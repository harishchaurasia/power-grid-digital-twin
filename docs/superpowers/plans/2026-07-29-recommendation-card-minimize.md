# Recommendation Card Minimize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an operator collapse the agent recommendation card to a one-line summary that keeps its conclusion, instead of having to `Close` it and discard the analysis.

**Architecture:** Local `useState` in `RecommendationCard` drives an expanded/collapsed fork. The collapsed row's headline is derived from `simulate_forward` tool results via the existing `extractPlans`, never from the agent's prose. The "agent disagrees with its own tools" predicate is lifted out of `RankedOptions` into `lib/agentPlans.ts` so both call sites share one definition.

**Tech Stack:** React 19, TypeScript strict, Tailwind v4 (inline classes), Zustand, Vitest + @testing-library/react (jsdom), Playwright (installed Chrome).

## Global Constraints

- TypeScript strict. `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on — indexing an array yields `T | undefined`.
- No `any` without a justifying comment (`@typescript-eslint/no-explicit-any` is an error).
- Functional components only; named exports; props interfaces named `[Component]Props`.
- Tailwind classes inline. No `@apply`. Brand tokens only (`docs/brand.md`).
- Forge Red is accent only, ~10–15% of a view max. Amber (`--status-warning`) for caution, never red.
- Modules under 300 lines, functions under 50 lines.
- **No new dependencies.** Use `fireEvent` from `@testing-library/react`; `@testing-library/user-event` is not installed and must not be added.
- Comments explain non-obvious *why* only. Names carry the *what*.
- Verification commands: `npm run test` (vitest), `npm run test:e2e` (Playwright), `npm run typecheck`, `npm run lint`, all run from `console/`.
- `.transition-brand` already exists and is already wrapped in `@media (prefers-reduced-motion: no-preference)` (`app/globals.css:78`). Use that class; do **not** add motion CSS.

## File Structure

| File | Responsibility |
|---|---|
| `console/lib/agentPlans.ts` (modify) | Add `disagreesWithTools` — the single definition of "prose contradicts tool output". |
| `console/lib/agentPlans.test.ts` (create) | Tests for that predicate. |
| `console/components/RankedOptions.tsx` (modify, line 29) | Use the shared predicate instead of an inline expression. No behaviour change. |
| `console/test/agentFixtures.ts` (create) | Seeds the store through the same `ServerMessage`s the agent WebSocket sends, so tests exercise the real path. |
| `console/test/setup.ts` (modify) | Add Testing Library `cleanup` alongside the existing store reset. |
| `console/components/RecommendationCard.tsx` (modify) | Expanded/collapsed fork, collapsed summary row, a11y wiring. |
| `console/components/RecommendationCard.test.tsx` (create) | Component behaviour, including the fabrication guard. |
| `console/app/main.tsx` (modify) | DEV-only store handle so Playwright can seed a recommendation without a live model. |
| `console/e2e/recommendation.spec.ts` (create) | Proves collapsing hands pointer events back to the twin. |

**Deviation from the spec, deliberate:** the spec put the e2e test in `e2e/fallback.spec.ts`. Recommendation behaviour is not a fallback concern, so it gets its own spec file.

**Deviation from the spec, forced:** the spec's test list included "Close still clears the recommendation *while collapsed*". The collapsed row is itself a single `<button>`, and nesting a Close button inside it would be invalid HTML with broken keyboard semantics. So the collapsed row carries the expand affordance only, and `Close` remains an expanded-state action. The test asserts Close from the expanded state.

---

### Task 1: Share one definition of "prose disagrees with tools"

**Files:**
- Modify: `console/lib/agentPlans.ts` (append after `statedChoice`, before `formatUsd`)
- Modify: `console/components/RankedOptions.tsx:29`
- Test: `console/lib/agentPlans.test.ts` (create)

**Interfaces:**
- Consumes: `PlanOption`, `CoolingStage` (both already exported from `lib/agentPlans.ts` / `lib/types.ts`).
- Produces: `disagreesWithTools(stated: CoolingStage | null, plans: PlanOption[]): boolean` — used by Task 2's collapsed row and by `RankedOptions`.

- [ ] **Step 1: Write the failing test**

Create `console/lib/agentPlans.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd console && npx vitest run lib/agentPlans.test.ts`
Expected: FAIL — `disagreesWithTools` is not exported from `@/lib/agentPlans`.

- [ ] **Step 3: Implement the predicate**

In `console/lib/agentPlans.ts`, insert after the `statedChoice` function and before `formatUsd`:

```ts
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
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd console && npx vitest run lib/agentPlans.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Point `RankedOptions` at the shared predicate**

