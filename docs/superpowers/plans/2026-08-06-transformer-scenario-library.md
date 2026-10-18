# Transformer Scenario Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single hard-coded heat-wave event with a named library of three sourced scenarios, deliberately triggerable, plus a seeded random-shift mode whose arrivals come from real-world rates.

**Architecture:** `sim/scenarios.py` holds the library as pure data (no RNG, no simulation). `sim/arrivals.py` owns the only `random.Random` in the sim and turns rates into a seeded arrival schedule. `sim/scenario.py` becomes a driver that applies whichever spec is active to the C57.91 model's three inputs — load, ambient, and an available-cooling cap. Splitting data from randomness from physics lets each be tested without the others.

**Tech Stack:** Python 3.12, Pydantic v2, pytest; React 19 + TypeScript strict, Vitest, Playwright.

## Global Constraints

- Python type hints on every public function; Pydantic v2 for all contracts. No dict-shaped payloads.
- One responsibility per module. Modules under 300 lines, functions under 50 lines.
- No magic numbers. Named constants at module top; **physical constants cite their source standard**.
- Comments explain non-obvious *why* only. Names carry the *what*.
- `structlog`, never `print`.
- Every scenario rate is either a citation or begins with `ASSUMED` and states its basis — the pattern `agent/economics.py` already uses.
- **Randomness selects which event occurs and when. It never perturbs a telemetry signal.** Every telemetry value stays a C57.91 output. `random.gauss`-as-signal is an explicit anti-tell in `docs/credibility-checklist.md`.
- Exactly one `random.Random` instance in the sim, seeded explicitly, living in `sim/arrivals.py`.
- TypeScript strict with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`; no `any` without a justifying comment.
- No new dependencies without asking. Nothing in this plan needs one.
- Verification: `make test`, `make lint`, `make typecheck` from the repo root; `npm run test:e2e` from `console/`.

## File Structure

| File | Responsibility |
|---|---|
| `backend/sim/scenarios.py` (create) | The library: `ScenarioSpec` entries with profiles, rates, sources. Data only. |
| `backend/sim/arrivals.py` (create) | Seeded Poisson arrival + severity draw. The sim's only RNG. |
| `backend/sim/transformer.py` (modify) | `max_available_stage` cap + `effective_cooling_stage`. |
| `backend/sim/scenario.py` (modify) | Generalised driver applying any `ScenarioSpec`. |
| `backend/sim/state.py` (modify) | `TwinSnapshot.scenario`, `TransformerSnapshot.requested_cooling_stage`. |
| `backend/api/schemas.py`, `ws_console.py` (modify) | Scenario id + random-shift wire messages. |
| `docs/architecture.md` (modify) | The documented `ClientMessage` union. **Approved explicitly in brainstorming.** |
| `console/lib/types.ts`, `components/ScenarioControls.tsx` (modify) | Library panel, seed display, requested-vs-effective stage. |
| `RESEARCH-LOG.md` (modify) | Entry recording the work. |

---

### Task 1: The scenario library as data

**Files:**
- Create: `backend/sim/scenarios.py`
- Test: `backend/tests/test_scenarios.py`

**Interfaces:**
- Consumes: `CoolingStage` from `sim.transformer`.
- Produces: `ScenarioId`, `ScenarioSpec`, `RampProfile`, `StepProfile`, `CoolingCapProfile`, `SCENARIO_LIBRARY: dict[ScenarioId, ScenarioSpec]`, `library_entries() -> list[ScenarioSpec]`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_scenarios.py`:

```python
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
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd backend && uv run --python 3.12 --extra dev --extra api pytest tests/test_scenarios.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'sim.scenarios'`.

- [ ] **Step 3: Write the library**

Create `backend/sim/scenarios.py`:

```python
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
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd backend && uv run --python 3.12 --extra dev --extra api pytest tests/test_scenarios.py -q`
Expected: PASS — 12 tests (the parametrised ones expand per scenario).

- [ ] **Step 5: Commit**

```bash
git add backend/sim/scenarios.py backend/tests/test_scenarios.py
git commit -m "Add the scenario library as sourced data

Three scenarios, each expressible through the C57.91 model's real inputs.
Every rate carries a citation or an explicit ASSUMED basis, enforced by a
test rather than by convention.

The cooling entry carries two rates on purpose. CIGRE 642's 9.7% is 9.7% of
MAJOR failures -- cooling faults severe enough to take the unit out -- which
is not the rate at which a redundant fan bank trips. Merging them would use
a citation to dignify a number it does not support."
```

---

### Task 2: Cap the attainable cooling stage

**Files:**
- Modify: `backend/sim/transformer.py`
- Test: `backend/tests/test_transformer_thermal.py` (append)

