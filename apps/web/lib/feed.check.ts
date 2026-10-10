// Self-check for For You ranking. Run: npm run check -w @inside/web
import assert from "node:assert/strict";
import type { CuratedMoment, MatchEvent } from "@inside/types";
import { rankFeed } from "./feed";

const ev = (id: string, minute: number, extra: number | null = null): MatchEvent => ({ id, minute, extra, type: "Goal", detail: "", team: "home", player: null, assist: null });
const cm = (id: string, minute: number | null, promoted = false): CuratedMoment => ({
  id, matchId: "1", kind: "CROWD", title: id, description: "", minute, promoted, source: "editor", status: "PUBLISHED", media: null, createdAt: "",
});

const ids = (xs: ReturnType<typeof rankFeed>) => xs.map((x) => (x.kind === "event" ? x.e.id : x.m.id));

assert.deepEqual(ids(rankFeed([ev("g10", 10), ev("g80", 80)], [cm("crowd50", 50)])), ["g80", "crowd50", "g10"], "newest minute first");
assert.deepEqual(ids(rankFeed([ev("g80", 80)], [cm("featured5", 5, true)])), ["featured5", "g80"], "featured pinned on top");
assert.deepEqual(ids(rankFeed([ev("g90", 90)], [cm("nominute", null)])), ["nominute", "g90"], "no minute counts as newest");
assert.deepEqual(ids(rankFeed([ev("g90", 90), ev("g90+3", 90, 3)], [])), ["g90+3", "g90"], "stoppage time after 90'");
assert.deepEqual(rankFeed([], []), []);

console.log("For You ranking: all checks passed");
