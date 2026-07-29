# UE5 Asset Sourcing + Import & Integration Guide

Practical guidance for the Unreal Engine 5 experience layer of the ArkaForge substation
digital-twin demo. Two parts: **(a)** recommended Fab / Megascans asset sources, and **(b)** an
import + runtime-integration guide focused on the one hard requirement for this demo — a
**matte → red heat glow on the transformer, driven live by twin state streamed from the Python
backend**.

Reminder of the brand/scope constraints this must respect (see `docs/brand.md`,
`docs/credibility-checklist.md`):
- Stylized **industrial matte**, not neon/photoreal-for-its-own-sake. Forge Red `#FF3B00` is an
  **alert-only** accent — a healthy node is monochrome industrial. Red appears only when a real
  physics state (hot-spot into limit) drives it.
- Unreal renders **only** state derived from the simulation core. No locally-invented physics,
  no decorative animation. The heat glow is physics-driven or it does not exist.

---

## Background: Fab, Megascans, and licensing (2024–2026)

- **Fab** (`fab.com`) is Epic's unified marketplace, launched **October 2024**. It is the
  successor to the **Unreal Engine Marketplace**, **Quixel Bridge/Megascans**, and the
  **Sketchfab Store**. This is now the canonical source for UE5 packs. The old
  `unrealengine.com/marketplace` redirects here.
- **Megascans licensing — important, this changed:** Megascans were **free for everyone** on Fab
  only through **Dec 31, 2024**. Since **2025, Megascans is a paid catalog** again (individual
  assets from ~$0.99, procedural kits ~$4.99, packs ~$24.99). **Anything you acquired while it
  was free — free or paid — is yours to use forever under the Fab Standard License.** If the team
  claimed the full Megascans library in 2024, you already have a large matte-industrial surface
  set at zero cost. If not, budget for the specific surfaces you need or use the free tier.
- **Fab free content program:** Epic still rotates **free packs** (a "Free content" section on
  Fab / `unrealengine.com/fabfreecontent`), including periodic **limited-time free** environment
  packs (the old "free-of-the-month") plus a permanent set of **Epic-published free** packs and
  sponsored content. Claim limited-time packs even if you don't need them yet — a claim is
  permanent.
