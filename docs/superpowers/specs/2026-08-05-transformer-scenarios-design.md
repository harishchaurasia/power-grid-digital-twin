# Design: transformer scenario library with stochastic arrival

**Date:** 2026-08-05
**Status:** approved in brainstorming, not yet implemented
**Scope:** backend `sim/` + wire contract + console scenario controls. No agent-reasoning change.

> ⚠️ New file under `docs/`, which `CLAUDE.md` normally protects. Created on explicit
> instruction. This spec also proposes editing `docs/architecture.md` — see "Wire contract".

## Decomposition

The original ask covered three senses of "probabilistic". It splits into two independent specs:

| | Piece | Independent because |
|---|---|---|
| **A — this spec** | Scenario library with sourced likelihoods + seeded stochastic arrival | Works against today's deterministic UQ unchanged |
| **B — later spec** | Monte Carlo risk layer: `P(exceed limit)`, unbiased loss-of-life distribution, probability-weighted economics | Samples forecast error over *whatever* scenario runs; needs no library |

A is built first: it is the named ask, and B is more useful once there is a library to run across.

**B's motivating defect, recorded here so it is not lost:** `F_AA = exp(15000/383 − 15000/(θ_H+273))`
is strictly convex over the operating band — its second derivative is
`f·b/(θ+273)³·[b/(θ+273) − 2]` with `b/(θ+273) ≈ 37.5 ≫ 2`. By Jensen's inequality
`E[F_AA(θ)] > F_AA(E[θ])`, so loss-of-life computed along the *expected* trajectory —
what the code does today — systematically **understates** expected life consumed, and the error
grows with forecast spread. Deterministic corner propagation cannot correct this; sampling can.
That is B's job.

## Problem

`sim/scenario.py` hard-codes one event: a heat wave coincident with a data-centre load spike. A
prospect sees the same arc every time, and the twin never demonstrates that it handles anything
it was not built to show. Nothing in the demo carries a real-world *rate*, so "how often does
this actually happen?" has no answer in-product.

## Goals

1. A named scenario library, each entry carrying a real-world frequency with a citation or an
   explicitly-labelled assumption.
2. Deliberate triggering, so a sales demo is repeatable.
3. A "random shift" mode where events arrive from the frequency model, with a visible seed so any
   run replays exactly.
4. Every scenario expressible honestly through the three inputs the C57.91 model actually takes:
   load, ambient, and cooling capacity.

## Non-goals

- BESS or transmission-line scenarios. Those models do not exist (`TwinSnapshot.bess`/`.line` are
  `None` by design); a scenario needing them would be invented telemetry.
- User-authored scenarios. `CLAUDE.md` rules out scenario customisation beyond documented controls.
- Changing agent reasoning or the ranked-options contract.
- Monte Carlo anything — that is spec B.

## Scenario selection

Chosen for demo value, not completeness. Each must be (a) recognisable to a power engineer,
(b) visibly different on the chart, and (c) a *different problem* for the agent. Three qualify;
two candidates were cut.

### Included

**1. `heatwave_load_spike` — heat wave coincident with a data-centre peak.** Exists today. Ambient
28 → 41 °C over 4 h, load 135 → 198 MVA over 3 h (smoothstep). Agent's answer: engage cooling.

- Rate: **~6 per year.** EPA Climate Change Indicators: heat waves across 50 large US metros rose
  from 2/yr in the 1960s to 6/yr in the 2020s, averaging 4 days, over a 73-day season.
- Why keep: it is the scenario the whole project is scoped around (`CLAUDE.md`, "Scenario").

**2. `cooling_bank_failure` — a fan/pump bank trips.** Load and ambient nominal-to-elevated; the
transformer's *ability to shed heat* drops. This is the qualitatively different one: the agent's
habitual lever — engage the next cooling stage — is partly unavailable, so it must reach for load
management instead. It is the strongest evidence the agent reasons rather than replays a script.

- Rate: **two distinct rates, deliberately.** See "Not conflating the cooling rates" below.
- Physics: caps the highest attainable cooling stage (see "Modelling the derate").

**3. `feeder_pickup_step` — N-1: an adjacent feeder trips and this node picks up its load.** A
load *step*, not a ramp: +25–45 MVA within minutes, then held.

