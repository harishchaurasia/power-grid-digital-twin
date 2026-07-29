"""Agent tools: the only route from the model to twin state.

Every tool returns structured values read or computed from the authoritative
Python twin. None of them accepts a number *from* the model and echoes it back,
which is what makes "every quantitative claim traces to a tool call" enforceable
rather than aspirational (docs/CLAUDE.md hard rule 3).

Schemas are declared once, in the JSON-Schema shape both the Anthropic and
OpenAI tool APIs accept, so adding a provider does not mean restating the tools.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from agent import economics
from sim.projection import DEFAULT_PROJECTION_DT_HOURS
from sim.scenario import Simulation
from sim.transformer import COOLING_STAGE_PARAMS, CoolingStage
from sim.history import AMBIENT_SIGNALS, TRANSFORMER_SIGNALS

MIN_HORIZON_HOURS = 1.0
MAX_HORIZON_HOURS = 24.0
DEFAULT_HORIZON_HOURS = 6.0

#: Interventions the Phase 1 (transformer-only) agent may evaluate.
COOLING_PLANS = ("ONAN", "ONAF", "OFAF")
LOAD_ACTIONS = ("serve_full", "shed_noncritical")


class ToolError(BaseModel):
    error: str


def tool_schemas() -> list[dict[str, Any]]:
    """JSON-Schema definitions for every tool, provider-neutral."""
    signals = sorted({**TRANSFORMER_SIGNALS, **AMBIENT_SIGNALS})
    return [
        {
            "name": "get_node_state",
            "description": (
                "Current twin state for the substation node: transformer thermal "
                "state (IEEE C57.91), loading, insulation aging, cooling stage, and "
                "ambient conditions. Call this first."
            ),
            "input_schema": {"type": "object", "properties": {}, "required": []},
        },
        {
            "name": "query_history",
            "description": (
                "Recorded time series of one signal, with min/max/mean and a "
                "measured trend per hour. Use to establish whether a signal is "
                "rising and how fast."
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "signal": {"type": "string", "enum": signals},
                    "window_hours": {"type": "number", "minimum": 0.1, "maximum": 24.0},
                },
                "required": ["signal"],
            },
        },
        {
            "name": "compute_limits",
            "description": (
                "Project hot-spot forward under current conditions with no "
                "intervention. Returns the trajectory, a 95% confidence band from "
                "weather and load forecast uncertainty, and time-to-120C as a range."
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "horizon_hours": {
                        "type": "number",
                        "minimum": MIN_HORIZON_HOURS,
                        "maximum": MAX_HORIZON_HOURS,
                    }
                },
                "required": [],
            },
        },
        {
            "name": "simulate_forward",
            "description": (
                "Run the twin forward under an intervention plan and cost it. "
                "Returns peak hot-spot, life consumed, any limit breach, and a full "
                "economic breakdown. Call once per option you are comparing."
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "cooling_stage": {"type": "string", "enum": list(COOLING_PLANS)},
                    "load_action": {"type": "string", "enum": list(LOAD_ACTIONS)},
                    "horizon_hours": {
                        "type": "number",
                        "minimum": MIN_HORIZON_HOURS,
                        "maximum": MAX_HORIZON_HOURS,
                    },
                },
                "required": ["cooling_stage"],
            },
        },
    ]


class TwinTools:
    """Tool implementations bound to one Simulation."""

    def __init__(self, sim: Simulation) -> None:
        self._sim = sim

    def dispatch(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Route a tool call. Unknown tools and bad arguments return an error
        object rather than raising, so the model can correct itself in-loop."""
        try:
            match name:
                case "get_node_state":
                    return self.get_node_state()
                case "query_history":
                    return self.query_history(**arguments)
                case "compute_limits":
                    return self.compute_limits(**arguments)
                case "simulate_forward":
                    return self.simulate_forward(**arguments)
                case _:
                    return ToolError(error=f"unknown tool {name!r}").model_dump()
        except (KeyError, LookupError, TypeError, ValueError) as exc:
            return ToolError(error=f"{type(exc).__name__}: {exc}").model_dump()

    def get_node_state(self) -> dict[str, Any]:
        snapshot = self._sim.snapshot()
        t = snapshot.transformer
        stage = COOLING_STAGE_PARAMS[CoolingStage(t.cooling_stage)]
        return {
            "sim_time_hours": round(snapshot.sim_time_hours, 3),
            "twinning_rate_hz": snapshot.twinning_rate_hz,
            "transformer": {
                "hot_spot_c": round(t.hot_spot_c, 2),
                "top_oil_c": round(t.top_oil_c, 2),
                "loading_k": round(t.loading_k, 3),
                "node_load_mva": round(t.node_load_mva, 2),
                "rated_mva_at_stage": stage.rated_mva,
                "aging_factor_faa": round(t.aging_factor_faa, 3),
                "cumulative_loss_of_life_hours": round(t.cumulative_loss_of_life_hours, 3),
                "cooling_stage": t.cooling_stage,
                "status": t.status,
                "model_standard": t.model_standard,
            },
            "ambient": {"air_temp_c": round(snapshot.ambient.air_temp_c, 2)},
            "limits": {
                "hot_spot_warning_c": 105.0,
                "hot_spot_critical_c": 120.0,
                "reference_hot_spot_c": 110.0,
            },
        }

    def query_history(self, signal: str, window_hours: float = 2.0) -> dict[str, Any]:
        result = self._sim.history.query(signal=signal, window_hours=window_hours)
        # Samples are dropped from the tool payload: the summary is what the
        # agent reasons over, and a few hundred raw pairs would crowd context
        # without adding anything it can use.
        return result.model_dump(exclude={"samples"})

    def compute_limits(self, horizon_hours: float = DEFAULT_HORIZON_HOURS) -> dict[str, Any]:
        horizon = _clamp_horizon(horizon_hours)
        projection = self._sim.project(horizon_hours=horizon)
        window = projection.time_to_limit
        return {
            "horizon_hours": horizon,
            "limit_c": projection.limit_c,
            "hot_spot_now_c": round(projection.expected_c[0], 2),
            "hot_spot_at_horizon_c": round(projection.expected_c[-1], 2),
            "hot_spot_at_horizon_ci95_c": [
                round(projection.ci95_low_c[-1], 2),
                round(projection.ci95_high_c[-1], 2),
            ],
            "time_to_limit_hours": {
                "expected": window.expected_hours,
                "ci95": [window.ci95_low_hours, window.ci95_high_hours],
                "already_breached": window.already_breached,
            },
            "model_standard": projection.model_standard,
            "uncertainty_basis": projection.uncertainty_basis,
        }

    def simulate_forward(
        self,
        cooling_stage: str,
        load_action: str = "serve_full",
        horizon_hours: float = DEFAULT_HORIZON_HOURS,
    ) -> dict[str, Any]:
        if cooling_stage not in COOLING_PLANS:
            raise ValueError(f"cooling_stage must be one of {COOLING_PLANS}")
        if load_action not in LOAD_ACTIONS:
            raise ValueError(f"load_action must be one of {LOAD_ACTIONS}")

        horizon = _clamp_horizon(horizon_hours)
        result = self._sim.simulate_plan(
            cooling_stage=CoolingStage(cooling_stage),
            shed_fraction=(
                economics.SHEDDABLE_LOAD_FRACTION if load_action == "shed_noncritical" else 0.0
            ),
            horizon_hours=horizon,
            dt_hours=DEFAULT_PROJECTION_DT_HOURS,
        )
        costed = economics.evaluate(
            hot_spot_trajectory_c=result.hot_spot_c,
            served_mva_trajectory=result.served_mva,
            offered_mva_trajectory=result.offered_mva,
            cooling_stage=cooling_stage,
            dt_hours=DEFAULT_PROJECTION_DT_HOURS,
        )
        return {
            "plan": {
                "cooling_stage": cooling_stage,
                "load_action": load_action,
                "horizon_hours": horizon,
            },
            "peak_hot_spot_c": round(max(result.hot_spot_c), 2),
            "final_hot_spot_c": round(result.hot_spot_c[-1], 2),
            "peak_loading_k": round(max(result.loading_k), 3),
            "breaches_120c": max(result.hot_spot_c) >= 120.0,
            "hours_above_120c": round(
                sum(1 for v in result.hot_spot_c if v >= 120.0) * DEFAULT_PROJECTION_DT_HOURS, 2
            ),
            "economics": costed.model_dump(),
        }


def _clamp_horizon(hours: float) -> float:
    return max(MIN_HORIZON_HOURS, min(MAX_HORIZON_HOURS, float(hours)))
