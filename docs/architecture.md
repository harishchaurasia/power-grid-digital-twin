# Architecture

## Overview

A full-scale, client-facing digital-twin demo of a **grid substation node** (transformer +
BESS + transmission line) serving a data-center load. Three tiers:

1. **Experience layer** — Unreal Engine 5 renders the 3D twin; delivered to the browser by
   Pixel Streaming (WebRTC). A React **operator console** is composited on top as an HTML
   overlay for telemetry charts and the agent panel.
2. **Simulation core** — Python physics models (the authoritative twin state).
3. **Agent layer** — Anthropic SDK tool-use loop reasoning over twin state.

```
┌──────────────────────────────────────────────────────────────────────┐
│                    arkaforge.com  (marketing site)                     │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │            <iframe src="demo.arkaforge.com">                      │ │
│  │  ┌────────────────────────────────────────────────────────────┐  │ │
│  │  │  BROWSER                                                    │  │ │
│  │  │  ┌──────────────────────────┐  ┌───────────────────────┐   │  │ │
│  │  │  │  Pixel-Streamed video    │  │  React operator       │   │  │ │
│  │  │  │  (Unreal 3D twin)  <WebRTC> │  console overlay      │   │  │ │
│  │  │  │                          │  │  - telemetry charts   │   │  │ │
│  │  │  │                          │  │  - agent panel        │   │  │ │
│  │  │  └──────────────────────────┘  │  - scenario controls  │   │  │ │
│  │  │         ▲                       └───────────┬───────────┘   │  │ │
│  │  └─────────┼───────────────────────────────────┼───────────────┘  │ │
│  └───────────┼───────────────────────────────────┼──────────────────┘ │
└──────────────┼───────────────────────────────────┼────────────────────┘
        WebRTC │ (video + input)          WSS       │ (state + agent events)
               ▼                                     ▼
┌──────────────────────────────┐        ┌───────────────────────────────────┐
│  GPU HOST (cloud)            │        │  BACKEND  (FastAPI, Python)       │
│  ┌────────────────────────┐  │  WSS   │  ┌─────────────────────────────┐  │
│  │  Unreal Engine 5       │◄─┼────────┼─►│  Twin orchestrator          │  │
│  │  + Pixel Streaming      │  │ state  │  │  - simulation core (physics)│  │
│  │    (Signalling server)  │  │ sync   │  │  - agent loop (Anthropic)   │  │
│  └────────────────────────┘  │        │  │  - WS event router          │  │
└──────────────────────────────┘        │  └─────────────────────────────┘  │
                                         └───────────────────────────────────┘
```

### Why this shape

- **Unreal for the twin, React for the data.** In-engine UMG for charts/agent text would be
  slow to iterate and less accessible. Rendering the 3D twin in Unreal and the data/agent UI as
  a browser overlay gives us AAA visuals *and* crisp, accessible, fast-to-change data UI.
- **Pixel Streaming for reach.** A prospect opens a URL; no install, no local GPU. The heavy
  render runs on a cloud GPU and streams as video. This is how NVIDIA/industrial twins ship to
  the web.
- **Python owns physics truth.** One authoritative twin state, verifiable against standards,
  consumed by both Unreal (to render) and the agent (to reason). Unreal never invents state.

## Tiers in detail

### 1. Experience layer (Unreal + Pixel Streaming + console)

- **Unreal Engine 5** scene: the substation node — transformer, BESS enclosure/yard, outgoing
  transmission line/corridor, in the ArkaForge palette (stylized industrial, matte). Visual
  state (heat glow on the transformer, BESS rack activity, line loading) is **driven by twin
  state received from the backend**, never locally simulated.
- **Pixel Streaming**: UE Signalling & Web server; WebRTC transport of rendered frames + user
  input (camera, asset selection) to the browser.
- **React operator console** (separate web app, composited over the video): telemetry charts
  (Recharts), the agent reasoning panel, and scenario controls (trigger heat wave / load spike,
  run agent, apply intervention). Talks to the backend over its own WSS channel.

### 2. Simulation core (Python — authoritative twin state)

Physics models, one module per asset (see the domain docs for equations/standards):

- `sim/grid.py` — steady-state power flow via **pandapower/PyPSA** on an IEEE test case; sets
  the electrical context (bus voltages, real/reactive flows) the three assets live in.
- `sim/transformer.py` — **IEEE C57.91** top-oil + hot-spot thermal model; insulation aging
  (6 °C rule / loss-of-life).
- `sim/bess.py` — electro-thermal model + non-linear degradation (calendar + cycle aging as a
  function of DoD, C-rate, cell temperature); thermal-runaway margin.
- `sim/line.py` — **IEEE 738** conductor heat balance → dynamic ampacity vs static rating.
- `sim/scenario.py` — drives load (data-center ramp), weather (heat wave), and couples the
  assets (BESS dispatch offloads the transformer; line limits cap export).
- `sim/state.py` — the twin state machine and the Pydantic `TwinState` contract.

Runs at a fixed sim tick (target 10 Hz for smooth telemetry; physics sub-steps as needed).
Headless-runnable via `make sim` for physics-validation tests.

### 3. Agent layer (Anthropic SDK)

- `agent/tools.py`, `agent/loop.py`, `agent/prompts.py` — tools query twin state via a thin
  interface (never import sim internals directly). See `docs/agent-design.md`.
- Streams reasoning + tool calls + a final ranked, costed recommendation over WSS to the
  console.

## Transport & protocol

Two browser channels:

