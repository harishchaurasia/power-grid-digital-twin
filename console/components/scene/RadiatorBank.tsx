import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

import { TRANSFORMER } from "@/lib/substationSpec";

import { MATTE, SCENE } from "./materials";

const FIN_COUNT = 14;
const FIN_GAP = 0.13;
/** Forced-air fans on a unit this size are roughly a metre across. */
const FAN_RADIUS_M = 0.45;
const FAN_BLADES = 7;

/**
 * One radiator bank with its forced-air fan, at the real proportions of a
 * 150/200/250 MVA unit (see lib/substationSpec.ts).
 *
 * Fan speed comes from the cooling stage in twin state: ONAN is genuinely
 * motionless (oil natural, air natural), ONAF spins, OFAF spins faster. The
 * stage is decided by the Python core, never here.
 */
export interface RadiatorBankProps {
  position: [number, number, number];
  rotationY: number;
  fanSpeedRadS: number;
}

export function RadiatorBank({ position, rotationY, fanSpeedRadS }: RadiatorBankProps) {
  const fanRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (fanRef.current) {
      fanRef.current.rotation.z += fanSpeedRadS * delta;
    }
  });

  const bankWidth = FIN_COUNT * FIN_GAP;
  const finHeight = TRANSFORMER.radiatorHeightM;
  const finDepth = TRANSFORMER.radiatorDepthM;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Upper and lower header pipes feeding the bank. */}
      {[finHeight * 0.5 - 0.1, -finHeight * 0.5 + 0.1].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, bankWidth + 0.2, 12]} />
          <meshStandardMaterial color={SCENE.tankDark} {...MATTE} />
        </mesh>
      ))}

      {/* Cooling fins. */}
      {Array.from({ length: FIN_COUNT }, (_, i) => (
        <mesh
          key={i}
          position={[(i - (FIN_COUNT - 1) / 2) * FIN_GAP, 0, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.045, finHeight, finDepth]} />
          <meshStandardMaterial color={SCENE.radiator} {...MATTE} />
        </mesh>
      ))}

      {/* Fan cowling and rotating blades, mounted beneath the bank. */}
      <mesh position={[0, -finHeight * 0.5 - 0.28, 0]} castShadow>
        <cylinderGeometry args={[FAN_RADIUS_M, FAN_RADIUS_M, 0.2, 20]} />
        <meshStandardMaterial color={SCENE.fan} {...MATTE} />
      </mesh>
      <group
        ref={fanRef}
        position={[0, -finHeight * 0.5 - 0.18, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        {Array.from({ length: FAN_BLADES }, (_, i) => {
          const angle = (i / FAN_BLADES) * Math.PI * 2;
          return (
            <mesh
              key={i}
              rotation={[0, 0, angle]}
              position={[Math.cos(angle) * 0.19, Math.sin(angle) * 0.19, 0]}
            >
              <boxGeometry args={[FAN_RADIUS_M * 0.85, 0.14, 0.03]} />
              <meshStandardMaterial color={SCENE.conductor} roughness={0.7} metalness={0.3} />
            </mesh>
          );
        })}
        <mesh>
          <cylinderGeometry args={[0.1, 0.1, 0.16, 10]} />
          <meshStandardMaterial color={SCENE.fan} {...MATTE} />
        </mesh>
      </group>
    </group>
  );
}
