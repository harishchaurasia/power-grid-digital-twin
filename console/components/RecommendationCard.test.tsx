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
    expect(screen.getByRole("button", { name: /expand recommendation/i })).toBeInTheDocument();
  });

  it("keeps the conclusion: recommended stage and its net value", () => {
    seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_OFAF });
    renderCard();
    minimize();

    const bar = screen.getByRole("button", { name: /expand recommendation/i });
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

    const bar = screen.getByRole("button", { name: /expand recommendation/i });
    expect(bar).toHaveTextContent("OFAF");
    expect(bar).not.toHaveTextContent("ONAN");
    expect(bar).toHaveTextContent(/disagrees/i);
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
    // not grab it.
    seedRecommendation({ plans: OFAF_BEST, final: FINAL_SAYS_OFAF });
    renderCard();

    expect(document.body).toHaveFocus();
  });
});
