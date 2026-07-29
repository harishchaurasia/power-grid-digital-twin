import { BUSHING, YARD } from "@/lib/substationSpec";

import { MATTE, SCENE } from "./materials";

/**
 * The 230 kV yard around the transformer: rigid tubular bus on post insulators,
 * SF6 dead-tank breaker, surge arresters, CVTs, dead-end structure, control
 * house and NESC-height perimeter fence.
 *
 * **None of this is twinned.** It is physical context at correct dimensions, so
 * the node reads as a real substation rather than a transformer floating on a
 * plane. Only the transformer carries live state; BESS and the transmission
 * line are Phases 2-3 and are deliberately absent rather than faked, because
 * their physics does not exist yet (`bess: null`, `line: null`).
 */

const BUS_SPAN_M = 34;

function PostInsulator({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.16, 0.18, 2.4, 12]} />
        <meshStandardMaterial color={SCENE.insulator} roughness={0.45} metalness={0.05} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[0, -1.0 + i * 0.34, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.32, 0.06, 12]} />
          <meshStandardMaterial color={SCENE.insulator} roughness={0.45} metalness={0.05} />
        </mesh>
      ))}
    </group>
  );
}

function LatticeColumn({ position, height }: { position: [number, number, number]; height: number }) {
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <boxGeometry args={[0.42, height, 0.42]} />
        <meshStandardMaterial color={SCENE.conductor} roughness={0.75} metalness={0.35} />
      </mesh>
    </group>
  );
}

/** Station-class surge arrester: stacked porcelain sheds on a base. */
function SurgeArrester({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, YARD.arresterHeightM / 2, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.19, YARD.arresterHeightM, 12]} />
        <meshStandardMaterial color={SCENE.insulator} roughness={0.5} metalness={0.05} />
      </mesh>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[0, 0.35 + i * 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.3, 0.05, 12]} />
          <meshStandardMaterial color={SCENE.insulator} roughness={0.5} metalness={0.05} />
        </mesh>
      ))}
    </group>
  );
}

