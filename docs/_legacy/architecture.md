# Architecture

## Overview

A self-contained interactive demo embedded in the ArkaForge website via iframe. The demo consists of a Next.js frontend (3D scene + telemetry dashboard + agent panel) and a FastAPI backend (twin state + synthetic telemetry generator + agent orchestrator) connected by WebSocket.

```
┌──────────────────────────────────────────────────────────┐
│             arkaforge.com (existing site)                │
│  ┌────────────────────────────────────────────────────┐  │
│  │       <iframe src="demo.arkaforge.com">            │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │  Next.js frontend                            │  │  │
│  │  │  - 3D scene (R3F)                            │  │  │
│  │  │  - Telemetry dashboard (Recharts)            │  │  │
│  │  │  - Agent reasoning panel                     │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                            │ WSS
                            ▼
                ┌────────────────────────┐
                │    FastAPI backend     │
                │  - Twin state machine  │
                │  - Synthetic telemetry │
                │  - Agent loop          │
                │  - Anthropic SDK       │
                └────────────────────────┘
```

## Embed Strategy

**Iframe embed** is the deployment model. Decision rationale:

- Full CSS isolation (parent site styles cannot break demo, and vice versa)
- Tech stack independence (works regardless of whether main site is WordPress, Webflow, Next.js, plain HTML)
- Independent deploy cadence
- Easy fallback to recorded video if backend is down
- Easy A/B testing of demo variants

**Embed snippet for the marketing site:**

```html
<div style="position: relative; width: 100%; aspect-ratio: 16/9; max-height: 720px;">
  <iframe
    src="https://demo.arkaforge.com"
    style="position: absolute; inset: 0; width: 100%; height: 100%; border: 0;"
    title="ArkaForge wind turbine digital twin demo"
    loading="lazy"
    allow="autoplay"
  ></iframe>
</div>
```

**Iframe-safe constraints (enforced in code):**

- No `window.parent`, `window.top`, or `window.opener` access
- No assumption of parent page fonts or colors (all assets self-hosted or loaded from Google Fonts)
- No `postMessage` reliance for v1 (can be added later for parent-iframe communication)
- All routes resolve within the demo app (no external links opening in parent)

## Stack Decisions

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | Next.js 14 App Router + TypeScript strict | SSR for fast first paint inside iframe, type safety, mature ecosystem |
| Styling | Tailwind CSS | Fast iteration, clean brand token mapping via CSS variables |
| 3D | React Three Fiber + drei | Three.js with React ergonomics. Drei provides cameras, controls, helpers |
| Charts | Recharts | Lightweight, declarative, good defaults, easy theming |
| State | Zustand | Simpler than Redux for this scope, good TypeScript inference |
| Backend | FastAPI (Python 3.11+) | Native WebSocket, Pydantic v2 contracts, async-first |
| Realtime | WebSocket (WSS in prod) | Bidirectional, low overhead, FastAPI native support |
| Synthetic data | NumPy + SciPy | Physically plausible signal generation |
| Agent | Anthropic Python SDK | Tool use loop with claude-sonnet-4-5 (or haiku for cost) |
| Dep management (frontend) | pnpm | Fast, disk-efficient |
| Dep management (backend) | uv | Fast, modern, lockfile-first |
| Frontend deploy | Vercel | Zero-config Next.js, fast global edge |
| Backend deploy | Fly.io or Railway | Cheap, WebSocket-friendly, simple |

## File Structure

```
arkaforge-demo/
├── CLAUDE.md
├── README.md
├── Makefile
├── .gitignore
├── docs/
│   ├── architecture.md          (this file)
│   ├── domain.md
│   ├── agent-design.md
│   ├── build-plan.md
│   └── brand.md
├── frontend/
│   ├── app/
│   │   ├── layout.tsx           (root layout, fonts, brand vars)
│   │   ├── page.tsx             (main demo page, single route)
│   │   └── globals.css          (brand tokens, Tailwind directives)
│   ├── components/
│   │   ├── scene/
│   │   │   ├── TurbineScene.tsx
│   │   │   ├── Turbine.tsx
│   │   │   ├── Ocean.tsx
│   │   │   └── Lighting.tsx
│   │   ├── telemetry/
│   │   │   ├── TelemetryPanel.tsx
│   │   │   ├── TelemetryChart.tsx
│   │   │   └── StatusBadge.tsx
│   │   ├── agent/
│   │   │   ├── AgentPanel.tsx
│   │   │   ├── ReasoningStream.tsx
│   │   │   ├── ToolCallCard.tsx
│   │   │   └── Recommendation.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       └── Tagline.tsx
│   ├── lib/
│   │   ├── ws.ts                (WebSocket client)
│   │   ├── store.ts             (Zustand state)
│   │   └── types.ts             (shared TS types matching backend Pydantic)
│   ├── public/
│   │   └── fonts/               (Bebas Neue if self-hosted)
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── next.config.js
│   └── .eslintrc.json
└── backend/
    ├── main.py                  (FastAPI app + WebSocket endpoint)
    ├── twin/
    │   ├── __init__.py
    │   ├── state.py             (twin state machine)
    │   ├── physics.py           (power curve, rotor dynamics)
    │   ├── telemetry.py         (synthetic telemetry generator)
    │   └── degradation.py       (bearing failure model)
    ├── agent/
    │   ├── __init__.py
    │   ├── loop.py              (agent orchestration with tool use)
    │   ├── tools.py             (tool definitions wrapping twin)
    │   └── prompts.py           (system prompt)
    ├── api/
    │   ├── __init__.py
    │   ├── ws.py                (WebSocket handler, event routing)
    │   └── schemas.py           (Pydantic models)
    ├── tests/
    │   ├── test_physics.py
    │   ├── test_telemetry.py
    │   └── test_agent.py
    ├── pyproject.toml
    └── ruff.toml
```

