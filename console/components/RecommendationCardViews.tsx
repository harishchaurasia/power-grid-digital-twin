/**
 * Presentational pieces of `RecommendationCard`, split out so that component's
 * own body stays about the running/minimized/expanded fork rather than the
 * markup for each state.
 */

import { formatUsd } from "@/lib/agentPlans";
import type { PlanOption } from "@/lib/agentPlans";
import { PROSE_REPLACED_BY_TABLE } from "@/lib/agentNarrative";
import type { Section } from "@/lib/agentNarrative";

import { Caption } from "./Panel";

/** Matches the shape `store.agentProvider` holds — not exported from `lib/store.ts`. */
export type AgentProvider = { provider: string; model: string; local: boolean };

interface AgentAnalysingProps {
  toolCount: number;
}

/** Shown while the agent loop is running and there is no final answer yet. */
export function AgentAnalysing({ toolCount }: AgentAnalysingProps) {
  return (
    <div className="pointer-events-auto self-end rounded border border-border bg-surface-1/95 px-4 py-3 backdrop-blur-sm">
      <Caption>Agent analysing</Caption>
      <p className="mt-1 font-mono text-[12px] text-text-secondary">
        {toolCount} tool {toolCount === 1 ? "call" : "calls"} so far…
      </p>
    </div>
  );
}

interface RecommendationHeaderProps {
  provider: AgentProvider | null;
  toolCount: number;
  bodyId: string;
  onMinimize: () => void;
  onDismiss: () => void;
}

/** Title, provider/tool-count line, and the Minimize/Close actions. */
export function RecommendationHeader({
  provider,
  toolCount,
  bodyId,
  onMinimize,
  onDismiss,
}: RecommendationHeaderProps) {
  return (
    <header className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-2">
      <div className="flex items-baseline gap-3">
        <h2 className="font-display text-[20px] tracking-[0.03em] text-text-primary">
          Recommendation
        </h2>
        {provider ? (
          <span className="font-mono text-[11px] text-text-tertiary">
            {provider.provider}:{provider.model} · {toolCount} tool calls
          </span>
        ) : null}
      </div>
      <div className="flex items-baseline gap-2">
        <button
          type="button"
          onClick={onMinimize}
          aria-label="Minimize recommendation"
          aria-expanded={true}
          aria-controls={bodyId}
          className="transition-brand rounded border border-border px-2 py-0.5 text-[12px] text-text-tertiary hover:text-text-primary"
        >
          Minimize
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss recommendation"
          className="transition-brand rounded border border-border px-2 py-0.5 text-[12px] text-text-tertiary hover:text-text-primary"
        >
          Close
        </button>
      </div>
    </header>
  );
}

interface AgentNarrativeProps {
  sections: Section[];
}

/**
 * The model's prose, minus the OPTIONS/RECOMMENDATION sections — those are
 * replaced by the ranked-options table rendered alongside this, from tool
 * output rather than wording.
 */
export function AgentNarrative({ sections }: AgentNarrativeProps) {
  return (
    <>
      <p className="mb-2 text-[11px] uppercase tracking-[0.05em] text-text-tertiary">
        Agent narrative
      </p>
      {sections
        .filter((section) => !PROSE_REPLACED_BY_TABLE.has(section.label))
        .map((section, i) => (
          <div key={`${section.label}-${i}`} className="mb-3 last:mb-0">
            {section.label ? <Caption>{section.label}</Caption> : null}
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-text-secondary">
              {section.body}
            </p>
          </div>
        ))}
    </>
  );
}

interface CollapsedSummaryProps {
  best: PlanOption | undefined;
  disagrees: boolean;
  local: boolean;
  bodyId: string;
  onExpand: () => void;
}

/**
 * The card's one-line form. Its figure comes from `best` -- a `simulate_forward`
 * result -- never from the agent's prose: with the ranked table hidden there is
 * nothing here to check a claim against, so an untraceable number would be worse
 * than no number.
 */
export function CollapsedSummary({ best, disagrees, local, bodyId, onExpand }: CollapsedSummaryProps) {
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-expanded={false}
      aria-controls={bodyId}
      className="transition-brand pointer-events-auto flex w-full items-baseline justify-between gap-3 self-end rounded border border-border border-l-2 border-l-forge-red bg-surface-1/95 px-4 py-2 text-left backdrop-blur-sm hover:border-text-tertiary"
    >
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {/* The action is announced but not shown: an aria-label here would
            override the content and hide the conclusion below from screen
            readers, which is the one thing the collapsed row exists to keep. */}
        <span className="sr-only">Expand</span>{" "}
        <span className="font-display text-[20px] tracking-[0.03em] text-text-primary">
          Recommendation
        </span>{" "}
        {best ? (
          <span className="font-mono text-[14px] font-medium tabular-nums text-text-primary">
            {best.coolingStage} · {formatUsd(best.netValueUsd)}
          </span>
        ) : (
          <span className="text-[13px] text-text-secondary">ready</span>
        )}
      </span>

      <span className="flex items-baseline gap-3">
        {local ? <span className="text-[12px] text-status-warning">Local model</span> : null}
        {disagrees ? (
          <span className="text-[12px] text-status-warning">prose disagrees</span>
        ) : null}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 stroke-text-tertiary"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 15l6-6 6 6" />
        </svg>
      </span>
    </button>
  );
}
