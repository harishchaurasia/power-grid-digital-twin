"""Behavioural tests for the heat-wave + load-spike scenario coupling."""

from __future__ import annotations

from sim.scenario import BASELINE_LOAD_MVA, PEAK_AMBIENT_C, PEAK_LOAD_MVA, Simulation
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