**Interfaces:**
- Consumes: `CoolingStage`, `COOLING_STAGE_PARAMS` (both already in the module).
- Produces: `TransformerThermalModel.max_available_stage: CoolingStage` (field, default `OFAF`), `TransformerThermalModel.effective_cooling_stage: CoolingStage` (property), `COOLING_STAGE_ORDER: tuple[CoolingStage, ...]`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_transformer_thermal.py`:

```python
def test_requested_stage_is_capped_by_available_cooling() -> None:
    """A tripped fan bank must remove the lever, not be silently ignored."""
    model = TransformerThermalModel(ambient_c=30.0, cooling_stage=CoolingStage.ONAN)
    model.max_available_stage = CoolingStage.ONAF
    model.cooling_stage = CoolingStage.OFAF

    assert model.cooling_stage is CoolingStage.OFAF  # what the operator asked for
    assert model.effective_cooling_stage is CoolingStage.ONAF  # what physics gets


def test_capped_stage_uses_the_capped_stage_rating() -> None:
    """K must be computed against attainable capacity, not the requested one."""
    capped = TransformerThermalModel(ambient_c=30.0, cooling_stage=CoolingStage.OFAF)
    capped.max_available_stage = CoolingStage.ONAF
    honest = TransformerThermalModel(ambient_c=30.0, cooling_stage=CoolingStage.ONAF)

    assert capped.load_ratio(200.0) == pytest.approx(honest.load_ratio(200.0))
    assert capped.load_ratio(200.0) == pytest.approx(200.0 / 200.0)


def test_cap_makes_the_transformer_run_hotter_for_the_same_load() -> None:
    """The whole point of the scenario: the usual lever no longer helps."""
    free = TransformerThermalModel(ambient_c=40.0, cooling_stage=CoolingStage.OFAF)
    capped = TransformerThermalModel(ambient_c=40.0, cooling_stage=CoolingStage.OFAF)
    capped.max_available_stage = CoolingStage.ONAN

    for _ in range(400):
        free_state = free.step(dt_hours=0.05, load_mva=190.0, ambient_c=40.0)
        capped_state = capped.step(dt_hours=0.05, load_mva=190.0, ambient_c=40.0)

    assert capped_state.hotspot_c > free_state.hotspot_c + 20.0


def test_uncapped_model_is_unchanged() -> None:
    """Default behaviour must be byte-identical to before the cap existed."""
    model = TransformerThermalModel(ambient_c=30.0, cooling_stage=CoolingStage.ONAF)
    assert model.max_available_stage is CoolingStage.OFAF
    assert model.effective_cooling_stage is CoolingStage.ONAF
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd backend && uv run --python 3.12 --extra dev --extra api pytest tests/test_transformer_thermal.py -q -k capped or available`
Expected: FAIL — `AttributeError: 'TransformerThermalModel' object has no attribute 'max_available_stage'`.

- [ ] **Step 3: Implement the cap**

In `backend/sim/transformer.py`, add immediately after `COOLING_STAGE_PARAMS`:

```python
#: Increasing capacity order. Explicit rather than relying on enum declaration
#: order, because the cap comparison is physical, not incidental.
COOLING_STAGE_ORDER: tuple[CoolingStage, ...] = (
    CoolingStage.ONAN,
    CoolingStage.ONAF,
    CoolingStage.OFAF,
)


def stage_rank(stage: CoolingStage) -> int:
    """Position in increasing cooling capacity."""
    return COOLING_STAGE_ORDER.index(stage)
```

In `TransformerThermalModel`, add the field beside `cooling_stage`:

```python
    #: Highest stage the plant can actually deliver. A tripped fan bank lowers
    #: this; the operator's request is kept separate so the console can show
    #: that what was asked for is not what physics received.
    max_available_stage: CoolingStage = CoolingStage.OFAF
```

Add the property after `__post_init__`:

```python
    @property
    def effective_cooling_stage(self) -> CoolingStage:
        """The stage physics actually gets: the request, capped by availability."""
        if stage_rank(self.cooling_stage) <= stage_rank(self.max_available_stage):
            return self.cooling_stage
        return self.max_available_stage
```

Then replace every *physics* read of `self.cooling_stage` with `self.effective_cooling_stage`.
Specifically: in `load_ratio` change `stage = cooling_stage or self.cooling_stage` to
`stage = cooling_stage or self.effective_cooling_stage`; in `step` and in
`steady_state_of_record` change `params = COOLING_STAGE_PARAMS[self.cooling_stage]` to
`params = COOLING_STAGE_PARAMS[self.effective_cooling_stage]`, and the
`cooling_stage=self.cooling_stage` passed into the returned `TransformerState` to
`cooling_stage=self.effective_cooling_stage`.

In `clone`, carry the cap across — a what-if run under a failed fan bank must stay capped:

```python
    def clone(self) -> TransformerThermalModel:
        """Copy the full thermal state so a what-if run cannot disturb the live twin."""
        other = TransformerThermalModel(ambient_c=self.ambient_c, cooling_stage=self.cooling_stage)
        other.max_available_stage = self.max_available_stage
        other._top_oil_c = self._top_oil_c
        other._hotspot_rise_c = self._hotspot_rise_c
        other._cumulative_lol_hours = self._cumulative_lol_hours
        return other
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd backend && uv run --python 3.12 --extra dev --extra api pytest tests/test_transformer_thermal.py -q`
Expected: PASS — all pre-existing thermal tests plus the 4 new ones. **If any pre-existing test now fails, the cap changed default behaviour and the implementation is wrong** — the default `max_available_stage=OFAF` must make `effective_cooling_stage` identical to `cooling_stage`.

- [ ] **Step 5: Commit**

```bash
git add backend/sim/transformer.py backend/tests/test_transformer_thermal.py
git commit -m "Cap the attainable cooling stage so a bank failure removes the lever

