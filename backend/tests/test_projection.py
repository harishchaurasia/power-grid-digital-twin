"""Tests for the hot-spot projection band.

The credibility requirement is that projections are ranges with a stated basis,
that the band is deterministic (no RNG), and that it widens with lead time --
present conditions are known, forecasts are not.
"""

from __future__ import annotations

import math

from sim.projection import (
    HOT_SPOT_LIMIT_C,
    Z_SCORE_95,
    forecast_sigma,
    project_hot_spot,
)
from sim.scenario import BASELINE_AMBIENT_C, BASELINE_LOAD_MVA, PEAK_LOAD_MVA, Simulation
from sim.transformer import CoolingStage, TransformerThermalModel


class _FixedSetpoint:
    def __init__(self, load_mva: float, ambient_c: float) -> None:
        self.load_mva = load_mva
        self.ambient_c = ambient_c


def _constant(load_mva: float, ambient_c: float):
    return lambda _lead: _FixedSetpoint(load_mva, ambient_c)


def test_forecast_sigma_is_zero_at_zero_lead() -> None:
    """Present conditions are known, so the band must be closed at t=0."""
    ambient_sigma, load_sigma = forecast_sigma(0.0)
    assert ambient_sigma == 0.0
    assert load_sigma == 0.0


def test_forecast_sigma_grows_with_lead_time() -> None:
    assert forecast_sigma(6.0)[0] > forecast_sigma(1.0)[0]
    assert forecast_sigma(6.0)[1] > forecast_sigma(1.0)[1]


def test_forecast_sigma_follows_sqrt_growth() -> None:
    """sigma(4t) == 2 * sigma(t) for the random-walk error-growth law."""
    base_ambient, base_load = forecast_sigma(1.5)
    quad_ambient, quad_load = forecast_sigma(6.0)
    assert math.isclose(quad_ambient, 2.0 * base_ambient)
    assert math.isclose(quad_load, 2.0 * base_load)


def test_band_brackets_the_expected_trajectory() -> None:
    model = TransformerThermalModel(ambient_c=BASELINE_AMBIENT_C, cooling_stage=CoolingStage.ONAN)
    projection = project_hot_spot(
        model, _constant(BASELINE_LOAD_MVA, BASELINE_AMBIENT_C), horizon_hours=6.0
    )
    for low, expected, high in zip(
        projection.ci95_low_c, projection.expected_c, projection.ci95_high_c
    ):
        assert low <= expected <= high


def test_band_widens_with_horizon() -> None:
    """Uncertainty must grow with lead time, not sit at a constant width."""
    model = TransformerThermalModel(ambient_c=BASELINE_AMBIENT_C, cooling_stage=CoolingStage.ONAN)
    projection = project_hot_spot(
        model, _constant(BASELINE_LOAD_MVA, BASELINE_AMBIENT_C), horizon_hours=6.0
    )
    first_width = projection.ci95_high_c[0] - projection.ci95_low_c[0]
    last_width = projection.ci95_high_c[-1] - projection.ci95_low_c[-1]
    assert last_width > first_width


def test_projection_is_deterministic() -> None:
    """Same twin state must give the identical band every time (no RNG)."""
    model = TransformerThermalModel(ambient_c=BASELINE_AMBIENT_C, cooling_stage=CoolingStage.ONAN)
    setpoint = _constant(PEAK_LOAD_MVA, BASELINE_AMBIENT_C)
    first = project_hot_spot(model, setpoint, horizon_hours=4.0)
    second = project_hot_spot(model, setpoint, horizon_hours=4.0)
    assert first.expected_c == second.expected_c
    assert first.ci95_low_c == second.ci95_low_c
    assert first.ci95_high_c == second.ci95_high_c


