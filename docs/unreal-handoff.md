# Unreal + Pixel Streaming — handoff

Written 2026-07-28. This is the **PC-side work**, deliberately separated from what runs on a Mac.
Read `docs/architecture.md` first; this covers only what that doc leaves to the Unreal team.

## Why this is PC work

Pixel Streaming's production path is Windows-first: the Linux/Mac paths exist but are second-class,
and every deployment target in `architecture.md` (AWS g4/g5, Azure NV, CoreWeave) is a Windows GPU
image. Trying to do this on an Apple-silicon Mac means an unsupported combination on both the
encoder and the host. Do it on the PC.

---

## What already exists (do not rebuild)

The backend is done and the contract is stable. Unreal does **not** need to compute anything.

- **Twin state** streams from `ws://<backend>/ws/console` at **10 Hz** as JSON.
  Message shape: `{"type": "telemetry", "payload": TwinSnapshot, "timestamp": <ms>}`.
- The fields Unreal needs are all under `payload.transformer`:

  | Field | Type | Use in-engine |
  |---|---|---|
  | `hot_spot_c` | float °C | Drives the thermal cue |
  | `top_oil_c` | float °C | Optional secondary cue |
  | `loading_k` | float | Optional |
  | `cooling_stage` | `"ONAN"` \| `"ONAF"` \| `"OFAF"` | Fan rotation + pump visibility |
  | `status` | `"nominal"` \| `"warning"` \| `"critical"` | Alert state only |

  Plus `payload.ambient.air_temp_c`.

- **`console/lib/visualState.ts` is the reference mapping.** Port it verbatim rather than inventing
  new thresholds — it is what the browser scene already uses, so both renderers agree:
  - heat = `clamp01((hot_spot_c − 105) / (120 − 105))`
  - fan shaft speed rad/s: ONAN `0`, ONAF `6.5`, OFAF `11.0`
  - oil pumps visible only on OFAF
  - alert only when `status == "critical"`

- **A working browser-rendered version of this exact scene** lives in
  `console/components/scene/`. Use it as the blockout reference: tank ~3.0 × 2.0 × 1.7 m, three tall
  230 kV bushings on one face, two shorter 34.5 kV bushings on the other, radiator banks with fans on
  both long faces, conservator drum on top.

---

## Hard rules that carry over

From `CLAUDE.md` and `docs/credibility-checklist.md` — these are not stylistic preferences:

1. **Unreal is a view + controller, never a source of physics truth.** No thermal maths in
   Blueprints. If a value is not in `TwinSnapshot`, it does not get rendered.
2. **Render must be deterministic w.r.t. twin state** — the same state always looks the same. Drive
   the heat cue as a **scalar lerp on an emissive parameter**, not a timeline or a noise texture.
   (This was flagged in `assets/sourcing/ue5-packs-and-import.md`.)
3. **Forge Red `#FF3B00` is alert-only.** A healthy node is monochrome industrial. Do not tint the
   whole tank — concentrate the cue where the winding hot-spot physically is, high in the tank. The
   browser scene learned this the hard way: a fully-saturated tank loses its form and blows past
   brand.md's ~10–15 % red budget.
4. **Stylized industrial, matte.** Photoreal detail must aid comprehension, not substitute for it.
5. **No magic numbers in Blueprints** — drive from backend state or a named DataTable.

---

## Build order

**Phase 0 target from `docs/build-plan.md`:** placeholder substation blockout, Pixel Streaming
running and reachable in a browser, receiving `TwinSnapshot` and moving one debug value. Get to that
before any art.

1. **UE 5.4+ project**, `unreal/ArkaForgeTwin.uproject`. Blank C++ project.
2. **Enable plugins:** Pixel Streaming, Pixel Streaming Player. Restart.
3. **WebSocket client.** Simplest path is the built-in `WebSockets` module in C++
   (`FWebSocketsModule::Get().CreateWebSocket`). Parse to a `USTRUCT` mirroring `TwinSnapshot` and
   broadcast to Blueprints via a delegate. Do **not** poll the REST endpoints from Unreal — those
   serve the console.
4. **Bind one debug value first** (e.g. a text render actor showing `hot_spot_c`). Confirm it moves
   when you run `make backend` and trigger the scenario. That proves the whole chain before art.
5. **Blockout + material.** One emissive scalar parameter, driven by the `heat` value from step 3.
6. **Pixel Streaming locally:** launch with
   `-PixelStreamingURL=ws://127.0.0.1:8888 -RenderOffscreen -Unattended`, run the signalling server
   from `Samples/PixelStreaming/WebServers/SignallingWebServer`, open the player page. Confirm the
   stream works on `localhost` before touching cloud.
7. **Cloud GPU host** — the item that has been open since the pivot. AWS `g4dn`/`g5`, Azure NV, or
   CoreWeave, Windows Server + NVIDIA driver. Secure signalling (TURN credentials, origin allowlist)
   per `architecture.md`. **Document the GPU-concurrency cap** — it bounds how many prospects can
   view at once.

---

## How it meets the console

The console already treats the 3D as a layer behind it and needs **no change** when Unreal arrives:

- `console/app/App.tsx` renders `<TwinScene />` in an absolutely-positioned layer at `inset-0`, with
  the overlay above it. Swap that one element for the Pixel Streaming video element.
- The overlay is transparent-backgrounded and `pointer-events-none` except on panels, so drags in the
  centre column reach whatever is behind — currently the browser camera, later the stream's input
  handler.
- Keep the browser scene. `architecture.md` **requires** a fallback for when the GPU host is
  unavailable, and a working browser twin is a far better fallback than the recorded video loop
  originally planned. Gate it on a query param or a stream-health check.

---

## Open decisions

- **Asset sourcing.** `assets/sourcing/*.md` are research notes, not models — nothing has been
  bought or downloaded. The transformer note flags that no credible hero LPT exists on Fab, so plan
  to author or kitbash. Verify every licence on the live listing before download; CC BY-NC and
  Sketchfab "Editorial" are disqualifying for a commercial demo.
- **Megascans** went paid after Dec 2024; the sourcing notes picked CC0 alternatives.
