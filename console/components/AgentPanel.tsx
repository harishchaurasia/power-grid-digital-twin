import { useConsoleStore } from "@/lib/store";
import type { ClientMessage } from "@/lib/types";

import { Caption, Panel } from "./Panel";

/**
 * Agent panel.
 *
 * Renders the tool traffic, not just the conclusion. That is the differentiator
 * (RESEARCH-LOG Agent C): a dashboard vendor can assert "our AI recommends
 * OFAF"; showing which tools were called and what they returned is what makes
 * the recommendation auditable.
 *
 * When the agent is served by a local model the panel says so, because a small
 * model is materially more likely to state a figure it did not read from a tool
 * — that caveat belongs next to the output, not in a README.
 */
export interface AgentPanelProps {
  send: (message: ClientMessage) => void;
}

export function AgentPanel({ send }: AgentPanelProps) {
  const connection = useConsoleStore((s) => s.connection);
  const running = useConsoleStore((s) => s.agentRunning);
  const provider = useConsoleStore((s) => s.agentProvider);
  const toolCalls = useConsoleStore((s) => s.agentToolCalls);
  const final = useConsoleStore((s) => s.agentFinal);
  const online = connection === "open";

  return (
    <Panel
      title="Agent"
      {...(provider ? { standard: `${provider.provider}:${provider.model}` } : {})}
      actions={
        <button
          type="button"
          onClick={() => send({ type: "agent_invoke" })}
          disabled={!online || running}
          className="transition-brand rounded border border-forge-red bg-forge-red px-3 py-1 text-[14px] text-void-black hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? "Analysing…" : "Run analysis"}
        </button>
      }
    >
      {provider?.local ? (
        <p className="mb-2 rounded border border-status-warning/40 px-2 py-1 text-[12px] leading-snug text-status-warning">
          Local model. Verify every figure against the tool output below — small
          models sometimes state numbers they did not read.
        </p>
      ) : null}

      {toolCalls.length > 0 ? (
        <div className="mb-3">
          <Caption>Tool calls</Caption>
          <ul className="mt-1.5 flex flex-col gap-1">
            {toolCalls.map((call) => (
              <li key={call.call_id} className="font-mono text-[11px] leading-snug">
                <span className="text-text-primary">{call.tool}</span>
                <span className="text-text-tertiary">
                  ({Object.entries(call.input)
                    .map(([k, v]) => `${k}=${String(v)}`)
                    .join(", ")})
                </span>
                <span className={call.output ? "ml-2 text-status-nominal" : "ml-2 text-text-tertiary"}>
                  {call.output ? "✓" : "…"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* The recommendation itself renders in the centre column via
          <RecommendationCard/>, where there is room to read it. This panel keeps
          the control and the audit trail. */}
      {final ? (
        <p className="text-[12px] leading-snug text-text-tertiary">
          Recommendation shown in the centre. Each figure in it should appear in a
          tool result above.
        </p>
      ) : null}

      {!running && toolCalls.length === 0 && !final ? (
        <p className="py-4 text-[14px] leading-snug text-text-tertiary">
          Run an analysis and the agent reads live twin state through its tools, then
          ranks the interventions by cost. Every figure it states is shown with the
          tool call that produced it.
        </p>
      ) : null}
    </Panel>
  );
}