/** SF6 dead-tank circuit breaker with its three bushings. */
function DeadTankBreaker({ position }: { position: [number, number, number] }) {
  const b = YARD.breaker;
  return (
    <group position={position}>
      <mesh position={[0, b.tankHeightM / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[b.lengthM, b.tankHeightM, b.widthM]} />
        <meshStandardMaterial color={SCENE.tank} {...MATTE} />
      </mesh>
      {[-1.6, 0, 1.6].map((x) => (
        <mesh key={x} position={[x, b.tankHeightM + b.bushingHeightM / 2, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.19, b.bushingHeightM, 12]} />
          <meshStandardMaterial color={SCENE.insulator} roughness={0.5} metalness={0.05} />
        </mesh>
      ))}
    </group>
  );
}

export function SubstationYard() {
  const phase = BUSHING.hv.phaseSpacingM;

  return (
    <group>
      {/* Rigid tubular main bus, one run per phase, at 7.9 m above grade. */}
      {[-1, 0, 1].map((i) => (
        <mesh
          key={`bus-${i}`}
          position={[0, YARD.busHeightM, i * phase - 16]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry
            args={[YARD.busDiameterM / 2, YARD.busDiameterM / 2, BUS_SPAN_M, 12]}
          />
          <meshStandardMaterial color={SCENE.conductor} roughness={0.5} metalness={0.6} />
        </mesh>
      ))}

      {/* Bus support structures. */}
      {[-14, 0, 14].map((x) =>
        [-1, 0, 1].map((i) => (
          <group key={`sup-${x}-${i}`}>
            <LatticeColumn
              position={[x, 0, i * phase - 16]}
              height={YARD.busHeightM - 1.3}
            />
            <PostInsulator position={[x, YARD.busHeightM - 1.2, i * phase - 16]} />
          </group>
        )),
      )}

      {/* Dead-end take-off structure where the outgoing feeder leaves. */}
      {[-6, 6].map((x) => (
        <LatticeColumn key={`de-${x}`} position={[x, 0, -27]} height={YARD.deadEndHeightM} />
      ))}
      <mesh position={[0, YARD.deadEndHeightM - 0.4, -27]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <boxGeometry args={[0.5, 12.6, 0.5]} />
        <meshStandardMaterial color={SCENE.conductor} roughness={0.75} metalness={0.35} />
      </mesh>

      <DeadTankBreaker position={[-13, 0, -8]} />

      {[-1, 0, 1].map((i) => (
        <SurgeArrester key={`arr-${i}`} position={[9.5, 0, i * phase]} />
      ))}

      {/* Capacitive voltage transformers on the bus side. */}
      {[-1, 1].map((i) => (
        <group key={`cvt-${i}`} position={[-20, 0, i * phase]}>
          <mesh position={[0, YARD.cvtHeightM / 2, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.24, YARD.cvtHeightM, 12]} />
            <meshStandardMaterial color={SCENE.insulator} roughness={0.5} metalness={0.05} />
          </mesh>
          <mesh position={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[1.0, 0.8, 0.8]} />
            <meshStandardMaterial color={SCENE.tankDark} {...MATTE} />
          </mesh>
        </group>
      ))}

      {/* Control house. */}
      <group position={[20, 0, 14]}>
        <mesh position={[0, YARD.controlHouse.heightM / 2, 0]} castShadow receiveShadow>
          <boxGeometry
            args={[
              YARD.controlHouse.lengthM,
              YARD.controlHouse.heightM,
              YARD.controlHouse.widthM,
            ]}
          />
          <meshStandardMaterial color={SCENE.pad} roughness={0.9} metalness={0.05} />
        </mesh>
        <mesh position={[0, YARD.controlHouse.heightM + 0.12, 0]} castShadow>
          <boxGeometry
            args={[
              YARD.controlHouse.lengthM + 0.4,
              0.24,
              YARD.controlHouse.widthM + 0.4,
            ]}
          />
          <meshStandardMaterial color={SCENE.tankDark} {...MATTE} />
        </mesh>
      </group>

      <PerimeterFence />
    </group>
  );
}

/** NESC-height perimeter fence: 2.13 m fabric plus a barbed outrigger. */
function PerimeterFence() {
  const hx = YARD.yardLengthM / 2;
  const hz = YARD.yardWidthM / 2;
  const h = YARD.fenceHeightM;
  const posts = 34;

  return (
    <group>
      {(
        [
          [0, -hz, 0, YARD.yardLengthM],
          [0, hz, 0, YARD.yardLengthM],
          [-hx, 0, Math.PI / 2, YARD.yardWidthM],
          [hx, 0, Math.PI / 2, YARD.yardWidthM],
        ] as const
      ).map(([x, z, rot, len], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, rot, 0]}>
          <mesh position={[0, h / 2, 0]}>
            <boxGeometry args={[len, h, 0.04]} />
            <meshStandardMaterial
              color={SCENE.conductor}
              roughness={0.9}
              metalness={0.3}
              transparent
              opacity={0.22}
            />
          </mesh>
          <mesh position={[0, h + YARD.fenceBarbedM / 2, 0]}>
            <boxGeometry args={[len, YARD.fenceBarbedM, 0.02]} />
            <meshStandardMaterial
              color={SCENE.conductor}
              roughness={0.9}
              transparent
              opacity={0.16}
            />
          </mesh>
          {Array.from({ length: posts }, (_, p) => (
            <mesh key={p} position={[-len / 2 + (p * len) / (posts - 1), h / 2, 0]} castShadow>
              <cylinderGeometry args={[0.05, 0.05, h + YARD.fenceBarbedM, 6]} />
              <meshStandardMaterial color={SCENE.conductor} roughness={0.85} metalness={0.4} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
