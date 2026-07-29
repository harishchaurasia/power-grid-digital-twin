import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useMemo } from "react";

import { HERO_MODEL_URL, useHeroModelAvailable } from "@/lib/heroModel";
import { useConsoleStore } from "@/lib/store";
import { YARD } from "@/lib/substationSpec";
import { toVisualState } from "@/lib/visualState";

import { HeroTransformer } from "./HeroTransformer";
import { SubstationYard } from "./SubstationYard";
import { TransformerModel } from "./TransformerModel";
import { SCENE } from "./materials";

/**
 * Browser-rendered substation twin.
 *
 * This occupies the layer that the Pixel-Streamed Unreal video will occupy once
 * the GPU host exists (docs/architecture.md); the console overlay composites on
 * top of it either way, so swapping one for the other does not touch the UI.
 *
 * The scene is a **view**, never a source of truth: everything it shows is
 * derived from `TwinSnapshot` via lib/visualState. Only the camera is local.
 */
export function TwinScene() {
  const snapshot = useConsoleStore((state) => state.snapshot);
  const visual = useMemo(() => toVisualState(snapshot), [snapshot]);
  const heroAvailable = useHeroModelAvailable();

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [34, 19, 34], fov: 40, near: 0.5, far: 400 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[SCENE.background]} />
      <fog attach="fog" args={[SCENE.background, 70, 170]} />

      {/* Matte industrial lighting: warm key, cool sky fill, one cold back rim
          to separate the silhouette from the Void Black backdrop. */}
      <ambientLight intensity={0.9} />
      <hemisphereLight args={["#aebdd4", "#2a2d36", 1.1]} />
      <directionalLight
        position={[34, 46, 22]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-camera-far={140}
      />
      <directionalLight position={[-30, 20, -26]} intensity={0.85} color="#9fb0c8" />
      <directionalLight position={[-10, 12, 30]} intensity={0.5} color="#cdd6e4" />

      <Suspense fallback={<TransformerModel visual={visual} />}>
        {heroAvailable === true ? (
          <HeroTransformer url={HERO_MODEL_URL} visual={visual} />
        ) : (
          <TransformerModel visual={visual} />
        )}
      </Suspense>
      <SubstationYard />

      {/* Graded yard surface. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[260, 260]} />
        <meshStandardMaterial color={SCENE.pad} roughness={1} metalness={0} />
      </mesh>
      <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={70} blur={2.6} far={18} />
      <gridHelper
        args={[YARD.yardLengthM, Math.round(YARD.yardLengthM / 2), "#333845", "#232733"]}
        position={[0, 0.02, 0]}
      />

      <OrbitControls
        makeDefault
        target={[0, 4.5, 0]}
        minDistance={14}
        maxDistance={95}
        maxPolarAngle={Math.PI / 2.1}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}
