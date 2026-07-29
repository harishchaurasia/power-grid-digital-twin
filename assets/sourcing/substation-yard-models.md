# Substation Switchyard — 3D Model Sourcing

Sourcing for the ArkaForge digital-twin substation yard (UE5 / Pixel Streaming). Target
equipment: circuit breakers, disconnect/isolator switches, bushings, busbars/conductor tubing,
CTs/PTs, lightning arresters, steel support structures/gantries, control house, chain-link
perimeter fence, gravel yard ground. Style target: **stylized industrial, matte** (re-material
any PBR pack into the Void-Black / Forge-Red palette per `docs/brand.md`).

> Sourcing note: several storefronts (Fab/Unreal Marketplace, CGTrader) block automated
> fetching (HTTP 403/410), so per-pack detail below is drawn from search result metadata and
> product summaries. **Verify the exact asset manifest, polycount, formats, and current license
> on each product page before purchase/commit.** Prioritize the bundled kits — they cover most
> of the equipment list in one buy.

---

## Comparison table

| # | Name | Source | License | Formats | ~Polycount | PBR | Suitability |
|---|------|--------|---------|---------|-----------|-----|-------------|
| 1 | **Electrical Substation / 34 Assets** | Fab (ex-UE Marketplace) | Fab Standard (commercial) | UE `.uasset` native; FBX likely as source | Optimized game-res (not published) | Yes | Best single bundle — 34 props built in a PBR pipeline, drops straight into UE5. Covers breakers, switches, bushings, busbars, structures. |
| 2 | **Electrical Utility and Substation** | Fab | Fab Standard (commercial) | UE `.uasset` native | Game-res | Yes | Complete substation + poles, pole transformers, insulators, wiring, crossarms — good breadth to complement #1; adds conductor/insulator detail. |
| 3 | **Electric Substation** (pre-assembled + props) | Fab | Fab Standard (commercial) | UE `.uasset` native | Game-res | Yes | Pre-assembled yard + a dozen swappable props, modeled from real substation reference. Fast starting-point scene. |
| 4 | **Power Substation** (Environments) | Fab | Fab Standard (commercial) | UE `.uasset` native | Environment-res | Yes | Full environment/scene rather than a parts kit — useful for background/yard massing. |
| 5 | **Electrical Equipment Pack** | Fab | Fab Standard (commercial) | UE `.uasset` native | Game-res | Yes | Assorted electrical props to fill gaps; import into existing project. |
| 6 | **Substation – Primary Plant Equipment** (collection, Digital BIM Solutions) | Sketchfab | Per-model (check each; many CC-BY) | glTF / FBX / USDZ (per model) | Mixed (BIM-accurate geometry) | Varies | Engineer-credible **individual HV gear**: circuit breakers, disconnectors, busbars, gantries, transformers. Best for the specific switchyard items game packs stylize loosely. |
| 7 | **3D Substation (150 kV)** by benkbenk1727 | Sketchfab | Check on page | glTF / FBX (if downloadable) | Layout/vis-res | Likely | Whole 150 kV switchyard layout — gantries, busbar runs, transmission connections, transformer bay. Great massing/reference or hero backdrop. |
| 8 | **Electrical substation pack** | CGTrader | Royalty-free (check tier) | MAX, OBJ, FBX, DXF | Low/mid | Some | Multi-object kit in engine-friendly formats; verify manifest and PBR per listing. |
| 9 | **Electric substation low-poly (39 unique objects)** | CGTrader / Free3D / STLFinder | Royalty-free (check) | FBX, OBJ, DAE | Low-poly, game-ready | Likely no/basic | Cheap stylized kit; matte low-poly aesthetic aligns with brand; good for distant/instanced yard clutter. |
| 10 | **Utility Box 01/02, Modular Electricity Poles** | Poly Haven | **CC0** (no attribution) | Blend, glTF, FBX, USD | Clean, 8K textures | Yes | Free/CC0 fillers — poles, insulators, crossarms, junction boxes, utility cabinets. Not HV switchyard gear, but zero-risk supporting props + control-house dressing. |
| 11 | Quixel Megascans (Fab) — gravel surface, metals | Fab / Quixel | Fab Standard (free redemption) | UE native / textures | N/A (surfaces) | Yes | **Gravel yard ground** + weathered-metal/concrete surfaces for the matte re-material pass. Best source for ground + PBR material base. |
| 12 | Low Poly Electrical Substation ($1); ABB SF6 Circuit Breaker; transformer low-poly | TurboSquid / Free3D | Royalty-free / per-listing | FBX, OBJ, 3DS | Low | Some | Cheap point buys to fill a specific missing item (e.g. named SF6 breaker) if a kit lacks it. |

Gaps to fill separately (not well covered by the kits above):
- **Chain-link perimeter fence** — source a dedicated modular fence (Fab/Sketchfab/CGTrader
  "chain link fence modular"); or build as a tiling alpha-card material in UE.
