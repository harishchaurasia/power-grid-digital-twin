# CLAUDE.md

ArkaForge digital-twin platform demo: a **full-scale, industry-grade interactive digital twin
of a power-grid substation node**, with an agentic operations layer. Built as a client-facing
sales demo — it must be *credible* to a power engineer and *impressive* to an executive. The
3D experience runs in **Unreal Engine 5** and is delivered to any browser via **Pixel
Streaming**, so a prospect can open a link and try it. The goal is to prove ArkaForge's thesis:

> **AI agents reasoning over industrial digital twins, proposing interventions with quantified
> trade-offs.**

This project supersedes the earlier single-wind-turbine demo (archived in `docs/_legacy/`).
The thesis is unchanged; the asset, scale, and stack are new.

## Read first

@./docs/architecture.md
@./docs/domain-transformer.md
@./docs/domain-bess.md
@./docs/domain-transmission.md
@./docs/agent-design.md
@./docs/credibility-checklist.md
@./docs/build-plan.md
@./docs/brand.md
@./RESEARCH-LOG.md

If you have not read these, do not write code. The domain docs are what separate a credible
industrial twin from a pretty toy. `credibility-checklist.md` is a hard build gate.

## Scenario

- **Node:** one grid substation serving a fast-growing data-center load (the #1 US power
  problem of 2025–26 — see `RESEARCH-LOG.md`).
- **Assets twinned (all three):**
  1. **Large Power Transformer (LPT)** — the substation's main step-down transformer.
  2. **Battery Energy Storage System (BESS)** — co-located, for peak shaving / arbitrage.
  3. **Transmission line** — the outgoing feeder, thermally rate-limited.
- **Precipitating event:** a heat wave coincident with a data-center load spike.
- **Agent role:** serve the load through the peak without (a) driving transformer hot-spot
  into accelerated insulation aging, (b) burning excess BESS cycle life or crossing a thermal
  safety margin, or (c) exceeding the transmission line's dynamic thermal limit — and present
  the ranked, costed trade-offs of each option.

One node. Three coupled assets. One agent reasoning across them. Depth and credibility over
breadth.

## Deployment model

- **Experience layer:** Unreal Engine 5, rendered on cloud GPU, delivered by **Pixel
  Streaming** (WebRTC) to the browser. Embeddable in an `<iframe>` on the marketing site.
- **Operator console UI** (telemetry charts, agent panel): HTML/React overlay composited on
  top of the Pixel-Streamed video in the browser — not rendered in-engine. Keeps data/agent UI
  crisp, accessible, and fast to iterate.
- **Simulation + agent backend:** Python (FastAPI), physics models + Anthropic SDK.
- Self-contained: no external nav, no dependency on parent-site context, full isolation.

See `docs/architecture.md` for the three-tier design and transport.

## Stack

- **Experience:** Unreal Engine 5 (C++/Blueprints), Pixel Streaming (Signalling + WebRTC),
  cloud GPU host.
- **Console UI:** React + TypeScript strict, Tailwind, Recharts, Zustand — an overlay app.
- **Simulation core:** Python 3.11+, NumPy/SciPy, **pandapower/PyPSA** (power flow on IEEE
  cases), physics models per the domain docs (IEEE C57.91, IEEE 738, electro-thermal BESS).
- **Agent:** Anthropic Python SDK (tool use loop), `claude-sonnet-4-5` (or `claude-haiku-4-5`
  if cost-driven — never a mock).
- **Orchestration/transport:** FastAPI + WebSocket between backend, Unreal, and console.
- **Deploy:** Unreal + Pixel Streaming on a GPU host (AWS g4/g5, Azure NV, or CoreWeave);
  backend on Fly.io/Railway; console via the Pixel Streaming web frontend.

## Hard rules

1. **Physics before pixels. Visual realism is NOT fidelity.** The research is explicit that
   "pretty 3D standing in for fidelity" is the #1 tell of a toy demo. Every telemetry value and
   every agent number must trace to a real physics model or named standard. Unreal is the skin;
   the physics core is the product.

2. **Telemetry must be physically correct and verifiable.** Transformer thermal follows
   **IEEE C57.91** (top-oil + hot-spot, the 6 °C insulation-aging rule). Line rating follows
   **IEEE 738** (conductor heat balance). BESS follows an electro-thermal + degradation model.
   Power flow uses **pandapower/PyPSA on a published IEEE test case** so an engineer can verify
   the numbers. If you find yourself writing `random.gauss(0, 1)` as a signal, stop and read the
   domain docs.

