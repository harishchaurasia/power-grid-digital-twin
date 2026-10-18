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

## Running the demo

One command. It reclaims the ports from any previous session, starts Ollama and pre-loads the
model if the agent resolves to a local one, then brings up the backend and console — waiting
until each actually answers before telling you it is ready.

```bash
make demo            # start; open http://localhost:5173
make demo-restart    # same, but take ports 8000/5173 from whatever holds them
```

Ctrl-C stops everything it started. It never stops a server it did not start: if a port is held
by a process it cannot identify as this project's, it refuses and names the process rather than
killing it — `make demo-restart` overrides that.

**First run only:** `make install`.

### Which model the agent uses

Resolved by `backend/agent/provider.py`, and the script asks the app rather than deciding for
itself:

| Environment | Provider |
|---|---|
| `ANTHROPIC_API_KEY` set | Anthropic — use this for anything prospect-facing |
| `OPENAI_API_KEY` set | OpenAI |
| neither | local Ollama (`qwen2.5:7b`), started and pinned automatically |

⚠️ **Presenting on the local model:** trust the ranked options table over the agent's prose. The
table is built from `simulate_forward` tool output; the narrative is the model's summary, and a
local 7B has stated a net value with the sign flipped from what its own tool returned
(`RESEARCH-LOG.md` §9). Export an `ANTHROPIC_API_KEY` before showing this to a prospect.

The model is pinned in memory for the session, because Ollama otherwise unloads it after ~5
minutes idle and the reload adds ~20 s to the next analysis. Set
`ARKAFORGE_OLLAMA_KEEP_ALIVE=5m` to reclaim the RAM instead.

### If something goes wrong

Logs are printed on startup, under `$TMPDIR/arkaforge-demo/`. Common cases:

- **`port … is held by something this script does not recognise`** — a stray server. The message
  names it; `make demo-restart` takes the port regardless.
- **`APIConnectionError`** in the agent panel — Ollama is not running. `make demo` starts it; if
  it was already up before the backend, restart with `make demo-restart`.
- **Agent panel says it is unavailable** — the backend was started without `--extra agent`. Use
  `make demo`, not a hand-rolled `uvicorn` command.

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
