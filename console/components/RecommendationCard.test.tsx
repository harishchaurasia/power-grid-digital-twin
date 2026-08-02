import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RecommendationCard } from "@/components/RecommendationCard";
import { formatUsd } from "@/lib/agentPlans";
import { seedRecommendation } from "@/test/agentFixtures";

const OFAF_BEST = [
  { stage: "OFAF" as const, netValueUsd: 508_680 },
  { stage: "ONAN" as const, netValueUsd: 120_000 },
];

// ONAN is the fixture's "do-nothing" plan and the only one `seedRecommendation`
// marks as breaching (see test/agentFixtures.ts) -- ranking it first is what
// makes the recommended plan itself the one in breach, not just a runner-up.
const ONAN_BREACHES_TOP = [
  { stage: "ONAN" as const, netValueUsd: 300_000 },
  { stage: "OFAF" as const, netValueUsd: 100_000 },
];

const NEGATIVE_TOP = [{ stage: "OFAF" as const, netValueUsd: -50_000 }];

const FINAL_SAYS_OFAF = "OBSERVATION\nHot-spot 134.4 °C.\n\nRECOMMENDATION\nEngage OFAF.";
const FINAL_SAYS_HOLD_ONAN =
  "OBSERVATION\nHot-spot 134.4 °C.\n\nRECOMMENDATION\nHold at ONAN.";
// Carries a currency figure -- the sign-flipped magnitude from the RESEARCH-LOG
// §9 incident -- so a fabrication guard can check the figure, not just the stage.
const FINAL_SAYS_ONAN = "OBSERVATION\nHot-spot 134.4 °C.\n\nRECOMMENDATION\nHold at ONAN, net −$508,680.";

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
    expect(screen.getByRole("button", { name: /expand recommendation/i })).toBeInTheDocument();
  });

  it("keeps the conclusion: recommended stage and its net value", () => {
    seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_OFAF });
    renderCard();
    minimize();

    const bar = screen.getByRole("button", { name: /expand recommendation/i });
    // Exact text via getByText, not toHaveTextContent's substring match:
    // toHaveTextContent("$509k") would also pass against a rendered "−$509k",
    // since "−$509k".includes("$509k") is true. A substring probe cannot
    // distinguish a correct figure from a sign-flipped one -- the exact
    // RESEARCH-LOG.md §9 failure mode -- so the assertion has to be exact.
    expect(within(bar).getByText(`OFAF · ${formatUsd(508_680)}`)).toBeInTheDocument();
  });

  it("takes the headline from tool output even when the prose names another stage", () => {
    // The fabrication guard, aimed at the RESEARCH-LOG.md §9 failure class: a
    // sign-flipped dollar figure, not merely a wrong stage name. FINAL_SAYS_ONAN
    // states "net −$508,680" -- OFAF's real net value with the sign flipped --
    // so an implementation that takes the stage from tools but the figure from
    // prose (falling back to tools only when prose has no figure) would render
    // "−$508,680" here and pass a stage-only check while still fabricating the
    // number.
    //
    // The figure assertions below must use exact text (getByText), not
    // toHaveTextContent's substring match: formatUsd(-508_680) is "−$509k",
    // and "−$509k".includes("$509k") is true, so toHaveTextContent(formatUsd
    // (508_680)) would pass whether the rendered figure was "$509k" or the
    // sign-flipped "−$509k" -- exactly the fabrication this test exists to
    // catch. Only an exact match on the full rendered figure (stage included,
    // since that is what CollapsedFigure actually renders as one text node)
    // can tell the two apart.
    seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_ONAN });
    renderCard();
    minimize();

    const bar = screen.getByRole("button", { name: /expand recommendation/i });
    expect(bar).not.toHaveTextContent("ONAN");
    expect(bar).toHaveTextContent(/disagrees/i);
    expect(within(bar).getByText(`OFAF · ${formatUsd(508_680)}`)).toBeInTheDocument();
    expect(within(bar).queryByText(`OFAF · ${formatUsd(-508_680)}`)).not.toBeInTheDocument();
  });

  it("shows a breach marker when the recommended plan breaches the limit", () => {
    // Ranking ONAN first makes the *recommended* plan the one in breach, not
    // just a runner-up -- the case the collapsed bar must not hide.
    seedRecommendation({ plans: ONAN_BREACHES_TOP, final: FINAL_SAYS_HOLD_ONAN });
    renderCard();
    minimize();

    expect(screen.getByRole("button", { name: /expand recommendation/i })).toHaveTextContent(
      /breach/i,
    );
  });

  it("shows no breach marker when the recommended plan is within limits", () => {
    seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_OFAF });
    renderCard();
    minimize();

    expect(screen.getByRole("button", { name: /expand recommendation/i })).not.toHaveTextContent(
      /breach/i,
    );
  });

  it("colours a negative net value the same way the ranked table does", () => {
    seedRecommendation({ plans: NEGATIVE_TOP, final: FINAL_SAYS_OFAF });
    renderCard();
    minimize();

    const figure = screen.getByText(`OFAF · ${formatUsd(-50_000)}`);
    expect(figure).toHaveClass("text-forge-red");
  });

  it("shows no figure at all when no plan could be extracted", () => {
    seedRecommendation({ plans: [], final: FINAL_SAYS_OFAF });
    renderCard();
    minimize();

    const bar = screen.getByRole("button", { name: /expand recommendation/i });
    expect(bar).toHaveTextContent(/ready/i);
    expect(bar).not.toHaveTextContent("$");
  });

  it("keeps the local-model caveat visible", () => {
    seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_OFAF, local: true });
    renderCard();
    minimize();

    expect(screen.getByRole("button", { name: /expand recommendation/i })).toHaveTextContent(
      /local model/i,
    );
  });

  it("expands again and restores the table", () => {
    seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_OFAF });
    renderCard();
    minimize();
    fireEvent.click(screen.getByRole("button", { name: /expand recommendation/i }));

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
    expect(screen.queryByRole("button", { name: /expand recommendation/i })).not.toBeInTheDocument();
  });
});

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
    const bar = screen.getByRole("button", { name: /expand recommendation/i });
    expect(bar).toHaveAttribute("aria-expanded", "false");
    expect(bar).toHaveAttribute("aria-controls", bodyId);
  });

  it("moves focus to the collapsed bar so the keyboard does not lose its place", () => {
    seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_OFAF });
    renderCard();
    minimize();

    expect(screen.getByRole("button", { name: /expand recommendation/i })).toHaveFocus();
  });

  it("moves focus into the card on expand", () => {
    seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_OFAF });
    renderCard();
    minimize();
    fireEvent.click(screen.getByRole("button", { name: /expand recommendation/i }));

    expect(screen.getByRole("heading", { name: "Recommendation" })).toHaveFocus();
  });

  it("does not steal focus when a card first appears", () => {
    // Focus belongs to whatever the operator was doing; an arriving panel must
    // not grab it. jsdom's default active element is already document.body, so
    // asserting that after a bare render passes trivially -- nothing had a
    // chance to steal anything. Focusing a real sibling element first, then
    // seeding the recommendation, gives the assertion something to lose.
    render(
      <>
        <button type="button">Elsewhere</button>
        <RecommendationCard send={vi.fn()} />
      </>,
    );
    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
    elsewhere.focus();
    expect(elsewhere).toHaveFocus();

    act(() => {
      seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_OFAF });
    });

    expect(elsewhere).toHaveFocus();
  });
});
