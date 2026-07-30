/**
 * Seeds an agent run into the store by replaying the same `ServerMessage`s the
 * WebSocket sends. Going through `applyServerMessage` rather than `setState`
 * means a test exercises the real path -- including `extractPlans` reading tool
 * output -- instead of a hand-built store shape that could drift from it.
 */

import { useConsoleStore } from "@/lib/store";
import type { CoolingStage } from "@/lib/types";

export interface PlanFixture {
  stage: CoolingStage;
  netValueUsd: number;
}

function simulateForwardOutput(fixture: PlanFixture): Record<string, unknown> {
  // ONAN is the do-nothing plan, so it is the one that breaches the limit.
  const breaches = fixture.stage === "ONAN";
  return {
    plan: { cooling_stage: fixture.stage, load_action: "serve_full" },
    peak_hot_spot_c: breaches ? 134.4 : 103.0,
    breaches_120c: breaches,
    hours_above_120c: breaches ? 2.4 : 0,
    economics: {
      equivalent_life_consumed_hours: breaches ? 62.0 : 4.1,
      net_value_usd: fixture.netValueUsd,
      transformer_life_cost_usd: breaches ? 41_000 : 2_700,
      curtailment_cost_usd: 0,
      failure_risk_cost_usd: breaches ? 18_000 : 900,
    },
  };
}

export function seedRecommendation(options: {
  plans: PlanFixture[];
  final: string;
  local?: boolean;
}): void {
  const local = options.local ?? false;
  const store = useConsoleStore.getState();

  store.applyServerMessage({
    type: "agent_started",
    provider: local ? "ollama" : "anthropic",
    model: local ? "qwen2.5:7b" : "claude-sonnet-5",
    local,
  });

  options.plans.forEach((fixture, index) => {
    const callId = `call-${index}`;
    store.applyServerMessage({
      type: "tool_call",
      call_id: callId,
      tool: "simulate_forward",
      input: { cooling_stage: fixture.stage },
    });
    store.applyServerMessage({
      type: "tool_result",
      call_id: callId,
      tool: "simulate_forward",
      output: simulateForwardOutput(fixture),
    });
  });

  store.applyServerMessage({ type: "agent_final", text: options.final });
  store.applyServerMessage({ type: "agent_done", timestamp: 0 });
}
