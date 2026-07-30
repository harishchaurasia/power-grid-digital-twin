import { beforeEach, describe, expect, it } from "vitest";

import { useConsoleStore } from "@/lib/store";
import { projection, snapshot } from "@/test/fixtures";

const store = () => useConsoleStore.getState();

function pushTelemetry(count: number, startHours = 0.02): void {
  for (let i = 0; i < count; i += 1) {
    store().applyServerMessage({
      type: "telemetry",
      payload: snapshot({ simTimeHours: startHours + i * 0.02, hotSpotC: 96.5 + i }),
      timestamp: 0,
    });
  }
}

describe("telemetry", () => {
  it("always exposes the newest snapshot, even on thinned ticks", () => {
    pushTelemetry(3);
    expect(store().snapshot?.transformer.hot_spot_c).toBe(98.5);
    expect(store().ticksReceived).toBe(3);
  });

  it("thins history for the charts while keeping every tick counted", () => {
    // 10 Hz telemetry would swamp the charts, so only every other tick is kept.
    pushTelemetry(10);
    expect(store().ticksReceived).toBe(10);
    expect(store().history).toHaveLength(5);
  });

  it("caps history so a long session cannot grow without bound", () => {
    pushTelemetry(700);
    expect(store().history).toHaveLength(300);
    // Capping must drop the oldest, not the newest -- the chart's right edge is
    // the live value.
    const last = store().history.at(-1);
    expect(last?.hotSpotC).toBe(96.5 + 699);
  });
});

describe("state changes", () => {
  it("logs newest first and bounds the log", () => {
    pushTelemetry(1);
    for (let i = 0; i < 12; i += 1) {
      store().applyServerMessage({
        type: "state_change",
        asset: "transformer",
        from: "nominal",
        to: i % 2 === 0 ? "warning" : "critical",
        timestamp: i,
      });
    }
    const log = store().stateChanges;
    expect(log).toHaveLength(8);
    expect(log[0]?.to).toBe("critical");
  });

  it("stamps each entry with the sim time it happened at", () => {
    pushTelemetry(1, 3.5);
    store().applyServerMessage({
      type: "state_change",
      asset: "transformer",
      from: "nominal",
      to: "warning",
      timestamp: 1,
    });
    expect(store().stateChanges[0]?.simTimeHours).toBe(3.5);
  });
});

describe("clearTimeline", () => {
  beforeEach(() => {
    pushTelemetry(6);
    store().setProjection(projection());
    store().applyServerMessage({ type: "agent_final", text: "recommendation" });
  });

  it("drops derived series so a replay does not read as one continuous run", () => {
    store().clearTimeline();
    const state = store();
    expect(state.history).toHaveLength(0);
    expect(state.stateChanges).toHaveLength(0);
    expect(state.ticksReceived).toBe(0);
    expect(state.projection).toBeNull();
    expect(state.agentFinal).toBeNull();
  });

  it("keeps the latest snapshot so panels do not blank out", () => {
    const before = store().snapshot;
    store().clearTimeline();
    expect(store().snapshot).toBe(before);
  });
});

describe("agent stream", () => {
  it("attaches a tool result to the call it belongs to", () => {
    store().applyServerMessage({
      type: "tool_call",
      call_id: "c1",
      tool: "get_node_state",
      input: {},
    });
    store().applyServerMessage({
      type: "tool_call",
      call_id: "c2",
      tool: "compute_limits",
      input: { horizon_hours: 6 },
    });
    store().applyServerMessage({
      type: "tool_result",
      call_id: "c2",
      tool: "compute_limits",
      output: { time_to_120c: 2.1 },
    });

    const calls = store().agentToolCalls;
    expect(calls).toHaveLength(2);
    expect(calls[0]?.output).toBeUndefined();
    expect(calls[1]?.output).toStrictEqual({ time_to_120c: 2.1 });
  });

  it("clears the previous run when a new one starts", () => {
    store().applyServerMessage({ type: "agent_thinking", text: "stale" });
    store().applyServerMessage({ type: "agent_final", text: "stale recommendation" });
    store().applyServerMessage({
      type: "agent_started",
      provider: "ollama",
      model: "qwen2.5:7b",
      local: true,
    });

    const state = store();
    expect(state.agentRunning).toBe(true);
    expect(state.agentThinking).toHaveLength(0);
    expect(state.agentFinal).toBeNull();
  });

  it("flags a local provider so the console can warn about it", () => {
    // RESEARCH-LOG.md: a local 7B fabricated numbers, so the UI must be able to
    // say which model produced the prose.
    store().applyServerMessage({
      type: "agent_started",
      provider: "ollama",
      model: "qwen2.5:7b",
      local: true,
    });
    expect(store().agentProvider?.local).toBe(true);
  });

  it("stops the run and surfaces the message on error", () => {
    store().applyServerMessage({
      type: "agent_started",
      provider: "anthropic",
      model: "claude-sonnet-5",
      local: false,
    });
    store().applyServerMessage({ type: "error", message: "provider unreachable" });
    expect(store().agentRunning).toBe(false);
    expect(store().lastError).toBe("provider unreachable");
  });
});