In `console/components/RankedOptions.tsx`, change the import on line 1 to include the predicate:

```tsx
import {
  disagreesWithTools,
  formatUsd,
  interventionFor,
  type PlanOption,
} from "@/lib/agentPlans";
```

Then replace line 29:

```tsx
  const disagrees = stated !== null && best !== undefined && stated !== best.coolingStage;
```

with:

```tsx
  const disagrees = disagreesWithTools(stated, plans);
```

- [ ] **Step 6: Verify nothing regressed**

Run: `cd console && npm run test && npm run typecheck && npm run lint`
Expected: all pass. `RankedOptions` behaviour is unchanged — the predicate is the same boolean expressed once.

- [ ] **Step 7: Commit**

```bash
cd console
git add lib/agentPlans.ts lib/agentPlans.test.ts components/RankedOptions.tsx
git commit -m "Extract disagreesWithTools so both views share one verdict

The predicate lived inside RankedOptions where only that component could
see it. The collapsed recommendation summary needs the same judgement, and
two copies could drift to different answers -- which is the class of bug
this card exists to prevent."
```

---

### Task 2: Collapse the card to a summary row that keeps its conclusion

**Files:**
- Create: `console/test/agentFixtures.ts`
- Modify: `console/test/setup.ts`
- Modify: `console/components/RecommendationCard.tsx`
- Test: `console/components/RecommendationCard.test.tsx` (create)

**Interfaces:**
- Consumes: `disagreesWithTools` from Task 1; `extractPlans`, `statedChoice`, `formatUsd`, `PlanOption` from `lib/agentPlans.ts`.
- Produces: `seedRecommendation(options: { plans: PlanFixture[]; final: string; local?: boolean }): void` and `PlanFixture = { stage: CoolingStage; netValueUsd: number }` from `test/agentFixtures.ts`, reused by Task 3.

- [ ] **Step 1: Add Testing Library cleanup to the existing setup**

In `console/test/setup.ts`, replace the whole file with:

```ts
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import { useConsoleStore } from "@/lib/store";

/**
 * The console store is a module-level singleton, so state leaks between tests
 * unless it is reset. Capture the initial state once, before any test mutates
 * it, and restore it after each.
 */
const INITIAL_STATE = useConsoleStore.getState();

afterEach(() => {
  cleanup();
  useConsoleStore.setState(INITIAL_STATE, true);
});
```

- [ ] **Step 2: Add the store-seeding fixture**

Create `console/test/agentFixtures.ts`:

```ts
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
```

- [ ] **Step 3: Write the failing component tests**

