import { MATTE, PORCELAIN, SCENE } from "./materials";

/**
 * An HV/LV bushing: the porcelain insulator stack that carries a conductor
 * through the tank wall. The shed count and height differ between the 230 kV
 * and 34.5 kV sides, which is the main visual cue that this is a step-down unit.
 */
export interface BushingProps {
  position: [number, number, number];
  height: number;
  radius: number;
  sheds: number;
}

export function Bushing({ position, height, radius, sheds }: BushingProps) {
  const shedSpacing = height / (sheds + 1);

  return (
    <group position={position}>
      {/* Turret the bushing seats into. */}
      <mesh position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[radius * 1.6, radius * 1.8, 0.24, 16]} />
        <meshStandardMaterial color={SCENE.tankDark} {...MATTE} />
      </mesh>

      {/* Porcelain core. */}
      <mesh position={[0, height / 2 + 0.24, 0]} castShadow>
        <cylinderGeometry args={[radius * 0.72, radius, height, 16]} />
        <meshStandardMaterial color={SCENE.insulator} {...PORCELAIN} />
      </mesh>

      {/* Weather sheds, tapering with the core. */}
      {Array.from({ length: sheds }, (_, i) => {
        const y = 0.24 + shedSpacing * (i + 1);
        const taper = 1 - (i / sheds) * 0.28;
        return (
          <mesh key={i} position={[0, y, 0]} castShadow>
            <cylinderGeometry args={[radius * 1.5 * taper, radius * 1.7 * taper, 0.05, 16]} />
            <meshStandardMaterial color={SCENE.insulator} {...PORCELAIN} />
          </mesh>
        );
      })}

      {/* Terminal palm at the top. */}
      <mesh position={[0, height + 0.3, 0]} castShadow>
        <cylinderGeometry args={[radius * 0.9, radius * 0.9, 0.12, 12]} />
        <meshStandardMaterial color={SCENE.conductor} roughness={0.6} metalness={0.5} />
      </mesh>
    </group>
  );
}