def test_projection_does_not_mutate_the_live_twin() -> None:
    """Projection runs on a clone; the authoritative twin must be untouched.

    A model that has had a hot projection run against it must remain bit-identical
    to a control that has not.
    """
    projected = TransformerThermalModel(
        ambient_c=BASELINE_AMBIENT_C, cooling_stage=CoolingStage.ONAN
    )
    control = TransformerThermalModel(
        ambient_c=BASELINE_AMBIENT_C, cooling_stage=CoolingStage.ONAN
    )
    for _ in range(50):
        projected.step(0.01, BASELINE_LOAD_MVA, BASELINE_AMBIENT_C)
        control.step(0.01, BASELINE_LOAD_MVA, BASELINE_AMBIENT_C)

    project_hot_spot(projected, _constant(PEAK_LOAD_MVA, 45.0), horizon_hours=8.0)

    after_projected = projected.step(0.01, BASELINE_LOAD_MVA, BASELINE_AMBIENT_C)
    after_control = control.step(0.01, BASELINE_LOAD_MVA, BASELINE_AMBIENT_C)
    assert after_projected.top_oil_c == after_control.top_oil_c
    assert after_projected.hotspot_c == after_control.hotspot_c
    assert (
        after_projected.cumulative_loss_of_life_hours
        == after_control.cumulative_loss_of_life_hours
    )


def test_hot_corner_reaches_the_limit_first() -> None:
    """The +z corner bounds the earliest crossing, the -z corner the latest."""
    model = TransformerThermalModel(ambient_c=42.0, cooling_stage=CoolingStage.ONAN)
    projection = project_hot_spot(
        model, _constant(1.45 * 150.0, 42.0), horizon_hours=12.0, dt_hours=0.02
    )
    window = projection.time_to_limit
    assert window.expected_hours is not None
    assert window.ci95_low_hours is not None
    assert window.ci95_low_hours <= window.expected_hours
    if window.ci95_high_hours is not None:
        assert window.expected_hours <= window.ci95_high_hours


def test_no_crossing_reports_none_rather_than_guessing() -> None:
    """A limit never reached in the horizon is unknown, not extrapolated."""
    model = TransformerThermalModel(ambient_c=BASELINE_AMBIENT_C, cooling_stage=CoolingStage.ONAN)
    projection = project_hot_spot(
        model, _constant(0.5 * 150.0, BASELINE_AMBIENT_C), horizon_hours=6.0
    )
    assert max(projection.ci95_high_c) < HOT_SPOT_LIMIT_C
    assert projection.time_to_limit.expected_hours is None
    assert projection.time_to_limit.ci95_high_hours is None


def test_simulation_projection_uses_scenario_setpoints() -> None:
    """After the heat wave triggers, the projection must be hotter than baseline."""
    sim = Simulation()
    baseline = sim.project(horizon_hours=6.0)
    sim.trigger_scenario()
    escalating = sim.project(horizon_hours=6.0)
    assert escalating.expected_c[-1] > baseline.expected_c[-1]


def test_z_score_is_the_two_sided_95_quantile() -> None:
    assert math.isclose(Z_SCORE_95, 1.959964, abs_tol=1e-5)


def test_already_breached_limit_reports_no_fake_precise_window() -> None:
    """Past the limit, report 'breached' -- not a degenerate 0.05 h CI.

    A window like "0.1 h (95% CI 0.1-0.1)" is exactly the fake-precise failure
    prediction docs/credibility-checklist.md rules out.
    """
    model = TransformerThermalModel(ambient_c=40.0, cooling_stage=CoolingStage.ONAN)
    for _ in range(int(20.0 / 0.02)):  # settle well above 120 degC
        model.step(0.02, 1.4 * 150.0, 40.0)
    assert model.step(0.0, 1.4 * 150.0, 40.0).hotspot_c > HOT_SPOT_LIMIT_C

    projection = project_hot_spot(model, _constant(1.4 * 150.0, 40.0), horizon_hours=6.0)
    window = projection.time_to_limit
    assert window.already_breached
    assert window.expected_hours is None
    assert window.ci95_low_hours is None
    assert window.ci95_high_hours is None


def test_pending_limit_is_not_flagged_as_breached() -> None:
    model = TransformerThermalModel(ambient_c=BASELINE_AMBIENT_C, cooling_stage=CoolingStage.ONAN)
    projection = project_hot_spot(
        model, _constant(BASELINE_LOAD_MVA, BASELINE_AMBIENT_C), horizon_hours=6.0
    )
    assert not projection.time_to_limit.already_breached