A fan-bank failure is modelled as capping the highest attainable stage
rather than as a capacity fudge factor: stage-capping is discrete, matches
how cooling is actually staged, and every number still comes from the
existing C57.91 parameter table. A partial derate would need n and tau_TO
interpolated between stages with no standard to justify it.

The requested stage is kept separate from the effective one so the console
can show that a request was not honoured. Silently ignoring it would be a
lie about twin state."
```

---

### Task 3: Drive any scenario from the library

**Files:**
- Modify: `backend/sim/scenario.py`
- Test: `backend/tests/test_scenario.py` (append; do not alter existing tests)

**Interfaces:**
- Consumes: `SCENARIO_LIBRARY`, `ScenarioId`, `ScenarioSpec`, profile classes (Task 1); `CoolingStage` and the cap (Task 2).
- Produces: `Scenario.trigger(at_sim_hours: float, spec: ScenarioSpec, severity: float = 1.0)`, `Scenario.active_spec: ScenarioSpec | None`, `Scenario.cooling_cap: CoolingStage | None`, `Simulation.trigger_scenario(scenario_id: ScenarioId = "heatwave_load_spike", severity: float = 1.0)`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_scenario.py`:

```python
from sim.scenarios import SCENARIO_LIBRARY
from sim.transformer import CoolingStage


def _run(sim: Simulation, hours: float, dt: float = 0.02):
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
    settled = _run(sim, hours=4.0)
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
    snap = _run(sim, hours=2.0)

    assert snap.transformer.node_load_mva == pytest.approx(
        baseline.transformer.node_load_mva, rel=1e-6
    )
    assert snap.ambient.air_temp_c == pytest.approx(baseline.ambient.air_temp_c, rel=1e-6)


def test_severity_scales_the_event() -> None:
    mild, harsh = Simulation(), Simulation()
    mild.trigger_scenario("feeder_pickup_step", severity=0.6)
    harsh.trigger_scenario("feeder_pickup_step", severity=1.4)

    mild_snap = _run(mild, hours=2.0)
    harsh_snap = _run(harsh, hours=2.0)
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
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd backend && uv run --python 3.12 --extra dev --extra api pytest tests/test_scenario.py -q`
Expected: FAIL — `Simulation.trigger_scenario()` takes no scenario argument; `TwinSnapshot` has no `scenario`.

- [ ] **Step 3: Generalise the driver**

In `backend/sim/scenario.py`, replace the module docstring's first line with
`"""Scenario driver: applies a library spec to the C57.91 model's inputs."""` and add imports:

```python
from sim.scenarios import SCENARIO_LIBRARY, ScenarioId, ScenarioSpec
from sim.state import ActiveScenario
```

Replace the `Scenario` class body with:

```python
class Scenario:
    """Produces (load, ambient, cooling cap) as a function of elapsed sim time.

    Baseline until triggered. Which spec is active and how severe it is come
    from the caller -- deliberately in manual mode, from `sim/arrivals.py` in a
    random shift -- so this class stays free of randomness.
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
            # Ramped over minutes rather than a true discontinuity: a breaker
            # operation is fast against tau_TO but the integrator still needs a
            # finite slope. The lag the test asserts comes from the physics, not
            # from smoothing the input.
            fraction = _smoothstep(elapsed / profile.step_duration_hours)
            return ScenarioSetpoint(
                load_mva=BASELINE_LOAD_MVA + profile.load_step_mva * self._severity * fraction,
                ambient_c=BASELINE_AMBIENT_C,
            )

        # cooling_cap: the stress is lost capacity, so the inputs stay at baseline.
        return baseline
```

In `Simulation`, change `trigger_scenario` and `reset`, and apply the cap each tick:

```python
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
```

Call `self._apply_cooling_cap()` at the end of `reset()` too (after the transformer is rebuilt), so a
reset clears a cap.

In `_build_snapshot`, add the requested stage and the active scenario:

```python
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
```

- [ ] **Step 4: Add the state contract**

In `backend/sim/state.py`, add before `TwinSnapshot`:

```python
class ActiveScenario(BaseModel):
    """Which library scenario is running, for display and for the agent's context."""

    id: str
    label: str
    mechanism: str
    #: Present only in a random shift; None when triggered deliberately.
    seed: int | None = None
```

Add to `TransformerSnapshot`, after `cooling_stage`:

