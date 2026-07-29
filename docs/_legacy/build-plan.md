# Build Plan

Total timeline: 14 to 17 working days. Two-week focused sprint with buffer for polish.

## Phase 0: Foundation (Day 1 to 2)

Goal: scaffolds running, brand tokens loaded, empty WebSocket connection working end to end.

**Deliverables**
- Monorepo structure created per `docs/architecture.md`
- Frontend: Next.js 14 with TypeScript strict, Tailwind, brand CSS variables, Bebas Neue + Inter loaded
- Backend: FastAPI scaffold with `/ws` echo endpoint, structured logging via structlog
- Makefile with `dev`, `frontend`, `backend`, `typecheck`, `lint`, `test`
- `.gitignore`, `.env.example`, `pyproject.toml`, `package.json`
- Frontend connects to backend over WebSocket and exchanges ping/pong
- Both run under `make dev` with hot reload

**Exit criteria:** Visiting `localhost:3000` in a browser shows a blank dark page with a "connected" indicator pulling from the backend over WS.

**Claude Code prompts**
- "Scaffold a Next.js 14 App Router app with TypeScript strict mode, Tailwind, in `frontend/`. Configure Tailwind theme with CSS variables from `docs/brand.md`. Load Bebas Neue and Inter from Google Fonts in the root layout."
- "Scaffold a FastAPI app in `backend/` with one WebSocket endpoint at `/ws`. On connect, echo messages and emit a heartbeat every second. Use Pydantic v2 for the message schema. Use uv for dependency management."
- "Create a Makefile at the repo root with targets: dev, frontend, backend, typecheck, lint, test. The dev target should run frontend and backend concurrently using a tool like `concurrently` or `make -j 2`."

---

## Phase 1: Twin Backend (Day 3 to 5)

Goal: synthetic telemetry streaming over WebSocket, physically plausible.

**Deliverables**
- `twin/physics.py` with power curve, rotor dynamics
- `twin/telemetry.py` with synthetic generators for all signals listed in `docs/domain.md`
- `twin/degradation.py` with bearing fault model
- `twin/state.py` with twin state machine (healthy/degrading/critical) driven by degradation parameter
- 10 Hz telemetry stream pushed over WebSocket
- Frontend receives and logs telemetry (no rendering yet, just console)
- Tests in `tests/test_physics.py` and `tests/test_telemetry.py`

**Realism checklist (must verify)**
- Wind speed: Weibull(k=2, lambda=10), 1/f temporal correlation
- Power output matches piecewise curve from `docs/domain.md`, follows wind
- Vibration spectrum has correct peaks at BPFI/BPFO/BSF frequencies
- Sidebands at +/- shaft frequency around fault peaks
- Bearing temperature has thermal time constant (slow drift, not noise)
- Degradation parameter modulates fault peak amplitudes per `docs/domain.md`

**Exit criteria:**
- Backend logs show physically plausible telemetry continuously
- Plot one minute of wind speed and verify it looks like wind (not white noise)
- Plot vibration spectrum at d=0 and d=0.8 and verify peaks grow at correct frequencies
- `pytest tests/` passes

**Claude Code prompts**
- "Implement `twin/physics.py` with the power curve from `docs/domain.md`. Function `compute_power(wind_speed_ms: float) -> float` returns MW. Add unit tests in `tests/test_physics.py` covering cut-in, ramp, rated, and cut-out regions."
- "Implement `twin/telemetry.py` with a `TelemetryGenerator` class that yields synthetic samples at 10 Hz. Use NumPy. Follow `docs/domain.md` exactly for distributions and ranges. Wind speed via Weibull with 1/f noise. Vibration spectrum with fault frequencies modulated by degradation parameter."

---

## Phase 2: Frontend Scene + Dashboard (Day 6 to 9)

Goal: visitor sees the turbine and live telemetry charts.

**Deliverables**
- `components/scene/TurbineScene.tsx` with R3F canvas, lighting, ocean, turbine
- `components/scene/Turbine.tsx` with parameterized RPM, takes telemetry from store
- `components/telemetry/TelemetryPanel.tsx` with four Recharts panels (2x2 grid)
- `lib/store.ts` Zustand store: telemetry buffer, twin state, agent state
- `lib/ws.ts` WebSocket client writing to store
- Smooth 60fps animation
- All in brand palette per `docs/brand.md`

**Visual rules (enforced in code review)**
- No photoreal materials. Matte everything.
- Forge Red `#FF3B00` only on hub and accents (no general use)
- Tower: dark monolithic, slight taper from base to top
- Water: stylized animated plane, dark, subtle ripple
- Sky: solid Void Black, no clouds

**Exit criteria:**
- Visiting the page shows a rotating turbine with blade speed tied to live RPM
- Four telemetry charts update in real time with rolling 5-minute windows
- Page works inside an iframe (test by creating a separate `test-embed.html` that iframes it)
- Lighthouse performance score above 85

