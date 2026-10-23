// Build-up facts for the Tactics Analyst. Numbers come from the synthetic event log, never from the model:
// the agent only turns these facts into words at the fan's depth and language.
import type { MatchDataset, Side, SynthEvent } from "@inside/matchdata";

const PITCH = 105;
const MAX_BUILD_UP_MS = 45_000;

export type BuildUp = {
  side: Side;
  team: string;
  scorer: string | null;
  minute: number;
  passes: number;
  playersInvolved: string[];
  progressM: number;
  durationS: number;
  startZone: "defensive third" | "middle third" | "final third";
  wonBy: { how: "interception" | "tackle"; player: string | null } | null;
  passesUnderPressure: number;
  hardestPass: { from: string | null; to: string | null; distanceM: number } | null;
  shot: { xg: number; speedKmh: number | null; distanceM: number | null };
  /** Share of passes in the ten minutes before the goal. */
  recentControlPct: number;
};

/** Distance up the pitch towards the opponent's goal, for either side. */
const forward = (side: Side, x: number) => (side === "home" ? x : PITCH - x);

const zone = (m: number): BuildUp["startZone"] => (m < 35 ? "defensive third" : m < 70 ? "middle third" : "final third");

export function buildUp(d: MatchDataset, eventId: string): BuildUp | null {
  const i = d.events.findIndex((e) => e.id === eventId);
  const goal = d.events[i];
  if (!goal || goal.type !== "shot" || goal.outcome !== "goal" || !goal.side) return null;
  const side = goal.side;
  const players = new Map([...d.home.players, ...d.away.players].map((p) => [p.id, p.name]));
  const name = (id?: string) => (id ? players.get(id) ?? null : null);

  // Walk back through this side's possession until the ball last changed hands.
  const chain: SynthEvent[] = [];
  let wonBy: BuildUp["wonBy"] = null;
  for (let k = i - 1; k >= 0; k--) {
    const e = d.events[k]!;
    if (goal.t - e.t > MAX_BUILD_UP_MS || e.type === "kickoff" || e.type === "half_time") break;
    if (e.type === "telemetry") continue;
    if ((e.type === "interception" || e.type === "tackle") && e.side === side && e.outcome === "won") {
      wonBy = { how: e.type, player: name(e.playerId) };
      chain.unshift(e);
      break;
    }
    if (e.type === "possession_change") break;
    if (e.side && e.side !== side && e.type !== "pressure") break;
    chain.unshift(e);
  }

  const passes = chain.filter((e) => e.type === "pass" && e.side === side && e.outcome === "complete");
  const involved = new Set<string>();
  for (const e of [...chain, goal]) if (e.side === side && e.playerId) involved.add(e.playerId);
  const first = chain.find((e) => e.side === side && e.x !== undefined) ?? goal;
  const start = forward(side, first.x ?? 52.5);
  const end = forward(side, goal.x ?? PITCH - 11);
  const hardest = passes.reduce<SynthEvent | null>((best, p) => ((p.difficulty ?? 0) > (best?.difficulty ?? -1) ? p : best), null);

  const recent = d.events.filter((e) => e.type === "pass" && e.t <= goal.t && e.t > goal.t - 10 * 60_000);
  const own = recent.filter((e) => e.side === side).length;

  return {
    side,
    team: side === "home" ? d.home.name : d.away.name,
    scorer: name(goal.playerId),
    minute: goal.minute,
    passes: passes.length,
    playersInvolved: [...involved].map((id) => name(id) ?? id),
    progressM: Math.max(0, Math.round(end - start)),
    durationS: Math.round((goal.t - (chain[0]?.t ?? goal.t)) / 1000),
    startZone: zone(start),
    wonBy,
    passesUnderPressure: passes.filter((p) => p.underPressure).length,
    hardestPass: hardest ? { from: name(hardest.playerId), to: name(hardest.recipientId), distanceM: Math.round(hardest.distance ?? 0) } : null,
    shot: {
      xg: Math.round((goal.xg ?? 0) * 100) / 100,
      speedKmh: goal.speedKmh ? Math.round(goal.speedKmh) : null,
      distanceM: goal.x !== undefined && goal.y !== undefined ? Math.round(Math.hypot(PITCH - forward(side, goal.x), goal.y - 34)) : null,
    },
    recentControlPct: recent.length ? Math.round((own / recent.length) * 100) : 50,
  };
}