```python
    #: What the operator asked for. Differs from `cooling_stage` when a fan-bank
    #: failure has capped what the plant can deliver.
    requested_cooling_stage: CoolingStage
```

Add to `TwinSnapshot`, after `transformer`:

```python
    scenario: ActiveScenario | None = None
```

- [ ] **Step 5: Run the whole backend suite**

Run: `cd backend && uv run --python 3.12 --extra dev --extra api --extra agent pytest -q`
Expected: PASS. **The pre-existing `test_scenario.py` tests must pass untouched** — they assert the heat-wave arc reaches K ≈ 1.32 and the critical band. If those numbers moved, the physics changed and that is a defect, not a test to update.

- [ ] **Step 6: Commit**

```bash
git add backend/sim/scenario.py backend/sim/state.py backend/tests/test_scenario.py
git commit -m "Drive any library scenario from one generalised driver

The heat-wave arc becomes one library entry rather than the only thing the
driver can do; its existing tests pass untouched, which is the check that
the physics did not move.

The step profile ramps over minutes rather than being a true discontinuity:
a breaker operation is fast against tau_TO but the integrator needs a finite
slope. The thermal lag the test asserts comes from the winding time
constant, not from smoothing the input."
```

---

### Task 4: Seeded arrivals for a random shift

**Files:**
- Create: `backend/sim/arrivals.py`
- Test: `backend/tests/test_arrivals.py`

**Interfaces:**
- Consumes: `SCENARIO_LIBRARY`, `ScenarioSpec`, `library_entries` (Task 1).
- Produces: `Arrival` (dataclass: `at_sim_hours: float`, `spec: ScenarioSpec`, `severity: float`), `SHIFT_SIM_HOURS: float`, `SHIFT_REPRESENTS_HOURS: float`, `plan_shift(seed: int, sim_hours: float = SHIFT_SIM_HOURS) -> list[Arrival]`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_arrivals.py`:

```python
"""Arrivals decide WHICH event and WHEN -- never the value of a signal."""

from __future__ import annotations

from sim.arrivals import SHIFT_REPRESENTS_HOURS, SHIFT_SIM_HOURS, plan_shift


def test_same_seed_gives_an_identical_shift() -> None:
    """An unreproducible demo failure is an unfixable one."""
    a = plan_shift(seed=4718)
    b = plan_shift(seed=4718)
    assert [(x.at_sim_hours, x.spec.id, x.severity) for x in a] == [
        (y.at_sim_hours, y.spec.id, y.severity) for y in b
    ]


def test_different_seeds_diverge() -> None:
    seeds = [plan_shift(seed=s) for s in range(40)]
    signatures = {tuple((a.spec.id, round(a.at_sim_hours, 3)) for a in shift) for shift in seeds}
    assert len(signatures) > 1


def test_a_quiet_shift_is_reachable() -> None:
    """A twin that always produces drama is a slideshow, not a twin."""
    assert any(plan_shift(seed=s) == [] for s in range(200))


def test_arrivals_land_inside_the_shift_and_in_order() -> None:
    for seed in range(30):
        arrivals = plan_shift(seed=seed)
        times = [a.at_sim_hours for a in arrivals]
        assert times == sorted(times)
        assert all(0.0 <= t <= SHIFT_SIM_HOURS for t in times)


def test_severity_stays_inside_each_scenario_range() -> None:
    for seed in range(60):
        for arrival in plan_shift(seed=seed):
            low, high = arrival.spec.severity_range
            assert low <= arrival.severity <= high


def test_heat_waves_dominate_the_draw() -> None:
    """Rates must actually govern frequency, or the sourcing is decoration."""
    counts: dict[str, int] = {}
    for seed in range(400):
        for arrival in plan_shift(seed=seed):
            counts[arrival.spec.id] = counts.get(arrival.spec.id, 0) + 1
    assert counts.get("heatwave_load_spike", 0) > counts.get("cooling_bank_failure", 0)


