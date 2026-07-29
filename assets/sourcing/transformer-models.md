# 3D Model Sourcing — Large Power Transformer (LPT)

**Target asset:** substation main step-down transformer — three-phase, oil-immersed, with
radiators/fans, bushings, conductor terminals. Reference: 150/200/250 MVA, 230/34.5 kV.
**Style target:** stylized industrial, matte (per `docs/brand.md`) — not photoreal-for-its-own-sake.
**Use case:** commercial client-facing sales demo in Unreal Engine 5 (Pixel Streaming).

> Sourced 2026-07-23. Sites searched: Sketchfab, TurboSquid, CGTrader, Fab / Unreal Marketplace,
> Poly Haven, and free CC0 repos. **License-verification caveat:** Fab/Unreal and CGTrader product
> pages return HTTP 403/410 to automated fetch, so their live prices and exact license SKUs below
> are drawn from search snippets and mirror listings. **Verify price + license on the live listing
> before download** — especially the commercial-use terms, which are the gating requirement here.

---

## Licensing gate (read first)

This is a **commercial client demo**, so license is the hard filter:

- **CC0** — usable, no attribution, no restriction. Safest.
- **CC BY 4.0** — usable commercially *with attribution*. Fine if we add a credits line in the demo.
- **CC BY-NC** — **NOT usable** (non-commercial). Disqualifies the model regardless of quality.
- **Fab "Standard License" / TurboSquid / CGTrader Royalty-Free** — usable in a commercial demo
  (rendered/streamed output is fine; do not resell the asset itself). Standard for this use.
- **Sketchfab "Editorial" license** — **NOT usable** commercially. Check per-model.

---

## Comparison table