- **License note for a client-facing commercial demo:** the **Fab Standard License** covers use
  in a product/demo like this. Verify per-listing that it is Standard (not "Personal / editorial
  only") before shipping, and keep a record of what was claimed. CAD/3D-scan marketplace models
  from *outside* Fab (Sketchfab non-Epic, CGTrader) carry their own per-model licenses — check
  each.

---

## (a) Recommended UE5 / Fab packs

Prices and availability on Fab change; treat cost as "verify at claim time." URLs are canonical
Fab listing pages.

### Directly on-topic — substation / electrical / power infrastructure

| Pack | URL | License / cost | What it covers |
|---|---|---|---|
| **Electrical Utility and Substation** | https://www.fab.com/listings/6d4453be-3d28-483b-9c14-206437721876 | Fab (paid, verify) | The closest single match: a complete substation plus utility props — pole transformers, insulators, wiring, bare poles, cross-arms, streetlights. Includes **spline-based** placement of poles/towers that auto-generates wires between them. Good base for the yard + outgoing feeder. |
| **Electrical Substation (Free)** | https://www.fab.com/listings/0b680515-bfa6-4958-8f80-d7a7fcf14428 | Free (verify) | Low-poly substation model, UE-ready. Useful as a fast blockout / background massing while the hero transformer is built. |
| **Utility / Power Pole** | https://www.fab.com/listings/24c6b789-5707-4be6-817b-777363952e84 | Fab (paid, verify) | 7 unique power/utility poles as Blueprints that link to one another with **dynamically-created wires** and adjustable slack. Ideal for the **transmission-line corridor** (the IEEE 738 asset). |

> Note on the hero transformer: none of these give a *credible large power transformer* (LPT)
> as the centerpiece. Expect to **build or heavily kitbash the hero LPT** (bushings, radiators,
> conservator, cooling fans) so the ONAN/ONAF/OFAF cooling stages read visually, and reserve
> marketplace substation packs for the surrounding yard, poles, and feeder. A 230/34.5 kV
> three-phase oil-immersed unit with radiator banks is the silhouette to target.

### Industrial environment / yard context (matte industrial shell)

| Pack | URL | License / cost | What it covers |
|---|---|---|---|
| **Warehouse & Factory – Essential Industrial Pack** | https://www.fab.com/listings/ea576eed-2226-4943-b4fa-92a7287589fb | Fab (paid, verify) | Modular pipes/ducts, **conduits and wires, electrical enclosures**, detailed props. Directly useful for BESS enclosure surrounds and substation control-house detailing. |
| **Modular Warehouse** | https://www.fab.com/listings/f7ce6f51-7138-4b1b-ae32-c05c8437c7ae | Fab (paid, verify) | Fully modular walls/roof/beams/floor for large industrial facilities, hangars, control buildings. Good for the BESS building shell and control house. |
| **Industrial Factory** | https://www.fab.com/listings/02708474-5331-4c47-b55c-3cbadc51fb4f | Fab (paid, verify) | Enterable industrial buildings + **PCG tools** to procedurally build structures — fast way to populate a yard perimeter. |
| **Modern Warehouse (Epic free pack)** | https://www.unrealengine.com/fabfreecontent (search "Warehouse") | Free (Epic-published) | 165 modular assets for a modern warehouse exterior + racking. Was a limited-time free claim in 2025; check current free section. High-quality, Epic-licensed — safe for a commercial demo if still claimable. |

### Megascans surfaces — matte industrial yard (materials, not meshes)

Use these as **tiling surface materials** for the ground plane, pads, and enclosures. All from
Fab's Megascans catalog (paid since 2025, or free if claimed in 2024). Search Fab for these
Megascans categories:

| Surface need | Megascans search terms | Use in scene |
|---|---|---|
| Gravel / crushed-stone substation yard | "gravel", "crushed rock", "aggregate" | The substation ground plane — substations are almost always gravel-bedded (drainage + step-potential). Reads instantly as "real substation." |
| Concrete pads / foundations | "concrete", "worn concrete", "concrete slab", "cast concrete" | Transformer plinth, BESS container pads, control-house floor. |
| Painted / galvanized metal | "painted metal", "galvanized steel", "brushed metal", "metal panel" | BESS enclosure skins, cabinets, transformer tank body. |
| Rust / weathering overlays | "rust", "rusted metal", "metal edge wear" | Weathering on radiators, bolts, tank seams — subtle, matte, not decorative. Keep it restrained; the brand is precise. |
| Asphalt / access road | "asphalt", "tarmac", "road" | Access road / laydown area around the yard. |

Prefer Megascans **surfaces/decals** over hero prop meshes here — the value is a physically
scanned matte base you tint into the Void-Black `#0B0C0F` palette. Drive final color/roughness
through **Material Instances** so the whole yard stays in-brand.

### Free industrial material sources (fallback / supplement)

- **Fab free section** (`unrealengine.com/fabfreecontent`) — rotating free environment/material
  packs; claim permanently.
- **Epic-published starter content & "Automotive Materials" / "Blocking Starter Kit"** on Fab —
  free, clean matte materials good for blockout.
- If Megascans surfaces aren't already owned and budget is zero: **ambientCG** and
  **Poly Haven** (CC0, outside Fab — no license friction) provide gravel/concrete/metal/rust
  PBR sets that import cleanly as UE materials. CC0 is the safest possible license for a
  client demo. (These are non-Fab; import as raw texture sets, see below.)

---

## (b) Import & integration guide

### 1. Choosing a format: FBX vs glTF vs Datasmith

| Source | Use | Notes |
|---|---|---|
| **Fab / Megascans assets** | Native — "Add to Project" via the **Fab plugin** in-editor | No manual import. Megascans arrive with LODs, materials, and (where authored) Nanite already set. Prefer this path for all marketplace content. |
| **FBX** | General art meshes from Blender/Maya/3ds Max | The reliable baseline. Best-tested skeletal + static mesh path. Export with **+Z up, cm scale** to match UE. Bake transforms; triangulate on export. |
| **glTF / GLB** | Web/AI-generated or lightweight meshes | Good PBR fidelity, but occasional **normal discrepancies on very high-density meshes** vs FBX — validate normals after import. Fine for props, prefer FBX for hero assets. |
| **Datasmith** | **CAD** and DCC scene transfer | The right tool if the client ever supplies **real transformer/BESS CAD**. Datasmith imports STEP (AP203/214/242), CATIA V5, NX, SolidWorks, Creo, JT, IFC, Revit directly, preserving hierarchy, metadata, and pivots. Use the **Datasmith CAD Importer** with tessellation (chord tolerance) tuned per asset. It also has dedicated glTF and VRED-FBX importers with extra options. |

**Recommendation for this demo:** marketplace packs via the Fab plugin; hero LPT authored in a
DCC and brought in as **FBX**; keep the **Datasmith CAD** path in your back pocket for when a
prospect wants their actual asset twinned (a strong sales beat — "we imported your real CAD").

### 2. Import settings that matter here

**Static meshes (all yard/prop assets):**
- **Nanite: ON** for high-poly, static, opaque meshes — the transformer body, radiators, BESS
  racks, poles, gravel-scatter meshes. Nanite removes the need for hand-authored LODs and holds
  detail at any distance, which is exactly right for a fixed-yard hero scene streamed at 1080p.
  Enable in the mesh's **Static Mesh Editor → Nanite Settings → Enable**, or check "Build
  Nanite" at import.
- **Nanite exclusions:** do **not** Nanite meshes that must be **translucent**, use
  **world-position offset heavily**, or are **skeletal/deforming** (cooling-fan blades if
  simulated, swaying wires). For those, keep traditional **LODs**. Wires/cables: Nanite works on
  modern UE5 for opaque cable meshes; test the spline-generated wires from the pole packs — if
  they render as translucent or use a special material, leave them non-Nanite with 2–3 LODs.
- **LODs (non-Nanite meshes):** enable **Auto LOD generation** (LOD Group: `LargeProp` for the
  transformer-scale, `SmallProp` for bolts/insulators). For a Pixel-Streamed single-node scene
  the camera distances are bounded, so 2–3 LODs is plenty.
- **Collision:** the demo is view + selection, not physics. Use **simple collision** (or "Use
  Complex as Simple" only on selectable hero assets so click-to-select ray hits are accurate).
- **Lightmaps:** if using baked/mixed lighting, ensure imported meshes have valid **lightmap
  UVs** (generate on import if absent). If fully dynamic (Lumen), lightmap UVs are irrelevant.
- **Scale/units:** confirm 1 UU = 1 cm. A 150 MVA LPT is physically large (~8–10 m tank); get
  the scale right so the yard reads credibly to an engineer.

**Materials on import:**
- Build **one master Material** with exposed parameters (Base Color, Roughness, Metallic,
  Normal) and make every imported material a **Material Instance** of it. This keeps the whole
  scene in the Void-Black matte palette and makes global tuning cheap. Do **not** ship dozens of
  unique unmanaged materials.

### 3. The core requirement — a runtime-driven heat glow on the transformer

The Python backend streams live `TwinState` (transformer hot-spot °C among it). Unreal must map
hot-spot → a **matte-to-Forge-Red emissive** on the transformer, updated every tick, with **no
locally-invented physics** — Unreal only visualizes the number it receives.

There are two clean patterns. Use the **Material Parameter Collection** pattern as the default.

#### Pattern A — Material Parameter Collection (MPC) + material lerp  (recommended)

Best when a single global "heat" value drives one hero asset (our case).

1. **Create a Material Parameter Collection** asset, e.g. `MPC_TwinState`. Add a **scalar**
   parameter `TransformerHeat` (normalized 0.0–1.0). Optionally add `BessHeat`, `LineHeat` for
   the other two assets later.
2. **In the transformer master material**, sample the collection parameter
   (`CollectionParameter` node → `MPC_TwinState.TransformerHeat`) and use it to **lerp**:
   - Base Color: `Lerp(MatteBaseColor, ForgeRed, HeatValue)` — but keep the low end fully matte
     so a healthy transformer is monochrome (brand rule).
   - Emissive: `ForgeRed * pow(HeatValue, k) * EmissiveIntensity` — a power curve so red only
     blooms near the top of the range (i.e., near the C57.91 limit), not linearly. This ties the
     visual to *approaching the limit*, not to any warmth.
   - Optionally push Roughness slightly or add a subtle heat-haze only at high values.
3. **Drive the scalar at runtime** from received state. In Blueprint or C++:
   `SetScalarParameterValue(MPC_TwinState, "TransformerHeat", normalizedHeat)`. One call per WS
   message updates every material that references the collection — cheap and global.
4. **Normalize on the Unreal side only for display mapping**, e.g. map hot-spot 90 °C → 0.0,
   120 °C → 1.0 (clamp). Keep this mapping in **named config / a DataTable**, not magic numbers
   in a Blueprint (project convention). The *physics* stays in Python; Unreal only maps a real
   number to a 0–1 glow.

#### Pattern B — Dynamic Material Instance (DMI) per asset

Best when each asset instance needs independent, non-global control (all three assets, or
multiple transformers later).

1. On BeginPlay, `CreateDynamicMaterialInstance` on the transformer mesh; store the reference.
2. On each state update, `SetScalarParameterValue("Heat", normalizedHeat)` (and any others) on
   that DMI.
3. Material graph does the same matte→red lerp/emissive, reading a **scalar parameter** instead
   of a collection parameter.

MPC is simpler for a single hero asset; DMI scales better to per-instance control. For the
three-asset final scene, a reasonable split is: **MPC** for global scene mood, **DMI** for each
asset's own limit-proximity glow.

#### Getting the backend state *into* Unreal

The physics/state truth is in Python; Unreal receives it. Options, in order of fit for this
Pixel-Streaming demo:

1. **Backend → Unreal over WebSocket (recommended).** Per `docs/architecture.md`, the backend
   pushes `TwinSnapshot` to Unreal each tick over WSS. Implement a lightweight WS client in
   Unreal (C++ `FWebSocketsModule`, or a WS plugin), parse the JSON snapshot into a struct, and
   on each message call the MPC/DMI setters. This is the authoritative, deterministic path and
   keeps render state a pure function of twin state (credibility-checklist requirement).
2. **Remote Control API / Web Remote Control.** UE's built-in Remote Control (HTTP/WebSocket)
   can expose material parameters and let the backend `PUT` values without custom C++. Fast to
   prototype; good for early Phase-1 wiring. Move to a typed WS client for production.
3. **Pixel Streaming input channel** (`emitUIInteraction` / data channel). Works, but this
   channel is really for *user input* from the browser; routing physics state through it couples
   render state to the streaming transport. Prefer keeping **state on the backend↔Unreal WSS**
   and reserving the Pixel Streaming channel for camera/selection input, per the architecture.

**Determinism check:** the same twin state must always produce the same look
(credibility-checklist). Because the glow is a pure lerp of a received scalar, this holds — as
long as Unreal never adds its own time-based or random component to the heat value. No
`FMath::RandRange` in the visual path.

### 4. Suggested Phase-1 wiring (transformer vertical slice)

1. Blockout the yard with the free substation model + gravel Megascans surface. Place a
   hero-LPT stand-in (kitbash from the Electrical Utility pack transformer meshes until the real
   hero asset is authored).
2. Author `M_Transformer` master material with the matte→Forge-Red `TransformerHeat` lerp
   (Pattern A). Confirm at Heat=0 it is fully matte Void-Black palette; at Heat=1 it reads as a
   clear Forge-Red alert.
3. Stand up the Unreal WS client (or Remote Control for the first pass); feed it the backend's
   hot-spot value; map 90→120 °C to 0→1 via config.
4. Trigger the heat-wave scenario in the backend and confirm the transformer glows **only** as
   hot-spot climbs toward the C57.91 limit, lagging with the thermal time constant (the lag is
   in the physics, not the shader) — no instant jumps.
5. Add an in-scene inspector label naming the source standard ("IEEE C57.91 hot-spot") per the
   credibility checklist — the visual glow must be traceable to the named model.

---

## Quick sourcing checklist

- [ ] Confirm whether the team **claimed the full Megascans library in 2024** (free forever) or
      needs to buy specific surfaces now.
- [ ] Verify each Fab listing is **Fab Standard License** (commercial demo use) before shipping.
- [ ] Claim any current **limited-time free** Fab environment packs now (permanent once claimed).
- [ ] Treat marketplace substation packs as **yard + poles + feeder**; plan to **author the hero
      LPT** so cooling-stage silhouette is credible.
- [ ] Keep the **Datasmith CAD path** ready for a "twin your real asset" sales moment.

## Sources

- [Fab launch — Unreal Engine blog](https://www.unrealengine.com/en-US/blog/fab-epics-new-unified-content-marketplace-launches-today)
- [Fab purchasing & downloading docs](https://dev.epicgames.com/documentation/fab/purchasing-and-downloading-assets-in-fab)
- [Megascans free only until end of 2024 — CG Channel](https://www.cgchannel.com/2024/10/epic-games-has-made-megascans-free-to-all-but-only-until-the-end-of-2024/)
- [Megascans back on Fab / legacy library — GameFromScratch](https://gamefromscratch.com/get-18000-quixel-megascans-assets-free-again/)
- [Quixel on Fab — new Megascans & Megaplants](https://quixel.com/news/quixel-on-fab-new-megascans-and-megaplants)
- [Electrical Utility and Substation — Fab](https://www.fab.com/listings/6d4453be-3d28-483b-9c14-206437721876)
- [Electrical Substation Free — Fab](https://www.fab.com/listings/0b680515-bfa6-4958-8f80-d7a7fcf14428)
- [Utility / Power Pole — Fab](https://www.fab.com/listings/24c6b789-5707-4be6-817b-777363952e84)
- [Warehouse & Factory Essential Industrial Pack — Fab](https://www.fab.com/listings/ea576eed-2226-4943-b4fa-92a7287589fb)
- [Modular Warehouse — Fab](https://www.fab.com/listings/f7ce6f51-7138-4b1b-ae32-c05c8437c7ae)
- [Industrial Factory — Fab](https://www.fab.com/listings/02708474-5331-4c47-b55c-3cbadc51fb4f)
- [Free modern-warehouse pack (165 assets) — CG Channel](https://www.cgchannel.com/2025/08/get-165-modular-3d-assets-for-creating-a-warehouse-in-unreal-engine/)
- [Datasmith Import Options — UE5.8 docs](https://dev.epicgames.com/documentation/unreal-engine/datasmith-import-options-in-unreal-engine)
- [Datasmith CAD Importer settings & cvars — Epic community tutorial](https://dev.epicgames.com/community/learning/tutorials/PYxb/unreal-engine-datasmith-cad-importer-settings-cvars)
- [FBX vs GLB for UE5 import pipeline — Tripo3D](https://www.tripo3d.ai/media-production/fbx-vs-glb-export-unreal-engine)
