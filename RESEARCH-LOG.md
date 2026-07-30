# ArkaForge — Pivot & Research Log

> Living document. Started 2026-07-15. Captures the strategic pivot away from the
> single-wind-turbine demo toward a full-scale, industry-standard digital twin of a
> US power-industry asset, plus the research feeding that decision.
> Append findings as they land; do not delete prior entries — strike through if superseded.

---

## 1. The pivot (2026-07-15)

**Decision:** Pivot the demo away from the locked wind-turbine scenario toward a
**full-scale, industry-standard digital twin of a US power-industry problem**, engineered
to a credibility bar comparable to Boeing / SpaceX / GE / Siemens — a demo serious
industrial and energy buyers can *trust*.

**Rationale (user):** A toy demo does not build trust. To win credibility we need a twin
that a domain expert cannot dismiss — real physics, real standards, real engineering —
targeting a problem the industry actually recognizes as urgent.

**What this supersedes:** The "Scenario lock" and several "Hard rules / Never do" items in
`CLAUDE.md` (single 8MW wind turbine, HSS bearing degradation, "do not pivot the
scenario," "one asset / one failure / one agent"). These are now **superseded by explicit
user instruction** and will be rewritten once the new target is chosen. Treat the pivot as
the new source of truth.

**What is preserved (the thesis is unchanged):**
> AI agents reasoning over an industrial digital twin and proposing interventions with
> quantified trade-offs.

Only the *asset* changes — from a wind turbine to whichever power-industry asset/subsystem
the research identifies as the most credible, urgent, and physically tractable target.

**North star for the new build:** credibility. Every number must trace to real physics or a
real standard. No hand-wavy telemetry, no hallucinated agent claims.

---

## 2. Research in flight

Three parallel research agents dispatched 2026-07-15 to inform target selection.
Status: **running** at time of writing. Findings appended in §4 as they return.

### Agent A — US power industry problems
Scope: rigorous, sourced briefing (2025–2026) on the most urgent problems in the US
electric power industry, ranked by urgency + demo potential. Areas: data-center/AI load
growth, interconnection queue backlog, grid reliability / resource adequacy, aging
infrastructure (large power transformers, lines, substations), transmission congestion,
extreme-weather hardening (wildfire/PSPS), nuclear/gas/coal balance, BESS operations, grid
cyber/physical security. Deliverable ends with **Top 3 problem targets for a twin**, each
naming the specific asset/subsystem to model.

### Agent B — Digital-twin credibility & industry standards
Scope: what makes an industrial digital twin *credible* and "industry standard." Covers
ISO 23247, Digital Twin Consortium, NIST/IEEE; physics-based vs data-driven vs hybrid;
validation & verification; how Boeing/SpaceX/NASA/GE/Siemens/Bentley/AVEVA/Palantir/NVIDIA
earn trust; power-specific models we can faithfully reflect (IEEE power-flow test cases,
IEEE C57.91 transformer thermal, IEEE 738 line rating, MATPOWER/PyPSA/OpenDSS/GridLAB-D,
PSS/E, PSCAD). Deliverable ends with a **credibility checklist** to build against.

### Agent C — Market & competitive landscape
Scope: who already sells power-industry digital twins / AI (GE Vernova GridOS, Siemens Grid
Software, Hitachi Energy, Schneider, AVEVA, Bentley iTwin, Palantir, C3.ai, NVIDIA
Omniverse/Earth-2, plus startups) and where the genuine *agentic* gap is — autonomous
reasoning over a twin vs dashboards/ML forecasting. Deliverable ends with a **positioning
recommendation** and target buyer personas.

---

## 3. Open decisions (pending research)

1. **Target asset/subsystem** — what exactly do we twin? (Early hypotheses: large power
   transformer thermal twin; grid interconnection / power-flow twin tied to the AI
   data-center load story; BESS thermal + degradation twin.)
2. **Buyer persona** — utility vs ISO/RTO vs IPP vs data-center developer. Shapes the
   narrative and the intervention set.
3. **Fidelity level** — which real physics models/standards we implement, and where we draw
   the line so it stays provably correct within demo scope.
4. **Stack implications** — does the pivot change the stack in `CLAUDE.md`
   (Next.js + FastAPI + Anthropic SDK)? Likely reusable; the physics layer changes.
5. **Docs migration** — existing design docs live at repo *root* but `CLAUDE.md` imports
   them as `docs/*.md` (broken `@` references). Reconcile during the docs rewrite.

---

## 4. Findings (appended as agents return)

### Agent A — US power industry problems ✅ (returned 2026-07-15)

**Root cause connecting everything:** After ~2 decades of flat load (0.1%/yr, 2005–2019),
US electricity demand is surging again. EIA (Jan 13 2026) forecasts the strongest 4-year
demand growth since 2000. This reversal drives most problems below.

**Problem areas, ranked (urgency + demo potential), with hard numbers:**

1. **Data-center / AI load growth (RANK #1 urgency).** ~166 GW US peak growth by 2030,
   ~90 GW of it data centers (Grid Strategies, Dec 2025). DC grid demand ~76 GW (2026) →
   ~134 GW (2030), ~tripling (S&P Global). ERCOT ~10%/yr, PJM ~3.2%/yr. Virginia "Data
   Center Alley": Dominion summer peak +23% vs 2019, winter +45%. Hard because load builds
   in 18–24 mo but generation+transmission takes 5–10+ yr.
2. **Interconnection queue backlog.** ~2,060–2,290 GW stuck (LBNL "Queued Up" 2025). Avg
   wait 4.5 yr; ~75% of requests withdraw; 700+ GW withdrew in 2024.
3. **Grid reliability / resource adequacy (RANK #3).** NERC LTRA 2025 (Jan 2026): 13 of 23
   areas elevated/high risk (MISO, PJM, ERCOT, WECC-NW/Basin, SERC-C). Winter Storm Elliott
   (2022): 90.5 GW outages, ~83% gas-fuel-caused. PJM 2026/27 capacity auction hit the FERC
   cap $329.17/MW-day RTO-wide; ~$9.3B+ passed to customers; cleared over requirement by
   just 139 MW.
4. **Aging transformers / LPTs (RANK #4 — best asset-level twin target).** LPT lead times
   ~128 wks, GSUs ~144 wks, some 4 yr (vs 7–14 mo pre-pandemic). Unit prices +77% since
   2019. >50% of ~40M US distribution transformers past service life; ~30% supply shortfall.
   No spare buffer → life-extension / condition-based maintenance is economically critical.
5. **Transmission congestion.** ~$11.5B US congestion cost (2023). CAISO curtailed 3.4M MWh
   renewables in 2024 (+29%). Dynamic line rating can unlock ~25% more capacity; FERC Order
   881 (compliance Jul 2025) + Order 1920 give regulatory tailwind.
6. **Extreme weather / wildfire hardening.** CA ~$40B wildfire mitigation+liability
   2019–2024; PG&E bankruptcy precedent. High-dimensional, weather/vegetation-dependent —
   harder to twin credibly.
7. **Generation-mix transition** (coal retirements slowing, gas fragility, nuclear) —
   diffuse, portfolio-level, not a clean single-asset twin.
8. **BESS growth & ops (RANK #2 for demo potential).** >20 GW installed since 2020. Moss
   Landing fire (Jan 2025): thermal runaway destroyed ~75% of 300MW/1200MWh facility, 1,500
   evacuated — industry's defining safety event. Degradation = known function of cycles,
   DoD, C-rate, cell temp. Tractable electrochemical/thermal physics; crisp dispatch-vs-life
   trade-off.
9. **Grid cyber/physical security.** >3,500 physical breaches in 2025 (up from 2,800 in
   2023). Adversarial, low-data — poor fit for physics-based twin.

**Agent A's TOP 3 twin targets:**
- 🥇 **Large Power Transformer (LPT) thermal + health twin.** Winding hot-spot thermal model
  (IEEE C57.91) + dissolved-gas-analysis (DGA) fault trending (Duval triangle) + LTC
  condition + insulation/moisture aging. Wins on: universal recognition (the transformer
  crisis), obvious agentic payoff ("how much can I safely overload tonight, and is failure
  weeks or years away?" = dynamic loading vs accelerated insulation aging, a quantifiable
  trade-off), textbook-tractable physics, and it's the **closest structural analog to the
  existing HSS-bearing loop** (detect → project failure window → recommend intervention).
- 🥈 **BESS thermal + degradation twin.** Electro-thermal + non-linear degradation + early
  thermal-runaway detection. Dispatch to maximize market revenue subject to thermal safety +
  degradation budget. Best "modern/high-visibility" alternative (Moss Landing recognition).
- 🥉 **Transmission line dynamic line rating (DLR) twin.** IEEE 738 conductor heat balance
  driven by real-time weather → dynamic ampacity vs static rating, unlocking ~25% capacity.

**Agent A recommendation:** **LPT thermal/health twin is the strongest single target** —
most acute + recognized crisis, clearest asset-level agentic payoff, tractable physics,
closest analog to the ArkaForge pattern already scoped. BESS is the best modern alternative
if the buyer skews renewables/storage.

**Caveat flagged:** NERC risk framing is contested (Grid Strategies says it overstates
near-term risk by under-counting queued resources); load-growth GW figures carry large
uncertainty from duplicative "phantom" data-center interconnection requests. Treat GW
numbers as directionally strong but upper-bounded.

**Key sources:** NERC LTRA 2025; LBNL "Queued Up" 2025; EIA Jan 13 2026 demand forecast;
Grid Strategies National Load Growth Report 2025; FERC/NERC Winter Storm Elliott report;
POWER Magazine "Transformers 2026"; WECC Moss Landing Fire Report (Dec 22 2025); PJM 2026/27
capacity auction.

---

### Agent B — Digital-twin credibility & industry standards ✅ (returned 2026-07-15)

**Definitions serious buyers recognize:**
- **NASA (origin, 2010–12):** a twin is an *integrated multi-physics, multi-scale,
  probabilistic simulation … updated with sensor + fleet history*. Four load-bearing words:
  multi-physics, multi-scale, probabilistic, sensor-updated. A dashboard has none.
- **ISO 23247** (DT framework): load-bearing word is **synchronization** — a model that
  doesn't sync to the physical element isn't a twin. Enables the "digital thread."
- **Digital Twin Consortium:** "synchronized interaction at a **specified frequency and
  fidelity**." DTC Capabilities Periodic Table = the insider requirements framework.
- **IEEE 3144** DT Maturity Model; **NIST** measurement/security (NISTIR 8356).

**Fidelity spectrum (the crux):** dashboard (shows what is) < simulation (what-if, but not
this asset) < **digital twin** (model + bidirectional live sync to one specific asset).
Physics-based vs data-driven vs **hybrid physics-informed ML** (the credible sweet spot;
what GE/Siemens/NVIDIA all do). Concepts to cite: **twinning rate**, **bidirectional sync**.
⚠️ **"Visual realism is NOT fidelity"** — explicitly flagged in the literature as a trap.

**V&V + Uncertainty Quantification = the trust layer:** Verification (code solves math right)
+ Validation (math matches reality) + UQ (aleatoric vs epistemic). **ASME V&V 40** credibility
framework; NASEM says embed VVUQ deeply. Failure windows must be **ranges with probability**,
never fake-precise timestamps.

**How credible players earn trust:** physics first, AI second; real sensor integration;
explicit validation against the real asset or a reference model. NASA/Boeing (airframe
fatigue), SpaceX (HIL test stands, "test as you fly," model-reality reconciliation), GE
Vernova (Predix physics twins, Digital Wind Farm validated over decade service contracts),
Siemens ("validated dynamic models" in PSS®E), NVIDIA PhysicsNeMo (Fourier Neural Operator
surrogates validated against first-principles, ~10,000× faster). **None claim credibility from
visual realism.**

**Power-specific models that make a demo provably correct (name these in-product):**
- Grid power flow: per-unit + Newton-Raphson; **IEEE test cases (14/118-bus, RTS-96)**;
  open tools **PyPSA / pandapower / MATPOWER / OpenDSS** (expert can verify our numbers).
- Transformer: **IEEE C57.91** top-oil + hot-spot thermal model; the **6 °C rule** (every
  6 °C over 110 °C hot-spot ~halves insulation life).
- Transmission line: **IEEE 738** conductor heat balance (Joule+solar = convective+radiative).
- Wind/bearing (prior scenario): Weibull, piecewise power curve, Betz limit (Cp≤0.593),
  geometry-derived **BPFO/BPFI/BSF** fault frequencies, RMS/Kurtosis health indicators,
  NREL/IEA 15-MW Reference Turbine as anchor.

**Deliverable ended with a CREDIBILITY CHECKLIST** (physics & units, anchor to recognized
references, DT discipline incl. bidirectional sync + stated twinning rate, V&V + uncertainty
bands, agent reports only tool-returned values, and a list of anti-tells: no random-noise
signals, no fake-precise dates, no arbitrary-frequency peaks, **no pretty 3D standing in for
fidelity**, no number without a traceable model/standard). This checklist is our build bar.

### Agent C — Market & competitive landscape ✅ (returned 2026-07-15)

**Incumbents:** nearly all bolted an "AI copilot/agentic" label on in 2025–26, but most ship
**ML forecasting + dashboards + retrieval copilots**, not autonomous multi-step reasoning that
proposes ranked, costed interventions. Furthest on the label: **Siemens Gridscale X**
("agentic transmission planning") and **C3.ai** (branded agentic). **GE Vernova GridOS** (grid
data-fabric twin; spun out ThinkLabs AI copilot). **Hitachi Energy** (HMAX + Anthropic
partnership). **Schneider** (Grid AI Assistant = copilot). **Palantir** (ontology = data model,
**not a physics twin**). **NVIDIA** (Omniverse/Earth-2/PhysicsNeMo = the simulation substrate —
a potential ally, not a competitor).

**Startups** are narrow / capacity-focused: GridCARE ($64M, grid-capacity for data centers),
ThinkLabs AI ($28M, grid-network simulation — nearest analog but network-level not asset-level),
Utilidata (grid-edge inference), LineVision (DLR sensors), Base Power (residential BESS).

**The agentic gap (the opening):** forecasting is solved/commoditized; **reasoning-to-a-costed,
auditable recommendation is open ground.** The frontier is still *research* (Argonne National
Lab's **GridMind** agentic control-room copilot; 2026 literature converging on exactly our
architecture: digital twin as the coordination layer that "grounds LLM reasoning in physics").
Decisions still made by humans staring at SCADA/EMS screens: asset-intervention timing under
trade-offs, alarm→root-cause→action, interconnection trade-offs, restoration sequencing.

**Differentiators a demo can own (that incumbents structurally can't show):**
1. **Transparent, physics-grounded agent reasoning — shown, not asserted** (cite the actual
   mechanism + expose the tool outputs; defeats the "black-box hallucination" objection).
2. **Quantified, ranked intervention trade-offs** (Option A/B/C with cost, risk, MWh — numbers
   from twin state, never invented). Hardest thing for a dashboard vendor to fake.
3. **Telemetry-to-decision in seconds** (vs incumbent study cycles in hours–days).
4. **Asset-level operational agency** (majors' agentic energy is at grid-network scale; the
   individual-asset level is still just ML anomaly detection).

**Positioning angles:** (1) "The auditable agent" → reliability/asset-mgmt engineers at
IPPs/utilities; (2) "From prediction to ranked, costed intervention" → O&M / plant ops;
(3) "Agent-over-a-twin at asset scale, telemetry-to-decision in seconds" → data-center
developers + control-room modernization teams. Through-line: transparency + quantification +
speed, done credibly.

**Caveat:** vendor performance stats (e.g., "48% fewer transformer failures") are marketing
claims, not independently verified; some 2026 dates are from trade press, not vendor pages.

---

## 4b. Direction decision (2026-07-15, user)

**Scope:** Build **all three assets** — Large Power Transformer, BESS, and Transmission-line
(DLR) — as **one full-scale digital-twin platform**, not a single-asset demo. The agentic
layer reasons across all three. This intentionally supersedes the old "one asset, one failure"
lock entirely.

**Stack:** **Likely Unreal Engine** for the visualization/experience layer (user: "probably be
using unreal engine"). Not yet locked.

**Implications to resolve (flagged, not yet decided):**
1. **Unreal ↔ web embed.** The original model was an iframe on the marketing site. Unreal in a
   browser means **Pixel Streaming** (cloud GPU rendering streamed to the browser) — real infra
   + per-concurrent-viewer GPU cost. Reconcile "embedded via iframe" with Unreal, or split into
   (a) a heavy Unreal build + (b) a lightweight web fallback.
2. **Visual realism ≠ credibility (Agent B).** Unreal wins the "wow," but the research is
   explicit that *pretty 3D standing in for fidelity is a TELL of a toy demo*. Trust comes from
   the **physics + agent** layer. Unreal is the shell; the simulation core must be equally real
   (PyPSA/pandapower power flow on IEEE cases, IEEE C57.91 transformer thermal + 6 °C aging,
   IEEE 738 line rating, electro-thermal + degradation BESS model), with V&V and uncertainty
   bands shown.
3. **Architecture becomes 3-tier:** Unreal experience layer ⇄ physics simulation backend
   (Python) ⇄ agentic reasoning layer (Anthropic SDK, tools over twin state). Define the
   transport (Pixel Streaming + WebSocket/state bridge).
4. **Timeline/effort:** far beyond the original 14–17 day web plan — this is a multi-month,
   team-scale build. Re-plan accordingly.
5. **Differentiation must survive the scope-up (Agent C):** three assets is breadth, but the
   moat is still transparent physics-grounded reasoning + ranked costed trade-offs +
   telemetry-to-decision in seconds. Don't let breadth dilute the auditable-agent story.

## 5. Next steps

1. ✅ All three research reports collected and logged (§4, §4b).
2. ✅ Architectural decisions locked: Unreal + Pixel Streaming (browser-delivered) confirmed by
   user; three-tier architecture; unified single-substation-node scenario (transformer + BESS +
   line coupled); vertical-slice build (transformer first). See §4b.
3. ✅ **Project recreated (2026-07-15).** Old wind-turbine docs archived to `docs/_legacy/`.
   New doc set written: `CLAUDE.md`, `docs/architecture.md`, `docs/domain-transformer.md`,
   `docs/domain-bess.md`, `docs/domain-transmission.md`, `docs/agent-design.md`,
   `docs/credibility-checklist.md`, `docs/build-plan.md`, `docs/brand.md`, `README.md`. Docs now
   live under `docs/` (fixes the old broken `@` imports).
4. **In progress — backend build (Phase 0 + Phase 1 physics).** Started 2026-07-22.
   - `backend/` scaffolded with `uv` (Python 3.12, pinned <3.13 for pandapower/scipy wheels).
   - `sim/transformer.py`: IEEE C57.91 top-oil + hot-spot thermal model (τ_TO/τ_W lag), F_AA
     Arrhenius aging, ONAN/ONAF/OFAF cooling stages, cumulative loss-of-life. **Validated**:
     `tests/test_transformer_thermal.py` (11 tests) checks F_AA=1.0 at 110 °C, the ~6.9 °C
     doubling rule, the rated-point 110 °C hot-spot design identity, thermal inertia (no instant
     jumps), Euler convergence to analytic equilibrium, and cooling-stage relief.
   - `sim/state.py`: Pydantic v2 `TwinSnapshot`/`TransformerSnapshot` contract (BESS/line left
     `None` until Phases 2-3 — not faked).
   - `sim/scenario.py`: heat-wave + data-center load-spike driver (smoothstep ramps) coupled to
     the transformer; `Simulation` owns the authoritative twin, sim-time accelerated for demo.
     `tests/test_scenario.py` (3 tests) confirms nominal baseline → K≈1.32 peak → critical band.
   - `api/`: FastAPI app + `/ws/console` WebSocket streaming telemetry at the 10 Hz twinning rate
     and accepting `trigger_scenario`/`apply_intervention`/`select_asset` intents; `schemas.py`
     mirrors the architecture.md wire contract. `tests/test_ws_console.py` (3 tests) smoke-tests
     end-to-end. CORS allowlist for the marketing origin + localhost.
   - `sim/__main__.py` (`make sim`): headless telemetry table for physics validation by eye.
   - `Makefile`: `install/backend/sim/test/lint/typecheck` all green (ruff clean, pyright 0
     errors, 17 tests pass). Physics output eyeballed and credible.
   - **3D asset sourcing** (6 research agents) written to `assets/sourcing/*.md`: transformer,
     BESS, transmission, substation-yard, materials/environment, and UE5 packs + import guide.
     Key flags for the Unreal team: no credible hero LPT on Fab (author/kitbash needed);
     Megascans went paid after Dec 2024 (built picks on CC0 instead); drive the heat glow as a
     scalar-lerp emissive so render stays a deterministic function of twin state.

5. **Console overlay + V&V/UQ backend (Phase 1).** Landed 2026-07-28. Built console-first because
   the agent layer is blocked on an Anthropic API key (see §6) and `CLAUDE.md` forbids mocking it.

   New backend modules (physics stays authoritative in Python — the console renders, never derives):
   - `sim/projection.py`: forward hot-spot band. Uncertainty is **weather + load forecast error
     propagated through the same C57.91 model**, not noise on a signal. Hot-spot is monotonic in
     ambient and load, so evaluating the forecast quantile corners bounds the trajectory exactly —
     deterministic, no RNG, so the render stays reproducible. Forecast σ grows as √(lead/6 h)
     (random-walk error growth), so the band is closed at t=0 and opens with horizon
     (0.2 °C → 14.6 °C over 6 h). `time_to_limit` reports an already-exceeded limit as
     `already_breached` rather than a degenerate "0.1 h (95% CI 0.1–0.1)" window.
   - `sim/validation.py`: separates **verification** (Euler integrator vs the closed-form C57.91
     solution — max residual **0.030 °C** over K = 0.4–1.4) from **validation** (exact Arrhenius
     F_AA vs the familiar 6 °C rule). Rated design point lands at **109.98 °C** against the
     standard's 110 °C normal-life basis. The 6 °C rule is shown as the approximation it is: it
     overstates aging by −14.8 at 140 °C (17.2 exact vs 32.0 rule).
   - `api/rest.py`: `GET /api/validation/transformer`, `GET /api/projection/transformer`. Served
     over REST specifically so the documented `ServerMessage` WS union in `architecture.md` is
     unchanged.
   - `TransformerThermalModel.clone()` so a what-if run cannot disturb the live twin (tested).

   `console/` scaffolded: React 19 + TS strict + Tailwind v4 + Recharts + Zustand. Panels:
   transformer telemetry (every row hints its governing equation), thermal history, projection with
   the 95 % band, V&V view, scenario/intervention controls, and an agent panel that says plainly it
   is not connected — no sample reasoning, no placeholder numbers. `make dev` runs both; the Vite
   dev server proxies `/api` and `/ws` so there is no cross-origin special-casing.

   **Two defects found by running it, not by reading it:**
   - `Simulation.reset()` preserved the current cooling stage, so once a prospect engaged OFAF the
     demo could never be re-run from baseline. Reset now restores the initial stage (2 tests).
   - The projection reported a fake-precise collapsed CI once hot-spot was already past 120 °C.

   **Deviations from the docs, flagged:** Vite rather than Next.js (`CLAUDE.md` names the libraries
   but no bundler; this is a client-only overlay with no SSR/routing) and Tailwind v4's CSS-first
   config, so `console/tailwind.config.ts` from `architecture.md` does not exist — brand tokens live
   in `app/globals.css`, which is where `brand.md` puts them anyway.

   **Verified end-to-end in Chrome, not just unit-tested:** baseline 96.5 °C nominal → heat wave →
   K 1.32, hot-spot 134.4 °C, F_AA 10.44, critical → engage OFAF → K 0.79, hot-spot 103.0 °C,
   nominal. State-change log shows the full arc. Iframe embed confirmed (transparent body composites
   correctly, no `window.parent` access). Zero console errors. 41 backend tests, ruff clean,
   pyright 0 errors, tsc strict clean, eslint clean, production build clean.

6. **Browser-rendered 3D twin (2026-07-28).** Added after the user pointed out — correctly — that
   the demo had **no 3D at all**: `unreal/` never existed, `assets/sourcing/*.md` are research notes
   rather than models, and the console was an overlay over nothing. Decision: build a browser-native
   twin now on the Mac, keep Unreal as the later high-fidelity path on a PC.

   - `components/scene/`: substation transformer built from primitives — 3.0 × 2.0 × 1.7 m tank,
     three 230 kV bushings and two 34.5 kV bushings (differing shed counts read as step-down),
     radiator banks with fans on both faces, conservator drum, concrete plinth.
   - `lib/visualState.ts` is the **only** twin-state → visual mapping, so the scene renders nothing
     it invents: heat = `clamp01((hot_spot_c − 105)/(120 − 105))`, fan rad/s per cooling stage
     (ONAN is genuinely 0 — oil natural, air natural), pumps visible only on OFAF, alert only when
     the backend says `critical`.
   - Layout reflowed to side rails with the twin in the centre; scenario controls moved to a bottom
     bar. `<TwinScene>` sits in the exact layer the Pixel-Streamed video will occupy, so swapping it
     later touches one element and no overlay code.

   **Three visual defects found by looking at renders, not by typechecking:** the scene was too dark
   to read as a transformer (steel was at background luminance — materials lifted, lighting
   rebuilt); the heat cue tinted the whole tank flat pink, losing all form and blowing past
   `brand.md`'s ~10–15 % Forge Red budget (now a concentrated band high on the tank, where the
   winding hot-spot physically is); and the oil pumps were tinted Forge Red even though a running
   pump is cooling *working*, not an alert.

   Verified in Chrome across nominal → critical → OFAF, zero console errors. Bundle is now 1.56 MB
   (430 kB gzip) — Three.js dominates; worth code-splitting the scene before shipping to prospects.

   **`docs/unreal-handoff.md` written** for the PC-side work (⚠️ new file in `docs/`, which
   `CLAUDE.md` normally protects — created because the user asked for guidance; move or delete if
   unwanted). Covers the WS contract Unreal consumes, the visual mapping to port verbatim, the
   deterministic-emissive rule, build order to a working local stream, and the still-open GPU host.

7. **Real 3D model + full substation to US standards (2026-07-28).**

   **Model sourcing.** Poly Haven is CC0 with an open no-auth API but carries only
   urban distribution props (wrong asset class). Sketchfab has correct-class assets
   but `/v3/models/{uid}/download` returns **401** — an account is required, so the
   download is a manual step. Installed:
   **`high_voltage_power_transformer (1)` by b4_cobra**, uid
   `43277271f7aa4d538259a029e8337bea`, **CC-BY-4.0, commercial use allowed**.
   ⚠️ A different model shares the same name *and* the same 11,933 face count but is
   **CC BY-NonCommercial** — match on uid, never name. Credit is rendered by
   `components/ModelAttribution.tsx` and is a licence requirement, not decoration.

   **Lesson:** the first recommendation (a "substation drone scan") was made from
   metadata — name, face count, licence — without looking at it. The user checked and
   it was a photogrammetry capture of a *brick building*. Candidates are now judged by
   pulling thumbnails and viewing them; "Power Transformer" turned out to be a
   pressure vessel by the same test.

   **Dimensions to standard** (`lib/substationSpec.ts`, every value cited): tank
   9.0 × 4.0 × 5.0 m / ~236 t (was an invented 3.0 m); HV bushing phase spacing 3.2 m
   against the IEEE 1427 minimum of **1.97 m** at 230 kV / 900 kV BIL; bus 7.9 m above
   grade vs the NESC **4.57 m** floor; NESC fence 2.13 m + 0.3 m barbed.
   `verifyClearances()` asserts the layout against those minima rather than claiming
   compliance. Yard adds rigid tubular bus on post insulators, SF6 dead-tank breaker,
   surge arresters, CVTs, 12 m dead-end structure and control house — all **context,
   not twinned**; only the transformer carries live state, and BESS/line stay absent
   because their physics does not exist yet.

   **Two bugs found by looking at renders, not by typechecking.** The heat cue silently
   did nothing on the loaded mesh, twice: first because `emissiveIntensity = 0` zeroes
   three.js's `emissive` uniform (so the injected term multiplied by black — fixed with
   an own colour uniform); then because the height mask compared **local** vertex
   `position.y` against **world-space** bounding-box values, which for an FBX-converted
   mesh share no coordinate space, so the band was zero everywhere. Now masks in world
   space via `modelMatrix`.

   **Known limitation:** the mesh is 2 fused meshes / 2 materials with no separable
   parts, so **fan rotation cannot bind to it** — that cue exists only on the primitive
   fallback. A modelled (not scanned) LPT with separable geometry would restore it.
   Bundle is now 1.64 MB JS + 14 MB model payload; both need optimising (code-split the
   scene, convert PNG textures to WebP/KTX2) before this goes in front of prospects.

8. **Payload optimisation (2026-07-28).** Cold-load payload cut from ~15.6 MB to
   **2.67 MB** (~5.9×), measured over the production build, not the dev server —
   the dev server serves unbundled ES modules and reports a misleading 9 MB of JS.

   - **Model 14.54 MB → 1.05 MB (13.8×)** via `gltf-transform optimize`: WebP
     textures at 2048, meshopt-compressed geometry, and `prune` dropping three
     unused UV sets (the Sketchfab export carried `TEXCOORD_0..3` where one is
     used, which was most of the 1.2 MB `.bin`). Now a single `transformer.glb`;
     the raw `.gltf`/`.bin`/`textures/` are gone. Measured four configurations
     before choosing — meshopt+2048 (1.04 MB) beat plain+1024 (1.01 MB) on
     quality at the same size. **The meshopt decoder ships inside drei via
     three-stdlib**, so nothing is fetched at runtime and the CSP/offline
     constraint holds. Verified visually: no regression, heat cue still binds
     after `join`/`flatten`/`simplify` restructured the mesh graph.
   - **JS entry chunk 1.64 MB → 23 kB (7.4 kB gzip).** `TwinSceneLazy` code-splits
     the 3D layer so the operator console — the part carrying the actual numbers —
     paints without waiting on Three.js, and a slow or failed scene load can no
     longer block the data UI. Vendor trees split into `three` (327 kB gzip) and
     `charts` (116 kB gzip) so a change to one does not invalidate the other's
     cache entry.

   Remaining headroom if needed: lazy-load the three Recharts panels (would defer
   another 116 kB gzip), and serve brotli — the 2.67 MB figure is uncompressed
   transfer, so a real server with compression lands nearer ~600-700 kB.

9. **Agent layer, provider-agnostic (2026-07-28).** Built and running end-to-end.

   **Provider resolution** (`agent/provider.py`), per user instruction: `ANTHROPIC_API_KEY`
   → Anthropic; else `OPENAI_API_KEY` → OpenAI; else **local Ollama**. Ollama speaks the
   OpenAI chat-completions shape, so OpenAI and local share one client and differ only by
   `base_url` — two code paths, not three. ⚠️ This **deviates from `CLAUDE.md`**, which
   specifies the Anthropic SDK; provider-agnostic means neither is locked in.

   New modules: `sim/history.py` (ring buffer + least-squares trend, backing `query_history`),
   `agent/economics.py` (costed trade-offs; every constant cited to
   `docs/domain-transformer.md`, and values the doc does not give are marked **ASSUMED**
   with their basis), `agent/tools.py` (4 tools, schemas declared once in a provider-neutral
   shape), `agent/prompts.py`, `agent/loop.py` (streams `agent_thinking` / `tool_call` /
   `tool_result` / `agent_final`). `Simulation` gained `snapshot()` — deliberately distinct
   from `tick(0.0)`, because a read must not append to the history the agent is about to
   query — plus `simulate_plan()` for what-if runs on a clone.

   **Verified against local qwen2.5:7b:** 6 tool calls in the right order, correct plan
   comparison, and it recommended OFAF on net value. 17 new tests (58 total).

   **⚠️ Finding that matters commercially.** An automated audit of the answer — matching every
   number in the prose against every number any tool returned — found **24 of 27 traceable,
   3 fabricated**. The clearest case: `compute_limits` returned an *asymmetric* CI of
   [135.04, 191.35] around 162.47 °C, and the model reported it as a symmetric
   "162.47 ± 36.31 °C", inventing a half-width matching neither bound. That is exactly the
   fake-precise anti-pattern `docs/agent-design.md` forbids, and it validates the concern
   raised before building: a small local model cannot be trusted with the
   "every number traces to a tool call" discipline that *is* the differentiator.
   **Local is for development. A prospect-facing demo needs a hosted frontier model.**
   Mitigations shipped: the console labels a local provider and warns in-panel, and the tool
   traffic is rendered next to the prose so any claim can be checked against its source.

   Known gap: `docs/architecture.md` specifies `final_recommendation` as the structured
   `AgentRecommendation`; the Phase 1 agent emits prose, so the wire message carries `text`
   and the structured form waits for Phase 4.

   **Recommendation UI (same day).** Moved out of the right rail — where it was clipped —
   into the centre column as the Forge-Red-accented block `docs/agent-design.md` specifies,
   with the ranked options table and an Apply button that closes the bidirectional loop.

   The table is built from the **`simulate_forward` tool results**, not by parsing the
   agent's prose, and that decision paid immediately: on the very next run the model
   reported ONAN's net value as **−$508,679.65** when its own tool had returned
   **+$508,679.65**. A flipped sign — a fourth fabrication class, after the invented CI
   half-width. The table showed the correct figure because it never reads the prose.
   The card now labels the two regions explicitly ("Agent narrative" above, "computed by
   the twin" below) so a viewer knows which to trust, and flags any disagreement between
   the stage the agent names and the stage its own tools rank highest.

   Reinforces the standing conclusion: **local models are a development tool here.** The
   architecture is sound and provider-swappable; the model is the weak link.

10. **Recorded-playback fallback (2026-07-29).** `docs/architecture.md` requires the demo never
   hard-fail in front of a prospect. Both fallback paths now exist.

   - `sim/record.py` (`make record`) captures a **scripted run of the real simulation** — settle,
     heat wave at 1.2 h, OFAF intervention at 5.6 h, 9 h total — to
     `console/public/recorded/scenario.json` (451 frames at the 10 Hz twinning rate, 18 projection
     snapshots, the V&V report). Recording the actual C57.91 model rather than hand-writing a
     fixture matters: a fabricated fallback would be a credibility hole hiding inside the safety
     net, shown at exactly the moment we cannot defend it live.
   - `lib/recorded.ts` `RecordedPlayer` feeds the **same store actions** as the live WebSocket, so
     every panel, chart and the 3D scene work unchanged — no second rendering path to keep in step.
   - Two entry points: `?mode=recorded` forces playback, and `ConsoleSocket` falls back
     automatically after 3 failed connection attempts while reconnection keeps running underneath.
   - The connection chip reads **Recorded** in amber, not red — playback is a working degraded
     mode, not a failure — and `ScenarioControls` disables its buttons off `connection === "open"`,
     so nothing looks clickable that cannot act.

   **Defect found reading the handover path, not from a failing check** (everything was green):
   nothing stopped the player when the backend came back. `onGiveUp` started playback and the
   socket's `onopen` cleared its own give-up flag, but the player's interval kept running — so a
   recovered backend produced **two timelines interleaved into the same charts**. Fixed with an
   `onLive` callback on `ConsoleSocket` that stops the player and clears the timeline on handover,
   plus a `running` guard so a `start()` whose fetch resolves *after* recovery aborts instead of
   clobbering live state. The reconnect path is the one nobody watches in a demo and the one most
   likely to run during a bad-network pitch.

   **Verified in real Chrome (2026-07-29)**, driven by Playwright against the installed browser
   (`channel="chrome"`) from an ephemeral `uv` env — nothing added to project deps. 13 of 14
   assertions pass; the 14th is a test-clock artifact, traced and dismissed with evidence (a
   projection poll issued while the backend was still down, whose 500 landed at t=+0.00s as
   readiness flipped; every poll after is 200, and `fetchProjection`'s catch keeps the last band).
   - `?mode=recorded`: chip reads Recorded, telemetry advances, controls disabled, V&V populated
     from the recording, and **zero `/api/` requests** — the guard genuinely bypasses the backend.
   - Backend killed → falls back in **1.8 s**; restarted → hands back to Live in **2.8 s**,
     controls re-enable, chart vertices drop 101 → 31 (the timeline reset), and hot-spot holds
     96.5 °C ±0.00 across 12 samples — the interleaving defect above is confirmed fixed.

   ⚠️ **Two of the three re-runs failed on the harness, not the app** — a case-sensitive compare
   against a CSS-uppercased chip, and `count("L")` on recharts paths that are cubic Béziers (`C`).
   A third "failure" was a 3 s sample sitting inside the recording's flat opening — which turned
   out to be a real product problem, fixed below.

   **Opening dead air fixed (same day): 7.0 s → 2.4 s.** The recording was motionless for its first
   ~7 s, which as the *fallback a prospect meets first* reads as a broken demo. Measured where it
   came from rather than guessing: 6.0 s was a scripted pre-trigger baseline and ~1.0 s is the
   scenario's smoothstep toe plus winding lag. The twin is already at thermal equilibrium at t=0
   (0.0185 °C drift across those 60 frames), so **the baseline was buying nothing physically** — it
   was not a settling requirement. `BASELINE_HOURS` 1.2 → 0.3 h; `HEAT_HOURS`/`RECOVERY_HOURS` now
   name the other two beats and `TRIGGER_AT_HOURS`/`INTERVENE_AT_HOURS`/`TOTAL_HOURS` derive from
   them, so the offsets can't drift apart. (`SETTLE_HOURS` was dead code — declared, never read.)
   The ~1 s of smoothstep toe is left alone: that one is physics.

   Peak hot-spot is **unchanged at 142.7 °C** and the nominal → critical → OFAF-relief arc is
   intact — the loop is just 40.6 s instead of 45.1 s (318 kB, down from 362 kB). Confirmed in
   Chrome, not just in the capture log: hot-spot moves at t≈2.2 s and climbs steadily
   (96.5 → 98.1 °C by 4.6 s).

   `tests/test_record.py` (5 tests) holds this: opening motion within a 3 s budget, a beat of
   nominal state still present, the arc still reaching critical and recovering under OFAF,
   monotonic sim time, and projections that still carry a widening CI band. `make record` now
   prints the measured opening against the budget, so a longer baseline cannot creep back
   unnoticed. 63 backend tests.

   **Defect found by looking at the render, not by any check** (all static checks were green, and
   it is not fallback-specific — live mode has it too): the side rails are `overflow-y-auto` flex
   columns, but `Panel`'s `<section>` had no `shrink-0`, so flexbox compressed the box to 241 px
   while its content kept its natural ~308 px and **spilled past the border onto the panel below**
   (`overflow: visible`). The casualty was the `Band: weather + load forecast error propagated
   through C57.91` line — the one that names the uncertainty basis, which
   `credibility-checklist.md` requires in-product. Fixed with `shrink-0` in `components/Panel.tsx`;
   panel takes its natural 321 px and the rail scrolls as the layout already intended. Verified at
   1000 px and 800 px viewport heights.

   The console still has no test runner (adding one is a dependency decision, unasked), so this
   verification lives in a scratchpad Playwright script rather than in the repo.

11. **Blocked / still pending.**
   - **Frontier model for the agent.** The agent layer is built and provider-agnostic (item 9);
     what is missing is a hosted key. Local `qwen2.5:7b` fabricated numbers in two distinct ways,
     which breaks the one discipline that *is* the differentiator. Development only.
   - **Model choice is an open decision.** `docs/agent-design.md` specifies `claude-sonnet-4-5`
     (fallback `claude-haiku-4-5`), both now two generations old. Current equivalents are
     `claude-sonnet-5` / `claude-opus-5`. Decide before writing `agent/loop.py`; put the ID in one
     named constant.
   - Transformer render in Unreal (user-owned) and the **GPU host for Pixel Streaming** —
     unchanged, still unprovisioned.
