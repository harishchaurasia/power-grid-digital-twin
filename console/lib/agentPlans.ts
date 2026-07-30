/**
 * Ranked intervention options, read from `simulate_forward` tool results.
 *
 * Deliberately built from the **tool output**, not from parsing the agent's
 * prose. The prose is the model's summary and can drift — a small model has
 * already been observed restating an asymmetric confidence interval as a
 * symmetric one. The table is the twin's own arithmetic, so what a prospect
 * reads stays true even when the wording does not
 * (docs/CLAUDE.md hard rule 3).
 */

import type { CoolingStage, InterventionId, ToolCallEvent } from "@/lib/types";

export interface PlanOption {
  coolingStage: CoolingStage;
  loadAction: string;
  peakHotSpotC: number;
  breachesLimit: boolean;
  hoursAboveLimit: number;
  lifeConsumedHours: number;
  netValueUsd: number;
  lifeCostUsd: number;
  curtailmentCostUsd: number;
  failureRiskCostUsd: number;
}

const INTERVENTION_BY_STAGE: Record<CoolingStage, InterventionId | null> = {
  // There is no intervention that returns to ONAN; "do nothing" is the
  // baseline plan, not an action, so it has no Apply button.
  ONAN: null,
  ONAF: "cooling_onaf",
  OFAF: "cooling_ofaf",
};

export function interventionFor(stage: CoolingStage): InterventionId | null {
  return INTERVENTION_BY_STAGE[stage];
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
}

/** Extract every costed plan the agent simulated, best net value first. */
export function extractPlans(toolCalls: ToolCallEvent[]): PlanOption[] {
  const plans = new Map<string, PlanOption>();

  for (const call of toolCalls) {
    if (call.tool !== "simulate_forward" || !call.output) continue;
    const output = call.output;
    const plan = output.plan as Record<string, unknown> | undefined;
    const econ = output.economics as Record<string, unknown> | undefined;
    if (!plan || !econ) continue;

    const stage = plan.cooling_stage;
    if (typeof stage !== "string") continue;

    const option: PlanOption = {
      coolingStage: stage as CoolingStage,
      loadAction:
        typeof plan.load_action === "string" ? plan.load_action : "serve_full",
      peakHotSpotC: num(output.peak_hot_spot_c),
      breachesLimit: Boolean(output.breaches_120c),
      hoursAboveLimit: num(output.hours_above_120c),
      lifeConsumedHours: num(econ.equivalent_life_consumed_hours),
      netValueUsd: num(econ.net_value_usd),
      lifeCostUsd: num(econ.transformer_life_cost_usd),
      curtailmentCostUsd: num(econ.curtailment_cost_usd),
      failureRiskCostUsd: num(econ.failure_risk_cost_usd),
    };
    if (Number.isNaN(option.netValueUsd)) continue;
    // Later calls for the same plan supersede earlier ones.
    plans.set(`${stage}:${option.loadAction}`, option);
  }

  return [...plans.values()].sort((a, b) => b.netValueUsd - a.netValueUsd);
}

/**
 * The stage the agent named in its prose, if any.
 *
 * Kept separate from the ranking so a disagreement between what the agent said
 * and what its own tools computed is visible rather than smoothed over.
 */
export function statedChoice(finalText: string | null): CoolingStage | null {
  if (!finalText) return null;
  const section = finalText.split(/RECOMMENDATION/i).pop();
  if (!section) return null;
  const match = section.match(/\b(OFAF|ONAF|ONAN)\b/);
  return (match?.[1] as CoolingStage) ?? null;
}

/**
 * True when the stage the agent named in prose is not the one its own tools rank
 * highest. Lives here rather than in a component so the ranked table and the
 * collapsed summary cannot reach different verdicts about the same answer.
 */
export function disagreesWithTools(
  stated: CoolingStage | null,
  plans: PlanOption[],
): boolean {
  const best = plans[0];
  if (stated === null || best === undefined) return false;
  return stated !== best.coolingStage;
}

export function formatUsd(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}
