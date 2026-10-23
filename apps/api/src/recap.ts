// Highlight Curator for recaps: pick the segments of a 15/30/60s recap from published fan Moments and
// official goals. Pure, so the selection is testable without a database or model.
export const RECAP_LENGTHS = [15, 30, 60] as const;
export type RecapLength = (typeof RECAP_LENGTHS)[number];

export type RecapCandidate = {
  id: string;
  minute: number | null;
  kind: string;
  title: string;
  promoted: boolean;
  media: { id: string; url: string; type: "PHOTO" | "VIDEO" } | null;
  /** True for an official match event (goal) rather than a fan Moment. */
  official: boolean;
};

export type RecapSegment = RecapCandidate & { seconds: number };

const SLOTS: Record<RecapLength, number> = { 15: 3, 30: 5, 60: 8 };
const WEIGHT: Record<string, number> = { GOAL: 5, CELEBRATION: 3, PLAYER: 2, CROWD: 2, FOUL: 1, OTHER: 1 };

const score = (c: RecapCandidate) => (WEIGHT[c.kind] ?? 1) + (c.promoted ? 3 : 0) + (c.media ? 2 : 0) + (c.official ? 0 : 1);

/** Best candidates for the length, played back in match order, with the seconds split evenly. */
export function pickSegments(candidates: RecapCandidate[], length: RecapLength): RecapSegment[] {
  // A goal with a fan Moment from the same minute is shown once, through the fans' angle.
  const fanGoalMinutes = new Set(candidates.filter((c) => !c.official && c.kind === "GOAL" && c.minute !== null).map((c) => c.minute));
  const pool = candidates.filter((c) => !(c.official && c.minute !== null && fanGoalMinutes.has(c.minute)));
  const chosen = [...pool].sort((a, b) => score(b) - score(a) || (b.minute ?? -1) - (a.minute ?? -1)).slice(0, SLOTS[length]);
  chosen.sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999));
  if (!chosen.length) return [];
  const base = Math.floor(length / chosen.length);
  const extra = length - base * chosen.length;
  return chosen.map((c, i) => ({ ...c, seconds: base + (i < extra ? 1 : 0) }));
}
