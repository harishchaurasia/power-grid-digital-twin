# Transmission-Line 3D Model Sourcing

**Target use:** Unreal Engine 5 digital-twin demo of a 230 kV substation node — the outgoing
transmission feeder (`sim/line.py`, IEEE 738). Need: 230 kV lattice steel towers (and/or
monopoles), overhead conductors (ACSR "Drake" 795 kcmil, ~28 mm dia), insulator strings
(suspension + dead-end). Style target: **stylized industrial, matte** (brand: Void Black base,
Forge Red accent). Prefer FBX/glTF/OBJ, PBR, commercially usable, and — ideally — a
**modular tower + cable-spline** setup so we can lay a corridor.

**Research date:** 2026-07-23. Prices/licenses change; verify on the listing before purchase.

> Note on licensing for a client-facing sales demo: CC0 (no attribution) and paid
> royalty-free / Fab standard licenses are the cleanest. CC-BY (attribution) is usable but
> adds an attribution obligation in credits. All Fab/Unreal Marketplace items below carry the
> **Fab Standard License**, which permits commercial use in a rendered/streamed product.

---

## Comparison table

| # | Name | Source | License | Price | Formats | Polycount | PBR | Corridor / spline system | Suitability |
|---|------|--------|---------|-------|---------|-----------|-----|--------------------------|-------------|
| 1 | Electric Transmission Towers | Fab (ex-UE Mktplace), by topchannel1on1 | Fab Standard | $24.99 | UE asset (.uasset); FBX via export | Game-optimized, custom collision | Yes (Substance) | **Yes** — 6 towers, each a Blueprint; wires generated dynamically when towers linked; individual modular pieces included | **Native UE5 corridor.** 6 towers + dynamic wires + recolorable PBR (dual-tone) → can matte to brand. Best single fit. |
| 2 | Modular Electricity Poles | Poly Haven | **CC0** | Free | Blend, glTF, USD, FBX | 201k tris | Yes (1K–8K: albedo/normal/rough/metal/AO) | Modular pieces (poles, crossarms, insulators, cable segments) — assemble manually | **CC0 zero-friction.** Weathered wooden **distribution** poles + insulators, not 230 kV lattice. Great foreground detail + license safety net. Heavy; decimate. |
| 3 | Electrical Utility and Substation | Fab, by (utility pkg) | Fab Standard | Paid (mid) | UE asset | Game-ready, 2K textures | Yes | **Yes** — spline placement auto-adds wires between poles/towers | **Bonus: covers line + substation.** Towers, poles, substation, insulators, cross-arms, transformers. One buy for corridor + node context. |
| 4 | Procedural Powerline Generator | Fab / UE Mktplace, by Michael Farrell | Fab Standard | Paid | UE asset (Blueprints) | Game-ready | Yes | **Yes** — 8 spline BP generators; 4 transmission towers + H-tower + 4 utility-pole lines; wires = dynamic Cable Actors (real sag) | Strongest **procedural corridor** with physically sagging cables. Note: may not be migrated to Fab by seller — check availability. |
| 5 | Power Transmission Tower (FREE) | Sketchfab, by darklord3d | CC-BY (attribution) | Free | glTF/FBX/OBJ (Sketchfab dl) | 129.4k tris | Textured | Single tower only | High-detail free **lattice hero tower**. Attribution required. Heavy for repetition; use as focal tower. |
| 6 | High Voltage Transmission Line (300KV/500KV) | Sketchfab, by ti_art | Check listing (often CC-BY) | Free/varies | glTF/FBX/OBJ | Low-poly (2 towers) | Yes (Substance) | Two towers, line-oriented | Clean low-poly PBR line pair; good LOD/background corridor filler. Verify license on page. |
| 7 | Lowpoly Modular Power line Set | CGTrader | Royalty Free | $8 | OBJ, FBX, C4D, 3DS, DAE, ABC | 2,000 polys | Textured (not confirmed PBR) | **Modular** — 10+ meshes (towers, poles, wires) | Cheap, very light, modular. Low fidelity — background/LOD only, not hero. |
| 8 | Transmission Tower 132kv Lowpoly | TurboSquid | Royalty Free (TS) | Paid | OBJ, FBX, 3DS, Maya | Low-poly, game-ready | Yes (Rough/Metal) | Single tower | Clean PBR game-ready lattice tower. 132 kV geometry (close enough visually to 230 kV). |
| 9 | Transmission Tower 230kV | Sketchfab, by gabrielkmgn | Check listing | Varies | glTF/FBX | n/a listed | n/a | Single tower | The literal **230 kV** match — verify license/download before relying on it. |
| 10 | Strain / Suspension Insulator | Sketchfab, by Martin Ibbett | Check listing | Free/varies | glTF/FBX/OBJ | Adjustable | Textured | Insulator only | Dedicated **dead-end/strain insulator string** to dress tower arms. |
| 11 | Electric Power Transmission Tower | Free3D | Royalty Free | $34 | 3ds, blend, c4d, fbx, max, ma, obj, **gltf, upk**, unitypackage, usdz | n/a | Yes | Single tower | Broadest format coverage incl. UPK/USDZ; paid single lattice tower. |

