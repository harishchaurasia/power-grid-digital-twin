"""The scenario library: what can happen to this node, and how often.

Data only -- no RNG, no simulation. `sim/arrivals.py` turns these rates into a
seeded schedule; `sim/scenario.py` applies a spec to the C57.91 inputs.

Every scenario is expressible through the three inputs the thermal model
actually takes -- load, ambient, and available cooling capacity. Anything
needing BESS or line physics is out of scope until those models exist; a
scenario the twin cannot honestly simulate would be invented telemetry
(docs/credibility-checklist.md).

Rates are per operating year. Each is either a citation or begins with ASSUMED
and states its basis, matching agent/economics.py.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from sim.transformer import CoolingStage

ScenarioId = Literal["heatwave_load_spike", "cooling_bank_failure", "feeder_pickup_step"]

# --- Sourced rates ---------------------------------------------------------
#: EPA Climate Change Indicators: heat waves across 50 large US metro areas rose
#: from ~2/yr in the 1960s to ~6/yr in the 2020s (avg 4 days, 73-day season).
HEATWAVE_RATE_PER_YEAR: float = 6.0
HEATWAVE_RATE_SOURCE: str = (
    "EPA Climate Change Indicators: Heat Waves -- 50 large US metros, "
    "~6 heat waves/yr in the 2020s, up from ~2/yr in the 1960s"
)

#: CIGRE 642 (WG A2.37) transformer reliability survey: 964 major failures over
#: 167,459 transformer-years, 56 utilities, 21 countries. Substation transformer
#: failure rate 0.53%/yr; cooling systems are 9.7% of major failures.
CIGRE_SUBSTATION_FAILURE_RATE_PER_YEAR: float = 0.0053
CIGRE_COOLING_SHARE_OF_FAILURES: float = 0.097
COOLING_MAJOR_FAILURE_RATE_PER_YEAR: float = (
    CIGRE_SUBSTATION_FAILURE_RATE_PER_YEAR * CIGRE_COOLING_SHARE_OF_FAILURES
)
COOLING_MAJOR_FAILURE_SOURCE: str = (
    "CIGRE 642 / WG A2.37 transformer reliability survey: 0.53%/yr substation "
    "transformer failure rate, of which cooling systems are 9.7% of major failures"
)

#: A bank trip on a redundant cooling system is a maintenance event, not an
#: outage, so it is an order of magnitude more common than the CIGRE figure --
#: which counts only failures severe enough to be *major*. Kept separate on
#: purpose; see docs/superpowers/specs/2026-08-05-transformer-scenarios-design.md.
COOLING_NUISANCE_TRIP_RATE_PER_YEAR: float = 0.05

FEEDER_PICKUP_RATE_PER_YEAR: float = 1.5


class RampProfile(BaseModel):
    """Coincident smooth ramps in ambient and load (a heat wave with a peak)."""

    kind: Literal["ramp"] = "ramp"
    peak_load_mva: float
    load_ramp_hours: float
    peak_ambient_c: float
    ambient_ramp_hours: float


class StepProfile(BaseModel):
    """A load step held thereafter (an adjacent feeder's load picked up)."""

    kind: Literal["step"] = "step"
    load_step_mva: float
    #: Minutes, not hours: a breaker operation is effectively instantaneous
    #: against tau_TO. The point of this scenario is that hot-spot still lags.
    step_duration_hours: float = Field(default=0.05, gt=0.0)


class CoolingCapProfile(BaseModel):
    """Loss of cooling capacity: the highest attainable stage is capped."""

    kind: Literal["cooling_cap"] = "cooling_cap"
    max_available_stage: CoolingStage


ScenarioProfile = RampProfile | StepProfile | CoolingCapProfile


class ScenarioSpec(BaseModel):
    """One thing that can happen to this node, with how often it really happens."""

    id: ScenarioId
    label: str
    #: The physical mechanism, in an operator's words. Shown in the UI.
    mechanism: str
    profile: ScenarioProfile = Field(discriminator="kind")
    rate_per_year: float = Field(gt=0.0)
    rate_source: str
    #: Severity multiplier drawn per arrival, so repeats are not identical.
    severity_range: tuple[float, float] = (0.8, 1.2)
    #: Context only, never used to drive arrivals. See the cooling entry.
    major_failure_rate_per_year: float | None = None
    major_failure_rate_source: str = ""


SCENARIO_LIBRARY: dict[ScenarioId, ScenarioSpec] = {
    "heatwave_load_spike": ScenarioSpec(
        id="heatwave_load_spike",
        label="Heat wave + data-centre load spike",
        mechanism=(
            "Ambient rises, shrinking cooling headroom, while the data-centre "
            "peak raises loading. Hot-spot climbs super-linearly."
        ),
        profile=RampProfile(
            peak_load_mva=198.0,
            load_ramp_hours=3.0,
            peak_ambient_c=41.0,
            ambient_ramp_hours=4.0,
        ),
        rate_per_year=HEATWAVE_RATE_PER_YEAR,
        rate_source=HEATWAVE_RATE_SOURCE,
        severity_range=(0.85, 1.15),
    ),
    "cooling_bank_failure": ScenarioSpec(
        id="cooling_bank_failure",
        label="Cooling fan-bank failure",
        mechanism=(
            "A fan/pump bank trips, so the highest attainable cooling stage "
            "drops. Load is unchanged -- the ability to shed heat is not."
        ),
        profile=CoolingCapProfile(max_available_stage=CoolingStage.ONAN),
        rate_per_year=COOLING_NUISANCE_TRIP_RATE_PER_YEAR,
        rate_source=(
            "ASSUMED -- basis: a bank trip on a redundant cooling system is a "
            "maintenance event, not an outage, so it is an order of magnitude "
            "more common than the CIGRE major-failure rate. Order of magnitude only."
        ),
        # Severity is inert for a binary stage-cap event (a bank either trips or it
        # does not). Variety between repeats comes from Poisson arrival timing, not
        # severity. Kept at (1.0, 1.0) deliberately.
        severity_range=(1.0, 1.0),
        major_failure_rate_per_year=COOLING_MAJOR_FAILURE_RATE_PER_YEAR,
        major_failure_rate_source=COOLING_MAJOR_FAILURE_SOURCE,
    ),
    "feeder_pickup_step": ScenarioSpec(
        id="feeder_pickup_step",
        label="N-1: adjacent feeder pickup",
        mechanism=(
            "An adjacent feeder trips and this node picks up its load as a step. "
            "Hot-spot rises on the winding time constant while top-oil lags on tau_TO."
        ),
        profile=StepProfile(load_step_mva=35.0),
        rate_per_year=FEEDER_PICKUP_RATE_PER_YEAR,
        rate_source=(
            "ASSUMED -- basis: IEEE 493 per-circuit forced-outage tables are not "
            "publicly available, so no citable figure exists. Order of magnitude "
            "for a distribution feeder contingency affecting one substation."
        ),
        severity_range=(0.6, 1.4),
    ),
}


def library_entries() -> list[ScenarioSpec]:
    """The library in a stable order, for UI listing and parametrised tests."""
    return list(SCENARIO_LIBRARY.values())