- **WebRTC (Pixel Streaming):** Unreal frames + camera/selection input. Handled by the UE
  Pixel Streaming frontend library; we extend its input handlers for asset selection.
- **WSS (backend ⇄ console, backend ⇄ Unreal):** JSON messages, `type`-discriminated, Pydantic
  on the backend mirrored by TS types in the console.

### Server → client (console)

```typescript
type ServerMessage =
  | { type: "telemetry"; payload: TwinSnapshot; timestamp: number }
  | { type: "state_change"; asset: AssetId; from: AssetState; to: AssetState; timestamp: number }
  | { type: "agent_thinking"; text: string; timestamp: number }
  | { type: "tool_call"; tool: string; input: unknown; call_id: string }
  | { type: "tool_result"; call_id: string; output: unknown }
  | { type: "final_recommendation"; recommendation: AgentRecommendation }
  | { type: "agent_done"; timestamp: number }
  | { type: "error"; message: string };
```

### Client → server (console)

```typescript
type ClientMessage =
  | { type: "trigger_scenario"; scenario: "heatwave_load_spike" | "reset" }
  | { type: "agent_invoke" }
  | { type: "apply_intervention"; intervention: InterventionId }
  | { type: "select_asset"; asset: AssetId };
```

### Backend ⇄ Unreal

Backend pushes `TwinSnapshot` to Unreal each tick (WSS or UE remote-control); Unreal maps it to
visual parameters. Asset selection from Pixel Streaming input is forwarded to the backend so the
console and 3D view stay in sync.

`AssetId = "transformer" | "bess" | "line"`.

## File structure

```
arkaforge-demo/
├── CLAUDE.md
├── README.md
├── RESEARCH-LOG.md
├── Makefile
├── docs/
│   ├── architecture.md            (this file)
│   ├── domain-transformer.md
│   ├── domain-bess.md
│   ├── domain-transmission.md
│   ├── agent-design.md
│   ├── credibility-checklist.md
│   ├── build-plan.md
│   ├── brand.md
│   └── _legacy/                   (archived wind-turbine demo — reference only)
├── backend/
│   ├── main.py                    (FastAPI app, WS endpoints)
│   ├── sim/
│   │   ├── grid.py  transformer.py  bess.py  line.py
│   │   ├── scenario.py  state.py
│   ├── agent/
│   │   ├── loop.py  tools.py  prompts.py
│   ├── api/
│   │   ├── ws_console.py  ws_unreal.py  schemas.py
│   ├── tests/
│   │   ├── test_transformer_thermal.py   (vs IEEE C57.91)
│   │   ├── test_line_rating.py           (vs IEEE 738)
│   │   ├── test_bess.py  test_grid_powerflow.py  test_agent.py
│   ├── pyproject.toml  ruff.toml
├── console/                       (React operator-console overlay)
│   ├── app/  components/  lib/
│   ├── package.json  tsconfig.json  tailwind.config.ts
└── unreal/                        (UE5 project)
    ├── ArkaForgeTwin.uproject
    ├── Source/  Content/  Config/
    └── PixelStreaming/            (signalling + web frontend config)
```

## Stack decisions

| Layer | Choice | Why |
|---|---|---|
| 3D experience | Unreal Engine 5 | AAA visuals; industrial-twin credibility; Pixel Streaming built-in |
| Web delivery | Pixel Streaming (WebRTC) | No install; cloud GPU; embeddable via iframe |
| Console UI | React + TS strict, Tailwind, Recharts, Zustand | Crisp, accessible data UI; fast iteration |
| Simulation | Python 3.11+, NumPy/SciPy, pandapower/PyPSA | Verifiable physics; IEEE test cases built in |
| Agent | Anthropic Python SDK | Native tool-use loop |
| Orchestration | FastAPI + WebSocket | Async, Pydantic contracts, native WS |
| GPU host | AWS g5 / Azure NV / CoreWeave | UE Pixel Streaming reference targets |
| Backend deploy | Fly.io / Railway | Cheap, WS-friendly |

## CORS & security

- Backend `CORSMiddleware`: allow `https://demo.arkaforge.com` and `http://localhost:*` (dev).
  WS origin checked in-handler.
- Anthropic API key stays on the backend. Never in Unreal or the console.
- Pixel Streaming signalling secured (TURN credentials, origin allowlist).

## Performance targets

- Pixel Streaming: 30 fps min, 60 fps target at 1080p; glass-to-glass latency < 150 ms on
  good network.
- Sim tick: 10 Hz stable; physics step never blocks the WS loop (run sim in its own task).
- Agent: first `agent_thinking` token < 2 s after invoke; full ranked recommendation < 15 s.
- Backend: 25+ concurrent console sessions; GPU concurrency bounded by host (document the cap;
  queue or scale out beyond it).

## Fallbacks (client demo must never hard-fail)

- **GPU/Pixel Streaming unavailable:** console shows a pre-recorded twin video loop + live
  telemetry/agent still driven by the backend (or a `?mode=recorded` full playback from static
  JSON). Defined in `docs/build-plan.md`.
- **Backend unreachable:** console enters recorded-scenario playback.
- Reconnect with exponential backoff on both WS and WebRTC.

## Out of scope (v1)

Refuse without explicit instruction: fleet/multi-node view; additional asset types; other
failure modes beyond the documented three; accounts/auth/persistence beyond session;
user-editable asset parameters; real industrial-protocol integration (OPC-UA, Modbus, DNP3);
VR/AR; multi-language; visitor analytics.
