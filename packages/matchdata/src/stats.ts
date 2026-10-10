import type { Side, SynthEvent } from "./types.js";

export type TeamStat = { label: string; home: number; away: number; unit?: string };

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Team statistics from the events seen so far. Numbers come from code, never from the language model. */
export function teamStats(events: SynthEvent[]): TeamStat[] {
  const c = { home: blank(), away: blank() };
  for (const e of events) {
    if (!e.side) continue;
    const s = c[e.side];
    if (e.type === "pass") {
      s.passes++;
      if (e.outcome === "complete") s.completed++;
    } else if (e.type === "shot") {
      s.shots++;
      s.xg += e.xg ?? 0;
      if (e.outcome === "saved" || e.outcome === "goal") s.onTarget++;
      s.topShot = Math.max(s.topShot, e.speedKmh ?? 0);
    } else if (e.type === "corner") s.corners++;
    else if (e.type === "foul") s.fouls++;
    else if (e.type === "card" && e.detail === "Yellow Card") s.yellows++;
    else if ((e.type === "tackle" || e.type === "interception") && e.outcome === "won") s.won++;
  }
  const passes = c.home.passes + c.away.passes;
  const row = (label: string, f: (s: Counts) => number, unit?: string): TeamStat => ({ label, home: f(c.home), away: f(c.away), ...(unit ? { unit } : {}) });
  return [
    { label: "Possession", home: pct(c.home.passes, passes), away: passes ? 100 - pct(c.home.passes, passes) : 0, unit: "%" },
    row("Shots", (s) => s.shots),
    row("On target", (s) => s.onTarget),
    row("Expected goals", (s) => r2(s.xg)),
    row("Passes", (s) => s.passes),
    row("Pass accuracy", (s) => pct(s.completed, s.passes), "%"),
    row("Ball wins", (s) => s.won),
    row("Corners", (s) => s.corners),
    row("Fouls", (s) => s.fouls),
    row("Yellow cards", (s) => s.yellows),
    row("Fastest shot", (s) => Math.round(s.topShot), " km/h"),
  ];
}

type Counts = ReturnType<typeof blank>;
function blank() {
  return { passes: 0, completed: 0, shots: 0, onTarget: 0, xg: 0, corners: 0, fouls: 0, yellows: 0, won: 0, topShot: 0 };
}

export function score(events: SynthEvent[]): Record<Side, number> {
  const s = { home: 0, away: 0 };
  for (const e of events) if (e.type === "shot" && e.outcome === "goal" && e.side) s[e.side]++;
  return s;
}
