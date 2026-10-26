import type { CuratedMoment, MatchEvent } from "@inside/types";

export type FeedItem = { kind: "event"; e: MatchEvent; angle?: CuratedMoment } | { kind: "curated"; m: CuratedMoment };

const ANGLE_KINDS = new Set(["GOAL", "CELEBRATION", "CROWD"]);

/** For You order: featured (promoted) moments first, then newest by match minute.
 *  Curated moments without a minute count as newest. A goal borrows the first fan clip filmed
 *  within three minutes of it as its background, so the slide shows the stands instead of a blank card. */
export function rankFeed(events: MatchEvent[], curated: CuratedMoment[]): FeedItem[] {
  const used = new Set<string>();
  const eventItems: FeedItem[] = events.map((e) => {
    const angle = e.type === "Goal"
      ? curated.find((m) => !used.has(m.id) && !m.promoted && m.media && ANGLE_KINDS.has(m.kind) && m.minute !== null && m.minute >= e.minute && m.minute <= e.minute + 3)
      : undefined;
    if (angle) used.add(angle.id);
    return angle ? { kind: "event", e, angle } : { kind: "event", e };
  });
  const minute = (i: FeedItem) => (i.kind === "event" ? i.e.minute + (i.e.extra ?? 0) / 100 : i.m.minute ?? Number.POSITIVE_INFINITY);
  const pinned = (i: FeedItem) => (i.kind === "curated" && i.m.promoted ? 1 : 0);
  const items: FeedItem[] = [...curated.filter((m) => !used.has(m.id)).map((m) => ({ kind: "curated" as const, m })), ...eventItems];
  return items.sort((a, b) => pinned(b) - pinned(a) || minute(b) - minute(a));
}
