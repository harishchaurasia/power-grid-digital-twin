import { Suspense, lazy } from "react";

/**
 * Code-split boundary for the 3D layer.
 *
 * Three.js, drei and the loaders are the bulk of the bundle and none of it is
 * needed to render telemetry. Splitting here lets the operator console — the
 * part carrying the actual numbers — paint on the main chunk while the scene
 * streams in behind it, which also means a slow or failed scene load never
 * blocks the data UI (docs/architecture.md fallbacks).
 */
const TwinScene = lazy(() =>
  import("./TwinScene").then((m) => ({ default: m.TwinScene })),
);

export function TwinSceneLazy() {
  return (
    <Suspense fallback={null}>
      <TwinScene />
    </Suspense>
  );
}