Create `console/components/RecommendationCard.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RecommendationCard } from "@/components/RecommendationCard";
import { seedRecommendation } from "@/test/agentFixtures";

const OFAF_BEST = [
  { stage: "OFAF" as const, netValueUsd: 508_680 },
  { stage: "ONAN" as const, netValueUsd: 120_000 },
];

const FINAL_SAYS_OFAF = "OBSERVATION\nHot-spot 134.4 °C.\n\nRECOMMENDATION\nEngage OFAF.";
const FINAL_SAYS_ONAN = "OBSERVATION\nHot-spot 134.4 °C.\n\nRECOMMENDATION\nHold at ONAN.";

const TABLE_HEADING = "Ranked options — by net value, computed by the twin";

function renderCard() {
  return render(<RecommendationCard send={vi.fn()} />);
}

function minimize() {
  fireEvent.click(screen.getByRole("button", { name: "Minimize recommendation" }));
}

describe("expanded by default", () => {
  it("shows the full analysis when it arrives", () => {
    seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_OFAF });
    renderCard();

    // Collapsing by default would hide the conclusion the demo builds to.
    expect(screen.getByText(TABLE_HEADING)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Minimize recommendation" })).toBeInTheDocument();
  });
});

describe("collapsed", () => {
  it("hides the body and offers a way back", () => {
    seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_OFAF });
    renderCard();
    minimize();

    expect(screen.queryByText(TABLE_HEADING)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Expand recommendation/ })).toBeInTheDocument();
  });

  it("keeps the conclusion: recommended stage and its net value", () => {
    seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_OFAF });
    renderCard();
    minimize();

    const bar = screen.getByRole("button", { name: /Expand recommendation/ });
    expect(bar).toHaveTextContent("OFAF");
    expect(bar).toHaveTextContent("$509k");
  });

  it("takes the headline from tool output even when the prose names another stage", () => {
    // The fabrication guard. Collapsed there is no table beside the prose, so a
    // prose-derived figure would be an unchecked claim in the most glanceable
    // element in the UI.
    seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_ONAN });
    renderCard();
    minimize();

    const bar = screen.getByRole("button", { name: /Expand recommendation/ });
    expect(bar).toHaveTextContent("OFAF");
    expect(bar).not.toHaveTextContent("ONAN");
    expect(bar).toHaveTextContent(/disagrees/i);
  });

  it("shows no figure at all when no plan could be extracted", () => {
    seedRecommendation({ plans: [], final: FINAL_SAYS_OFAF });
    renderCard();
    minimize();

    const bar = screen.getByRole("button", { name: /Expand recommendation/ });
    expect(bar).toHaveTextContent(/ready/i);
    expect(bar).not.toHaveTextContent("$");
  });

  it("keeps the local-model caveat visible", () => {
    seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_OFAF, local: true });
    renderCard();
    minimize();

    expect(screen.getByRole("button", { name: /Expand recommendation/ })).toHaveTextContent(
      /local model/i,
    );
  });

  it("expands again and restores the table", () => {
    seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_OFAF });
    renderCard();
    minimize();
    fireEvent.click(screen.getByRole("button", { name: /Expand recommendation/ }));

    expect(screen.getByText(TABLE_HEADING)).toBeInTheDocument();
  });
});

describe("a new analysis", () => {
  it("re-expands a collapsed card", () => {
    seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_OFAF });
    renderCard();
    minimize();

    act(() => {
      seedRecommendation({
        plans: [{ stage: "ONAF", netValueUsd: 300_000 }],
        final: "OBSERVATION\nSecond run.\n\nRECOMMENDATION\nEngage ONAF.",
      });
    });

    // A collapsed card must never suppress fresh output.
    expect(screen.getByText(TABLE_HEADING)).toBeInTheDocument();
  });
});

describe("close", () => {
  it("still clears the recommendation", () => {
    seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_OFAF });
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss recommendation" }));

    expect(screen.queryByText(TABLE_HEADING)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Expand recommendation/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `cd console && npx vitest run components/RecommendationCard.test.tsx`
Expected: FAIL — no button named "Minimize recommendation" exists yet.

- [ ] **Step 5: Add the collapsed summary row**

In `console/components/RecommendationCard.tsx`, add to the imports at the top:

```tsx
import { useEffect, useMemo, useRef, useState } from "react";

import { disagreesWithTools, extractPlans, formatUsd, statedChoice } from "@/lib/agentPlans";
import type { PlanOption } from "@/lib/agentPlans";
```

(Replace the existing `useMemo`-only React import and the existing `extractPlans, statedChoice` import line.)

Append this component at the end of the file:

```tsx
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
        <span className="font-display text-[20px] tracking-[0.03em] text-text-primary">
          Expand recommendation
        </span>
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
```

- [ ] **Step 6: Wire the fork into `RecommendationCard`**

Inside `RecommendationCard`, after the existing `const stated = useMemo(...)` line, add:

```tsx
  const bodyId = "recommendation-body";
  const [minimized, setMinimized] = useState(false);
  const best = plans[0];
  const disagrees = disagreesWithTools(stated, plans);

  // A new analysis must never arrive behind a collapsed card. Keyed on the text
  // itself: two character-identical answers in a row would not re-expand, which
  // is vanishingly unlikely once live telemetry is quoted in the prose.
  useEffect(() => {
    setMinimized(false);
  }, [final]);
