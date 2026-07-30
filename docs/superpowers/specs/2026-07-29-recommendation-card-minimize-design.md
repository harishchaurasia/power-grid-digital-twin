# Design: minimize the agent recommendation card

**Date:** 2026-07-29
**Status:** approved, not yet implemented
**Scope:** `console/components/RecommendationCard.tsx` and its tests. No backend change.

> ⚠️ This file is new under `docs/`, which `CLAUDE.md` normally protects. Created on explicit
> instruction (brainstorming session, 2026-07-29). Relocate or delete if unwanted.

## Problem

The recommendation card is the conclusion the demo builds to, so it occupies the centre column
above the twin (`app/App.tsx:71`). Expanded, it covers the transformer a prospect is trying to
look at, and the only way to clear it is `Close`, which **discards the analysis entirely**
(`dismissRecommendation` sets `agentFinal` to `null`). An operator who wants to see the asset has
to throw away the reasoning to get there, then re-run the agent to get it back.

## Goals

1. Collapse the card without losing the analysis.
2. Collapsed, the card still carries its conclusion — recommended stage and net value.
3. Collapsed, the centre column returns to click-through so the camera works.
4. A new analysis is never hidden behind a collapsed card.

## Non-goals

- Dragging, resizing, or repositioning the card.
- Persisting the collapsed state across reloads. `CLAUDE.md` forbids persistence beyond session,
  and a remembered collapse would hide the demo's payoff from the next visitor.
- Any change to what the agent produces, or to the wire contract in `docs/architecture.md`.

## Behaviour

`minimized` is local `useState` in `RecommendationCard`. Nothing else in the app reads it, and
`CLAUDE.md` reserves Zustand for cross-component state.

| State | Renders |
|---|---|
| `agentRunning` | Existing "Agent analysing — N tool calls so far…" block. Unchanged. Not collapsible; there is no conclusion to collapse yet. |
| `agentFinal` set, expanded | Today's card, plus a `[–]` minimize control beside `[×]`. |
| `agentFinal` set, minimized | Single row: title, headline, disagreement/local markers, expand chevron. |
| `agentFinal` null, not running | `null`. Unchanged. |

Rules:

- **A new analysis re-expands.** `minimized` resets to `false` whenever `agentFinal` changes
  identity. Without this, minimize silently suppresses fresh output — the one failure mode that
  would make this feature worse than the problem it solves.
- **Close is unchanged.** Minimize is the new primary action; `Close` keeps calling
  `dismissRecommendation`. Nothing is taken away.
- **The whole collapsed row is the expand control**, not just the chevron — a 40px-tall bar whose
  only hit target is a 16px glyph is a defect on a demo shown on unfamiliar hardware.
- The Forge Red left rule (`border-l-2 border-l-forge-red`) is kept in both states, so the
  collapsed bar still reads as the agent's output rather than as chrome.
- `pointer-events-auto` stays scoped to the card itself; the surrounding centre column remains
  `pointer-events-none`, which is what makes collapsing hand the twin back to the camera.

## Headline provenance — the load-bearing decision

The collapsed headline is derived from **`extractPlans(toolCalls)`** — the `simulate_forward` tool
results — and never from parsing `agentFinal` prose.

This is not a style preference. `RESEARCH-LOG.md` §9 records the agent reporting ONAN's net value
as **−$508,679.65** when its own tool had returned **+$508,679.65**, and restating an asymmetric
CI of [135.04, 191.35] as a symmetric "162.47 ± 36.31". Expanded, the ranked table sits beside the
prose and contradicts it; the card already labels the two regions so a reader knows which to
trust. **Collapsed, there is no table.** A prose-derived number would be an unchecked fabrication
in the most glanceable element in the UI, which is strictly worse than showing nothing.

Consequences:

| Case | Collapsed bar shows |
|---|---|
| Plans extracted | `Recommendation · OFAF · +$509k` — stage and `netValueUsd` of `plans[0]` (already sorted best-first). |
| `statedChoice(final)` ≠ `plans[0].coolingStage` | Same headline, plus the disagreement marker the expanded card uses. Minimizing must not hide a discrepancy between what the agent said and what its tools computed. |
| No plans extracted (prose but no usable `simulate_forward` output) | `Recommendation ready` — **no number**. Never invent one. |
| `provider.local` | A small amber marker persists. The "check every figure against the tool output" caveat must not vanish on collapse. |

Formatting uses the existing `formatUsd`, so the collapsed figure and the table figure cannot
drift into different roundings.

