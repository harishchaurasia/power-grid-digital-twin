/**
 * REST fetches for the two derived analyses (projection band, V&V report).
 * Both are computed in the Python core; the console only renders them.
 *
 * Same-origin relative paths keep this iframe- and stream-safe.
 */

import type { HotSpotProjection, ValidationReport } from "@/lib/types";

export const PROJECTION_HORIZON_HOURS = 6;
export const PROJECTION_POLL_MS = 2000;

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status}`);
  }
  return (await response.json()) as T;
}

export function fetchProjection(
  signal: AbortSignal,
  horizonHours: number = PROJECTION_HORIZON_HOURS,
): Promise<HotSpotProjection> {
  return getJson<HotSpotProjection>(
    `/api/projection/transformer?horizon_hours=${horizonHours}`,
    signal,
  );
}

export function fetchValidation(signal: AbortSignal): Promise<ValidationReport> {
  return getJson<ValidationReport>("/api/validation/transformer", signal);
}
