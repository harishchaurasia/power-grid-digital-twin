import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Box3, Color, Mesh, MeshStandardMaterial, Vector3 } from "three";

import { TRANSFORMER } from "@/lib/substationSpec";
import type { TwinVisualState } from "@/lib/visualState";

import { MATTE, SCENE } from "./materials";

const HOT_COLOR = new Color(SCENE.forgeRed);

/**
 * Peak emissive on the hero mesh.
 *
 * Lower than the primitive fallback uses, because this mesh is textured: the
 * albedo and normal detail keep reading through a gentler tint, where a flat
 * grey box needed a stronger cue to register at all.
 */
const MAX_EMISSIVE = 0.55;

/**
 * The real transformer mesh.
 *
 * CC-BY-4.0 "high_voltage_power_transformer (1)" by b4_cobra. The licence
 * requires visible credit — see <ModelAttribution/>, which is not optional.
 *
 * Two things this component owns:
 *
 * 1. **Scale.** A downloaded mesh arrives at whatever scale its author used.
 *    The bounding box is measured and the long axis rescaled to the real
 *    9.0 m tank length from lib/substationSpec.ts, so a borrowed asset cannot
 *    quietly reintroduce the scale error the spec exists to prevent.
 * 2. **The heat cue.** The mesh is two fused meshes with no separable parts, so
 *    the cue is a *height-masked* emissive injected into the standard material:
 *    it ramps in over the upper part of the tank, where the winding hot-spot
 *    physically sits, instead of flooding the whole body.
 */
export interface HeroTransformerProps {
  url: string;
  visual: TwinVisualState;
}

export function HeroTransformer({ url, visual }: HeroTransformerProps) {
  const { scene } = useGLTF(url);
  const heat = useRef({ value: 0 });

  const { scale, groundOffsetY, worldMinY, worldSpanY } = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const longest = Math.max(size.x, size.z) || 1;
    const s = TRANSFORMER.tankLengthM / longest;
    // Bounds of the mesh *as finally placed*: scaled, then lifted so its base
    // sits on the plinth. The shader masks in world space, so these must be
    // world-space too -- the mesh's own local axes come from an FBX conversion
    // and bear no relation to scene coordinates.
    return {
      scale: s,
      groundOffsetY: -box.min.y * s,
      worldMinY: TRANSFORMER.plinthHeightM,
      worldSpanY: Math.max(size.y * s, 0.001),
    };
  }, [scene]);

  // Patch every material once so the emissive ramps in by height rather than
  // washing the whole body. Materials are cloned first: useGLTF caches the
  // scene graph, so mutating in place would leak across remounts.
  useEffect(() => {
    scene.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;

      const source = child.material as MeshStandardMaterial;
      const material = source.clone();
      material.roughness = Math.max(source.roughness, MATTE.roughness * 0.8);
      // The heat cue rides an own colour uniform rather than `material.emissive`.
      // three.js folds emissiveIntensity into the `emissive` uniform, so a zero
      // intensity would multiply the whole term to black and the cue would never
      // appear -- keep the material's own emissive out of it entirely.

      material.onBeforeCompile = (shader) => {
        shader.uniforms.uHeat = heat.current;
        shader.uniforms.uHotColor = { value: HOT_COLOR };
        shader.uniforms.uMinY = { value: worldMinY };
        shader.uniforms.uSpan = { value: worldSpanY };
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nvarying float vWorldY;")
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
             // World-space height: modelMatrix folds in every parent transform
             // plus our scale and ground offset.
             vWorldY = ( modelMatrix * vec4( transformed, 1.0 ) ).y;`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            `#include <common>
             varying float vWorldY;
             uniform float uHeat;
             uniform vec3 uHotColor;
             uniform float uMinY;
             uniform float uSpan;`,
          )
          .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
             // Ramp the cue in over the upper part of the tank, where the
             // winding hot-spot is, and fade it near the top so the cover and
             // bushings stay steel.
             float h = (vWorldY - uMinY) / uSpan;
             float band = smoothstep(0.35, 0.66, h) * (1.0 - smoothstep(0.74, 0.92, h));
             totalEmissiveRadiance += uHotColor * uHeat * band;`,
          );
      };
      // Distinguish this program from the stock standard-material shader so
      // three.js does not hand back a cached one without the injection.
      material.customProgramCacheKey = () => "arkaforge-hotspot";
      material.needsUpdate = true;
      child.material = material;
    });
  }, [scene, worldMinY, worldSpanY]);

  useFrame((_, delta) => {
    const target = visual.heat * MAX_EMISSIVE;
    heat.current.value += (target - heat.current.value) * Math.min(1, delta * 3);
  });

  return (
    <group>
      {/* Concrete plinth with oil-containment kerb -- not part of the mesh. */}
      <mesh position={[0, TRANSFORMER.plinthHeightM / 2, 0]} receiveShadow castShadow>
        <boxGeometry
          args={[
            TRANSFORMER.tankLengthM + 4.0,
            TRANSFORMER.plinthHeightM,
            TRANSFORMER.tankWidthM + 5.5,
          ]}
        />
        <meshStandardMaterial color={SCENE.pad} roughness={0.95} metalness={0.02} />
      </mesh>

      <primitive object={scene} scale={scale} position={[0, TRANSFORMER.plinthHeightM + groundOffsetY, 0]} />

      {/* Oil-pump housings: forced-oil stage only. The mesh has no separable
          pumps, so this stays our geometry. Neutral steel -- a running pump is
          cooling working, not an alert (docs/brand.md). */}
      {visual.pumpActive
        ? [-TRANSFORMER.tankLengthM * 0.3, TRANSFORMER.tankLengthM * 0.3].map((x) => (
            <mesh
              key={x}
              position={[x, TRANSFORMER.plinthHeightM + 0.55, TRANSFORMER.tankWidthM / 2 + 1.4]}
              castShadow
            >
              <cylinderGeometry args={[0.3, 0.3, 0.9, 14]} />
              <meshStandardMaterial color={SCENE.conductor} roughness={0.55} metalness={0.4} />
            </mesh>
          ))
        : null}
    </group>
  );
}