## Data Flow

### Telemetry stream (continuous)

```
twin/telemetry.py generates 10Hz samples
       │
       ▼
twin/state.py updates state (healthy/degrading/critical based on degradation parameter)
       │
       ▼
api/ws.py serializes to JSON and pushes to all connected clients
       │
       ▼ WebSocket
       │
frontend/lib/ws.ts receives, writes to Zustand store
       │
       ▼
React components subscribe (selective) and re-render
```

### Agent invocation (on demand)

```
User clicks "Run agent analysis" OR anomaly threshold crossed
       │
       ▼ WS message: { type: "agent_invoke" }
       │
backend api/ws.py routes to agent/loop.py
       │
       ▼
agent/loop.py calls Anthropic SDK with tools defined in agent/tools.py
       │
       ▼ (tool use loop)
Each tool call:
  - Anthropic returns tool_use block
  - Backend executes tool against twin state
  - Backend streams to frontend: { type: "tool_call", ... }, { type: "tool_result", ... }
  - Backend returns tool_result to Anthropic
       │
       ▼
Final assistant message streams to frontend: { type: "agent_thinking", text: "..." }
       │
       ▼
On completion: { type: "final_recommendation", structured: {...} }
       │
       ▼
Frontend renders in AgentPanel
```

## WebSocket Protocol

All messages are JSON with a `type` discriminator. Schemas defined in `backend/api/schemas.py` and mirrored in `frontend/lib/types.ts`.

### Server -> Client

```typescript
type ServerMessage =
  | { type: "telemetry"; payload: TelemetrySnapshot; timestamp: number }
  | { type: "state_change"; from: TwinState; to: TwinState; timestamp: number }
  | { type: "agent_thinking"; text: string; timestamp: number }
  | { type: "tool_call"; tool: string; input: unknown; call_id: string }
  | { type: "tool_result"; call_id: string; output: unknown }
  | { type: "final_recommendation"; recommendation: AgentRecommendation }
  | { type: "agent_done"; timestamp: number }
  | { type: "error"; message: string }
```

### Client -> Server

```typescript
type ClientMessage =
  | { type: "trigger_anomaly" }
  | { type: "reset_scenario" }
  | { type: "agent_invoke" }
  | { type: "apply_intervention"; intervention: InterventionId }
```

## State Machines

### Twin state

```
healthy ──(degradation_param > 0.3)──> degrading ──(degradation_param > 0.8)──> critical
   ▲                                       │                                       │
   │                                       │                                       │
   └─────────(reset_scenario)──────────────┴───────────────────────────────────────┘
```

### Frontend agent UI state

```
idle ──(invoke)──> running ──(final_recommendation)──> showing_result
  ▲                                                          │
  │                                                          │
  └─────────────────(apply_intervention)────────────────────┘
```

## CORS and Security

The backend must allow connections from the iframe origin. Configure `fastapi.middleware.cors.CORSMiddleware` with:

- `allow_origins`: `["https://demo.arkaforge.com", "http://localhost:3000"]` (and the marketing site origin if backend is called directly)
- `allow_methods`: `["GET", "POST"]`
- WebSocket origin check enforced in the WS handler

API key for Anthropic stays on backend. Never expose to frontend.

## Performance Targets

- First contentful paint inside iframe: < 1.5s on 4G
- 3D scene runs at 60fps on mid-range laptop (no constraint on low-end mobile for v1)
- WebSocket message latency: < 100ms round trip
- Agent response: streaming starts < 2s after invocation, full response within 15s
- Backend handles 50 concurrent WebSocket connections (enough for early demo traffic)

## Out of Scope (v1)

Refuse to add any of these without explicit instruction:

- Fleet view, multiple turbines, comparison views
- Multiple failure modes (only HSS bearing)
- User accounts, authentication, persistence beyond session
- Customizable scenarios or asset parameters
- Real industrial protocol integration (OPC-UA, Modbus, MQTT to actual hardware)
- VR/AR mode
- Mobile-first layout (works on mobile, but desktop is the design target)
- Multi-language support
- Analytics or telemetry collection on visitors
