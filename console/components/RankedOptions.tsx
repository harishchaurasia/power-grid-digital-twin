import { formatUsd, interventionFor, type PlanOption } from "@/lib/agentPlans";
import type { ClientMessage, CoolingStage } from "@/lib/types";

import { Caption } from "./Panel";

/**
 * The ranked, costed options table.
 *
 * This is the differentiator made concrete (RESEARCH-LOG Agent C): a dashboard
 * shows the temperature, this shows what each choice is worth. Rows are ordered
 * by net value computed by the twin, and the winning row carries the Forge Red
 * accent plus the button that applies it — which closes the bidirectional loop
 * the credibility checklist requires, since applying a plan changes real twin
 * state rather than a display toggle.
 */
export interface RankedOptionsProps {
  plans: PlanOption[];
  /** The stage the agent named in prose, for cross-checking against the ranking. */
  stated: CoolingStage | null;
  activeStage: CoolingStage | undefined;
  canApply: boolean;
  send: (message: ClientMessage) => void;
}

export function RankedOptions({ plans, stated, activeStage, canApply, send }: RankedOptionsProps) {
  if (plans.length === 0) return null;

  const best = plans[0];
  const disagrees = stated !== null && best !== undefined && stated !== best.coolingStage;

  return (
    <div>
      <Caption>Ranked options — by net value, computed by the twin</Caption>

      <div className="mt-1.5 overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="text-text-tertiary">
              <th className="py-1 pr-3 text-left font-medium">Plan</th>
              <th className="py-1 pr-3 text-right font-medium">Peak θH</th>
              <th className="py-1 pr-3 text-right font-medium">Life used</th>
              <th className="py-1 pr-3 text-right font-medium">Net value</th>
              <th className="py-1 text-right font-medium">Limit</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {plans.map((plan, index) => {
              const isBest = index === 0;
              return (
                <tr
                  key={`${plan.coolingStage}-${plan.loadAction}`}
                  className={`border-t border-border/60 ${
                    isBest ? "text-text-primary" : "text-text-secondary"
                  }`}
                >
                  <td className="py-1.5 pr-3">
                    <span className={isBest ? "border-l-2 border-forge-red pl-2" : "pl-2"}>
                      {plan.coolingStage}
                    </span>
                    {plan.loadAction !== "serve_full" ? (
                      <span className="ml-1 text-text-tertiary">+shed</span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-3 text-right">{plan.peakHotSpotC.toFixed(1)} °C</td>
                  <td className="py-1.5 pr-3 text-right">
                    {plan.lifeConsumedHours.toFixed(1)} h
                  </td>
                  <td
                    className={`py-1.5 pr-3 text-right ${
                      plan.netValueUsd < 0 ? "text-forge-red" : ""
                    }`}
                  >
                    {formatUsd(plan.netValueUsd)}
                  </td>
                  <td className="py-1.5 text-right">
                    {plan.breachesLimit ? (
                      <span className="text-forge-red">breach</span>
                    ) : (
                      <span className="text-status-nominal">ok</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {best ? <RecommendedAction plan={best} activeStage={activeStage} canApply={canApply} send={send} /> : null}

      {disagrees ? (
        <p className="mt-2 text-[12px] leading-snug text-status-warning">
          The agent named {stated} in its summary, but its own tool results rank{" "}
          {best?.coolingStage} highest on net value. The table is the twin&apos;s arithmetic.
        </p>
      ) : null}
    </div>
  );
}

interface RecommendedActionProps {
  plan: PlanOption;
  activeStage: CoolingStage | undefined;
  canApply: boolean;
  send: (message: ClientMessage) => void;
}

function RecommendedAction({ plan, activeStage, canApply, send }: RecommendedActionProps) {
  const intervention = interventionFor(plan.coolingStage);
  const alreadyActive = activeStage === plan.coolingStage;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded border border-forge-red/50 bg-surface-2 px-3 py-2">
      <span className="text-[13px] text-text-primary">
        Recommended: <span className="font-mono font-medium">{plan.coolingStage}</span>
      </span>
      <span className="text-[12px] text-text-secondary">
        peak {plan.peakHotSpotC.toFixed(1)} °C · {plan.lifeConsumedHours.toFixed(1)} h life ·{" "}
        {formatUsd(plan.netValueUsd)} net
      </span>

      {intervention === null ? (
        <span className="ml-auto text-[12px] text-text-tertiary">No action — baseline</span>
      ) : (
        <button
          type="button"
          onClick={() => send({ type: "apply_intervention", intervention })}
          disabled={!canApply || alreadyActive}
          className="transition-brand ml-auto rounded border border-forge-red bg-forge-red px-3 py-1 text-[13px] text-void-black hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {alreadyActive ? `${plan.coolingStage} engaged` : `Apply ${plan.coolingStage}`}
        </button>
      )}
    </div>
  );
}
