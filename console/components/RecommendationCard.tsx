import { useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Ref } from "react";

import { disagreesWithTools, extractPlans, statedChoice } from "@/lib/agentPlans";
import type { PlanOption } from "@/lib/agentPlans";
import { parseSections } from "@/lib/agentNarrative";
import type { Section } from "@/lib/agentNarrative";
import { useConsoleStore } from "@/lib/store";
import type { ClientMessage, CoolingStage } from "@/lib/types";

import { RankedOptions } from "./RankedOptions";
import {
  AgentAnalysing,
  AgentNarrative,
  CollapsedSummary,
  RecommendationHeader,
} from "./RecommendationCardViews";
import type { AgentProvider } from "./RecommendationCardViews";

/**
 * The agent's recommendation, rendered where it can actually be read.
 *
 * docs/agent-design.md asks for the recommendation as a highlighted,
 * Forge-Red-accented block — it is the conclusion the whole demo builds to, so
 * it gets the centre of the view rather than the bottom of a side rail. The
 * accent is a single left rule, keeping Forge Red well inside the ~10-15% of
 * the view docs/brand.md allows.
 */

interface RecommendationState {
  final: string | null;
  running: boolean;
  provider: AgentProvider | null;
  toolCount: number;
  isConnected: boolean;
  activeStage: CoolingStage | undefined;
  sections: Section[];
  plans: PlanOption[];
  stated: CoolingStage | null;
  bodyId: string;
  minimized: boolean;
  setMinimized: (minimized: boolean) => void;
  best: PlanOption | undefined;
  disagrees: boolean;
  dismiss: () => void;
}

/**
 * All the store reads and derived values `RecommendationCard` needs, kept out
 * of the component so its own body stays about rendering, not data-gathering.
 */
function useRecommendationState(): RecommendationState {
  const final = useConsoleStore((s) => s.agentFinal);
  const running = useConsoleStore((s) => s.agentRunning);
  const provider = useConsoleStore((s) => s.agentProvider);
  const toolCalls = useConsoleStore((s) => s.agentToolCalls);
  const dismiss = useConsoleStore((s) => s.dismissRecommendation);
  const connection = useConsoleStore((s) => s.connection);
  const activeStage = useConsoleStore((s) => s.snapshot?.transformer.cooling_stage);
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

  return {
    final,
    running,
    provider,
    toolCount: toolCalls.length,
    isConnected: connection === "open",
    activeStage,
    sections,
    plans,
    stated,
    bodyId,
    minimized,
    setMinimized,
    best,
    disagrees,
    dismiss,
  };
}

export interface RecommendationCardProps {
  send: (message: ClientMessage) => void;
}

export function RecommendationCard({ send }: RecommendationCardProps) {
  const state = useRecommendationState();
  const collapsedRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus moves imperatively, inside this handler, rather than via an effect:
  // reading a ref during render is banned by this project's react-hooks/refs
  // rule, and flushSync guarantees the target branch has committed before the
  // .focus() call runs. Because this only ever runs from a click, an arriving
  // analysis (which re-expands via render-time state adjustment, not this
  // function) never moves focus on its own.
  const toggle = (next: boolean) => {
    flushSync(() => state.setMinimized(next));
    if (next) collapsedRef.current?.focus();
    else headingRef.current?.focus();
  };

  if (state.running) return <AgentAnalysing toolCount={state.toolCount} />;

  if (!state.final) return null;

  if (state.minimized) {
    return (
      <CollapsedSummary
        ref={collapsedRef}
        best={state.best}
        disagrees={state.disagrees}
        local={state.provider?.local ?? false}
        bodyId={state.bodyId}
        onExpand={() => toggle(false)}
      />
    );
  }

  return (
    <ExpandedRecommendation
      state={state}
      send={send}
      headingRef={headingRef}
      onMinimize={() => toggle(true)}
    />
  );
}

interface ExpandedRecommendationProps {
  state: RecommendationState;
  send: (message: ClientMessage) => void;
  headingRef: Ref<HTMLHeadingElement>;
  onMinimize: () => void;
}

/** The full card: header, local-model caveat, narrative, and ranked options. */
function ExpandedRecommendation({ state, send, headingRef, onMinimize }: ExpandedRecommendationProps) {
  return (
    <section className="pointer-events-auto flex max-h-full min-h-0 flex-col self-end rounded border border-border border-l-2 border-l-forge-red bg-surface-1/95 backdrop-blur-sm">
      <RecommendationHeader
        provider={state.provider}
        toolCount={state.toolCount}
        bodyId={state.bodyId}
        headingRef={headingRef}
        onMinimize={onMinimize}
        onDismiss={state.dismiss}
      />

      {state.provider?.local ? (
        <p className="mx-4 mt-3 rounded border border-status-warning/40 px-2 py-1 text-[12px] leading-snug text-status-warning">
          Local model — check each figure against the tool output in the agent panel.
        </p>
      ) : null}

      <div id={state.bodyId} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {/* Two distinct kinds of content, labelled as such. Above: the model's
            narrative, which can drift. Below: the twin's own arithmetic, read
            from tool results. Where they disagree, the table is right — so the
            reader is told which is which rather than left to assume. */}
        <AgentNarrative sections={state.sections} />

        <div className="my-3 border-t border-border" />

        <RankedOptions
          plans={state.plans}
          stated={state.stated}
          activeStage={state.activeStage}
          canApply={state.isConnected}
          send={send}
        />
      </div>
    </section>
  );
}
