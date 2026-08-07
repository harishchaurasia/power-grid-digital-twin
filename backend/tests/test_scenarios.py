"""The library is the demo's credibility surface: every rate must be traceable."""

from __future__ import annotations

import pytest

from sim.scenarios import SCENARIO_LIBRARY, ScenarioSpec, library_entries
from sim.transformer import CoolingStage


def test_library_has_the_three_designed_scenarios() -> None:
    assert set(SCENARIO_LIBRARY) == {
        "heatwave_load_spike",
        "cooling_bank_failure",
        "feeder_pickup_step",
    }


@pytest.mark.parametrize("spec", library_entries(), ids=lambda s: s.id)
def test_every_rate_is_traceable(spec: ScenarioSpec) -> None:
    """A rate with no provenance is exactly the number a prospect will challenge."""
    assert spec.rate_per_year > 0.0
    assert spec.rate_source.startswith("ASSUMED") or len(spec.rate_source) > 20
    if not spec.rate_source.startswith("ASSUMED"):
        # A citation names a document, not a vibe.
        assert any(token in spec.rate_source for token in ("CIGRE", "EPA", "IEEE", "NERC"))
    else:
        assert "basis:" in spec.rate_source


@pytest.mark.parametrize("spec", library_entries(), ids=lambda s: s.id)
def test_every_scenario_is_labelled_for_an_operator(spec: ScenarioSpec) -> None:
    assert spec.label
    assert spec.mechanism


def test_cooling_rates_are_kept_separate() -> None:
    """CIGRE's 9.7% is 9.7% of MAJOR failures -- not the rate a fan bank trips.

    Merging them would use a citation to dignify a number it does not support.
    """
    spec = SCENARIO_LIBRARY["cooling_bank_failure"]
    assert spec.major_failure_rate_per_year is not None
    assert spec.major_failure_rate_per_year == pytest.approx(0.0053 * 0.097, rel=1e-3)
    assert "CIGRE" in spec.major_failure_rate_source
    # The simulated event is the nuisance trip, which is far more common.
    assert spec.rate_per_year > spec.major_failure_rate_per_year * 10
    assert spec.rate_source.startswith("ASSUMED")


def test_cooling_scenario_caps_the_stage_rather_than_fudging_capacity() -> None:
    spec = SCENARIO_LIBRARY["cooling_bank_failure"]
    assert spec.profile.kind == "cooling_cap"
    assert spec.profile.max_available_stage is CoolingStage.ONAN


def test_severity_ranges_are_ordered() -> None:
    for spec in library_entries():
        low, high = spec.severity_range
        assert low < high
