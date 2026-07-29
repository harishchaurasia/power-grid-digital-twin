"""Validation tests for the transformer thermal + aging model vs IEEE C57.91.

These are a hard build gate (docs/credibility-checklist.md): the model output
must match the C57.91 equations and the 6 degC aging rule, and hot-spot must
show thermal inertia (no instantaneous jumps).
"""

from __future__ import annotations

import math

from sim.transformer import (
    HOTSPOT_REFERENCE_C,
    CoolingStage,
    TransformerThermalModel,
    aging_acceleration_factor,
    ultimate_hotspot_rise_over_top_oil_c,
    ultimate_top_oil_rise_c,
)

RATED_MVA_ONAN = 150.0
RATED_AMBIENT_C = 30.0


def test_faa_is_unity_at_reference_hotspot() -> None:
    """F_AA(110 degC) == 1.0 exactly (C57.91 Annex A normal-aging basis)."""
    assert aging_acceleration_factor(HOTSPOT_REFERENCE_C) == 1.0


def test_faa_matches_arrhenius_equation() -> None:
    """F_AA reproduces exp(15000/383 - 15000/(theta_H+273)) to machine precision."""
    for hotspot_c in (95.0, 110.0, 116.0, 122.0, 140.0):
        expected = math.exp(15000.0 / 383.0 - 15000.0 / (hotspot_c + 273.0))
        assert aging_acceleration_factor(hotspot_c) == expected


def test_six_degree_rule_doubling_temperature() -> None:
    """Aging doubles ~6-7 degC above the 110 degC reference (the '6 degC rule')."""
    # Solve F_AA == 2 for hot-spot; the exact Arrhenius form doubles at ~116.9 degC.
    doubling_hotspot = 15000.0 / (15000.0 / 383.0 - math.log(2.0)) - 273.0
    delta = doubling_hotspot - HOTSPOT_REFERENCE_C
    assert 6.5 < delta < 7.2
    assert math.isclose(aging_acceleration_factor(doubling_hotspot), 2.0, rel_tol=1e-9)


def test_faa_monotonic_increasing() -> None:
    temps = [90.0, 100.0, 110.0, 120.0, 130.0]
    faa = [aging_acceleration_factor(t) for t in temps]
    assert all(b > a for a, b in zip(faa, faa[1:]))


def test_rated_load_gives_reference_hotspot() -> None:
    """K=1 at 30 degC ambient -> 55 degC top-oil rise + 25 degC winding rise = 110 degC.

    This is the C57.91 normal-life design point: 30 degC ambient + 80 degC total
    rise = 110 degC hot-spot, F_AA = 1.0.
    """
    model = TransformerThermalModel(cooling_stage=CoolingStage.ONAN)
    state = model.steady_state(load_mva=RATED_MVA_ONAN, ambient_c=RATED_AMBIENT_C)
    assert math.isclose(state.load_ratio_k, 1.0)
    assert math.isclose(state.top_oil_c, RATED_AMBIENT_C + 55.0, abs_tol=1e-9)
    assert math.isclose(state.hotspot_c, HOTSPOT_REFERENCE_C, abs_tol=1e-9)
    assert math.isclose(state.aging_factor_faa, 1.0, abs_tol=1e-9)


def test_ultimate_rises_match_c57_91_formulas() -> None:
    # Top-oil: DELTA_TO,R * [(K^2 R + 1)/(R+1)]^n ; winding: DELTA_(H/TO),R * K^(2m).
    for k in (0.5, 0.8, 1.0, 1.2):
        top = ultimate_top_oil_rise_c(k, oil_exponent_n=0.8)
        expected_top = 55.0 * ((k**2 * 8.0 + 1.0) / 9.0) ** 0.8
        assert math.isclose(top, expected_top)
        win = ultimate_hotspot_rise_over_top_oil_c(k)
        assert math.isclose(win, 25.0 * k ** (2.0 * 0.8))


def test_overload_accelerates_aging() -> None:
    model = TransformerThermalModel(cooling_stage=CoolingStage.ONAN)
    overload = model.steady_state(load_mva=1.25 * RATED_MVA_ONAN, ambient_c=RATED_AMBIENT_C)
    assert overload.load_ratio_k > 1.0
    assert overload.hotspot_c > HOTSPOT_REFERENCE_C
    assert overload.aging_factor_faa > 1.0


def test_cooling_stage_relieves_hotspot() -> None:
    """Engaging a higher cooling stage lowers hot-spot for the same load (higher rated MVA)."""
    model = TransformerThermalModel()
    load = 190.0  # over ONAN rated (150), within OFAF rated (250)
    onan = model.steady_state(load, RATED_AMBIENT_C, cooling_stage=CoolingStage.ONAN)
    ofaf = model.steady_state(load, RATED_AMBIENT_C, cooling_stage=CoolingStage.OFAF)
    assert onan.load_ratio_k > 1.0
    assert ofaf.load_ratio_k < 1.0
    assert ofaf.hotspot_c < onan.hotspot_c


def test_hotspot_has_thermal_inertia_no_instant_jump() -> None:
    """A step to rated load must not move hot-spot instantly (tau_TO, tau_W)."""
    model = TransformerThermalModel(cooling_stage=CoolingStage.ONAN)  # starts at 30 degC
    first = model.step(dt_hours=0.001, load_mva=RATED_MVA_ONAN, ambient_c=RATED_AMBIENT_C)
    # After ~3.6 s the hot-spot is still near ambient, nowhere near its 110 degC ultimate.
    assert first.hotspot_c < 40.0


def test_integration_converges_to_steady_state() -> None:
    """Integrated Euler model relaxes to the analytic equilibrium under constant load."""
    model = TransformerThermalModel(cooling_stage=CoolingStage.ONAN)
    state = None
    steps = int(24.0 / 0.01)  # 24 h at dt = 0.01 h
    for _ in range(steps):
        state = model.step(dt_hours=0.01, load_mva=RATED_MVA_ONAN, ambient_c=RATED_AMBIENT_C)
    assert state is not None
    assert math.isclose(state.hotspot_c, HOTSPOT_REFERENCE_C, abs_tol=0.5)


def test_loss_of_life_accumulates_faster_under_overload() -> None:
    nominal = TransformerThermalModel(cooling_stage=CoolingStage.ONAN)
    overload = TransformerThermalModel(cooling_stage=CoolingStage.ONAN)
    for _ in range(int(6.0 / 0.01)):  # 6 h each
        nominal.step(0.01, RATED_MVA_ONAN, RATED_AMBIENT_C)
        overload.step(0.01, 1.3 * RATED_MVA_ONAN, RATED_AMBIENT_C)
    n_state = nominal.step(0.01, RATED_MVA_ONAN, RATED_AMBIENT_C)
    o_state = overload.step(0.01, 1.3 * RATED_MVA_ONAN, RATED_AMBIENT_C)
    assert o_state.cumulative_loss_of_life_hours > n_state.cumulative_loss_of_life_hours
