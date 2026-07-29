/**
 * Twin state -> visual parameters.
 *
 * The scene renders **only** what this module derives from a `TwinSnapshot`
 * (docs/credibility-checklist.md: "renders only state derived from the
 * simulation core -- never locally invented physics"). Every mapping below is a
 * pure function of twin state, so a given state always looks the same.
 *
 * Nothing here is physics. These are presentation ramps over numbers the Python
 * core already computed, and the thresholds are the operating bands in
 * docs/domain-transformer.md.
 */

import type { CoolingStage, TwinSnapshot } from "@/lib/types";

/** Heat cue starts at the top of the normal band and saturates at the limit. */
const GLOW_START_C = 105;
const GLOW_FULL_C = 120;

/**
 * Fan shaft speed by cooling stage, in radians/second. ONAN has no fans at all
 * (oil natural, air natural), which is why it is exactly zero rather than slow.
 */
const FAN_SPEED_RAD_S: Record<CoolingStage, number> = {
  ONAN: 0,
  ONAF: 6.5,
  OFAF: 11.0,
};

/** Oil pumps only exist on the forced-oil stage. */
const PUMP_ACTIVE: Record<CoolingStage, boolean> = {
  ONAN: false,
  ONAF: false,
  OFAF: true,
};

export interface TwinVisualState {
  /** 0 = at or below the normal band, 1 = at or above the C57.91 limit. */
  heat: number;
  fanSpeedRadS: number;
  pumpActive: boolean;
  /** True only when the backend says the asset is critical. */
  alert: boolean;
  hotSpotC: number;
  coolingStage: CoolingStage;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function toVisualState(snapshot: TwinSnapshot | null): TwinVisualState {
  if (!snapshot) {
    return {
      heat: 0,
      fanSpeedRadS: 0,
      pumpActive: false,
      alert: false,
      hotSpotC: 0,
      coolingStage: "ONAN",
    };
  }

  const t = snapshot.transformer;
  return {
    heat: clamp01((t.hot_spot_c - GLOW_START_C) / (GLOW_FULL_C - GLOW_START_C)),
    fanSpeedRadS: FAN_SPEED_RAD_S[t.cooling_stage],
    pumpActive: PUMP_ACTIVE[t.cooling_stage],
    alert: t.status === "critical",
    hotSpotC: t.hot_spot_c,
    coolingStage: t.cooling_stage,
  };
}
