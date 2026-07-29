/**
 * Availability probe for the optional hero mesh.
 *
 * With the file present the scene uses the real model; without it the built
 * geometry stands in, so a missing asset degrades rather than hard-failing
 * (docs/architecture.md fallbacks). Shared so the scene and the attribution
 * agree on one answer -- the credit must appear exactly when the mesh does.
 */

import { useEffect, useState } from "react";

/**
 * Optimised single-file GLB: WebP textures at 2048, meshopt-compressed
 * geometry, unused UV sets pruned. 14.5 MB of raw glTF + PNGs down to 1.05 MB.
 * The meshopt decoder ships with drei, so nothing is fetched at runtime.
 */
export const HERO_MODEL_URL = "/models/substation/transformer.glb";

export function useHeroModelAvailable(url: string = HERO_MODEL_URL): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(url, { method: "HEAD" })
      .then((response) => {
        if (!cancelled) setAvailable(response.ok);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return available;
}
