# BESS 3D Model Sourcing — Battery Energy Storage System

Sourcing report for the co-located BESS asset in the ArkaForge substation digital-twin
(Unreal Engine 5, Pixel Streaming). Reference asset: **100 MW / 400 MWh, LFP, containerized**,
co-located at a substation. Style target: **stylized industrial, matte** (per `docs/brand.md`).

- **Date:** 2026-07-23
- **Sources surveyed:** Sketchfab, TurboSquid, CGTrader, Fab (Quixel/Unreal Marketplace),
  Poly Haven, CC0 repos.
- **Format priority:** FBX / glTF / OBJ (native UE5 import via glTF/FBX).

> Note on the reference asset scale: a real 100 MW / 400 MWh LFP site is **many** containers
> (dozens of 20–40 ft enclosures in rows), not one box. For the twin, source **one credible,
> instanceable enclosure** and array it in-engine. That makes a clean, low-poly, tileable
> enclosure more valuable than a single hero mesh. Interior racks only matter for a
> cutaway/"open door" view.

---

## Comparison table

| # | Model | Source | License | Price | Formats | Polycount | PBR | Interior modeled | Suitability |
|---|-------|--------|---------|-------|---------|-----------|-----|------------------|-------------|
| 1 | Container Battery Storage System 4k PBR | CGTrader | Royalty-free | **$9.99** | BLEND, FBX, glTF, MAX, PNG/JPG | 10.3k tris / 5.5k verts | Yes (4K, AO/Metal/Rough/Normal) | Enclosure only | Low-poly, game-ready, glTF+FBX, cheap. Ideal instanceable enclosure. **Best value.** |
| 2 | Battery Energy Storage System Container BESS PBR | CGTrader | Royalty-free (no AI) | $150 | MAX, OBJ, FBX, glTF, C4D, BLEND, MA, USDZ | ~1.59M polys / 1.60M verts | Yes | Yes (batteries, inverters, HVAC, explosion flaps) | High-detail hero + interior; heavy, needs decimation for streaming. Best if a cutaway is required. |
| 3 | Battery Energy Storage System Container BESS | CGTrader | Royalty-free | $150 (also listed ~$79–95) | MAX, FBX, OBJ + textures | ~10.2M polys / 5.4M verts | Yes (V-Ray) | Yes (batteries, inverters, HVAC, explosion flaps) | Very heavy (V-Ray, 18k objects, 1GB OBJ). Overkill for Pixel Streaming; retopo cost high. |
| 4 | Battery Energy Storage System Container BESS | TurboSquid (2286057 / 2069041) | Royalty-free | ~$89 | MAX, OBJ, FBX | High (not listed precisely) | Yes | Yes (batteries, inverters, AC, explosion flaps) | Same asset family as #2/#3 on TurboSquid. Credible detail; verify tri-count before buying. |
| 5 | BESS Container (Geek acc) | Sketchfab | CC-BY 4.0 | Free | glb/gltf (Sketchfab dl) | 388k tris / 194k verts | Not stated | Enclosure only | Free, but **AI-generated (Meshy)** — geometry/texture credibility is weak for an engineer-facing twin. Attribution required. |
| 6 | Integrated Box Energy Storage System (MrdT) | Sketchfab | CC-BY 4.0 | Free | glb/gltf | 318k tris / 274k verts | Not stated | Yes (BMS, fire, HVAC, PCS, isolation xfmr described) | Free, shows internals concept. AI/hobby quality; attribution required. Backup only. |
| 7 | Electrical Substation / 34 Assets | Fab (UE Marketplace) | Fab Standard (royalty-free) | Paid | UE native (+ FBX) | AAA-optimized | Yes | N/A (substation props) | Not a BESS, but the **matching substation kit** for the transformer/yard — buy for scene cohesion. |
| 8 | Poly Haven — Containers category | Poly Haven | **CC0** | Free | glTF, FBX, Blender, USD | Game-res, clean | Yes (2K–8K) | No (empty containers) | CC0 shipping-container stand-in; reskin as an enclosure. Zero license risk. |
| 9 | Low Poly Server Racks w/ Modules | Sketchfab (councilboar) | Check listing (free dl) | Free | glb/gltf | Low-poly | Basic | Rack modules | Stand-in for **interior battery racks** for a cutaway view. Pair with an empty enclosure. |

