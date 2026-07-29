/**
 * Per-signal operating bands, transcribed from the "Normal operating ranges"
 * table in docs/domain-transformer.md.
 *
 * These are **presentational only** -- they colour an individual reading. The
 * authoritative asset status that drives the Forge Red alert state is computed
 * by `transformer_status` in the Python core and arrives on every snapshot;
 * this module never overrides it.
 */

import type { AssetStatus } from "@/lib/types";

interface Band {
  warningAbove: number;
  criticalAbove: number;
}

const HOT_SPOT_BAND: Band = { warningAbove: 105, criticalAbove: 120 };
const TOP_OIL_BAND: Band = { warningAbove: 75, criticalAbove: 90 };
const LOADING_K_BAND: Band = { warningAbove: 1.0, criticalAbove: 1.3 };
const AGING_FACTOR_BAND: Band = { warningAbove: 1.0, criticalAbove: 4.0 };

function classify(value: number, band: Band): AssetStatus {
  if (value > band.criticalAbove) return "critical";
  if (value > band.warningAbove) return "warning";
  return "nominal";
}

export const hotSpotTone = (value: number): AssetStatus => classify(value, HOT_SPOT_BAND);
export const topOilTone = (value: number): AssetStatus => classify(value, TOP_OIL_BAND);
export const loadingTone = (value: number): AssetStatus => classify(value, LOADING_K_BAND);
export const agingTone = (value: number): AssetStatus => classify(value, AGING_FACTOR_BAND);

export const HOT_SPOT_CRITICAL_C = HOT_SPOT_BAND.criticalAbove;
export const HOT_SPOT_WARNING_C = HOT_SPOT_BAND.warningAbove;
