import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Color, type MeshStandardMaterial } from "three";

import { BUSHING, TRANSFORMER } from "@/lib/substationSpec";
import type { TwinVisualState } from "@/lib/visualState";

import { Bushing } from "./Bushing";
import { RadiatorBank } from "./RadiatorBank";
import { MATTE, SCENE } from "./materials";

/**
 * Heat cue strength.
 *
 * The tank carries only faint overall warmth; the readable cue is a band high
 * on the tank, where the winding hot-spot physically is. Concentrating it there
 * keeps Forge Red to a small share of the view (docs/brand.md) and stops a
 * saturated tank from flattening out and losing its form.
 */
const MAX_TANK_EMISSIVE = 0.11;
const MAX_BAND_EMISSIVE = 1.6;

const COOL_COLOR = new Color(SCENE.tank);
const HOT_COLOR = new Color(SCENE.forgeRed);

const { tankLengthM: L, tankWidthM: W, tankHeightM: H, plinthHeightM: P } = TRANSFORMER;
const TANK_CENTRE_Y = P + H / 2;
const COVER_Y = P + H;

/**
 * The 150/200/250 MVA, 230/34.5 kV step-down transformer, at the real
 * dimensions in lib/substationSpec.ts -- a ~236 t object roughly 9 m long.
 *
 * Geometry is a stand-in for a proper mesh, but the *dimensions* are not: they
 * are the thing an engineer checks first, so they trace to IEEE C57.12.10 and
 * IEEE 1427 rather than to what framed nicely.
 */
export interface TransformerModelProps {
  visual: TwinVisualState;
}

export function TransformerModel({ visual }: TransformerModelProps) {
  const tankMaterial = useRef<MeshStandardMaterial>(null);
  const bandMaterial = useRef<MeshStandardMaterial>(null);

  // Ease toward the target so a scenario ramp reads smoothly, without ever
  // showing a value the twin has not reported.
  useFrame((_, delta) => {
    const t = Math.min(1, delta * 3);
    const tank = tankMaterial.current;
    if (tank) {
      tank.emissiveIntensity += (visual.heat * MAX_TANK_EMISSIVE - tank.emissiveIntensity) * t;
    }
    const band = bandMaterial.current;
    if (band) {
      band.emissiveIntensity += (visual.heat * MAX_BAND_EMISSIVE - band.emissiveIntensity) * t;
      band.color.lerp(visual.heat > 0 ? HOT_COLOR : COOL_COLOR, t);
    }
  });

  const bankSpacing = L / (TRANSFORMER.radiatorBanksPerSide + 1);
  const bankOffsets = Array.from(
    { length: TRANSFORMER.radiatorBanksPerSide },
    (_, i) => (i + 1) * bankSpacing - L / 2,
  );
  const radiatorZ = W / 2 + TRANSFORMER.radiatorDepthM / 2 + 0.15;
  const radiatorY = P + TRANSFORMER.radiatorHeightM / 2 + 0.7;

  return (
    <group>
      {/* Concrete plinth with oil-containment kerb. */}
      <mesh position={[0, P / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[L + 4.0, P, W + 5.5]} />
        <meshStandardMaterial color={SCENE.pad} roughness={0.95} metalness={0.02} />
      </mesh>

      {/* Main oil tank. */}
      <mesh position={[0, TANK_CENTRE_Y, 0]} castShadow receiveShadow>
        <boxGeometry args={[L, H, W]} />
        <meshStandardMaterial
          ref={tankMaterial}
          color={SCENE.tank}
          emissive={HOT_COLOR}
          emissiveIntensity={0}
          {...MATTE}
        />
      </mesh>

      {/* Hot-spot band: the winding sits high in the tank, so the thermal cue
          reads there rather than across the whole shell. */}
      <mesh position={[0, COVER_Y - 0.85, 0]}>
        <boxGeometry args={[L + 0.05, 0.5, W + 0.05]} />
        <meshStandardMaterial
          ref={bandMaterial}
          color={COOL_COLOR}
          emissive={HOT_COLOR}
          emissiveIntensity={0}
          toneMapped={false}
          {...MATTE}
        />
      </mesh>

      {/* Tank cover. */}
      <mesh position={[0, COVER_Y + 0.12, 0]} castShadow>
        <boxGeometry args={[L + 0.3, 0.24, W + 0.3]} />
        <meshStandardMaterial color={SCENE.tankDark} {...MATTE} />
      </mesh>

      {/* Conservator drum on saddles above the cover. */}
      <mesh
        position={[-L * 0.15, COVER_Y + 1.35, -W / 2 - 0.2]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry
          args={[
            TRANSFORMER.conservatorDiameterM / 2,
            TRANSFORMER.conservatorDiameterM / 2,
            TRANSFORMER.conservatorLengthM,
            20,
          ]}
        />
        <meshStandardMaterial color={SCENE.tankDark} {...MATTE} />
      </mesh>

      {/* 230 kV HV bushings -- tall, 18 sheds, 3.2 m phase spacing. */}
      {[-1, 0, 1].map((i) => (
        <Bushing
          key={`hv-${i}`}
          position={[i * BUSHING.hv.phaseSpacingM, COVER_Y + 0.24, -W * 0.24]}
          height={BUSHING.hv.heightM}
          radius={BUSHING.hv.radiusM}
          sheds={BUSHING.hv.sheds}
        />
      ))}

      {/* 34.5 kV LV bushings -- short, 8 sheds. */}
      {[-1, 0, 1].map((i) => (
        <Bushing
          key={`lv-${i}`}
          position={[i * BUSHING.lv.phaseSpacingM, COVER_Y + 0.24, W * 0.3]}
          height={BUSHING.lv.heightM}
          radius={BUSHING.lv.radiusM}
          sheds={BUSHING.lv.sheds}
        />
      ))}

      {/* Radiator banks, four per long face. */}
      {bankOffsets.map((x) => (
        <RadiatorBank
          key={`r+${x}`}
          position={[x, radiatorY, radiatorZ]}
          rotationY={0}
          fanSpeedRadS={visual.fanSpeedRadS}
        />
      ))}
      {bankOffsets.map((x) => (
        <RadiatorBank
          key={`r-${x}`}
          position={[x, radiatorY, -radiatorZ]}
          rotationY={Math.PI}
          fanSpeedRadS={visual.fanSpeedRadS}
        />
      ))}

      {/* Oil-pump housings: forced-oil stage only. Neutral steel -- a running
          pump is cooling working, not an alert (docs/brand.md). */}
      {visual.pumpActive
        ? [-L * 0.28, L * 0.28].map((x) => (
            <mesh key={x} position={[x, P + 0.55, W / 2 + 0.1]} castShadow>
              <cylinderGeometry args={[0.3, 0.3, 0.9, 14]} />
              <meshStandardMaterial color={SCENE.conductor} roughness={0.55} metalness={0.4} />
            </mesh>
          ))
        : null}

      {/* Tap-changer compartment on the LV end. */}
      <mesh position={[L / 2 + 0.55, P + 1.6, 0]} castShadow>
        <boxGeometry args={[1.1, 3.0, 2.2]} />
        <meshStandardMaterial color={SCENE.tankDark} {...MATTE} />
      </mesh>

      {/* Control/marshalling cabinet. */}
      <mesh position={[-L / 2 - 0.5, P + 1.0, W * 0.3]} castShadow>
        <boxGeometry args={[0.9, 2.0, 1.2]} />
        <meshStandardMaterial color={SCENE.tankDark} {...MATTE} />
      </mesh>
    </group>
  );
}