- **Gravel yard ground** — Quixel Megascans gravel surface (#11) tiled on the landscape.
- **CTs / PTs and lightning arresters as distinct labeled parts** — confirm presence in #1/#2;
  otherwise pull individually from the Sketchfab BIM collection (#6).

---

## TOP 3 recommendation (favor bundled kits)

### 1. Electrical Substation / 34 Assets — Fab (primary kit)
`https://www.unrealengine.com/marketplace/en-US/product/electrical-substation-34-assets`
The strongest single buy: 34 PBR props, native UE5, commercially licensed under the Fab
Standard License. It covers the bulk of the equipment list (breakers, disconnects, bushings,
busbars, support structures) with no import/retopo overhead. Re-material to matte Void-Black
with Forge-Red only on genuine alert states. **Buy this first and build the yard around it.**

### 2. Electrical Utility and Substation — Fab (breadth complement)
`https://www.unrealengine.com/marketplace/en-US/product/electrical-utility-and-substation`
Complements #1 with insulators, wiring/conductors, pole transformers, and crossarms — the
stringy conductor/insulator detail that a single equipment kit tends to under-serve. Same
native-UE5, Fab Standard License path. Together #1 + #2 give a credible, populated switchyard.

### 3. Substation – Primary Plant Equipment collection — Sketchfab (Digital BIM Solutions)
`https://sketchfab.com/digitalbimsolutions/collections/substation-primary-plant-equipment-b999c6039fd54ea88b5c2e93116dbb30`
For the specific HV gear that must read correctly to a power engineer — circuit breakers,
disconnectors, busbars, gantries, transformers as **individually correct** BIM-derived
geometry. Use these where credibility matters most (the twinned transformer bay, the CT/PT and
disconnector the agent reasons over). **Check each model's license individually** (mix of
CC-BY and others) and budget a cleanup/retopo pass, since BIM meshes are not game-optimized.

**Free/CC0 backstop:** Poly Haven (#10) for zero-risk supporting props (poles, insulators,
utility boxes, control-house dressing) and Quixel Megascans (#11) for the gravel ground and the
weathered-metal/concrete PBR base of the matte re-material pass — both carry the most permissive
licensing (CC0 / Fab Standard free redemption) and require no attribution in-product.

---

## Practical notes
- **Formats:** Fab packs are native `.uasset` — the least-friction path for UE5 (no import
  step). Poly Haven ships FBX/glTF/USD (clean, well-UV'd). Sketchfab/CGTrader/TurboSquid give
  FBX/OBJ/glTF — prefer FBX or glTF for UE5 import.
- **License discipline:** Fab Standard License and CC0 are safe for a commercial client demo.
  Sketchfab and CGTrader are **per-model** — record the license of each downloaded asset. Avoid
  any "editorial use only" item for a sales demo.
- **Brand pass:** every PBR pack must be re-materialed to the matte Void-Black palette; Forge
  Red is reserved for genuine alert states (transformer over-limit, line over-rating), never as
  a base accent. See `docs/brand.md`.
- **Fidelity reminder:** these models are the *skin* only. Per `CLAUDE.md` hard-rule #1, visual
  realism is not fidelity — the physics core remains authoritative; the mesh choice must serve
  comprehension of the twin, not substitute for it.

## Sources
- Fab / UE Marketplace: [34 Assets](https://www.unrealengine.com/marketplace/en-US/product/electrical-substation-34-assets), [Utility and Substation](https://www.unrealengine.com/marketplace/en-US/product/electrical-utility-and-substation), [Electric Substation](https://unrealengine.com/marketplace/en-US/product/0817dd35aaf845eba6031d6bdbc63bc8), [Power Substation](https://www.unrealengine.com/marketplace/en-US/product/power-substation), [Electrical Equipment Pack](https://www.unrealengine.com/marketplace/en-US/product/electrical-equipment-pack/questions)
- Sketchfab: [Digital BIM Solutions collection](https://sketchfab.com/digitalbimsolutions/collections/substation-primary-plant-equipment-b999c6039fd54ea88b5c2e93116dbb30), [3D Substation 150 kV](https://sketchfab.com/3d-models/3d-substation-676fd52dd35042fe936a93202a01bc82), [substation tag](https://sketchfab.com/tags/substation)
- CGTrader: [Electrical substation models](https://www.cgtrader.com/3d-models/electrical-substation), [Low-poly substation](https://www.cgtrader.com/low-poly-3d-models/substation)
- Poly Haven (CC0): [Modular Electricity Poles](https://polyhaven.com/a/modular_electricity_poles), [Utility Box 02](https://polyhaven.com/a/utility_box_02), [License](https://polyhaven.com/license)
- Quixel Megascans on Fab: [Quixel Megascans](https://www.fab.com/sellers/Quixel%20Megascans)
- TurboSquid: [Substation models](https://www.turbosquid.com/Search/3D-Models/substation)
- Free3D: [Substation models](https://free3d.com/premium-3d-models/substation)
