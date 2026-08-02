/**
 * Splits the agent's final answer into its labelled sections, so the
 * OPTIONS/RECOMMENDATION prose can be swapped out for the ranked-options table
 * built from tool output while the rest of the narrative still renders.
 */

/** Section headings the system prompt asks the agent to produce. */
const SECTIONS = [
  "OBSERVATION",
  "MECHANISM",
  "PROJECTION",
  "OPTIONS",
  "RECOMMENDATION",
] as const;

export interface Section {
  label: string;
  body: string;
}

/** Rendered as a table instead of prose, from tool output rather than wording. */
export const PROSE_REPLACED_BY_TABLE = new Set(["OPTIONS", "RECOMMENDATION"]);

/**
 * Split the answer on its section headings.
 *
 * Falls back to one unlabelled block if the model did not follow the format —
 * a smaller model often will not, and showing its raw output is better than
 * showing nothing or pretending it was structured.
 */
export function parseSections(text: string): Section[] {
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