def test_time_compression_is_explicit() -> None:
    """The shift is compressed; the underlying rates are not inflated."""
    assert SHIFT_REPRESENTS_HOURS > SHIFT_SIM_HOURS
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd backend && uv run --python 3.12 --extra dev --extra api pytest tests/test_arrivals.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'sim.arrivals'`.

- [ ] **Step 3: Write the arrival model**

Create `backend/sim/arrivals.py`:

```python
"""Seeded event arrivals for a random shift.

The only `random.Random` in the simulation lives here. It decides **which**
scenario occurs, **when**, and **how severe** -- never the value of a telemetry
signal, which always comes from C57.91 applied to the resulting inputs. Noise
standing in for a physical signal is an explicit anti-tell
(docs/credibility-checklist.md).

Given a seed, the schedule is fixed, so a given twin state always renders the
same and any surprising run can be reproduced exactly.

Time compression: at true rates a 0.05/yr event essentially never fires inside a
demo. A shift therefore *plays* SHIFT_SIM_HOURS but *represents*
SHIFT_REPRESENTS_HOURS of operating time, and both are stated in the UI. The
per-year rates are unchanged -- compressing time is honest, inflating a rate
would not be.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

from sim.scenarios import ScenarioSpec, library_entries

HOURS_PER_YEAR: float = 8760.0

#: What one shift plays out in sim time.
SHIFT_SIM_HOURS: float = 12.0
#: What one shift stands for in operating time. Two months, so a ~1.5/yr event
#: appears occasionally and a 0.05/yr event stays genuinely rare.
SHIFT_REPRESENTS_MONTHS: float = 2.0
MONTHS_PER_YEAR: float = 12.0
SHIFT_REPRESENTS_HOURS: float = HOURS_PER_YEAR * SHIFT_REPRESENTS_MONTHS / MONTHS_PER_YEAR


@dataclass(frozen=True)
class Arrival:
    """One scheduled event: which scenario, when in sim time, and how severe."""

    at_sim_hours: float
    spec: ScenarioSpec
    severity: float


def _expected_count(spec: ScenarioSpec) -> float:
    """Expected arrivals of this scenario over the represented window."""
    return spec.rate_per_year * (SHIFT_REPRESENTS_HOURS / HOURS_PER_YEAR)


def _poisson(rng: random.Random, mean: float) -> int:
    """Knuth's product method. Fine here: means are far below 1."""
    limit = math.exp(-mean)
    count, product = 0, rng.random()
    while product > limit:
        count += 1
        product *= rng.random()
    return count


def plan_shift(seed: int, sim_hours: float = SHIFT_SIM_HOURS) -> list[Arrival]:
    """The full arrival schedule for one shift, fixed by the seed.

    Scenarios are drawn independently, so a shift may contain none -- which is
    a legitimate outcome, not a failure to be corrected.
    """
    rng = random.Random(seed)
    arrivals: list[Arrival] = []

    for spec in library_entries():
        for _ in range(_poisson(rng, _expected_count(spec))):
            low, high = spec.severity_range
            arrivals.append(
                Arrival(
                    at_sim_hours=rng.uniform(0.0, sim_hours),
                    spec=spec,
                    severity=rng.uniform(low, high),
                )
            )

    arrivals.sort(key=lambda arrival: arrival.at_sim_hours)
    return arrivals
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd backend && uv run --python 3.12 --extra dev --extra api pytest tests/test_arrivals.py -q`
Expected: PASS — 7 tests.

If `test_a_quiet_shift_is_reachable` or `test_heat_waves_dominate_the_draw` fails, adjust
`SHIFT_REPRESENTS_HOURS` — **not** the rates, which are sourced. Record any change and why in the
commit message.

- [ ] **Step 5: Commit**

```bash
git add backend/sim/arrivals.py backend/tests/test_arrivals.py
git commit -m "Add seeded arrivals so a random shift is reproducible

The sim's only random.Random lives here and decides which scenario, when,
and how severe -- never the value of a signal. Every telemetry number stays
a C57.91 output.

A shift plays 12 sim-hours but represents two months of operating time, so
a 1.5/yr event appears occasionally and a 0.05/yr event stays rare. Both
numbers are stated rather than the rates being inflated. A shift with no
arrivals is a legitimate draw and has a test."
```

---

### Task 5: Wire the library through the API

**Files:**
- Modify: `backend/api/schemas.py`, `backend/api/ws_console.py`
- Modify: `docs/architecture.md`
- Test: `backend/tests/test_ws_console.py` (append)

**Interfaces:**
- Consumes: `ScenarioId`, `SCENARIO_LIBRARY` (Task 1); `plan_shift` (Task 4); `Simulation.trigger_scenario` (Task 3).
- Produces: `TriggerScenarioMessage.scenario: ScenarioId | Literal["reset"]`, `StartRandomShiftMessage`, and `GET /api/scenarios`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_ws_console.py`:

```python
def test_scenario_library_is_served_with_its_sources() -> None:
    """The rates are a credibility surface; they must reach the client."""
    with TestClient(app) as client:
        response = client.get("/api/scenarios")
        assert response.status_code == 200
        entries = response.json()

    assert {e["id"] for e in entries} == {
        "heatwave_load_spike",
        "cooling_bank_failure",
        "feeder_pickup_step",
    }
    for entry in entries:
        assert entry["rate_per_year"] > 0
        assert entry["rate_source"]

    cooling = next(e for e in entries if e["id"] == "cooling_bank_failure")
    assert "CIGRE" in cooling["major_failure_rate_source"]


def test_triggering_a_named_scenario_changes_twin_state() -> None:
    with TestClient(app) as client, client.websocket_connect("/ws/console") as ws:
        ws.receive_json()
        ws.send_json({"type": "trigger_scenario", "scenario": "cooling_bank_failure"})
        for _ in range(20):
            message = ws.receive_json()
            if message["type"] == "telemetry" and message["payload"]["scenario"] is not None:
                assert message["payload"]["scenario"]["id"] == "cooling_bank_failure"
                return
    raise AssertionError("no telemetry reported the triggered scenario")


def test_random_shift_reports_its_seed() -> None:
    """A run nobody can reproduce is a run nobody can debug."""
    with TestClient(app) as client, client.websocket_connect("/ws/console") as ws:
        ws.receive_json()
        ws.send_json({"type": "start_random_shift", "seed": 4718})
        for _ in range(20):
            message = ws.receive_json()
            payload = message.get("payload")
            if message["type"] == "telemetry" and payload and payload["scenario"]:
                assert payload["scenario"]["seed"] == 4718
                return
    raise AssertionError("no telemetry reported a seeded shift")
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd backend && uv run --python 3.12 --extra dev --extra api --extra agent pytest tests/test_ws_console.py -q`
Expected: FAIL — 404 on `/api/scenarios`, and the WS rejects `start_random_shift`.