**Claude Code prompts**
- "Build `components/scene/Turbine.tsx` in React Three Fiber. Tower: CylinderGeometry tapered from radius 0.95 (base) to 0.45 (top), height 15. Nacelle: BoxGeometry 3.0 x 1.2 x 1.4 at top of tower. Hub: CylinderGeometry rotated 90deg, color Forge Red. Three blades as elongated BoxGeometry, group rotating around hub axis at a rate set by the `rotorRpm` prop. Materials: MeshStandardMaterial with roughness 0.5+, no metalness above 0.2."
- "Build `components/telemetry/TelemetryPanel.tsx` with four Recharts AreaCharts in a 2x2 CSS grid. Each panel shows a rolling 5-minute window of one signal (power, vibration RMS, gearbox temp, wind speed). Read from the Zustand store. Use brand CSS variables for colors."

---

## Phase 3: Agent Loop (Day 10 to 13)

Goal: agent panel works end to end. Visitor clicks "Run agent analysis," agent reasoning streams in, final recommendation appears.

**Deliverables**
- `agent/tools.py` with four tools per `docs/agent-design.md`
- `agent/prompts.py` with the system prompt
- `agent/loop.py` with the tool use orchestration loop
- WebSocket protocol extension for agent events (per `docs/architecture.md`)
- `components/agent/AgentPanel.tsx` with reasoning stream + tool call cards + final recommendation
- Anomaly auto-injection: degradation parameter ramps up over ~30 seconds after visitor clicks "Trigger anomaly"
- Intervention buttons: visitor can accept agent recommendation, twin state updates accordingly

**Agent quality bar**
- Run the agent manually against healthy state, Stage 3, Stage 4. Verify per QA checklist in `docs/agent-design.md`.
- Read every agent recommendation aloud. If it sounds like a generic LLM, iterate the prompt.

**Exit criteria:**
- Agent invocation completes in under 15 seconds
- Every quantitative claim in agent output traces to a tool call
- Manual QA checklist in `docs/agent-design.md` passes
- Recommendation rendering is clean and uses brand styling

**Claude Code prompts**
- "Implement the four agent tools in `agent/tools.py` per `docs/agent-design.md`. Each tool is a Python function with a corresponding Anthropic tool schema. Tools query twin state (do not import twin internals directly; use a thin interface)."
- "Implement the agent loop in `agent/loop.py`. Use the Anthropic Python SDK's tool use loop. Stream incremental text via the provided callback. Emit structured events for tool_call, tool_result, agent_thinking, final_recommendation."
- "Build `components/agent/AgentPanel.tsx`. Renders agent state: idle (CTA button), running (streamed reasoning with collapsible tool cards), done (highlighted recommendation block with intervention buttons)."

---

## Phase 4: Polish + Deploy (Day 14 to 17)

Goal: production-ready demo embedded in the marketing site.

**Deliverables**
- Scenario script polish: visitor lands -> healthy -> trigger anomaly -> agent analysis -> intervention -> resolved
- Copy: headline, sub, tagline at bottom, micro-copy on CTAs
- Loading states, error states, reconnect logic on WebSocket
- 60-second screencap recorded as fallback if backend goes down
- Frontend deployed to Vercel as `demo.arkaforge.com`
- Backend deployed to Fly.io with WSS
- CORS configured for marketing site origin
- Iframe embed snippet documented (in `docs/architecture.md`)
- Marketing site updated with iframe embed

**Copy candidates (pick one for headline)**
- "The operations layer for industrial AI."
- "Twins that think ahead."
- "From telemetry to decision in seconds."

**Tagline at footer:** `TRAIN IN SIMULATION. OPERATE IN REALITY.` (Bebas Neue, letter-spacing 0.05em)

**Exit criteria:**
- Live demo at `demo.arkaforge.com` works for a fresh visitor with no instructions
- Marketing site iframe embed works on Chrome, Safari, Firefox
- Full scenario (land -> trigger -> analyze -> intervene) completes in under 90 seconds
- Recorded video fallback verified

**Claude Code prompts**
- "Add reconnect logic to `lib/ws.ts`. On disconnect, retry with exponential backoff (1s, 2s, 4s, 8s, max 16s). Show a 'reconnecting' indicator in the UI."
- "Create a fallback recorded mode. Add a `?mode=recorded` URL param that plays back a pre-recorded scenario from a static JSON file instead of connecting to the backend. Use this as the production fallback if the backend is unreachable."

---

## Done Definition

The demo ships when:

1. A visitor lands and within 30 seconds understands: this platform lets AI agents reason about industrial assets and recommend interventions
2. The telemetry could be shown to a wind operations engineer without them laughing
3. The agent output could be shown to a domain expert without them rolling their eyes
4. The visual identity reads as ArkaForge, not generic SaaS
5. It runs reliably enough to demo live, with a recorded fallback ready
6. The iframe embed works on the marketing site across major browsers

Ship. Iterate from real visitor feedback.
