import { useMemo, useState } from "react";

import { disagreesWithTools, extractPlans, formatUsd, statedChoice } from "@/lib/agentPlans";
import type { PlanOption } from "@/lib/agentPlans";
import { useConsoleStore } from "@/lib/store";
import type { ClientMessage } from "@/lib/types";

import { Caption } from "./Panel";
import { RankedOptions } from "./RankedOptions";

/**
 * The agent's recommendation, rendered where it can actually be read.
 *
 * docs/agent-design.md asks for the recommendation as a highlighted,
 * Forge-Red-accented block — it is the conclusion the whole demo builds to, so
 * it gets the centre of the view rather than the bottom of a side rail. The
 * accent is a single left rule, keeping Forge Red well inside the ~10-15% of
 * the view docs/brand.md allows.
 */

/** Section headings the system prompt asks the agent to produce. */
const SECTIONS = [
  "OBSERVATION",
  "MECHANISM",
  "PROJECTION",
  "OPTIONS",
  "RECOMMENDATION",
] as const;

interface Section {
  label: string;
  body: string;
}

/** Rendered as a table instead of prose, from tool output rather than wording. */
const PROSE_REPLACED_BY_TABLE = new Set(["OPTIONS", "RECOMMENDATION"]);

/**
 * Split the answer on its section headings.
 *
 * Falls back to one unlabelled block if the model did not follow the format —
 * a smaller model often will not, and showing its raw output is better than
 * showing nothing or pretending it was structured.
 */
function parseSections(text: string): Section[] {
  const pattern = new RegExp(`^\\s*(${SECTIONS.join("|")})\\s*[—:-]*\\s*`, "gim");
  const matches = [...text.matchAll(pattern)];
  if (matches.length === 0) return [{ label: "", body: text.trim() }];

  return matches.map((match, i) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1]?.index : undefined;
    return {
      label: (match[1] ?? "").toUpperCase(),
      body: text.slice(start, end).trim(),
    };
  });
}

export interface RecommendationCardProps {
  send: (message: ClientMessage) => void;
}

export function RecommendationCard({ send }: RecommendationCardProps) {
  const final = useConsoleStore((s) => s.agentFinal);
  const running = useConsoleStore((s) => s.agentRunning);
  const provider = useConsoleStore((s) => s.agentProvider);
  const toolCalls = useConsoleStore((s) => s.agentToolCalls);
  const dismiss = useConsoleStore((s) => s.dismissRecommendation);
  const connection = useConsoleStore((s) => s.connection);
  const activeStage = useConsoleStore((s) => s.snapshot?.transformer.cooling_stage);
  const toolCount = toolCalls.length;

  const sections = useMemo(() => (final ? parseSections(final) : []), [final]);
  const plans = useMemo(() => extractPlans(toolCalls), [toolCalls]);
  const stated = useMemo(() => statedChoice(final), [final]);

  const bodyId = "recommendation-body";
  const [minimized, setMinimized] = useState(false);
  const best = plans[0];
  const disagrees = disagreesWithTools(stated, plans);

  // A new analysis must never arrive behind a collapsed card. Adjusted during
  // render (React's documented pattern for resetting state on a prop change,
  // using state rather than a ref so this project's stricter react-hooks/refs
  // rule -- which forbids reading a ref during render -- is satisfied) rather
  // than in an effect, so there is no extra render pass between the fresh
  // answer landing and the card re-expanding. Keyed on the text itself: two
  // character-identical answers in a row would not re-expand, which is
  // vanishingly unlikely once live telemetry is quoted in the prose.
  const [seenFinal, setSeenFinal] = useState(final);
  if (seenFinal !== final) {
    setSeenFinal(final);
    if (minimized) setMinimized(false);
  }

  if (running) {
    return (
      <div className="pointer-events-auto self-end rounded border border-border bg-surface-1/95 px-4 py-3 backdrop-blur-sm">
        <Caption>Agent analysing</Caption>
        <p className="mt-1 font-mono text-[12px] text-text-secondary">
          {toolCount} tool {toolCount === 1 ? "call" : "calls"} so far…
        </p>
      </div>
    );
  }

  if (!final) return null;

  if (minimized) {
    return (
      <CollapsedSummary
        best={best}
        disagrees={disagrees}
        local={provider?.local ?? false}
        bodyId={bodyId}
        onExpand={() => setMinimized(false)}
      />
    );
  }

  return (
    <section className="pointer-events-auto flex max-h-full min-h-0 flex-col self-end rounded border border-border border-l-2 border-l-forge-red bg-surface-1/95 backdrop-blur-sm">
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
            onClick={() => setMinimized(true)}
            aria-label="Minimize recommendation"
            aria-expanded={true}
            aria-controls={bodyId}
            className="transition-brand rounded border border-border px-2 py-0.5 text-[12px] text-text-tertiary hover:text-text-primary"
          >
            Minimize
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss recommendation"
            className="transition-brand rounded border border-border px-2 py-0.5 text-[12px] text-text-tertiary hover:text-text-primary"
          >
            Close
          </button>
        </div>
      </header>

      {provider?.local ? (
        <p className="mx-4 mt-3 rounded border border-status-warning/40 px-2 py-1 text-[12px] leading-snug text-status-warning">
          Local model — check each figure against the tool output in the agent panel.
        </p>
      ) : null}

      <div id={bodyId} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {/* Two distinct kinds of content, labelled as such. Above: the model's
            narrative, which can drift. Below: the twin's own arithmetic, read
            from tool results. Where they disagree, the table is right — so the
            reader is told which is which rather than left to assume. */}
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

        <div className="my-3 border-t border-border" />

        <RankedOptions
          plans={plans}
          stated={stated}
          activeStage={activeStage}
          canApply={connection === "open"}
          send={send}
        />
      </div>
    </section>
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
function CollapsedSummary({ best, disagrees, local, bodyId, onExpand }: CollapsedSummaryProps) {
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
        {local ? (
          <span className="text-[12px] text-status-warning">Local model</span>
        ) : null}
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