- [ ] **Step 3: Extend the wire contract**

In `backend/api/schemas.py`, import `ScenarioId` from `sim.scenarios`, then change
`TriggerScenarioMessage.scenario` from `Literal["heatwave_load_spike", "reset"]` to
`ScenarioId | Literal["reset"]`, and add beside it:

```python
class StartRandomShiftMessage(BaseModel):
    """Run a shift whose events arrive from the library's real-world rates."""

    type: Literal["start_random_shift"]
    #: Omitted means "pick one and tell me", so the run stays reproducible either way.
    seed: int | None = None
```

Add `StartRandomShiftMessage` to the `ClientMessage` union.

In `backend/api/rest.py`, add the library endpoint:

```python
@router.get("/api/scenarios", response_model=list[ScenarioSpec])
def scenarios() -> list[ScenarioSpec]:
    """The scenario library, rates and sources included."""
    return library_entries()
```

In `backend/api/ws_console.py`: handle `trigger_scenario` by passing the id through to
`simulation.trigger_scenario(scenario_id=...)` (`"reset"` keeps calling `simulation.reset()`), and
handle `start_random_shift` by choosing a seed when none is given
(`seed = message.seed if message.seed is not None else random.randrange(10_000)`), calling
`plan_shift(seed)`, storing the schedule plus the seed on the session, and firing each arrival as
sim-time passes its `at_sim_hours` via `simulation.trigger_scenario(arrival.spec.id, arrival.severity)`.
Stamp the seed onto the snapshot's `ActiveScenario` before sending.

- [ ] **Step 4: Update the documented contract**

In `docs/architecture.md`, in the "Client → server (console)" block, replace

```typescript
  | { type: "trigger_scenario"; scenario: "heatwave_load_spike" | "reset" }
```

with

```typescript
  | { type: "trigger_scenario"; scenario: ScenarioId | "reset" }
  | { type: "start_random_shift"; seed?: number }
```

and add below the block:

```markdown
`ScenarioId = "heatwave_load_spike" | "cooling_bank_failure" | "feeder_pickup_step"`, served with
its real-world rates and sources from `GET /api/scenarios`.
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `cd backend && uv run --python 3.12 --extra dev --extra api --extra agent pytest -q`
Expected: PASS — full backend suite including the 3 new WS/REST tests.

- [ ] **Step 6: Commit**

```bash
git add backend/api docs/architecture.md backend/tests/test_ws_console.py
git commit -m "Serve the scenario library and accept seeded random shifts

GET /api/scenarios carries each rate with its source, so the credibility
surface reaches the client rather than living only in Python.

A random shift always reports its seed -- including when the server picks
one -- because a run nobody can reproduce is a run nobody can debug.

Updates the ClientMessage union in docs/architecture.md, which CLAUDE.md
protects; approved explicitly during brainstorming."
```

---

### Task 6: Console scenario library and honesty indicators

**Files:**
- Modify: `console/lib/types.ts`, `console/lib/api.ts`, `console/lib/store.ts`, `console/components/ScenarioControls.tsx`, `console/components/TransformerPanel.tsx`
- Test: `console/components/ScenarioControls.test.tsx` (create)

**Interfaces:**
- Consumes: `GET /api/scenarios` and the wire messages from Task 5.
- Produces: no exports other tasks depend on.

- [ ] **Step 1: Write the failing test**

Create `console/components/ScenarioControls.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScenarioControls } from "@/components/ScenarioControls";
import { useConsoleStore } from "@/lib/store";
import { scenarioLibrary, snapshot } from "@/test/fixtures";

function seedLibrary() {
  useConsoleStore.getState().setScenarios(scenarioLibrary());
  useConsoleStore.getState().setConnection("open");
}