```

Then, immediately before the existing `return (` of the expanded card, add:

```tsx
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
```

In the expanded header, add the minimize button immediately before the existing Close button:

```tsx
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
```

(This replaces the existing single Close `<button>` element, wrapping both in the new `div`.)

Finally, give the scrollable body the id the controls point at — change

```tsx
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
```

to

```tsx
      <div id={bodyId} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
```

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `cd console && npx vitest run components/RecommendationCard.test.tsx`
Expected: PASS — 9 tests.

- [ ] **Step 8: Check the module limits and full suite**

Run: `cd console && wc -l components/RecommendationCard.tsx && npm run test && npm run typecheck && npm run lint`
Expected: file under 300 lines; all suites pass; no type or lint errors.

- [ ] **Step 9: Commit**

```bash
cd console
git add test/setup.ts test/agentFixtures.ts components/RecommendationCard.tsx components/RecommendationCard.test.tsx
git commit -m "Minimize the recommendation card instead of discarding it

Close was the only way to clear the card, and it throws the analysis away,
so seeing the twin meant losing the reasoning and re-running the agent.
Minimize collapses to a one-line row that keeps the conclusion.

The collapsed headline comes from simulate_forward tool output, never from
parsing the prose: with the ranked table hidden there is nothing beside it
to check a claim against, and RESEARCH-LOG.md records the agent flipping a
net-value sign its own tool had returned correctly."
```

---

### Task 3: Make it usable without a mouse

**Files:**
- Modify: `console/components/RecommendationCard.tsx`
- Test: `console/components/RecommendationCard.test.tsx` (append)

**Interfaces:**
- Consumes: `seedRecommendation` from Task 2.
- Produces: nothing new. Behaviour only.

- [ ] **Step 1: Write the failing a11y tests**

Append to `console/components/RecommendationCard.test.tsx`:

```tsx
describe("keyboard and assistive technology", () => {
  it("links each control to the region it controls", () => {
    seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_OFAF });
    renderCard();

    const minimizeButton = screen.getByRole("button", { name: "Minimize recommendation" });
    expect(minimizeButton).toHaveAttribute("aria-expanded", "true");
    const bodyId = minimizeButton.getAttribute("aria-controls");
    expect(bodyId).toBeTruthy();
    expect(document.getElementById(bodyId ?? "")).toBeInTheDocument();

    minimize();
    const bar = screen.getByRole("button", { name: /Expand recommendation/ });
    expect(bar).toHaveAttribute("aria-expanded", "false");
    expect(bar).toHaveAttribute("aria-controls", bodyId);
  });

  it("moves focus to the collapsed bar so the keyboard does not lose its place", () => {
    seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_OFAF });
    renderCard();
    minimize();

    expect(screen.getByRole("button", { name: /Expand recommendation/ })).toHaveFocus();
  });

  it("moves focus into the card on expand", () => {
    seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_OFAF });
    renderCard();
    minimize();
    fireEvent.click(screen.getByRole("button", { name: /Expand recommendation/ }));

    expect(screen.getByRole("heading", { name: "Recommendation" })).toHaveFocus();
  });

  it("does not steal focus when a card first appears", () => {
    // Focus belongs to whatever the operator was doing; an arriving panel must
    // not grab it.
    seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_OFAF });
    renderCard();

    expect(document.body).toHaveFocus();
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `cd console && npx vitest run components/RecommendationCard.test.tsx`
Expected: FAIL — focus assertions fail; nothing manages focus yet.

- [ ] **Step 3: Add focus management**

In `RecommendationCard`, replace the state block added in Task 2 Step 6 with:

```tsx
  const bodyId = "recommendation-body";
  const [minimized, setMinimized] = useState(false);
  const best = plans[0];
  const disagrees = disagreesWithTools(stated, plans);

  // Focus only follows a toggle the operator performed. Without this flag the
  // effect below would also fire on first render and steal focus from whatever
  // they were doing when the analysis landed.
  const toggledRef = useRef(false);
  const collapsedRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // A new analysis must never arrive behind a collapsed card. Keyed on the text
  // itself: two character-identical answers in a row would not re-expand, which
  // is vanishingly unlikely once live telemetry is quoted in the prose.
  useEffect(() => {
    setMinimized(false);
    toggledRef.current = false;
  }, [final]);

  useEffect(() => {
    if (!toggledRef.current) return;
    if (minimized) collapsedRef.current?.focus();
    else headingRef.current?.focus();
  }, [minimized]);

  const toggle = (next: boolean) => {
    toggledRef.current = true;
    setMinimized(next);
  };
```

Change the collapsed branch to pass the ref and use `toggle`:

```tsx
  if (minimized) {
    return (
      <CollapsedSummary
        ref={collapsedRef}
        best={best}
        disagrees={disagrees}
        local={provider?.local ?? false}
        bodyId={bodyId}
        onExpand={() => toggle(false)}
      />
    );
  }
```

Change the minimize button's handler to `onClick={() => toggle(true)}`.

Make the expanded heading a focus target — replace the `<h2>` with:

```tsx
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-[20px] tracking-[0.03em] text-text-primary outline-none"
          >
            Recommendation
          </h2>
```

Accept the forwarded ref in `CollapsedSummary` — React 19 passes `ref` as a normal prop, so add it to the props interface and spread it onto the button:

```tsx
interface CollapsedSummaryProps {
  ref: React.Ref<HTMLButtonElement>;
  best: PlanOption | undefined;
  disagrees: boolean;
  local: boolean;
  bodyId: string;
  onExpand: () => void;
}
```

and in the component signature destructure `ref` and put `ref={ref}` on the `<button>`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd console && npx vitest run components/RecommendationCard.test.tsx`
Expected: PASS — 13 tests.

- [ ] **Step 5: Full verification**

Run: `cd console && npm run test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd console
git add components/RecommendationCard.tsx components/RecommendationCard.test.tsx
git commit -m "Manage focus and ARIA state across the card's collapse

aria-expanded/aria-controls on both controls, and focus follows the toggle
so a keyboard user is not dropped at the top of the document. Focus moves
only on a toggle the operator performed -- an arriving analysis must not
grab focus from whatever they were doing."
```

---

### Task 4: Prove collapsing hands the twin back to the camera

**Files:**
- Modify: `console/app/main.tsx`
- Create: `console/e2e/recommendation.spec.ts`

**Interfaces:**
- Consumes: `connectionChip` from `e2e/console-page.ts` (already exists).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Expose the store in dev builds only**

The e2e suite has no backend and no model, so it cannot obtain a real recommendation. Give it a handle on the store, compiled out of production builds.

In `console/app/main.tsx`, insert after the `import "./globals.css";` line:

```tsx
import { useConsoleStore } from "@/lib/store";

/**
 * DEV-only handle for the Playwright suite, which has no backend and therefore
 * no way to obtain a real recommendation. `import.meta.env.DEV` is statically
 * false in a production build, so this and the store reference are removed by
 * dead-code elimination rather than shipped to prospects.
 */
if (import.meta.env.DEV) {
  (window as unknown as { __arkaforgeStore?: typeof useConsoleStore }).__arkaforgeStore =
    useConsoleStore;
}
```

- [ ] **Step 2: Write the failing e2e spec**

Create `console/e2e/recommendation.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

import { connectionChip } from "./console-page";

/**
 * The card sits over the twin in the centre column, so collapsing it has one
 * user-visible job: give the asset back to the camera. Asserted by hit-testing
 * the exact point the expanded card occupied.
 */

const FINAL = "OBSERVATION\nHot-spot 134.4 °C.\n\nRECOMMENDATION\nEngage OFAF.";