| # | Model | Source | License | Price | Formats | Polycount | PBR | Suitability |
|---|-------|--------|---------|-------|---------|-----------|-----|-------------|
| 1 | **Electical Power Transformer Station** | [Fab](https://www.fab.com/listings/ef8cdbab-6756-4380-bde3-1a1c50390a4e) | Fab Standard (commercial) — verify | Paid (verify) | FBX + 7×4K textures | ~104k tris / 54.8k verts | Yes (Albedo, Rough, Normal, AO, Metal, Curv, ID) | **Best single hero LPT** — dedicated transformer station, UE-ready, high-res PBR |
| 2 | **Electrical Substation / 34 Assets** | [Fab](https://www.fab.com/listings/5c324280-3248-439f-b390-c0769378a6ad) / [UE mirror](https://www.unrealengine.com/marketplace/en-US/product/electrical-substation-34-assets) | Fab Standard (commercial) — verify | Paid (verify) | UE asset / FBX | Game-optimized, PBR pipeline | Yes (1k–4k) | Kit-bash pack; build the whole substation node (transformer + props) in one buy |
| 3 | **Electric Substation** (pre-assembled) | [Fab / UE](https://www.unrealengine.com/marketplace/en-US/product/electric-substation) | Fab Standard (commercial) — verify | Paid (verify) | UE asset | Game-optimized | Yes | Pre-assembled substation from real-substation refs; fast scene bring-up |
| 4 | **Electrical Utility and Substation** | [Fab / UE](https://www.unrealengine.com/marketplace/en-US/product/electrical-utility-and-substation) | Fab Standard (commercial) — verify | Paid (verify) | UE asset | Game-optimized | Yes | Adds transmission towers + spline wiring — useful for the outgoing-line asset too |
| 5 | **Electrical transformer substation (КТП)** — Labus | [Sketchfab](https://sketchfab.com/3d-models/electrical-transformer-substation-4f72d11f91ce4cf09696aacb470e8dcd) | **CC BY 4.0** | Free | glTF/others (Sketchfab dl) | 44.4k tris / 22.5k verts | Yes (Blender + Substance) | Free + commercial-OK; Soviet КТП kiosk style — not a 230kV oil-radiator LPT |
| 6 | **High voltage power transformer** — Showdoze | [Sketchfab](https://sketchfab.com/3d-models/high-voltage-power-transformer-727bc7bb6777467dbea2ab6e0590bf4a) | **CC BY-NC 4.0** | Free | Sketchfab dl | 11.9k tris / 5.9k verts | Unclear | **Disqualified** — non-commercial license. "Based on how these work," but NC blocks use |
| 7 | **Electrical Transformer Substation (FREE)** — Chegodaev | [Sketchfab](https://sketchfab.com/3d-models/electrical-transformer-substation-free-2f176ef6ead04fff8459406e1d1ee91c) | Verify (free dl) | Free | Sketchfab dl | Low-poly | Likely | Free; confirm license before use. Blender+Substance |
| 8 | **3d Substation** — benkbenk1727 | [Sketchfab](https://sketchfab.com/3d-models/3d-substation-676fd52dd35042fe936a93202a01bc82) | Verify | Free (no paid tag) | Sketchfab dl | 177k tris / 137k verts | Not stated | 150kV switchyard **CAD layout** (AutoCAD) — good for context/layout, weak as a hero LPT |
| 9 | **Power Transformer** (low-poly) | [CGTrader](https://www.cgtrader.com/3d-models/industrial/industrial-machine/power-transformer-a79bb7c4-47d2-406f-a0b9-00c1b5a72a1b) | Royalty-Free | ~$40 | MAX, OBJ, 3DS, FBX | Low-poly | Likely | Royalty-free, FBX; verify radiators/bushings fidelity |
| 10 | **Electrical Substation Pack** | [CGTrader](https://www.cgtrader.com/3d-models/industrial/industrial-part/electrical-substation-pack) | Royalty-Free | ~$69 | MAX, OBJ, FBX, DXF | — | Likely | Full pack; listing returned 410 (may be delisted) — verify availability |
| 11 | **3D Electrical Substation** | [TurboSquid](https://www.turbosquid.com/3d-models/3d-electrical-substation-3d-2155424) | TurboSquid Royalty-Free | Paid | ma, blend, fbx, obj | ~164k tris | Varies | Heavy full-substation scene; FBX/OBJ UE-importable |
| 12 | **Modular Electricity Poles** | [Poly Haven](https://polyhaven.com/a/modular_electricity_poles) | **CC0** | Free | glTF/FBX/Blend + 8K | Mid | Yes (8K) | CC0, top-tier textures — **poles/crossarms, not an LPT**. Use for line asset, not transformer |

---

## TOP 3 recommendation

### 🥇 1. Electical Power Transformer Station (Fab) — primary hero LPT
[fab.com/listings/ef8cdbab-6756-4380-bde3-1a1c50390a4e](https://www.fab.com/listings/ef8cdbab-6756-4380-bde3-1a1c50390a4e)
- **Why:** The only candidate that is a *dedicated single power-transformer station* rather than a
  substation scene or a distribution kiosk. ~104k tris is an ideal hero-asset budget for UE5, and
  the **7×4K PBR set (Albedo, Roughness, Normal, AO, Metalness, Curvature, Material ID)** gives us
  the material control needed to re-tint to the matte Void-Black/Forge-Red palette and to drive the
  hot-spot thermal glow from twin state. FBX imports cleanly into UE5.
- **Watch-outs:** Confirm on the live listing that (a) it renders as a *large oil-immersed* unit
  with radiator banks + HV/LV bushings + conductor terminals (the name and single-object texture set
  strongly imply a single hero transformer), and (b) the Fab license covers commercial demo use.
  The Material-ID map is the reason to pick this one — it makes brand re-skinning straightforward.

### 🥈 2. Electrical Substation / 34 Assets (Fab) — the whole-node kit
[fab.com/listings/5c324280-3248-439f-b390-c0769378a6ad](https://www.fab.com/listings/5c324280-3248-439f-b390-c0769378a6ad)
- **Why:** One purchase yields a transformer plus 33 substation props (busbars, insulators, gantries,
  fencing) built in a PBR pipeline and optimized for real-time — so we can assemble the *entire
  substation node* (transformer + BESS-yard dressing + line gantry) in a consistent art style
  instead of stitching mismatched single models. Best value if we need the full scene, not just the
  LPT. Strong complement to #1 (hero transformer from #1, surroundings from #2).
- **Watch-outs:** Individual transformer fidelity in a 34-asset kit is usually lower than a dedicated
  hero model — verify the transformer has visible radiators/bushings and isn't a simplified box.

### 🥉 3. Electrical transformer substation — Labus (Sketchfab, CC BY 4.0) — free fallback
[sketchfab.com/3d-models/electrical-transformer-substation-4f72d11f91ce4cf09696aacb470e8dcd](https://sketchfab.com/3d-models/electrical-transformer-substation-4f72d11f91ce4cf09696aacb470e8dcd)
- **Why:** The strongest **free + commercially-usable** option (CC BY 4.0 — needs only an attribution
  line). 44.4k tris with real Blender+Substance PBR textures, downloadable in UE-importable formats.
  Zero cost and zero licensing risk make it the ideal Phase-0/blockout placeholder while the paid
  hero asset is procured, and a legitimate fallback if budget is denied.
- **Watch-outs:** It models a Soviet-style **КТП packaged kiosk substation**, not a 230/34.5 kV
  oil-radiator LPT. A power engineer would read it as distribution-class, not a 150–250 MVA main
  transformer — acceptable as a placeholder, not as the final credible hero.

---

## Recommended plan

1. **Procure #1 (Electical Power Transformer Station)** as the hero LPT after verifying commercial
   license + radiator/bushing geometry on the live Fab listing.
2. **Optionally add #2 (34 Assets)** to dress the rest of the substation node in matching style.
3. **Use #3 (Labus, CC BY 4.0) now** as the free, license-clean placeholder for the Phase-0/Phase-1
   blockout so Unreal work isn't blocked on procurement.
4. **Reserve #12 (Poly Haven CC0 poles)** for the *transmission-line* asset — not the transformer.
5. **Reject #6 (Showdoze)** despite decent geometry — CC BY-NC forbids commercial use.

**Note on brand fit:** every candidate ships photoreal-leaning textures. Per `docs/brand.md` and the
"physics before pixels" rule, whichever model we pick should be **re-materialed to the matte
industrial palette** in UE5 (Forge Red reserved for genuine alert/thermal state). Models exposing a
**Material-ID map (#1)** or clean UV separation make this re-skin cheapest — another point for #1.
