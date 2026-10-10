import type { CuratedMoment, MatchEvent } from "@inside/types";

export type FeedItem = { kind: "event"; e: MatchEvent } | { kind: "curated"; m: CuratedMoment };

/** For You order: featured (promoted) moments first, then newest by match minute.
 *  Curated moments without a minute count as newest. */
export function rankFeed(events: MatchEvent[], curated: CuratedMoment[]): FeedItem[] {
  const minute = (i: FeedItem) => (i.kind === "event" ? i.e.minute + (i.e.extra ?? 0) / 100 : i.m.minute ?? Number.POSITIVE_INFINITY);
  const pinned = (i: FeedItem) => (i.kind === "curated" && i.m.promoted ? 1 : 0);
  const items: FeedItem[] = [...curated.map((m) => ({ kind: "curated" as const, m })), ...events.map((e) => ({ kind: "event" as const, e }))];
  return items.sort((a, b) => pinned(b) - pinned(a) || minute(b) - minute(a));
}
