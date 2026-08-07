"""Behavioural tests for the heat-wave + load-spike scenario coupling."""

from __future__ import annotations

import pytest

from sim.scenario import BASELINE_LOAD_MVA, PEAK_AMBIENT_C, PEAK_LOAD_MVA, Simulation
from sim.scenarios import SCENARIO_LIBRARY
from sim.transformer import CoolingStage


def _run(sim: Simulation, sim_hours: float, dt: float = 0.01):
    snap = None
    for _ in range(int(sim_hours / dt)):
        snap = sim.tick(dt)
    assert snap is not None
    return snap


def test_baseline_is_nominal() -> None:
    sim = Simulation()
    snap = _run(sim, sim_hours=2.0)
    assert snap.transformer.node_load_mva == BASELINE_LOAD_MVA
    assert snap.transformer.loading_k < 1.0
    assert snap.transformer.status == "nominal"


def test_event_drives_hotspot_and_load_to_peak() -> None:
    sim = Simulation()
    _run(sim, sim_hours=1.0)
    sim.trigger_scenario()
    snap = _run(sim, sim_hours=6.0)
    # Load and ambient reach their coincident peak.
    assert abs(snap.transformer.node_load_mva - PEAK_LOAD_MVA) < 1.0
    assert abs(snap.ambient.air_temp_c - PEAK_AMBIENT_C) < 0.5
    # Peak overload pushes the transformer past its reference into an alarming band.
    assert snap.transformer.loading_k > 1.2
    assert snap.transformer.hot_spot_c > 110.0
    assert snap.transformer.aging_factor_faa > 1.0
    assert snap.transformer.status in ("warning", "critical")


def test_reset_restores_the_initial_cooling_stage() -> None:
    """An intervention must not survive a reset, or the demo cannot be re-run."""
    sim = Simulation(cooling_stage=CoolingStage.ONAN)
    _run(sim, 1.0)
    sim.trigger_scenario()
    sim.set_cooling_stage(CoolingStage.OFAF)
    _run(sim, 2.0)
    assert sim.cooling_stage is CoolingStage.OFAF

    sim.reset()
    snap = _run(sim, 0.5)
    assert sim.cooling_stage is CoolingStage.ONAN
    assert snap.transformer.cooling_stage is CoolingStage.ONAN
    assert snap.transformer.node_load_mva == BASELINE_LOAD_MVA
    assert snap.transformer.status == "nominal"


def test_reset_returns_to_the_baseline_thermal_state() -> None:
    sim = Simulation(cooling_stage=CoolingStage.ONAN)
    baseline = _run(sim, 1.0)
    sim.trigger_scenario()
    peak = _run(sim, 6.0)
    assert peak.transformer.hot_spot_c > baseline.transformer.hot_spot_c + 20.0

    sim.reset()
    after = _run(sim, 0.5)
    assert abs(after.transformer.hot_spot_c - baseline.transformer.hot_spot_c) < 1.0


def test_cooling_stage_relieves_peak_hotspot() -> None:
    onan = Simulation(cooling_stage=CoolingStage.ONAN)
    ofaf = Simulation(cooling_stage=CoolingStage.OFAF)
    for sim in (onan, ofaf):
        _run(sim, 1.0)
        sim.trigger_scenario()
    onan_snap = _run(onan, 6.0)
    ofaf_snap = _run(ofaf, 6.0)
    assert ofaf_snap.transformer.hot_spot_c < onan_snap.transformer.hot_spot_c
    assert ofaf_snap.transformer.loading_k < onan_snap.transformer.loading_k


def _advance(sim: Simulation, hours: float, dt: float = 0.02):
    """Distinct from `_run` above: starts from a snapshot (no forced first tick)
    and defaults to the finer step the new scenarios' short time constants need.
    Named separately so it does not shadow `_run`, which the pre-existing tests
    above call with a different signature (`sim_hours=`, default dt 0.01).
    """
    snap = sim.snapshot()
    for _ in range(int(hours / dt)):
        snap = sim.tick(dt)
    return snap


def test_feeder_pickup_steps_load_but_hot_spot_lags() -> None:
    """The thermal-inertia guard: instant telemetry is the #1 anti-pattern.

    docs/domain-transformer.md is explicit that hot-spot must not track load
    instantly. A step input is the clearest place to prove it does not.
    """
    sim = Simulation()
    before = sim.snapshot()
    sim.trigger_scenario("feeder_pickup_step")

    # One tick after the step: load has moved, hot-spot has barely begun to.
    after_one_tick = sim.tick(0.02)
    load_jump = after_one_tick.transformer.node_load_mva - before.transformer.node_load_mva
    hot_jump = after_one_tick.transformer.hot_spot_c - before.transformer.hot_spot_c
    assert load_jump > 10.0
    assert hot_jump < 2.0

    # Hours later it has climbed substantially -- the lag is a lag, not a cap.
    settled = _advance(sim, hours=4.0)
    assert settled.transformer.hot_spot_c > before.transformer.hot_spot_c + 5.0


def test_cooling_bank_failure_caps_the_stage() -> None:
    sim = Simulation(cooling_stage=CoolingStage.OFAF)
    sim.trigger_scenario("cooling_bank_failure")
    snap = sim.tick(0.02)

    assert snap.transformer.requested_cooling_stage is CoolingStage.OFAF
    assert snap.transformer.cooling_stage is CoolingStage.ONAN


def test_cooling_bank_failure_leaves_load_and_ambient_alone() -> None:
    """Its stress is lost capacity, not more load -- a different problem."""
    sim = Simulation()
    baseline = sim.snapshot()
    sim.trigger_scenario("cooling_bank_failure")
    snap = _advance(sim, hours=2.0)

    assert snap.transformer.node_load_mva == pytest.approx(
        baseline.transformer.node_load_mva, rel=1e-6
    )
    assert snap.ambient.air_temp_c == pytest.approx(baseline.ambient.air_temp_c, rel=1e-6)


def test_severity_scales_the_event() -> None:
    mild, harsh = Simulation(), Simulation()
    mild.trigger_scenario("feeder_pickup_step", severity=0.6)
    harsh.trigger_scenario("feeder_pickup_step", severity=1.4)

    mild_snap = _advance(mild, hours=2.0)
    harsh_snap = _advance(harsh, hours=2.0)
    assert harsh_snap.transformer.node_load_mva > mild_snap.transformer.node_load_mva


def test_snapshot_reports_the_active_scenario() -> None:
    sim = Simulation()
    assert sim.snapshot().scenario is None

    sim.trigger_scenario("heatwave_load_spike")
    scenario = sim.tick(0.02).scenario
    assert scenario is not None
    assert scenario.id == "heatwave_load_spike"
    assert scenario.label == SCENARIO_LIBRARY["heatwave_load_spike"].label


def test_reset_clears_the_active_scenario_and_the_cooling_cap() -> None:
    sim = Simulation(cooling_stage=CoolingStage.OFAF)
    sim.trigger_scenario("cooling_bank_failure")
    sim.tick(0.02)
    sim.reset()

    snap = sim.tick(0.02)
    assert snap.scenario is None
    assert snap.transformer.cooling_stage is CoolingStage.OFAF
