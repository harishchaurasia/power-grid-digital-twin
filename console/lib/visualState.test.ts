import { describe, expect, it } from "vitest";

import { snapshot } from "@/test/fixtures";
import { toVisualState } from "@/lib/visualState";

/**
 * This module is the only twin-state -> visual mapping, so it is the thing
 * standing between the scene and "Unreal invents its own physics"
 * (docs/credibility-checklist.md). It must be a pure function of twin state:
 * same snapshot, same look, every time.
 */

describe("toVisualState", () => {
  it("is deterministic for a given snapshot", () => {
    const input = snapshot({ hotSpotC: 112.5, status: "warning" });
    expect(toVisualState(input)).toStrictEqual(toVisualState(input));
  });

  it("renders nothing hot before the top of the normal band", () => {
    expect(toVisualState(snapshot({ hotSpotC: 104.9 })).heat).toBe(0);
  });

  it("saturates the heat cue at the C57.91 limit, not beyond it", () => {
    expect(toVisualState(snapshot({ hotSpotC: 120 })).heat).toBe(1);
    // Past the limit the cue cannot get louder -- Forge Red has a budget
    // (docs/brand.md), and 134 C must not read as "more red than 120".
    expect(toVisualState(snapshot({ hotSpotC: 134.4 })).heat).toBe(1);
  });

  it("ramps linearly across the warning band", () => {
    expect(toVisualState(snapshot({ hotSpotC: 112.5 })).heat).toBeCloseTo(0.5, 6);
  });

  it("takes alert from the backend's status, never from its own threshold", () => {
    // Hot-spot is over the limit but the backend still says warning: the scene
    // follows the twin, not a rule of its own.
    expect(toVisualState(snapshot({ hotSpotC: 125, status: "warning" })).alert).toBe(false);
    expect(toVisualState(snapshot({ hotSpotC: 96, status: "critical" })).alert).toBe(true);
  });

  it("leaves ONAN fans at exactly zero -- oil natural, air natural", () => {
    expect(toVisualState(snapshot({ coolingStage: "ONAN" })).fanSpeedRadS).toBe(0);
  });

  it("spins fans faster on each forced stage", () => {
    const onaf = toVisualState(snapshot({ coolingStage: "ONAF" })).fanSpeedRadS;
    const ofaf = toVisualState(snapshot({ coolingStage: "OFAF" })).fanSpeedRadS;
    expect(onaf).toBeGreaterThan(0);
    expect(ofaf).toBeGreaterThan(onaf);
  });

  it("shows oil pumps only on the forced-oil stage", () => {
    expect(toVisualState(snapshot({ coolingStage: "ONAN" })).pumpActive).toBe(false);
    expect(toVisualState(snapshot({ coolingStage: "ONAF" })).pumpActive).toBe(false);
    expect(toVisualState(snapshot({ coolingStage: "OFAF" })).pumpActive).toBe(true);
  });

  it("renders a cold, quiet, unalarmed scene before any telemetry arrives", () => {
    expect(toVisualState(null)).toStrictEqual({
      heat: 0,
      fanSpeedRadS: 0,
      pumpActive: false,
      alert: false,
      hotSpotC: 0,
      coolingStage: "ONAN",
    });
  });
});