/** Replays the agent messages the WebSocket would send, via the DEV store handle. */
async function seedRecommendation(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForFunction(() => "__arkaforgeStore" in window);
  await page.evaluate((final) => {
    const store = (
      window as unknown as {
        __arkaforgeStore: { getState: () => { applyServerMessage: (m: unknown) => void } };
      }
    ).__arkaforgeStore.getState();
    const send = (message: unknown) => store.applyServerMessage(message);

    send({ type: "agent_started", provider: "anthropic", model: "claude-sonnet-5", local: false });
    send({ type: "tool_call", call_id: "c1", tool: "simulate_forward", input: {} });
    send({
      type: "tool_result",
      call_id: "c1",
      tool: "simulate_forward",
      output: {
        plan: { cooling_stage: "OFAF", load_action: "serve_full" },
        peak_hot_spot_c: 103.0,
        breaches_120c: false,
        hours_above_120c: 0,
        economics: {
          equivalent_life_consumed_hours: 4.1,
          net_value_usd: 508_680,
          transformer_life_cost_usd: 2_700,
          curtailment_cost_usd: 0,
          failure_risk_cost_usd: 900,
        },
      },
    });
    send({ type: "agent_final", text: final });
    send({ type: "agent_done", timestamp: 0 });
  }, FINAL);
}

test("collapsing the recommendation gives the twin back to the camera", async ({ page }) => {
  await page.goto("/?mode=recorded");
  await expect(connectionChip(page)).toHaveText(/recorded/i);

  await seedRecommendation(page);

  const card = page.getByRole("heading", { name: "Recommendation" }).locator("xpath=../../..");
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  const point = {
    x: Math.round((box?.x ?? 0) + (box?.width ?? 0) / 2),
    y: Math.round((box?.y ?? 0) + (box?.height ?? 0) / 2),
  };

  const tagAt = (p: { x: number; y: number }) =>
    page.evaluate((q) => document.elementFromPoint(q.x, q.y)?.tagName ?? "", p);

  // Expanded, that point belongs to the card.
  expect(await tagAt(point)).not.toBe("CANVAS");

  await page.getByRole("button", { name: "Minimize recommendation" }).click();
  await expect(page.getByRole("button", { name: /Expand recommendation/ })).toBeVisible();

  // Collapsed, the same point reaches the twin.
  expect(await tagAt(point)).toBe("CANVAS");
});