describe("scenario library", () => {
  it("shows each scenario with the rate a prospect will ask about", () => {
    seedLibrary();
    render(<ScenarioControls send={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Heat wave/ })).toBeInTheDocument();
    expect(screen.getByText(/6.*\/\s*yr/)).toBeInTheDocument();
  });

  it("attributes every rate to a source", () => {
    // A rate with no provenance is the number that gets challenged.
    seedLibrary();
    render(<ScenarioControls send={vi.fn()} />);
    expect(screen.getByText(/EPA/)).toBeInTheDocument();
  });

  it("sends the scenario id when one is triggered", () => {
    seedLibrary();
    const send = vi.fn();
    render(<ScenarioControls send={send} />);

    fireEvent.click(screen.getByRole("button", { name: /Cooling fan-bank failure/ }));
    expect(send).toHaveBeenCalledWith({
      type: "trigger_scenario",
      scenario: "cooling_bank_failure",
    });
  });

  it("starts a random shift", () => {
    seedLibrary();
    const send = vi.fn();
    render(<ScenarioControls send={send} />);

    fireEvent.click(screen.getByRole("button", { name: /Random shift/ }));
    expect(send).toHaveBeenCalledWith({ type: "start_random_shift" });
  });

  it("shows the seed once a shift is running, so the run can be replayed", () => {
    seedLibrary();
    useConsoleStore.getState().applyServerMessage({
      type: "telemetry",
      payload: {
        ...snapshot(),
        scenario: { id: "heatwave_load_spike", label: "Heat wave", mechanism: "m", seed: 4718 },
      },
      timestamp: 0,
    });
    render(<ScenarioControls send={vi.fn()} />);

    expect(screen.getByText(/4718/)).toBeInTheDocument();
  });
});