**One definition of "disagrees".** The predicate currently lives inside `RankedOptions`
(`components/RankedOptions.tsx:29`), where only that component can see it. The collapsed bar needs
the same judgement, and two copies of it could diverge — which is precisely the class of bug this
card exists to prevent. Extract it to `lib/agentPlans.ts` as
`disagreesWithTools(stated, plans): boolean` and have both call sites use it. Targeted, in service
of this change; not a general refactor of the component.

## Accessibility and motion

These are what make it industry-standard rather than merely functional:

- The expand control is a real `<button>` with `aria-expanded` and `aria-controls` pointing at the
  body region; the body gets a stable `id`.
- `aria-label` distinguishes the two header actions: "Minimize recommendation" and "Dismiss
  recommendation" (the latter already exists).
- Focus moves to the expand control on collapse and back to the card body's heading on expand, so
  a keyboard user is not dropped at the top of the document.
- The collapse transition follows `brand.md`: 150ms ease-out, no bounce or spring. Honour
  `prefers-reduced-motion: reduce` by dropping the transition entirely.
- Contrast: the collapsed headline uses `--text-primary` on `--surface-1`, not `--text-tertiary`,
  because it is now the primary carrier of the conclusion.

## Brand compliance

`brand.md` caps Forge Red at ~10–15% of a view. Collapsed, the card's red is a single 2px left
rule on a ~40px row — a reduction, not an increase. The disagreement marker uses
`--status-warning` (amber), not red: a mismatch between prose and tools is a caution, not a
critical asset state, and red is reserved for genuine critical state.

## Files touched

| File | Change |
|---|---|
| `console/components/RecommendationCard.tsx` | Minimize state, collapsed row, header controls, a11y wiring. Currently 150 lines; the collapsed row should be extracted as a local component to keep it under the 300-line module limit and each function under 50 lines. |
| `console/lib/agentPlans.ts` | Add `disagreesWithTools(stated, plans)`, so the collapsed bar and `RankedOptions` share one definition. |
| `console/components/RankedOptions.tsx` | Use the extracted predicate instead of its inline expression. No behaviour change. |
| `console/components/RecommendationCard.test.tsx` | New. Component tests below. |
| `console/lib/agentPlans.test.ts` | New. Covers `disagreesWithTools`, including the no-plans and no-stated-choice cases. |
| `console/e2e/fallback.spec.ts` | One added spec: collapsed card hands pointer events back to the twin. |

No change to `lib/store.ts` or any backend file. The wire contract is untouched.

## Testing

Each test names the failure it guards, not the line it covers.

**Vitest (`RecommendationCard.test.tsx`)**

1. Renders expanded when an analysis arrives — the conclusion is not hidden by default.
2. Minimize collapses to one row; the ranked options table is no longer in the document.
3. The collapsed headline shows `plans[0]`'s stage and net value.
4. **The headline follows the computed best even when the prose names a different stage** —
   fixture where `statedChoice` returns `ONAN` while `plans[0]` is `OFAF`; assert `OFAF` is shown
   and the disagreement marker is present. This is the fabrication guard.
5. With no extractable plans, the collapsed bar shows no currency figure.
6. A local provider keeps its warning marker while collapsed.
7. A new `agentFinal` re-expands a collapsed card.
8. `Close` still clears the recommendation while collapsed.
9. Expand restores the table.

**Playwright (one added spec)**

10. With the card collapsed, a pointer event at centre-screen reaches the twin canvas — proves the
    stated benefit rather than assuming it. Runs under `?mode=recorded`, so it needs no backend
    and no agent; the spec seeds a recommendation through the store rather than waiting on a model.

Per the project's standing practice, tests 3–5 and 10 must be shown to fail against the current
code before the implementation lands. A guard that cannot fail is decoration.

## Risks

- **Seeding a recommendation in tests.** The e2e spec needs an `agentFinal` plus tool calls without
  a live model. Store seeding via `page.evaluate` is the pragmatic route; it couples the spec to the
  store shape, which is acceptable for one spec but should not become the pattern.
- **`agentFinal` identity as the re-expand trigger.** Two consecutive analyses producing character
  -identical text would not re-expand. Vanishingly unlikely with live telemetry in the prose, and
  the alternative (watching the `agentRunning` transition) has its own edge on a failed run. Accept,
  and note it in the code.

## Follow-on work (not this spec)

Agreed sequence from the same session: **transformer scenarios** (a sourced scenario library, seeded
stochastic arrival, and Monte Carlo UQ on outcomes — all three senses of "probabilistic", expressed
through the load / ambient / cooling-capacity inputs the C57.91 model already takes), then
**Phase 2 BESS**, **Phase 3 line + power flow**, then **Phase 4 cross-asset agent**. Each gets its
own spec. `CLAUDE.md`'s "Current phase: Phase 0" is stale and should be corrected as part of the
scenario work.