---

## TOP 3 recommendation

Because the demo is **UE5 + Pixel Streaming** and needs a laid-out corridor (not one hero
prop), the winners are the ones that ship a **spline/Blueprint wire system** natively in
Unreal, plus a CC0 safety net.

### 🥇 1. Electric Transmission Towers — Fab, $24.99
`https://www.unrealengine.com/marketplace/en-US/product/electric-transmission-towers`
- Native UE Blueprints; **wires generate dynamically when you link towers** → drop-in corridor.
- 6 tower variants + the **individual modular pieces** to build custom towers → we can compose
  a 230 kV-styled lattice.
- PBR with per-material color control (incl. dual-tone) → straightforward to **matte down to
  the brand palette** and drive a Forge-Red thermal/over-rating cue from twin state.
- UE 4.15–4.27, 5.0–5.1 (validate against our 5.x). Cheapest path to a credible, controllable
  corridor. **Primary buy.**

### 🥈 2. Modular Electricity Poles — Poly Haven, CC0 (free)
`https://polyhaven.com/a/modular_electricity_poles`
- **CC0** — no attribution, no license risk in a client-facing/streamed demo. The safety net.
- Real PBR set (albedo/normal/rough/metal/AO up to 8K), FBX + glTF + USD → clean UE import.
- Modular poles, **crossarms, insulators, cable segments** → excellent foreground/mid-ground
  substation-yard detail and insulator dressing.
- Caveat: these are **wooden distribution** poles, not 230 kV lattice/monopole — use for the
  yard/incoming detail and insulators, pair with a lattice tower (below) for the feeder itself.
  201k tris → decimate before repeating.

### 🥉 3. Procedural Powerline Generator — Fab / UE Marketplace (paid)
`https://www.unrealengine.com/marketplace/en-US/product/procedural-powerline-generator`
- The most **corridor-native** option: 8 spline Blueprint generators, 4 transmission towers +
  H-tower, and wires built from **dynamic Cable Actors with real sag** — the most physically
  honest conductor look for a credibility-focused demo (catenary, not straight lines).
- Best if we want a long, procedurally placed feeder line vanishing to the horizon.
- Risk: listing may **not have been migrated to Fab** by the seller — confirm it's still
  purchasable before committing; if not, #3 (Electrical Utility and Substation) is the
  spline-wire fallback and also throws in a full substation.

**Suggested combination:** buy **#1 (Electric Transmission Towers)** as the workhorse corridor,
add **#2 (Poly Haven, CC0)** for insulator/pole detail and license insurance, and evaluate
**#3/#4** if we want procedurally sagging long-run conductors. For a single ultra-detailed
focal lattice tower in a hero camera shot, grab **#5 (darklord3d, CC-BY)** and credit it.

---

## Notes & caveats

- **Geometry vs. our spec:** none of these are modeled to ACSR "Drake" 795 kcmil / 28 mm exact
  bundle geometry — that level of conductor accuracy is not what a 3D asset provides and does
  not need to (per CLAUDE.md hard rule #1, physics fidelity lives in `sim/line.py`, not the
  mesh). Choose on **silhouette credibility + matte-industrial style + corridor tooling**, then
  drive all thermal/loading visual cues from twin state.
- **230 kV visual:** a 230 kV single-circuit lattice tower reads as a mid-size steel lattice
  with 3 phases (often 1 conductor/phase at 230 kV, i.e., no big bundle). The 132 kV (#8) and
  300/500 kV (#6) assets are visually in-family; recolor and scale to taste.
- **License verification:** Sketchfab items (#5, #6, #9, #10) show license per-model — confirm
  CC0 vs CC-BY vs "editorial/no-download" on each page before use. Editorial-only or
  no-download items are unusable regardless of how good they look.
- **Fab migration:** post-2024 the UE Marketplace consolidated into **Fab**; some `unrealengine.com/marketplace`
  URLs redirect to `fab.com`. If a link 404s, search the product name on fab.com.
- **Performance:** for Pixel Streaming (30–60 fps target), prefer the game-ready/low-poly
  assets for repeated corridor instances; reserve high-poly (#2 at 201k, #5 at 129k) for
  foreground/hero use or decimate + LOD.
