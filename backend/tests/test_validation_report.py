"""Tests for the V&V report the console's validation view renders.

The report itself is a credibility artifact, so it has to be correct: the
integrator must track the closed-form C57.91 solution, the rated design point
must land on the standard's 110 degC basis, and the 6 degC rule must be shown
as the approximation it is.
"""

from __future__ import annotations

import math

from sim.transformer import HOTSPOT_REFERENCE_C, CoolingStage
from sim.validation import (
    LOAD_RATIO_SWEEP,
    six_degree_rule_faa,
    transformer_validation_report,
)

# Euler integration to equilibrium should track the closed form to well under a degree.
MAX_ACCEPTABLE_RESIDUAL_C = 0.5


def test_integrator_tracks_the_closed_form_solution() -> None:
    report = transformer_validation_report(CoolingStage.ONAN)
    assert report.thermal_max_abs_residual_c < MAX_ACCEPTABLE_RESIDUAL_C
    for point in report.thermal_verification:
        assert abs(point.residual_c) < MAX_ACCEPTABLE_RESIDUAL_C


def test_thermal_sweep_covers_the_documented_load_range() -> None:
    report = transformer_validation_report(CoolingStage.ONAN)
    assert [p.loading_k for p in report.thermal_verification] == list(LOAD_RATIO_SWEEP)


def test_hot_spot_rises_monotonically_with_load() -> None:
    report = transformer_validation_report(CoolingStage.ONAN)
    temps = [p.model_hot_spot_c for p in report.thermal_verification]
    assert all(b > a for a, b in zip(temps, temps[1:]))


def test_design_point_lands_on_the_c57_91_normal_life_basis() -> None:
    """K=1 at 30 degC ambient must give 110 degC hot-spot and F_AA = 1."""
    report = transformer_validation_report(CoolingStage.ONAN)
    design = report.design_point
    assert design.passes
    assert math.isclose(design.model_hot_spot_c, HOTSPOT_REFERENCE_C, abs_tol=0.5)
    assert math.isclose(design.model_faa, 1.0, abs_tol=0.05)


def test_six_degree_rule_is_unity_at_the_reference() -> None:
    assert six_degree_rule_faa(HOTSPOT_REFERENCE_C) == 1.0
    assert six_degree_rule_faa(HOTSPOT_REFERENCE_C + 6.0) == 2.0


def test_arrhenius_and_rule_of_thumb_agree_near_the_reference() -> None:
    """The 6 degC rule is a good approximation close to 110 degC."""
    report = transformer_validation_report(CoolingStage.ONAN)
    near = [p for p in report.aging_validation if abs(p.hot_spot_c - HOTSPOT_REFERENCE_C) <= 5.0]
    assert near
    for point in near:
        assert abs(point.residual) < 0.15


def test_rule_of_thumb_diverges_at_high_hot_spot() -> None:
    """Far above the reference the approximation overstates aging -- show it."""
    report = transformer_validation_report(CoolingStage.ONAN)
    hottest = max(report.aging_validation, key=lambda p: p.hot_spot_c)
    assert hottest.six_degree_rule_faa > hottest.model_faa
    assert abs(hottest.residual) > 1.0


def test_report_names_its_references() -> None:
    report = transformer_validation_report(CoolingStage.ONAN)
    assert "C57.91" in report.thermal_reference
    assert "C57.91" in report.aging_reference


def test_report_is_stable_across_calls() -> None:
    first = transformer_validation_report(CoolingStage.ONAN)
    second = transformer_validation_report(CoolingStage.ONAN)
    assert first == second
