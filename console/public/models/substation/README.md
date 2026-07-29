# Hero model drop-in

Put a glTF here and the scene picks it up automatically. With nothing here, the
scene falls back to the built geometry in `console/components/scene/`, so the
demo never hard-fails on a missing asset.

## What to drop

`console/components/scene/HeroModel.tsx` looks for **`scene.gltf`** in this
directory (`HERO_MODEL_URL`). Keep the whole unzipped folder together — the
`.gltf` references its `.bin` and texture files by relative path, so moving the
`.gltf` alone gives you an untextured or broken mesh.

A `.glb` works too; point `HERO_MODEL_URL` at it.

## Recommended

**`high_voltage_power_transformer (1)`** by **b4_cobra** — uid
`43277271f7aa4d538259a029e8337bea`

https://sketchfab.com/3d-models/high-voltage-power-transformer-1-43277271f7aa4d538259a029e8337bea

- **CC Attribution** — API states *"Author must be credited. Commercial use is allowed."*
- 11,933 faces / 5,908 verts — comfortably web-deliverable
- Correct asset class: oil-immersed power transformer with tank, radiator fin
  banks, three porcelain HV bushings, conservator drum and warning placards.

> ⚠️ A **different** model, uid `727bc7bb6777467dbea2ab6e0590bf4a`, has the same
> name and the same 11,933 face count but is **CC BY-NonCommercial** — which is
> disqualifying here. Check the uid, not the name.

### Rejected, and why

Judge these by *looking* at them, not by name and face count — that mistake is
what produced the first round of bad recommendations.

| Model | Why not |
|---|---|
| Electrical Substation [Drone Scan] `fd0152…` | Photogrammetry of a brick **building**, not switchyard equipment |
| Power Transformer `6,206 f` | Named right, but the mesh is a pressure vessel |
| Electricity transformer vault / Power transformer Building | Buildings, not apparatus |

Other candidates worth a look for **yard context** (all CC Attribution):
`Transformer Substation` `e490057f56e14d00adca63abdaf459ec` (936 f),
`Autotransformer voltage regulator` `04e4d8c65fbd4f3898530b9147aeecd1` (3,742 f),
`Electrical Transformer` `615fe4b367314a72b7dffb8ec791f575` (6,646 f).

Downloading needs a free Sketchfab account — the API returns **401** without
one, which is why this is a manual step.

## ⚠️ CC Attribution requires visible credit

Shipping a CC BY asset without attribution breaches the licence. Record the
author and model URL when you drop the file in, and surface the credit in the
console. This is a commercial client demo, so treat it as a hard requirement,
not a nicety.

## Two things the loader handles, and one it can't

Handled automatically by `HeroModel.tsx`:

- **Scale.** A downloaded mesh arrives at whatever scale its author used. The
  loader measures its bounding box and rescales the long axis to the real
  dimension from `lib/substationSpec.ts`, so a borrowed asset can't quietly
  reintroduce a scale error.
- **Grounding.** The mesh is offset to sit on grade rather than wherever its
  origin happens to be.

Not handled — **a photogrammetry scan is one fused mesh.** Its radiators, fans
and tank are not separable objects, so the fan rotation and the hot-spot heat
band cannot bind to it. Expect to use a scan as *site context* with the built
transformer keeping the live state bindings, or buy a modelled LPT with clean
separable geometry if you want the mesh itself animated.

## Licence hygiene

Verify on the live listing before shipping. **CC BY-NC and Sketchfab
"Editorial" are disqualifying** for a commercial demo regardless of quality.