---

## TOP 3 recommendation

### 1. Container Battery Storage System 4k PBR — CGTrader, $9.99 (PRIMARY)
- URL: https://www.cgtrader.com/3d-models/exterior/industrial-exterior/container-battery-storage-system-4k-pbr
- **Why:** Exactly the right tool for a Pixel-Streamed twin — **low-poly (10.3k tris), game-ready,
  glTF + FBX, full PBR set (Base/AO/Metal/Rough/Normal, 4K), royalty-free.** It is a 2 MW-class
  containerized unit, so it **instances cleanly** into a 100 MW / 400 MWh row. Cheap enough to buy
  outright, light enough to render many copies at 30–60 fps. Matte-industrial reskin to the
  Forge palette is trivial. This is the best physics-twin fit: legible, performant, credible.

### 2. Battery Energy Storage System Container BESS PBR — CGTrader, $150 (HERO / CUTAWAY)
- URL: https://www.cgtrader.com/3d-models/industrial/tool/battery-energy-storage-system-container-bess-pbr
- **Why:** When the demo needs a **single hero enclosure with modeled internals** (battery racks,
  inverters/PCS, HVAC, explosion flaps) for an "open-door" or inspector view, this is the credible
  option — royalty-free, broad format coverage incl. glTF/USDZ, PBR. Caveat: ~1.6M polys is heavy
  for streaming; decimate/LOD before use and reserve it for the focal container while #1 fills the row.

### 3. Poly Haven Containers (CC0) + Low-Poly Server Racks — free (ZERO-RISK FALLBACK / KITBASH)
- URLs: https://polyhaven.com/models/industrial/tools/containers ·
  https://sketchfab.com/3d-models/low-poly-server-racks-with-modules-included-14435ab46d2e407799e51ef9242179a7
- **Why:** A **CC0** shipping-container shell (no attribution, no license risk, native glTF/FBX/USD,
  clean PBR) reskinned as a BESS enclosure, kitbashed with low-poly server/battery racks for the
  interior. Fully commercially safe and free. This is the safety net if procurement wants zero paid
  dependencies, and the rack model doubles as the cutaway interior for option #1.

---

## Notes & cautions
- **Avoid the ultra-heavy V-Ray listing (#3, ~10.2M polys / 1 GB OBJ)** — buyer reviews note it
  needs rework in Blender, and it will not stream well. Not worth the retopo effort here.
- **AI-generated free Sketchfab models (#5, #6)** are tempting (free, CC-BY) but the geometry and
  textures read as generative-approximate. For an engineer-facing "credible twin," prefer the
  authored CGTrader/Poly Haven assets. Keep #6 only as a visual reference for interior layout.
- **License hygiene:** CGTrader/TurboSquid royalty-free permits commercial use in the demo; keep the
  invoice/license PDF in `assets/sourcing/`. CC-BY (Sketchfab) requires visible attribution — avoid
  in a client-facing sales demo unless credited. CC0 (Poly Haven) needs nothing.
- **Scene cohesion:** pair the BESS with the **Fab "Electrical Substation / 34 Assets"** kit
  (https://www.unrealengine.com/marketplace/en-US/product/electrical-substation-34-assets) so the
  transformer, yard, and BESS share one art style.
- **Fab direct search** was blocked (HTTP 403) to automated fetch; browse
  https://www.fab.com manually for the latest UE-native BESS packs — none surfaced as clearly
  BESS-specific at time of writing, so the substation kit is the closest UE-native match.
