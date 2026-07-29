# ArkaForge Demo

Full-scale, industry-grade **digital twin of a power-grid substation node** with an agentic
operations layer. The 3D twin runs in Unreal Engine 5 and streams to any browser via Pixel
Streaming; embeddable in the ArkaForge website via iframe.

## What this is

A client-facing demo that proves ArkaForge's thesis: **AI agents reasoning over industrial
digital twins, proposing interventions with quantified trade-offs** — credible enough for a
power engineer, impressive enough for an executive.

The scene is one substation node serving a fast-growing data-center load, containing three
coupled, physically-modeled assets:

1. **Large Power Transformer (LPT)** — thermal + insulation aging (IEEE C57.91)
2. **Battery Energy Storage System (BESS)** — electro-thermal + degradation
3. **Transmission line** — dynamic line rating (IEEE 738)

A visitor triggers a heat-wave + data-center load spike and watches the agent reason across all
three assets — how to serve the load through the peak without cooking the transformer, burning
battery life, or exceeding the line's thermal limit — and present ranked, costed trade-offs.

Why a grid substation: US electricity demand is surging for the first time in ~20 years, driven
by AI/data-center load — the #1 problem in the US power industry (2025–26). See
[`RESEARCH-LOG.md`](./RESEARCH-LOG.md).

## Tagline

```
TRAIN IN SIMULATION. OPERATE IN REALITY.
```

## Status

Pivoted from the earlier single-wind-turbine demo (archived in `docs/_legacy/`). Pre-Phase-0:
research complete, docs recreated. See [`docs/build-plan.md`](./docs/build-plan.md).

## Stack

- **Experience:** Unreal Engine 5 + Pixel Streaming (WebRTC), cloud GPU host
- **Console:** React + TypeScript strict, Tailwind, Recharts, Zustand (HTML overlay)
- **Simulation:** Python 3.11+, NumPy/SciPy, pandapower/PyPSA (physics-verifiable twin state)
- **Agent:** Anthropic Python SDK (tool-use loop), `claude-sonnet-4-5` / `claude-haiku-4-5`
- **Transport/deploy:** FastAPI + WebSocket; backend on Fly.io/Railway; UE on AWS g5 / CoreWeave

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — context and rules for Claude Code
- [`RESEARCH-LOG.md`](./RESEARCH-LOG.md) — pivot rationale + US-power-industry / credibility / market research
- [`docs/architecture.md`](./docs/architecture.md) — three-tier system architecture
- [`docs/domain-transformer.md`](./docs/domain-transformer.md) — LPT thermal + aging physics
- [`docs/domain-bess.md`](./docs/domain-bess.md) — battery electro-thermal + degradation
- [`docs/domain-transmission.md`](./docs/domain-transmission.md) — dynamic line rating + power flow
- [`docs/agent-design.md`](./docs/agent-design.md) — agent tools, prompt, cross-asset reasoning
- [`docs/credibility-checklist.md`](./docs/credibility-checklist.md) — the hard build gate
- [`docs/build-plan.md`](./docs/build-plan.md) — phased build (transformer vertical slice first)
- [`docs/brand.md`](./docs/brand.md) — brand tokens and visual rules

## License

Proprietary. ArkaForge.
