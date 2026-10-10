// Live replay of synthetic Roar League matches. Each match's event log plays back against the wall clock,
// so clients see events "as they happen". This is the ingest stage (a) of the pipeline.
import type { Fixture, MatchDetail, MatchEvent, MatchList } from "@inside/types";
import { analyse, generateMatch, SCRIPTS, teamStats, validateMatch, type MatchDataset, type MatchInsights, type SynthEvent } from "@inside/matchdata";

const MIN = 60_000;
const SPEED = Number(process.env["REPLAY_SPEED"] ?? 1) || 1;

const datasets = new Map<string, MatchDataset>();
for (const script of SCRIPTS) {
  const d = generateMatch(script);
  const { ok, problems } = validateMatch(d);
  if (!ok) throw new Error(`Synthetic match ${script.id} failed validation: ${problems.join("; ")}`);
  datasets.set(script.id, d);
}

// Demo schedule relative to API start: one live (20 minutes in), one finished, one about to start.
const boot = Date.now();
const kickoffAt = new Map<string, number>([
  ["rl-01", boot - (20 * MIN) / SPEED],
  ["rl-02", boot - 3 * 60 * MIN],
  ["rl-03", boot + 30 * MIN],
]);

/** Restart a match's replay so it is at `minute` right now (demo control). */
export function restartMatch(id: string, minute = 0) {
  const d = datasets.get(id);
  if (!d) return false;
  // Display minutes after 45 count from the second-half kick-off (first-half added time sits in between).
  const secondHalf = d.events.find((e) => e.type === "kickoff" && e.period === 2)?.t ?? 45 * MIN;
  const t = minute <= 45 ? minute * MIN : secondHalf + (minute - 45) * MIN;
  kickoffAt.set(id, Date.now() - t / SPEED);
  return true;
}

export const matchIds = () => [...datasets.keys()];

function elapsed(id: string) {
  return (Date.now() - (kickoffAt.get(id) ?? Date.now())) * SPEED;
}

/** Events that have "happened" so far. */
export function visibleEvents(id: string): SynthEvent[] {
  const d = datasets.get(id);
  if (!d) return [];
  const now = elapsed(id);
  // Events are sorted by t: binary search for the cut-off.
  let lo = 0;
  let hi = d.events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (d.events[mid]!.t <= now) lo = mid + 1;
    else hi = mid;
  }
  return d.events.slice(0, lo);
}

export const getDataset = (id: string) => datasets.get(id);

function fixture(id: string, seen: SynthEvent[]): Fixture {
  const d = datasets.get(id)!;
  const last = seen.at(-1);
  const done = seen.length === d.events.length;
  const started = seen.length > 0;
  const halfTime = last?.type === "half_time";
  const score = { home: 0, away: 0 };
  for (const e of seen) if (e.type === "shot" && e.outcome === "goal" && e.side) score[e.side]++;
  return {
    id,
    home: { name: d.home.name, short: d.home.short, logo: null },
    away: { name: d.away.name, short: d.away.short, logo: null },
    score: started ? [score.home, score.away] : null,
    status: done ? "FINISHED" : started ? "LIVE" : "SCHEDULED",
    statusText: done ? "Full time" : halfTime ? "Half time" : !started ? "Not started" : last?.period === 2 ? "Second half" : "First half",
    minute: started && !done ? (last?.minute ?? 0) : null,
    kickoff: new Date(kickoffAt.get(id) ?? boot).toISOString(),
    venue: d.home.venue,
  };
}

const playerName = (d: MatchDataset, id?: string) => (id ? [...d.home.players, ...d.away.players].find((p) => p.id === id)?.name ?? null : null);

/** The headline events the fan app shows as Moments: goals, cards, substitutions. */
function keyEvents(id: string, seen: SynthEvent[]): MatchEvent[] {
  const d = datasets.get(id)!;
  const out: MatchEvent[] = [];
  for (let i = 0; i < seen.length; i++) {
    const e = seen[i]!;
    const cap = e.period === 1 ? 45 : 90;
    const minute = Math.min(e.minute, cap);
    const extra = e.minute > cap ? e.minute - cap : null;
    const base = { id: e.id, minute, extra, team: e.side ?? "home" };
    if (e.type === "shot" && e.outcome === "goal") {
      // The assist is the completed pass that found the scorer just before the shot.
      const prev = [...seen.slice(Math.max(0, i - 4), i)].reverse().find((p) => p.type === "pass" && p.recipientId === e.playerId && p.side === e.side);
      out.push({ ...base, type: "Goal", detail: e.detail ?? "Normal Goal", player: playerName(d, e.playerId), assist: playerName(d, prev?.playerId) });
    } else if (e.type === "card") {
      out.push({ ...base, type: "Card", detail: e.detail ?? "Yellow Card", player: playerName(d, e.playerId), assist: null });
    } else if (e.type === "sub") {
      out.push({ ...base, type: "Sub", detail: "Substitution", player: playerName(d, e.recipientId), assist: playerName(d, e.playerId) });
    }
  }
  return out;
}

export async function listMatches(): Promise<MatchList> {
  const all = matchIds().map((id) => fixture(id, visibleEvents(id)));
  return {
    live: all.filter((f) => f.status === "LIVE"),
    upcoming: all.filter((f) => f.status === "SCHEDULED").sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
    recent: all.filter((f) => f.status === "FINISHED"),
    source: "synthetic",
  };
}

// Insights are recomputed only when new events have arrived.
const insightCache = new Map<string, MatchInsights>();
export function getInsights(id: string): MatchInsights | null {
  const d = datasets.get(id);
  if (!d) return null;
  const seen = visibleEvents(id);
  const hit = insightCache.get(id);
  if (hit && hit.asOfSeq === (seen.at(-1)?.seq ?? -1)) return hit;
  const fresh = analyse(d, seen);
  insightCache.set(id, fresh);
  return fresh;
}

export async function getMatch(id: string): Promise<MatchDetail | null> {
  if (!datasets.has(id)) return null;
  const seen = visibleEvents(id);
  return { fixture: fixture(id, seen), stats: teamStats(seen), events: keyEvents(id, seen), source: "synthetic" };
}