- Rate: **ASSUMED**, basis stated in-file. IEEE 493 tables are paywalled and no free source gives a
  per-circuit forced-outage rate we can cite honestly.
- Why keep: a step input is the clearest possible demonstration of thermal inertia — hot-spot rises
  on the winding time constant (minutes) while top-oil lags on τ_TO (hours). `domain-transformer.md`
  names instant-responding telemetry as the #1 anti-pattern, so a scenario that *shows* the lag is
  a credibility asset, not just variety.

### The quiet shift is a real outcome

In random-shift mode, a shift where nothing notable happens is a legitimate draw and must be
allowed to occur. A twin that always produces drama is a slideshow. It also exercises the QA case
`agent-design.md` already requires — nominal state, agent recommends `hold`.

### Cut, with reasons

- **Cold-load pickup after an outage.** Physically real (diversity loss on restoration), but it is
  another load transient — nearly the same demo beat as `feeder_pickup_step`, and it needs a
  preceding outage to make narrative sense. Redundant.
- **Radiator fouling / blocked airflow.** A slow capacity degradation. Same *kind* of stress as
  `cooling_bank_failure` but invisible on a demo timescale, where sim-hours pass in seconds.

## Not conflating the cooling rates

CIGRE 642 (WG A2.37) gives a substation-transformer failure rate of **0.53%/yr**, of which
**cooling systems account for 9.7%** — a survey of 964 major failures over 167,459 transformer-years
across 56 utilities in 21 countries.

That yields ≈ **0.05%/yr for a cooling fault severe enough to be a *major failure***. It is **not**
the rate at which a fan bank trips: a bank trip on a redundant cooling system is a maintenance
event, roughly an order of magnitude more common, and it is not what CIGRE counted.

So `cooling_bank_failure` carries **two rates**:

```
major_failure_rate_per_year: 0.00051   # 0.53% x 9.7%, CIGRE 642 / WG A2.37
nuisance_trip_rate_per_year: 0.05      # ASSUMED -- basis: redundant bank, maintenance
                                       # event not an outage; order of magnitude only
```

The arrival model uses the nuisance rate (that is the event being simulated). The major-failure
rate is displayed as context. Using the citation to dignify a number it does not support is exactly
the sloppiness a reliability engineer would catch, so the two never merge.

## Modelling the cooling derate

`COOLING_STAGE_PARAMS` maps each stage to `rated_mva`, `oil_exponent_n` and
`top_oil_time_constant_h` (150/200/250 MVA for ONAN/ONAF/OFAF). A bank failure is therefore modelled
as **capping the highest attainable stage**, not as a fudge factor:

```
effective_stage = min(requested_stage, max_available_stage)
```

Discrete stage-capping matches how cooling is actually staged, and every resulting number still
comes from the existing C57.91 parameter table. A *partial* derate (say, half of one bank) would
require interpolating `n` and `τ_TO` between stages with no standard to justify the interpolation —
rejected on those grounds.

Consequence worth stating: with the cap in place, an operator pressing "OFAF" gets ONAF behaviour,
and the console must show that the requested stage is not the effective one. Silently ignoring the
request would be a lie about twin state.

## Components

| Module | Responsibility |
|---|---|
| `sim/scenarios.py` (new) | The library: declarative `ScenarioSpec` entries with perturbations, rates, sources. No RNG, no simulation. |
| `sim/arrivals.py` (new) | Seeded Poisson arrival + severity draw. Owns the only `random.Random` in the sim. |
| `sim/scenario.py` (modify) | Generalised driver: applies whichever `ScenarioSpec` is active. Today's `Scenario` class becomes one library entry. |
| `sim/transformer.py` (modify) | `max_available_stage` cap and an `effective_stage` accessor. |
| `sim/state.py` (modify) | `TwinSnapshot` gains active scenario id, seed, and requested-vs-effective cooling stage. |
| `api/schemas.py` + `api/ws_console.py` (modify) | Wire contract for scenario selection and seed. |
| `console/` | Scenario library panel (label, rate, source), seed display, requested-vs-effective stage indicator. |

`sim/scenarios.py` holds data only and `sim/arrivals.py` holds the randomness, so the library can be
read and tested without touching RNG, and the arrival model can be tested against a fixed seed
without touching physics.