/** Plain facts for the model prompt. */
export function factsOf(b: BuildUp): string[] {
  return [
    `${b.team} scored in minute ${b.minute}${b.scorer ? `, scorer ${b.scorer}` : ""}.`,
    b.wonBy ? `The move began with a${b.wonBy.how === "interception" ? "n interception" : " tackle"}${b.wonBy.player ? ` by ${b.wonBy.player}` : ""} in the ${b.startZone}.` : `The move began in the ${b.startZone}.`,
    `${b.passes} completed passes, ${b.playersInvolved.length} players involved (${b.playersInvolved.join(", ")}), ${b.durationS} seconds from start to shot, ${b.progressM} metres gained towards goal.`,
    `${b.passesUnderPressure} of those passes were played under pressure.`,
    b.hardestPass ? `Hardest pass: ${b.hardestPass.from ?? "?"} to ${b.hardestPass.to ?? "?"}, ${b.hardestPass.distanceM} metres.` : "No standout pass.",
    `Shot: ${b.shot.xg} xG${b.shot.distanceM !== null ? ` from ${b.shot.distanceM} metres` : ""}${b.shot.speedKmh ? ` at ${b.shot.speedKmh} km/h` : ""}.`,
    `${b.team} had ${b.recentControlPct}% of the passes in the ten minutes before the goal.`,
  ];
}

/** Rule-based explanation when AI is off. English only; the route translates it if it can. */
export function ruleExplanation(b: BuildUp, depth: "beginner" | "expert") {
  const quick = b.durationS <= 12 && b.passes <= 4;
  const headline = b.passes === 0 ? "Clinical from a dead ball" : b.wonBy && quick ? "Won it, went straight for goal" : b.passes >= 8 ? "Patient passing opened them up" : quick ? "Fast and direct" : "Worked the ball into a scoring chance";
  const points =
    depth === "beginner"
      ? [
          b.wonBy ? `${b.team} took the ball off their opponents${b.wonBy.player ? ` (${b.wonBy.player})` : ""} and attacked straight away.` : `${b.team} started the move in the ${b.startZone}.`,
          `${b.passes} passes between ${b.playersInvolved.length} players moved the ball ${b.progressM} metres up the pitch in ${b.durationS} seconds.`,
          b.shot.xg >= 0.3 ? `The chance was a good one: a shot like that goes in about ${Math.round(b.shot.xg * 100)} times in 100.` : `It was a hard chance: a shot like that goes in only about ${Math.round(b.shot.xg * 100)} times in 100.`,
        ]
      : [
          b.wonBy ? `${b.wonBy.how === "interception" ? "Interception" : "Ball won"} in the ${b.startZone}${b.wonBy.player ? ` by ${b.wonBy.player}` : ""} triggered the transition.` : `Sequence started in the ${b.startZone}.`,
          `${b.passes} completed passes, ${b.passesUnderPressure} under pressure; ${b.progressM} m progression in ${b.durationS}s.`,
          b.hardestPass ? `Key progression: ${b.hardestPass.from ?? "?"} → ${b.hardestPass.to ?? "?"} (${b.hardestPass.distanceM} m).` : `No single line-breaking pass; progression came through combinations.`,
          `Finish: ${b.shot.xg} xG${b.shot.distanceM !== null ? ` from ${b.shot.distanceM} m` : ""}. ${b.team} had ${b.recentControlPct}% of passes over the previous ten minutes.`,
        ];
  return { headline, points };
}