describe("requested vs effective cooling", () => {
  it("says so when the plant cannot deliver the requested stage", () => {
    // Silently showing the requested stage would be a lie about twin state.
    const capped = snapshot({ coolingStage: "ONAN" });
    capped.transformer.requested_cooling_stage = "OFAF";
    useConsoleStore.getState().applyServerMessage({
      type: "telemetry",
      payload: capped,
      timestamp: 0,
    });
    useConsoleStore.getState().setConnection("open");
    render(<ScenarioControls send={vi.fn()} />);

    expect(screen.getByText(/OFAF requested/i)).toBeInTheDocument();
    expect(screen.getByText(/ONAN available/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd console && npx vitest run components/ScenarioControls.test.tsx`
Expected: FAIL — `setScenarios` is not on the store and `scenarioLibrary` is not exported from fixtures.

- [ ] **Step 3: Extend types, fixtures and store**

In `console/lib/types.ts` add:

```typescript
export type ScenarioId = "heatwave_load_spike" | "cooling_bank_failure" | "feeder_pickup_step";

export interface ScenarioSpec {
  id: ScenarioId;
  label: string;
  mechanism: string;
  rate_per_year: number;
  rate_source: string;
  major_failure_rate_per_year: number | null;
  major_failure_rate_source: string;
}

export interface ActiveScenario {
  id: ScenarioId;
  label: string;
  mechanism: string;
  seed: number | null;
}
```

Add `scenario: ActiveScenario | null` to `TwinSnapshot`, and
`requested_cooling_stage: CoolingStage` to `TransformerSnapshot`. Replace the `trigger_scenario`
arm of `ClientMessage` and add the shift arm:

```typescript
  | { type: "trigger_scenario"; scenario: ScenarioId | "reset" }
  | { type: "start_random_shift"; seed?: number }
```

In `console/test/fixtures.ts` add `requested_cooling_stage` to the transformer object (mirroring
`cooling_stage`), `scenario: null` to the snapshot, and export:

```typescript
export function scenarioLibrary(): ScenarioSpec[] {
  return [
    {
      id: "heatwave_load_spike",
      label: "Heat wave + data-centre load spike",
      mechanism: "Ambient rises while the data-centre peak raises loading.",
      rate_per_year: 6,
      rate_source: "EPA Climate Change Indicators: Heat Waves -- 50 large US metros",
      major_failure_rate_per_year: null,
      major_failure_rate_source: "",
    },
    {
      id: "cooling_bank_failure",
      label: "Cooling fan-bank failure",
      mechanism: "A fan/pump bank trips, so the highest attainable stage drops.",
      rate_per_year: 0.05,
      rate_source: "ASSUMED -- basis: redundant bank, maintenance event",
      major_failure_rate_per_year: 0.000514,
      major_failure_rate_source: "CIGRE 642 / WG A2.37 transformer reliability survey",
    },
    {
      id: "feeder_pickup_step",
      label: "N-1: adjacent feeder pickup",
      mechanism: "An adjacent feeder trips and this node picks up its load.",
      rate_per_year: 1.5,
      rate_source: "ASSUMED -- basis: no citable per-circuit figure is public",
      major_failure_rate_per_year: null,
      major_failure_rate_source: "",
    },
  ];
}
```

In `console/lib/store.ts` add `scenarios: ScenarioSpec[]` (initial `[]`) and
`setScenarios: (scenarios: ScenarioSpec[]) => void` implemented as `(scenarios) => set({ scenarios })`.
Add `scenarios: []` to the `clearTimeline` reset set is **not** wanted — the library is static, not
timeline state.

In `console/lib/api.ts` add `fetchScenarios(signal)` hitting `/api/scenarios`, and call it once from
`useTwinConnection` alongside `fetchValidation`.

- [ ] **Step 4: Rebuild `ScenarioControls`**

Replace the hard-coded trigger button with the library list, the random-shift control, the seed
readout, and the requested-vs-effective indicator. Keep the existing `disabled={!online}` pattern on
every control and the existing Tailwind/brand classes. The component must stay under 50 lines per
function — extract a `ScenarioButton` for the per-entry row, which renders label, `rate_per_year`
formatted as `~6 / yr`, and `rate_source` as a `title` tooltip plus visible caption.

The requested-vs-effective indicator renders only when
`snapshot.transformer.requested_cooling_stage !== snapshot.transformer.cooling_stage`, reading
`{requested} requested · {effective} available` in `text-status-warning` — amber, because a capped
stage is a caution, not a critical asset state (`docs/brand.md`).

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `cd console && npm run test && npm run typecheck && npm run lint`
Expected: PASS — the 6 new tests plus all existing ones unmodified.

- [ ] **Step 6: Commit**

```bash
git add console/lib console/components console/test
git commit -m "Show the scenario library, its sources, and capped cooling

Each scenario carries its real-world rate and the source behind it, so the
question 'how often does this actually happen?' has an in-product answer.

A running shift shows its seed, and when a fan-bank failure caps the
attainable stage the panel says '<requested> requested, <effective>
available' -- showing only the requested stage would be a lie about twin
state."
```

---

### Task 7: Record the work

**Files:**
- Modify: `RESEARCH-LOG.md`

- [ ] **Step 1: Append the entry**

Read the file first and confirm the current highest entry number; insert the new entry immediately
before the "Blocked / still pending" entry and renumber that one so the sequence stays consecutive
and it remains last. Match the surrounding entries' plain, evidence-first voice.

The entry must record: the three scenarios and why each earned its place (heat wave as the scoped
flagship, cooling failure because it removes the agent's habitual lever, feeder pickup because a
step input demonstrates the thermal inertia `domain-transformer.md` names as the #1 anti-pattern);
that cold-load pickup and radiator fouling were cut as redundant; the two-rate treatment of the
CIGRE figure and why merging them would be dishonest; the stage-capping choice over a partial
derate; that a quiet shift is a legitimate draw with a test; and the time-compression trade-off
(`SHIFT_SIM_HOURS` played vs `SHIFT_REPRESENTS_HOURS` represented, rates unchanged).

- [ ] **Step 2: Commit**

```bash
git add RESEARCH-LOG.md
git commit -m "Log the transformer scenario library"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Library with sourced rates | 1 |
| Citation-or-ASSUMED enforced | 1 (test) |
| Two cooling rates kept separate | 1 (test), 5 (served), 6 (displayed) |
| Three chosen scenarios | 1 |
| Cut scenarios stay cut | 1 (library has exactly three, asserted) |
| Stage-capping, not a fudge factor | 2 |
| Requested ≠ effective is visible | 2 (model), 3 (snapshot), 6 (UI) |
| Generalised driver | 3 |
| Heat-wave arc unchanged | 3 (Step 5 gate on existing tests) |
| Step shows thermal inertia | 3 (test) |
| Seeded Poisson arrivals | 4 |
| Determinism per seed | 4 (test) |
| Quiet shift reachable | 4 (test) |
| Time compression stated, rates unchanged | 4 (constants + test), 6 (UI) |
| Seed in snapshot and UI | 3, 5, 6 |
| Wire contract + `architecture.md` | 5 |
| `GET /api/scenarios` | 5 |
| RESEARCH-LOG entry | 7 |

No gaps.

**Placeholder scan:** none. Every code step carries literal code; every run step carries its command
and expected result. Task 6 Step 4 and Task 7 Step 1 describe rendering and prose rather than
pasting them — both specify exact content, class tokens and copy strings, which is the level at
which a reviewer can reject the result.

**Type consistency:** `ScenarioId` is the same `Literal` union in `sim/scenarios.py` (Task 1),
`api/schemas.py` (Task 5) and `lib/types.ts` (Task 6). `ScenarioSpec` field names match across
Python, the REST payload and the TS interface. `ActiveScenario` (Task 3) carries `id/label/mechanism/seed`
and the TS interface mirrors it. `max_available_stage` and `effective_cooling_stage` (Task 2) are used
with those exact names in Tasks 3 and 6. `plan_shift(seed, sim_hours)` returning `list[Arrival]`
(Task 4) is consumed with that signature in Task 5.

**One risk the plan cannot remove:** Task 3 rewrites the module the entire demo runs through. Its
Step 5 gate — the pre-existing `test_scenario.py` passing untouched — is the only thing standing
between a generalised driver and a silently changed heat-wave arc. A reviewer should treat any edit
to those existing assertions as a defect, not an update.
