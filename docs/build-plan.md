# Build Plan

Full-scale, multi-developer, multi-month build. Strategy: **prove one asset end-to-end through
the entire three-tier stack (the transformer vertical slice), then replicate the proven pattern
to BESS and the line, then make the agent reason across all three.** Physics correctness gates
every phase (`docs/credibility-checklist.md`). This supersedes the archived single-turbine plan
(`docs/_legacy/build-plan.md`).

Rough order-of-magnitude: ~4–6 months with a small multi-disciplinary team (sim/physics,
backend/agent, Unreal, frontend). Treat phase durations as sequencing, not commitments.

## Phase 0 — Foundation (the three tiers say hello)

**Goal:** end-to-end skeleton across all three tiers, no physics yet.

**Deliverables**
- Repo scaffold per `docs/architecture.md` (`backend/`, `console/`, `unreal/`).
- Backend: FastAPI, two WS endpoints (`ws_console`, `ws_unreal`), Pydantic `TwinState` stub,
  structlog. Sim loop tick emitting a placeholder state at 10 Hz.
- Console: React + TS strict + Tailwind + brand tokens; connects over WSS; renders a "connected"
  indicator and an empty telemetry/agent shell.
- Unreal: UE5 project with a placeholder substation blockout; **Pixel Streaming** running,
  reachable in a browser; receives the placeholder `TwinState` and moves one debug value.
- `Makefile` (`dev`, `backend`, `console`, `sim`, `typecheck`, `lint`, `test`).

**Exit criteria:** in a browser, the Pixel-Streamed Unreal scene renders with the React console
composited over it, both driven by one backend heartbeat. Deployed dev GPU host reachable.

## Phase 1 — Transformer vertical slice (the credibility proof)

**Goal:** one asset, fully real, through the whole stack + agent. This phase de-risks everything.

**Deliverables**
- `sim/transformer.py`: IEEE C57.91 thermal model (top-oil + hot-spot with τ), F_AA aging, cooling
  stages, DGA trend. `sim/scenario.py`: heat-wave + load ramp driving it.
- **Validation tests** (`tests/test_transformer_thermal.py`): model output vs a C57.91 worked
  example; F_AA vs the 6 °C rule. Must pass to exit.
- Unreal: transformer asset renders state — thermal cue (matte→Forge-Red glow) bound to hot-spot,
  cooling-stage visual. No invented physics in-engine.
- Console: transformer telemetry panel (hot-spot, top-oil, K, F_AA) with a **validation view**
  (model vs reference, residuals) and uncertainty bands.
- Agent (single-asset subset of tools): `get_node_state`, `query_history`, `compute_limits`,
  `simulate_forward` for transformer-only plans; ranked, costed recommendation.

**Realism checklist**
- Hot-spot lags load via τTO/τW (no instant jumps).
- F_AA strictly from the Arrhenius equation; 6 °C ⇒ ~2× verified in a test.
- Every displayed number names its source (C57.91) in the inspector.

**Exit criteria:** trigger the scenario → hot-spot climbs plausibly → agent identifies the
C57.91 limit, projects time-to-120 °C as a range, and recommends cooling/offload with a costed
table. QA checklist (`agent-design.md`) passes for the transformer. Physics tests green.

## Phase 2 — BESS asset

**Goal:** replicate the vertical-slice pattern for the battery.

**Deliverables**
- `sim/bess.py`: electro-thermal (Q_gen, lumped thermal with τ_th) + non-linear degradation
  (calendar + cycle, rainflow) + runaway margin + early-warning signals.
- Tests (`tests/test_bess.py`): thermal time-constant behavior; degradation non-linearity in
  DoD/C-rate; margin never crossed by the controller.
- Unreal: BESS enclosure/yard renders SOC, dispatch activity, thermal state.
- Console: BESS panel (SOC, C-rate, cell temp, dT/dt, SOH, runaway margin).
- Agent tools extended to BESS; dispatch as an intervention.

**Exit criteria:** agent optimizes dispatch for value while holding the thermal margin; refuses
to cross it under price pressure (QA). Tests green.

## Phase 3 — Transmission line + power flow + coupling

**Goal:** the line asset, the grid context, and the physical coupling among the three.

**Deliverables**
- `sim/line.py`: IEEE 738 dynamic rating (weather-driven ampacity + conductor temp).
- `sim/grid.py`: pandapower/PyPSA power flow on an IEEE test case; `run_power_flow` tool.
- Tests: line rating vs an IEEE 738 example; power flow vs the published test-case solution.
- **Coupling in `sim/scenario.py`:** BESS discharge lowers transformer K and line flow;
  `simulate_forward` returns coupled cross-asset trajectories + combined economics.
- Unreal: transmission corridor renders loading vs dynamic rating; conductor thermal cue.
- Console: line panel (loading vs dynamic/static, conductor temp, headroom, weather inputs).

**Exit criteria:** all three assets live and physically coupled; `simulate_forward` produces a
consistent cross-asset trajectory an engineer can sanity-check. Power-flow and IEEE 738 tests
green.

## Phase 4 — Cross-asset agent reasoning (the full scenario)

**Goal:** the money shot — agent reasons across all three assets in one recommendation.

**Deliverables**
- Full `agent/` toolset and system prompt per `docs/agent-design.md`; ranked plans that trade the
  three assets off, respecting both hard limits.
- Console: full recommendation block with the ranked, costed options table; intervention buttons
  that apply a plan and update twin state (bidirectional loop).
- Scenario script: land → heat-wave + load spike → agent analysis → apply intervention → resolved.

**Exit criteria:** the QA checklist in `agent-design.md` fully passes; every quantitative claim
traces to a tool; the agent states cross-asset coupling explicitly; telemetry-to-decision < 15 s.

## Phase 5 — Polish, fallbacks, deploy

**Goal:** production-ready client demo on the web.

**Deliverables**
- Copy: headline, sub, tagline (`TRAIN IN SIMULATION. OPERATE IN REALITY.`), CTA micro-copy.
- Loading/error/reconnect for both WSS and WebRTC (exponential backoff).
- **Fallbacks** (`docs/architecture.md`): recorded twin-video + live backend, and full
  `?mode=recorded` playback if backend/GPU is down. A 60–90 s screencap fallback recorded.
- Unreal + Pixel Streaming deployed on the GPU host; backend on Fly.io/Railway (WSS); CORS for
  the marketing origin; TURN/signalling secured; GPU-concurrency cap documented (queue beyond it).
- Iframe embed snippet documented and tested on Chrome/Safari/Firefox.

**Exit criteria:** a fresh prospect opens the link (or the iframe on the marketing site), runs
the full scenario with no instructions in < 90 s, on all three major browsers; recorded fallback
verified.

## Done definition

The demo ships when:
1. Within ~30 s a visitor understands: AI agents reason over industrial twins and recommend
   interventions with quantified trade-offs.
2. The telemetry could be shown to a substation/grid engineer without them laughing (physics
   traces to C57.91 / IEEE 738 / verifiable power flow).
3. The agent's cross-asset recommendation could be shown to a domain expert without eye-rolling.
4. The visual identity reads as ArkaForge, not generic SaaS — and visuals never stand in for
   fidelity.
5. It runs reliably enough to demo live over Pixel Streaming, with a recorded fallback ready.
6. The iframe embed works on the marketing site across major browsers.

Ship. Iterate from real prospect feedback.