## Determinism

`CLAUDE.md` requires the render be deterministic with respect to twin state, and forbids RNG
masquerading as a physical signal. Both hold:

- Randomness selects **which event occurs and when** — it never perturbs a telemetry signal. Every
  telemetry value still comes from C57.91 applied to the resulting inputs.
- One `random.Random(seed)` instance, seeded explicitly, lives in `sim/arrivals.py`. Given
  `(seed, sim-time)` the arrival sequence is fixed, so a given twin state always renders the same.
- The seed is part of `TwinSnapshot` and displayed in the console, so any run is replayable and any
  surprising behaviour can be reproduced exactly. An unreproducible demo failure is unfixable.

## Arrival model

Per scenario, arrivals are a Poisson process with rate λ from the library, scaled to sim-time.
Severity is drawn per-scenario (e.g. heat-wave peak ambient, feeder-pickup step size) from a
documented range, so repeat draws of the same scenario are not identical.

Demo pacing is a real constraint: at real-world rates, a 0.05/yr event essentially never fires
inside a demo. The random-shift mode therefore runs on a documented **time-compression factor**,
stated in the UI ("one shift ≈ N sim-hours"), with the underlying per-year rates unchanged and
shown. Compressing time is honest; inflating the rate would not be.

## Wire contract

`ClientMessage.trigger_scenario` today accepts `"heatwave_load_spike" | "reset"`. It becomes a
scenario id from the library, plus a random-shift mode carrying an optional seed:

```typescript
| { type: "trigger_scenario"; scenario: ScenarioId | "reset" }
| { type: "start_random_shift"; seed?: number }
```

`TwinSnapshot` gains `scenario: { id, label, seed | null }` and
`transformer.requested_cooling_stage` alongside the existing effective one.

⚠️ This changes the contract documented in `docs/architecture.md`, which `CLAUDE.md` protects.
The doc must be updated in the same change or it becomes wrong — flagged for explicit approval.

## Testing

Physics and library tests are cheap and belong in `backend/tests/`:

- **Library integrity:** every entry has a rate and a source; every source is either a citation or
  starts with `ASSUMED` and states a basis. A rate with no provenance fails the suite.
- **The two cooling rates never merge:** assert the arrival model uses the nuisance rate and that
  the major-failure rate is display-only.
- **Derate honesty:** requesting OFAF under a cap yields ONAF-rated behaviour, and the snapshot
  reports requested ≠ effective.
- **Step response shows thermal inertia:** after a load step, hot-spot must not reach its new
  steady state within one tick; assert it approaches over τ_W while top-oil lags on τ_TO. This is
  the anti-pattern `domain-transformer.md` names, so it gets a direct test.
- **Determinism:** the same seed produces an identical arrival sequence; different seeds differ.
- **Quiet shift is reachable:** some seed produces a shift with no arrival, proving the model is not
  rigged to always fire.
- **Existing `tests/test_scenario.py` must still pass** — it asserts the heat-wave arc reaches
  K ≈ 1.32 and the critical band. If generalising the driver changes those numbers, the physics
  changed and that is a defect, not a test to update.

Console tests follow the existing split: vitest for the library panel rendering rates and sources,
Playwright for triggering a scenario and for the requested-vs-effective stage indicator.

## Risks

- **Generalising `sim/scenario.py` touches the module the whole demo runs through.** The existing
  heat-wave arc is the one thing known to work end-to-end; it must come through byte-identical in
  behaviour, which is what the existing test asserts.
- **Time compression invites a credibility objection** ("you sped it up so the rare thing happens").
  Mitigated by stating the compression factor and the true per-year rate side by side, but it should
  be said out loud in the UI rather than buried.
- **Three scenarios may feel thin in random-shift mode.** Severity variation carries most of the
  variety. If it reads as repetitive in practice, the answer is severity range widening, not more
  scenario types — each additional type must earn its place on the criteria above.

## Follow-on

Spec B: the Monte Carlo risk layer — `P(exceed limit)` with its own sampling error reported (a
Monte Carlo probability is an estimate, and showing it fake-precise would breach the same rule it
exists to serve), the loss-of-life distribution correcting the Jensen bias documented above, and
probability-weighted economics so the agent ranks plans on expected cost under uncertainty.
