import { score, teamStats } from "./stats.js";
import type { MatchDataset } from "./types.js";

/** Realism and integrity checks every generated match must pass before it can be replayed. */
export function validateMatch(d: MatchDataset): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const { events, script } = d;
  const players = new Set([...d.home.players, ...d.away.players].map((p) => p.id));
  const ids = new Set<string>();

  events.forEach((e, i) => {
    if (e.seq !== i) problems.push(`event ${e.id}: seq ${e.seq} != index ${i}`);
    if (i > 0 && e.t < events[i - 1]!.t) problems.push(`event ${e.id}: time goes backwards`);
    if (ids.has(e.id)) problems.push(`duplicate id ${e.id}`);
    ids.add(e.id);
    for (const [k, v, max] of [["x", e.x, 105], ["endX", e.endX, 105], ["y", e.y, 68], ["endY", e.endY, 68]] as const) {
      if (v !== undefined && (v < 0 || v > max)) problems.push(`event ${e.id}: ${k}=${v} off the pitch`);
    }
    for (const p of [e.playerId, e.recipientId]) if (p && !players.has(p)) problems.push(`event ${e.id}: unknown player ${p}`);
  });

  for (const type of ["kickoff", "half_time", "full_time"] as const) {
    if (!events.some((e) => e.type === type)) problems.push(`missing ${type}`);
  }

  const goals = score(events);
  for (const side of ["home", "away"] as const) {
    const expected = script.goals.filter((g) => g.side === side).length;
    if (goals[side] !== expected) problems.push(`${side} scored ${goals[side]}, script says ${expected}`);
  }

  const stats = Object.fromEntries(teamStats(events).map((s) => [s.label, s]));
  const between = (label: string, lo: number, hi: number, total = false) => {
    const s = stats[label]!;
    const vals = total ? [s.home + s.away] : [s.home, s.away];
    for (const v of vals) if (v < lo || v > hi) problems.push(`${label} ${v} outside ${lo}-${hi}${total ? " (total)" : ""}`);
  };
  between("Passes", 650, 1400, true);
  between("Pass accuracy", 62, 94);
  between("Possession", 28, 72);
  between("Shots", 2, 30);
  between("Shots", 10, 45, true);
  between("Expected goals", 0.1, 4.5);

  const last = [...events].reverse().find((e) => e.type === "telemetry");
  for (const p of last?.players ?? []) {
    const km = p.distanceM / 1000;
    if (km > 14) problems.push(`${p.playerId} ran ${km.toFixed(1)} km`);
    if (p.topSpeedKmh > 37) problems.push(`${p.playerId} top speed ${p.topSpeedKmh} km/h`);
  }

  return { ok: problems.length === 0, problems };
}
