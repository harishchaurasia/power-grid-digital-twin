"""Scenario driver: applies a library spec to the C57.91 model's inputs.

Baseline until triggered, then the active `ScenarioSpec` (sim/scenarios.py)
drives load, ambient, and/or cooling capacity toward its setpoints. The
heat-wave + load-spike arc is one library entry now, not the only one this
module can apply (docs/domain-transformer.md, "Coupling to the scenario").
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

from sim.history import TwinHistory
from sim.projection import (
    DEFAULT_PROJECTION_DT_HOURS,
    HotSpotProjection,
    project_hot_spot,
)
from sim.scenarios import SCENARIO_LIBRARY, ScenarioId, ScenarioSpec
from sim.state import (
    ActiveScenario,
    AmbientConditions,
    TransformerSnapshot,
    TwinSnapshot,
    transformer_status,
)
from sim.transformer import CoolingStage, TransformerState, TransformerThermalModel

# The node's normal operating point absent any scenario (owned here, not by any one scenario).
BASELINE_LOAD_MVA: float = 135.0
BASELINE_AMBIENT_C: float = 28.0

# Re-exported from SCENARIO_LIBRARY (single source of truth) rather than
# duplicated as literals, since other modules still import these names here.
_heatwave_profile = SCENARIO_LIBRARY["heatwave_load_spike"].profile
if _heatwave_profile.kind != "ramp":
    raise AssertionError("heatwave_load_spike must have a ramp profile")
PEAK_LOAD_MVA: float = _heatwave_profile.peak_load_mva
PEAK_AMBIENT_C: float = _heatwave_profile.peak_ambient_c

DEFAULT_TWINNING_RATE_HZ: float = 10.0


def _smoothstep(t: float) -> float:
    """Smooth 0->1 ease over t in [0,1] (a load/weather ramp is not a step)."""
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


@dataclass
class ScenarioSetpoint:
    load_mva: float
    ambient_c: float


@dataclass
class PlanResult:
    """Trajectories from a what-if plan, fed straight into agent/economics."""

    hot_spot_c: list[float] = field(default_factory=list)
    loading_k: list[float] = field(default_factory=list)
    served_mva: list[float] = field(default_factory=list)
    offered_mva: list[float] = field(default_factory=list)


class Scenario:
    """Produces (load, ambient, cooling cap) as a function of elapsed sim time.

    Spec and severity come from the caller -- manually here, or from a random
    shift in `sim/arrivals.py` -- so this class stays free of randomness.
    """

    def __init__(self) -> None:
        self._spec: ScenarioSpec | None = None
        self._severity: float = 1.0
        self._trigger_time_hours: float | None = None

    @property
    def triggered(self) -> bool:
        return self._spec is not None

    @property
    def active_spec(self) -> ScenarioSpec | None:
        return self._spec

    @property
    def cooling_cap(self) -> CoolingStage | None:
        """The cap this scenario imposes, or None if it does not touch cooling."""
        if self._spec is None or self._spec.profile.kind != "cooling_cap":
            return None
        return self._spec.profile.max_available_stage

    def trigger(
        self,
        at_sim_hours: float,
        spec: ScenarioSpec,
        severity: float = 1.0,
    ) -> None:
        if self._spec is None:
            self._spec = spec
            self._severity = severity
            self._trigger_time_hours = at_sim_hours

    def reset(self) -> None:
        self._spec = None
        self._severity = 1.0
        self._trigger_time_hours = None

    def setpoint(self, sim_hours: float) -> ScenarioSetpoint:
        baseline = ScenarioSetpoint(load_mva=BASELINE_LOAD_MVA, ambient_c=BASELINE_AMBIENT_C)
        if self._spec is None or self._trigger_time_hours is None:
            return baseline

        elapsed = sim_hours - self._trigger_time_hours
        profile = self._spec.profile

        if profile.kind == "ramp":
            load_delta = (profile.peak_load_mva - BASELINE_LOAD_MVA) * self._severity
            ambient_delta = (profile.peak_ambient_c - BASELINE_AMBIENT_C) * self._severity
            return ScenarioSetpoint(
                load_mva=BASELINE_LOAD_MVA
                + load_delta * _smoothstep(elapsed / profile.load_ramp_hours),
                ambient_c=BASELINE_AMBIENT_C
                + ambient_delta * _smoothstep(elapsed / profile.ambient_ramp_hours),
            )

        if profile.kind == "step":
            # Ramped over minutes, not a true discontinuity: a breaker op is
            # fast against tau_TO, but the lag the test asserts is physics, not
            # smoothing of the input.
            fraction = _smoothstep(elapsed / profile.step_duration_hours)
            return ScenarioSetpoint(
                load_mva=BASELINE_LOAD_MVA + profile.load_step_mva * self._severity * fraction,
                ambient_c=BASELINE_AMBIENT_C,
            )

        # cooling_cap: the stress is lost capacity, so the inputs stay at baseline.
        return baseline


class Simulation:
    """Owns the authoritative transformer twin and advances it under the scenario.

    Sim time is decoupled from wall-clock: a multi-hour event demos in minutes.
    """

    def __init__(
        self,
        cooling_stage: CoolingStage = CoolingStage.ONAN,
        twinning_rate_hz: float = DEFAULT_TWINNING_RATE_HZ,
    ) -> None:
        self._initial_cooling_stage = cooling_stage
        self._transformer = TransformerThermalModel(
            ambient_c=BASELINE_AMBIENT_C, cooling_stage=cooling_stage
        )
        self._scenario = Scenario()
        self._history = TwinHistory()
        self._sim_hours = 0.0
        self._twinning_rate_hz = twinning_rate_hz
        # Warm the thermal state to the baseline equilibrium so t=0 is not a cold start.
        self._prime_baseline()

    def _prime_baseline(self) -> None:
        for _ in range(400):
            self._transformer.step(
                dt_hours=0.05,
                load_mva=BASELINE_LOAD_MVA,
                ambient_c=BASELINE_AMBIENT_C,
            )

    @property
    def history(self) -> TwinHistory:
        """Recorded twin state, backing the agent's query_history tool."""
        return self._history

    @property
    def cooling_stage(self) -> CoolingStage:
        return self._transformer.cooling_stage

    def trigger_scenario(
        self,
        scenario_id: ScenarioId = "heatwave_load_spike",
        severity: float = 1.0,
    ) -> None:
        spec = SCENARIO_LIBRARY[scenario_id]
        self._scenario.trigger(self._sim_hours, spec, severity)
        self._apply_cooling_cap()

    def _apply_cooling_cap(self) -> None:
        cap = self._scenario.cooling_cap
        self._transformer.max_available_stage = cap if cap is not None else CoolingStage.OFAF

    def reset(self) -> None:
        """Return the twin to its starting condition, cooling stage included.

        Interventions must not survive a reset: a demo that keeps OFAF engaged
        from a previous run cannot be shown a second time from baseline.
        """
        self._scenario.reset()
        self._transformer = TransformerThermalModel(
            ambient_c=BASELINE_AMBIENT_C, cooling_stage=self._initial_cooling_stage
        )
        self._sim_hours = 0.0
        self._history.clear()
        self._prime_baseline()
        self._apply_cooling_cap()

    def set_cooling_stage(self, stage: CoolingStage) -> None:
        self._transformer.cooling_stage = stage

    def project(
        self,
        horizon_hours: float,
        dt_hours: float = DEFAULT_PROJECTION_DT_HOURS,
    ) -> HotSpotProjection:
        """Project hot-spot forward from current twin state under the live scenario.

        Runs on a clone, so the authoritative twin is untouched.
        """
        start_hours = self._sim_hours
        return project_hot_spot(
            transformer=self._transformer,
            setpoint_at=lambda lead: self._scenario.setpoint(start_hours + lead),
            horizon_hours=horizon_hours,
            dt_hours=dt_hours,
        )

    def simulate_plan(
        self,
        cooling_stage: CoolingStage,
        shed_fraction: float,
        horizon_hours: float,
        dt_hours: float,
    ) -> PlanResult:
        """Run a what-if plan forward on a clone; the live twin is untouched.

        `shed_fraction` is the portion of offered load not served, which is what
        makes curtailment cost a real quantity rather than a label -- the plan
        that sheds load serves fewer MWh and the economics reflect it.
        """
        model = self._transformer.clone()
        model.cooling_stage = cooling_stage
        result = PlanResult()
        steps = max(1, int(round(horizon_hours / dt_hours)))

        for step in range(1, steps + 1):
            sp = self._scenario.setpoint(self._sim_hours + step * dt_hours)
            served = sp.load_mva * (1.0 - shed_fraction)
            state = model.step(dt_hours=dt_hours, load_mva=served, ambient_c=sp.ambient_c)
            result.hot_spot_c.append(state.hotspot_c)
            result.loading_k.append(state.load_ratio_k)
            result.served_mva.append(served)
            result.offered_mva.append(sp.load_mva)

        return result

    def snapshot(self) -> TwinSnapshot:
        """Current twin state without advancing time.

        Distinct from `tick(0.0)`: a read must not append to history, or an agent
        polling state would pollute the very series it is about to query.
        """
        sp = self._scenario.setpoint(self._sim_hours)
        state = self._transformer.steady_state_of_record(load_mva=sp.load_mva)
        return self._build_snapshot(sp, state)

    def tick(self, dt_hours: float) -> TwinSnapshot:
        self._sim_hours += dt_hours
        sp = self._scenario.setpoint(self._sim_hours)
        state = self._transformer.step(
            dt_hours=dt_hours, load_mva=sp.load_mva, ambient_c=sp.ambient_c
        )
        snapshot = self._build_snapshot(sp, state)
        self._history.record(snapshot)
        return snapshot

    def _build_snapshot(self, sp: ScenarioSetpoint, state: TransformerState) -> TwinSnapshot:
        transformer_snapshot = TransformerSnapshot(
            node_load_mva=sp.load_mva,
            loading_k=state.load_ratio_k,
            top_oil_c=state.top_oil_c,
            hot_spot_c=state.hotspot_c,
            aging_factor_faa=state.aging_factor_faa,
            cooling_stage=state.cooling_stage,
            requested_cooling_stage=self._transformer.cooling_stage,
            cumulative_loss_of_life_hours=state.cumulative_loss_of_life_hours,
            status=transformer_status(state.hotspot_c, state.aging_factor_faa),
        )
        spec = self._scenario.active_spec
        return TwinSnapshot(
            sim_time_hours=self._sim_hours,
            timestamp_ms=int(time.time() * 1000),
            twinning_rate_hz=self._twinning_rate_hz,
            ambient=AmbientConditions(air_temp_c=sp.ambient_c),
            transformer=transformer_snapshot,
            scenario=None
            if spec is None
            else ActiveScenario(id=spec.id, label=spec.label, mechanism=spec.mechanism),
        )
