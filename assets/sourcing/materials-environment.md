# Environment / Material Sourcing — Substation Digital Twin (UE5)

Sourced for the ArkaForge substation demo. Target look: **stylized-industrial matte**, base
Void Black `#0B0C0F`, Forge Red `#FF3B00` as an alert-only accent (do not bake red into base
materials — drive it as an emissive/overlay parameter from twin state per `docs/brand.md`).

**Sourcing bias:** CC0 first (no attribution, commercial-safe, redistributable), UE5-ready.
Primary sources — [Poly Haven](https://polyhaven.com), [ambientCG](https://ambientcg.com),
[Quixel Megascans on Fab](https://www.fab.com/sellers/Quixel%20Megascans).

**Matte-look note:** Substation yards are weathered and non-glossy. Pull roughness high
(0.7–0.95) and de-saturate albedo toward the palette. Prefer worn/procedural variants over
glossy studio scans.

**License quick-reference**
- **CC0 (Poly Haven, ambientCG, TextureCan):** public domain. Use anywhere, no attribution,
  redistribute freely. Safest for a client-facing demo repo.
- **Fab Standard License (Quixel Megascans):** usable in any engine/tool, but as of 2025 most
  Megascans are **paid per-asset** (the "free to everyone through 2024" window closed). A
  rotating **~1,500-asset free starter set** remains free under the Standard License. Megascans
  are higher-fidelity than needed here and their EULA is more restrictive than CC0 — treat as
  a **secondary** source, prefer CC0.

---

## 1. Ground materials — gravel / ballast, concrete pads, asphalt

Substation yards are typically crushed-rock (gravel/ballast) surfacing with concrete equipment
pads and asphalt access roads. All ambientCG assets below are **CC0**, PBR (color, normal,
roughness, displacement, AO), JPG/PNG, tiling, USD-compatible.

| Name | URL | Source | License | Format / Res | Suitability |
|---|---|---|---|---|---|
| **Gravel 001** | https://ambientcg.com/view?id=Gravel001 | ambientCG | CC0 | PBR, 1K–4K | Clean small-stone gravel; the default substation yard ground. Verified. |
| Gravel 002 | https://ambientcg.com/view?id=Gravel002 | ambientCG | CC0 | PBR, 1K–8K | Coarser crushed rock — reads as track/railway **ballast** for the transmission-corridor base. |
| Ground 027 / Ground 042 | https://ambientcg.com/list?q=ground | ambientCG | CC0 | PBR, 1K–8K | Gravelly/compacted dirt-gravel blends for yard edges and transitions. |
| Concrete 020 | https://ambientcg.com/view?id=Concrete020 | ambientCG | CC0 | PBR, 1K–8K | Clean cast concrete — transformer/BESS equipment pads and foundations. |
| Concrete 034 / Concrete 012 | https://ambientcg.com/view?id=Concrete012 | ambientCG | CC0 | PBR, 1K–8K | Worn/stained concrete for aged pads and curbing; matte, low-saturation. |
| **Asphalt 012** | https://ambientcg.com/view?id=Asphalt012 | ambientCG | CC0 | PBR, 1K–4K | Dark cracked asphalt — access road / perimeter drive. Matte, palette-friendly. Verified. |
| Asphalt 006 / Asphalt 014 | https://ambientcg.com/list?q=asphalt | ambientCG | CC0 | PBR, 1K–8K | Alternative asphalt variants (finer vs. more damaged) for road variation. |

**TOP pick — ground:** **Gravel 001** (https://ambientcg.com/view?id=Gravel001). Universal
substation surfacing, CC0, tiles cleanly, matte by default. Pair **Gravel 002** for coarse
ballast under the line corridor and **Concrete 020** for equipment pads.

*Secondary source:* [TextureCan Asphalt](https://www.texturecan.com/category/Asphalt/) — CC0,
free PBR, good for extra road variation.

---

## 2. Metal / steel / rust / galvanized

For transformer tanks, radiators, bushings, BESS enclosures, steel lattice/gantry structures,
bus supports, and cable trays. Poly Haven metal sets are **CC0**, up to 8K, PBR, UE-ready
(direct download, no login).

| Name | URL | Source | License | Format / Res | Suitability |
|---|---|---|---|---|---|
| **Box Profile Metal Sheet** | https://polyhaven.com/a/box_profile_metal_sheet | Poly Haven | CC0 | PBR, up to 8K | Galvanized corrugated/box-profile steel — BESS container walls, enclosures, cladding. |
| Metal Plate 02 | https://polyhaven.com/a/metal_plate_02 | Poly Haven | CC0 | PBR, up to 8K | Clean industrial steel plate — transformer tank walls, cabinet panels. |
| Rusty Metal 04 | https://polyhaven.com/a/rusty_metal_04 | Poly Haven | CC0 | PBR, up to 8K | Oxidized/weathered steel for aged structures and bases; matte. |
| Rusty Metal 05 | https://polyhaven.com/a/rusty_metal_05 | Poly Haven | CC0 | PBR, up to 8K | Alternate rust variation to break up tiling across the yard. |
| Green Metal Rust | https://polyhaven.com/a/green_metal_rust | Poly Haven | CC0 | PBR, up to 8K | Painted-then-worn metal with rust streaks — dead-on for old painted equipment cabinets. |
| Galvanized Steel 01 | https://www.cgbookcase.com/textures/galvanized-steel-01 | cgbookcase | CC0 | PBR, up to 8K | Bright galvanized finish — lattice towers, gantries, fence posts, bus supports. |
| Metal 032 / Rust 004 | https://ambientcg.com/list?q=galvanized | ambientCG | CC0 | PBR, 1K–8K | Additional galvanized + rust-decal options for masked weathering overlays. |

**TOP pick — metal:** **Box Profile Metal Sheet** (https://polyhaven.com/a/box_profile_metal_sheet)
for the galvanized-steel language that dominates the scene (BESS containers, enclosures), plus
**Green Metal Rust** as the hero weathered-equipment material. Both CC0, 8K, matte-tunable.

*Browse more:* [Poly Haven metal textures](https://polyhaven.com/textures/metal) (all CC0).

---

## 3. Chain-link fence

Perimeter security fencing is the signature substation boundary element. Best delivered as an
**alpha/opacity-mapped** tiling texture on a simple plane (cheap, streams well). ambientCG has
no strong chain-link with cutout; the best CC0 sources are TextureCan and 3DTextures.

| Name | URL | Source | License | Format / Res | Suitability |
|---|---|---|---|---|---|
| **Chain-link Metal Wire Fencing** | https://www.texturecan.com/details/134/ | TextureCan | CC0 | PBR + **opacity/alpha**, up to 4K | Diamond-mesh chain-link with base color, normal, roughness, metallic, AO, **opacity** — drop straight onto a fence plane. |
| Chain-link Iron Wire Fence (diamond) | https://www.texturecan.com/details/123/ | TextureCan | CC0 | PBR + opacity, up to 4K | Alternate weave/gauge for variation along long perimeter runs. |
| Chain-link (3DTextures) | https://3dtextures.me/tag/chainlink/ | 3DTextures | CC0 | PBR (diffuse, normal, metallic, rough, displ, AO) | Seamless CC0 chain-link maps; Blender/UE/Unity-ready. |
| Fence 001 | https://ambientcg.com/view?id=Fence001 | ambientCG | CC0 | PBR, 1K–8K | Fallback (metal fence material; confirm cutout suitability before use). |

**TOP pick — fence:** **TextureCan Chain-link Metal Wire Fencing** (https://www.texturecan.com/details/134/).
CC0 and — critically — ships an **opacity map**, so it works as a masked material on a plane
without custom alpha authoring. Use a galvanized-steel tint to match posts.

*Note:* Fab has game-ready chain-link **mesh** assets (e.g. modular posts + rails) if you want
true geometry instead of a plane, but those are paid/Standard-License — the CC0 alpha-plane
route above is recommended for the demo.

---

## 4. Sky / HDRI — clear heat-wave day + dusk

The scenario is a **heat wave coincident with a load spike**, so lighting should read as harsh,
hazy, high-sun daytime; a dusk option covers the "into the evening peak" beat. Poly Haven
**"Pure Sky"** HDRIs are ideal: high-res (up to 24K), unclipped sun, no ground clutter, and
they map cleanly to a UE5 **Sky Atmosphere / HDRI Backdrop / SkyLight** setup. All **CC0**.

| Name | URL | Source | License | Format / Res | Suitability |
|---|---|---|---|---|---|
| **Kloofendal 43d Clear (Pure Sky)** | https://polyhaven.com/a/kloofendal_43d_clear_puresky | Poly Haven | CC0 | HDR, up to 16K+ | Clear midday sun, minimal cloud — the **heat-wave day**. Hard shadows, hot key light. |
| Kloofendal 48d Partly Cloudy (Pure Sky) | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky | Poly Haven | CC0 | HDR, up to 16K | Bright midday with light cloud — softer alternate if pure-clear reads too flat. |
| **Qwantani Dusk 2 (Pure Sky)** | https://polyhaven.com/a/qwantani_dusk_2_puresky | Poly Haven | CC0 | HDR, up to 24K | Warm low-contrast **dusk** with sunset glow — the evening-peak lighting state. |
| Browse: Clear / Midday skies | https://polyhaven.com/hdris/skies/clear/midday | Poly Haven | CC0 | HDR | Full clear-midday collection for a hazier/hotter pick if desired. |
| Browse: Sunrise–sunset | https://polyhaven.com/hdris/sunrise-sunset | Poly Haven | CC0 | HDR | Full dusk/golden-hour collection for alternate evening moods. |

**TOP pick — HDRI:** **Kloofendal 43d Clear (Pure Sky)** (https://polyhaven.com/a/kloofendal_43d_clear_puresky)
for the primary heat-wave daytime, and **Qwantani Dusk 2 (Pure Sky)**
(https://polyhaven.com/a/qwantani_dusk_2_puresky) for the dusk state. Both CC0, Pure-Sky
(clean horizon), and high enough res to serve as both lighting and visible backdrop.

*Tip:* For a heat-wave feel, push the daytime HDRI's exposure up and add a subtle atmospheric
haze/desaturation in post rather than choosing a cloudier map — keeps the sun hard and hot.

---

## 5. Free matte-industrial material libraries (browse hubs)

| Library | URL | License | Note |
|---|---|---|---|
| **ambientCG** | https://ambientcg.com/ | CC0 | 2,000+ CC0 PBR materials + HDRIs. Best single source for grounds, concrete, metal, rust, decals. Deep filtering; 1K–8K. |
| **Poly Haven** | https://polyhaven.com/textures | CC0 | Curated high-quality CC0 textures + HDRIs, up to 8K/24K. Best for hero metals and skies. |
| TextureCan | https://www.texturecan.com/ | CC0 | Free PBR incl. alpha-mapped chain-link and asphalt; good gap-filler. |
| cgbookcase | https://www.cgbookcase.com/textures | CC0 | Free CC0 PBR, strong galvanized/metal set. |
| 3DTextures.me | https://3dtextures.me/ | CC0 | Free seamless CC0 materials, Blender/UE/Unity-ready. |
| Quixel Megascans (Fab) | https://www.fab.com/sellers/Quixel%20Megascans | Fab Standard (mostly **paid** in 2025; rotating free set) | Photoreal scans — secondary/hero-detail only; watch the more restrictive EULA vs CC0. |

**TOP pick — library:** **ambientCG** (https://ambientcg.com/) — broadest CC0 coverage of the
exact grounds/metal/rust/concrete surfaces this scene needs, one consistent CC0 license, and
resolutions that suit a real-time UE5 twin.

---

## Sourcing summary (fastest path to a dressed scene)

1. **Grounds:** ambientCG **Gravel 001** (yard) + **Gravel 002** (line-corridor ballast) +
   **Concrete 020** (pads) + **Asphalt 012** (roads). All CC0.
2. **Metal:** Poly Haven **Box Profile Metal Sheet** (galvanized enclosures) + **Green Metal
   Rust** / **Rusty Metal 04** (weathered equipment) + cgbookcase **Galvanized Steel 01**
   (lattice/gantry). All CC0.
3. **Fence:** TextureCan **Chain-link Metal Wire Fencing** (CC0, alpha-mapped) on a plane.
4. **Sky:** Poly Haven **Kloofendal 43d Clear (Pure Sky)** (heat-wave day) + **Qwantani Dusk 2
   (Pure Sky)** (dusk). Both CC0.
5. **Keep it matte and on-palette:** high roughness, desaturated albedo toward Void Black;
   reserve Forge Red for emissive alert overlays driven by twin state, never in base albedo.

All primary picks are **CC0** — safe to commit into the demo repo and redistribute without
attribution.