test("the collapsed bar still carries the recommended plan", async ({ page }) => {
  await page.goto("/?mode=recorded");
  await expect(connectionChip(page)).toHaveText(/recorded/i);
  await seedRecommendation(page);

  await page.getByRole("button", { name: "Minimize recommendation" }).click();

  const bar = page.getByRole("button", { name: /Expand recommendation/ });
  await expect(bar).toContainText("OFAF");
  await expect(bar).toContainText("$509k");
});
```

- [ ] **Step 3: Run the spec and confirm it fails**

Run: `cd console && npx playwright test e2e/recommendation.spec.ts`
Expected: FAIL — `__arkaforgeStore` is missing until Step 1 is saved, or the Minimize button is absent if Tasks 2–3 were skipped.

- [ ] **Step 4: Run it again after Step 1's edit is in place**

Run: `cd console && npx playwright test e2e/recommendation.spec.ts`
Expected: PASS — 2 tests.

If the `card` locator misses, print the DOM around the heading with
`await page.getByRole("heading", { name: "Recommendation" }).evaluate((el) => el.outerHTML)` and
adjust the `xpath=../../..` hop count to reach the `<section>`. Do not weaken the hit-test.

- [ ] **Step 5: Confirm the DEV hook is absent from a production build**

Run: `cd console && npm run build && grep -rc "__arkaforgeStore" dist/assets/*.js | grep -v ":0" || echo "absent from production bundle"`
Expected: `absent from production bundle`.

- [ ] **Step 6: Full verification**

Run: `cd console && npm run typecheck && npm run lint && npm run test && npm run test:e2e`
Expected: all pass — 4 vitest files, 10 Playwright specs.

- [ ] **Step 7: Commit**

```bash
cd console
git add app/main.tsx e2e/recommendation.spec.ts
git commit -m "Prove collapsing the card hands the twin back to the camera

Hit-tests the exact point the expanded card occupied: it belongs to the
card before collapse and to the canvas after. Asserting the stated benefit
rather than assuming it.

The e2e suite has no backend and no model, so a DEV-only store handle lets
it replay the agent messages the WebSocket would send. import.meta.env.DEV
is statically false in production, so it is eliminated from that bundle --
verified by grepping dist."
```

---

### Task 5: Record the change

**Files:**
- Modify: `RESEARCH-LOG.md`

**Interfaces:** none.

- [ ] **Step 1: Append the entry**

Add a numbered entry after the console-test-runner entry (§11), renumbering the "Blocked / still pending" entry that follows it:

```markdown
12. **Recommendation card minimize (2026-07-29).** `Close` was the only way to clear the card, and
   it discards the analysis — so seeing the twin meant losing the reasoning and re-running the
   agent. Minimize collapses it to a one-line row that keeps its conclusion; `Close` is unchanged.

   **The collapsed headline is read from `simulate_forward` tool output, never from the prose.**
   Expanded, the ranked table sits beside the narrative and contradicts it where they differ.
   Collapsed there is no table, so a prose-derived figure would be an unchecked claim in the most
   glanceable element in the UI — and §9 records the agent reporting ONAN's net value as
   −$508,679.65 when its own tool returned +$508,679.65. Where the prose names a different stage
   than the tools rank first, the collapsed bar says so; with no extractable plan it shows no
   number at all rather than inventing one. The `disagreesWithTools` predicate moved out of
   `RankedOptions` into `lib/agentPlans.ts` so the two views cannot reach different verdicts.

   Spec: `docs/superpowers/specs/2026-07-29-recommendation-card-minimize-design.md`.
   13 component tests + 2 e2e specs; the e2e one hit-tests the point the expanded card occupied to
   prove collapsing actually returns the twin to the camera.
```

- [ ] **Step 2: Commit**

```bash
cd /Users/harishchaurasia/Desktop/arka-forge-demo01
git add RESEARCH-LOG.md
git commit -m "Log the recommendation card minimize"
git push
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Collapse without losing the analysis | 2 |
| Collapsed carries stage + net value | 2 (Step 3 test 3) |
| Collapsed returns click-through to the twin | 4 |
| New analysis re-expands | 2 (Step 3, "a new analysis") |
| Close unchanged | 2 (Step 3, "close") |
| Whole row is the expand control | 2 (Step 5 — the row *is* the `<button>`) |
| Forge Red left rule in both states | 2 (Step 5 — `border-l-2 border-l-forge-red`) |
| Headline from tool output, never prose | 2 (Step 3 test 4 — the fabrication guard) |
| Disagreement marker survives collapse | 2 (Step 3 test 4) |
| No plans → no number | 2 (Step 3 test 5) |
| Local-model marker survives collapse | 2 (Step 3 test 6) |
| One definition of "disagrees" | 1 |
| `formatUsd` shared so roundings can't drift | 2 (Step 5) |
| `aria-expanded` / `aria-controls` | 3 |
| Distinct `aria-label`s | 2, 3 |
| Focus managed both directions | 3 |
| 150ms ease-out, reduced-motion honoured | 2 (`transition-brand`; already reduced-motion-gated) |
| Headline uses `--text-primary` | 2 (Step 5) |
| Amber for disagreement, not red | 2 (Step 5 — `text-status-warning`) |
| Module under 300 lines | 2 (Step 8 checks `wc -l`) |
| Failing-first proof for guards | 1 Step 2, 2 Step 4, 3 Step 2, 4 Step 3 |

No gaps.

**Placeholder scan:** none. Every code step carries the literal code; every run step carries the command and expected result.

**Type consistency:** `disagreesWithTools(stated, plans)` is defined in Task 1 and called with that signature in Tasks 1 and 2. `PlanFixture`/`seedRecommendation` are defined in Task 2 Step 2 and used with that shape in Tasks 2 and 3. `CollapsedSummaryProps` gains `ref` in Task 3 Step 3, matching the `ref={collapsedRef}` added in the same step. `best` is `PlanOption | undefined` throughout, consistent with `noUncheckedIndexedAccess`.

**Two spec deviations, both deliberate and documented above:** the e2e test lives in its own spec file rather than `fallback.spec.ts`, and `Close` is an expanded-state action because nesting it inside the collapsed row's `<button>` would be invalid HTML.