3. **Agent never invents numbers.** Agent tools return real (simulated) values from twin state.
   The agent reports tool output and reasons over it. No hallucinated telemetry, ever.

4. **Show uncertainty.** Failure/limit windows are ranges with probability, never fake-precise
   timestamps. Projections carry confidence bands. This is a credibility requirement (V&V/UQ),
   not a nicety.

5. **Scope discipline.** One substation node, three assets, one agent loop. No fleet view, no
   additional asset types, no login, no persistence beyond session, no scenario customization
   beyond the documented controls. If a feature is not in `docs/build-plan.md`, ask first.

6. **Brand discipline.** Forge Red `#FF3B00` is an accent only (alerts, CTAs, critical state).
   Void Black `#0B0C0F` is base. No other colors without justification. See `docs/brand.md`.

7. **Stylized industrial, not photoreal-for-its-own-sake.** Unreal buys clarity and legibility
   of the twin, in the brand palette — matte industrial. Photoreal detail must serve
   comprehension, never substitute for physics fidelity.

8. **TypeScript strict** (console). No `any` without a justifying comment.

9. **Python type hints everywhere.** Pydantic v2 models for all API/twin contracts. No
   dict-shaped payloads.

10. **Iframe- and stream-safe.** No `window.parent`/`window.top` access. No assumptions about
    parent page styles/fonts/scroll. All state contained to the demo. Pixel Streaming and the
    console overlay must degrade gracefully (see build-plan fallbacks).

## Conventions

### Unreal
- Simulation is authoritative in the Python core; Unreal is a **view + controller**, not a
  source of physics truth. Unreal receives twin state and renders it; user actions go back to
  the backend as intents.
- Prefer data-driven Blueprints/DataTables over hard-coded scene values. No magic numbers in
  Blueprints; drive from backend state or named config.
- Keep the render deterministic w.r.t. twin state so a given state always looks the same.

### TypeScript / React (console)
- Functional components only. Named exports preferred. Props interfaces `[Component]Props`.
- Zustand for cross-component state, `useState` for local only.
- Tailwind inline, no `@apply`. CSS variables for brand tokens (see `docs/brand.md`).
- Files: PascalCase components, kebab-case utilities.

### Python
- Type hints on every public function. Pydantic v2 for all contracts.
- One responsibility per module. `uv` for deps. FastAPI dependency injection over globals.
- Structured logging (`structlog`), not `print`.

### Code style
- No comments unless explaining a non-obvious *why*. Names carry the *what*.
- No magic numbers. Named constants at module top; physical constants cite their source
  standard.
- Functions under 50 lines, modules under 300. Refactor when exceeded.

## Commands

Defined as the project scaffolds (Phase 0 in `docs/build-plan.md`). Expected targets:
- `make dev` — backend + console concurrently
- `make backend` / `make console` — individually
- `make sim` — run the simulation core standalone (headless, for physics validation)
- `make typecheck` — tsc + pyright
- `make lint` — eslint + ruff
- `make test` — all tests, including physics-validation tests
- Unreal builds via UE tooling (documented in `docs/architecture.md`), not `make`.

## Always do

- Read the relevant domain doc before generating any telemetry for that asset.
- Validate physics against the named standard (write a test that checks the model output
  against the textbook equation / IEEE test-case published solution).
- Run `make typecheck` and `make test` before declaring a phase complete.
- Show a diff before applying multi-file changes.
- Ask before adding a new dependency.
- Test inside an iframe and over Pixel Streaming (not just the local console) before calling UI
  work done.

## Never do

- Add features not in `docs/build-plan.md` without confirmation.
- Mock the agent. Always real Anthropic SDK calls (`claude-haiku-4-5` if cost is the concern).
- Use placeholder/dummy data where synthetic-but-physically-correct is the spec.
- Let visual polish substitute for physics correctness.
- Add authentication, user accounts, or persistence beyond session.
- Disable strict mode, type checks, or lint rules to make code compile.
- Access `window.parent`/`window.top` or assume parent-page context.
- Modify files in `docs/` (including `docs/_legacy/`) without explicit instruction, except the
  living `RESEARCH-LOG.md`.

## Current phase

**Phase 0: Foundation & vertical slice planning.** See `docs/build-plan.md`. The build phases
the three assets: **transformer first as a credible vertical slice through the full three-tier
stack**, then BESS and transmission line replicate the proven pattern. Update this section when
transitioning phases.
