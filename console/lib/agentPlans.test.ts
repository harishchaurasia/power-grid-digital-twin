import { describe, expect, it } from "vitest";

import { disagreesWithTools, type PlanOption } from "@/lib/agentPlans";

function plan(coolingStage: PlanOption["coolingStage"], netValueUsd: number): PlanOption {
  return {
    coolingStage,
    loadAction: "serve_full",
    peakHotSpotC: 120,
    breachesLimit: false,
    hoursAboveLimit: 0,
    lifeConsumedHours: 1,
    netValueUsd,
    lifeCostUsd: 0,
    curtailmentCostUsd: 0,
    failureRiskCostUsd: 0,
  };
}

describe("disagreesWithTools", () => {
  it("flags a prose choice that is not the top-ranked plan", () => {
    // The case that matters: the agent said one thing, its own arithmetic says
    // another. RESEARCH-LOG.md records exactly this happening.
    expect(disagreesWithTools("ONAN", [plan("OFAF", 500_000), plan("ONAN", 100_000)])).toBe(true);
  });

  it("does not flag agreement", () => {
    expect(disagreesWithTools("OFAF", [plan("OFAF", 500_000)])).toBe(false);
  });

  it("does not flag when the prose named no stage", () => {
    expect(disagreesWithTools(null, [plan("OFAF", 500_000)])).toBe(false);
  });

  it("does not flag when there are no plans to compare against", () => {
    // With no tool output there is nothing to contradict, so claiming a
    // disagreement would itself be an invented finding.
    expect(disagreesWithTools("OFAF", [])).toBe(false);
  });
});
