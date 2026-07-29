import { useMemo } from "react";

import { extractPlans, statedChoice } from "@/lib/agentPlans";
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
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss recommendation"
          className="transition-brand rounded border border-border px-2 py-0.5 text-[12px] text-text-tertiary hover:text-text-primary"
        >
          Close
        </button>
      </header>

      {provider?.local ? (
        <p className="mx-4 mt-3 rounded border border-status-warning/40 px-2 py-1 text-[12px] leading-snug text-status-warning">
          Local model — check each figure against the tool output in the agent panel.
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
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
