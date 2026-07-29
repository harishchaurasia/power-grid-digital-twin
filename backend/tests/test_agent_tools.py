"""Tests for the agent's tool surface, history and economics.

The credibility claim is that every number the agent states came from a tool.
That only holds if the tools themselves are correct, refuse bad input loudly,
and never mutate the twin they are reading.
"""

from __future__ import annotations

from agent import economics
from agent.tools import TwinTools, tool_schemas
from sim.scenario import Simulation
from sim.transformer import CoolingStage


def _hot_sim() -> Simulation:
    """A twin driven into the critical band by the scenario."""
    sim = Simulation()
    for _ in range(60):
        sim.tick(0.02)
    sim.trigger_scenario()
    for _ in range(220):
        sim.tick(0.02)
    return sim


# --- schemas ---------------------------------------------------------------


def test_every_tool_has_a_schema_and_description() -> None:
    schemas = tool_schemas()
    assert {s["name"] for s in schemas} == {
        "get_node_state",
        "query_history",
        "compute_limits",
        "simulate_forward",
    }
    for s in schemas:
        assert s["description"].strip()
        assert s["input_schema"]["type"] == "object"


# --- history ---------------------------------------------------------------


def test_history_measures_a_rising_trend() -> None:
    sim = _hot_sim()
    result = sim.history.query("hot_spot_c", window_hours=2.0)
    assert result.unit == "degC"
    assert result.summary.trend_per_hour > 0
    assert result.summary.max >= result.summary.latest > result.summary.min


def test_history_rejects_an_unknown_signal() -> None:
    """A typo must fail loudly, not return plausible-looking nothing."""
    sim = _hot_sim()
    try:
        sim.history.query("hotspot", window_hours=1.0)
    except KeyError as exc:
        assert "unknown signal" in str(exc)
    else:
        raise AssertionError("expected KeyError for an unknown signal")


def test_snapshot_does_not_pollute_history() -> None:
    """Reading state must not append to the series the agent then queries."""
    sim = _hot_sim()
    before = sim.history.sample_count
    for _ in range(5):
        sim.snapshot()
    assert sim.history.sample_count == before


# --- tools -----------------------------------------------------------------


def test_unknown_tool_returns_error_not_raise() -> None:
    tools = TwinTools(_hot_sim())
    assert "error" in tools.dispatch("no_such_tool", {})


def test_bad_arguments_return_error_not_raise() -> None:
    tools = TwinTools(_hot_sim())
    assert "error" in tools.dispatch("simulate_forward", {"cooling_stage": "TURBO"})
    assert "error" in tools.dispatch("query_history", {"signal": "nonsense"})


def test_get_node_state_reports_the_standard() -> None:
    state = TwinTools(_hot_sim()).get_node_state()
    assert state["transformer"]["model_standard"] == "IEEE C57.91"
    assert state["limits"]["hot_spot_critical_c"] == 120.0


def test_compute_limits_returns_a_range_not_a_point() -> None:
    limits = TwinTools(_hot_sim()).compute_limits(horizon_hours=6.0)
    window = limits["time_to_limit_hours"]
    assert set(window) == {"expected", "ci95", "already_breached"}
    assert len(window["ci95"]) == 2


def test_simulate_forward_does_not_mutate_the_live_twin() -> None:
    sim = _hot_sim()
    tools = TwinTools(sim)
    before = sim.snapshot().transformer
    tools.simulate_forward(cooling_stage="OFAF", horizon_hours=6.0)
    after = sim.snapshot().transformer
    assert after.hot_spot_c == before.hot_spot_c
    assert after.cooling_stage == before.cooling_stage


def test_forced_cooling_lowers_peak_hot_spot() -> None:
    """The physical claim the agent's recommendation rests on."""
    tools = TwinTools(_hot_sim())
    onan = tools.simulate_forward(cooling_stage="ONAN", horizon_hours=6.0)
    ofaf = tools.simulate_forward(cooling_stage="OFAF", horizon_hours=6.0)
    assert ofaf["peak_hot_spot_c"] < onan["peak_hot_spot_c"]
    assert ofaf["economics"]["equivalent_life_consumed_hours"] < (
        onan["economics"]["equivalent_life_consumed_hours"]
    )


def test_shedding_load_reduces_served_energy() -> None:
    """Curtailment must be a real quantity, not a label."""
    tools = TwinTools(_hot_sim())
    full = tools.simulate_forward(cooling_stage="ONAF", load_action="serve_full", horizon_hours=6.0)
    shed = tools.simulate_forward(
        cooling_stage="ONAF", load_action="shed_noncritical", horizon_hours=6.0
    )
    assert shed["economics"]["served_mwh"] < full["economics"]["served_mwh"]
    assert shed["economics"]["unserved_mwh"] > 0.0
    assert shed["economics"]["curtailment_cost_usd"] > 0.0


def test_horizon_is_clamped_to_the_declared_range() -> None:
    tools = TwinTools(_hot_sim())
    assert tools.compute_limits(horizon_hours=999.0)["horizon_hours"] == 24.0
    assert tools.compute_limits(horizon_hours=0.0)["horizon_hours"] == 1.0


# --- economics -------------------------------------------------------------


def test_life_cost_derives_from_replacement_over_normal_life() -> None:
    expected = economics.LPT_REPLACEMENT_USD / 180_000.0
    assert abs(economics.LIFE_COST_USD_PER_EQUIVALENT_HOUR - expected) < 1e-9


def test_failure_hazard_rises_with_hot_spot() -> None:
    assert economics.failure_hazard_per_hour(150.0) > economics.failure_hazard_per_hour(120.0)
    assert economics.failure_hazard_per_hour(120.0) > economics.failure_hazard_per_hour(95.0)


def test_hotter_plan_consumes_more_life_and_costs_more() -> None:
    hot = economics.evaluate([150.0] * 20, [198.0] * 20, [198.0] * 20, "ONAN", 0.05)
    cool = economics.evaluate([100.0] * 20, [198.0] * 20, [198.0] * 20, "OFAF", 0.05)
    assert hot.equivalent_life_consumed_hours > cool.equivalent_life_consumed_hours
    assert hot.transformer_life_cost_usd > cool.transformer_life_cost_usd
    assert hot.failure_risk_cost_usd > cool.failure_risk_cost_usd
    assert cool.net_value_usd > hot.net_value_usd


def test_cooling_stage_carries_an_auxiliary_cost() -> None:
    """OFAF is not free: fans and pumps draw power and wear."""
    onan = economics.evaluate([95.0] * 10, [150.0] * 10, [150.0] * 10, "ONAN", 0.05)
    ofaf = economics.evaluate([95.0] * 10, [150.0] * 10, [150.0] * 10, "OFAF", 0.05)
    assert onan.cooling_cost_usd == 0.0
    assert ofaf.cooling_cost_usd > 0.0


def test_stage_ordering_matches_the_rated_capacities() -> None:
    assert CoolingStage.ONAN.value in economics.COOLING_AUX_LOAD_MW
    assert (
        economics.COOLING_AUX_LOAD_MW["OFAF"] > economics.COOLING_AUX_LOAD_MW["ONAF"] > 0.0
    )
