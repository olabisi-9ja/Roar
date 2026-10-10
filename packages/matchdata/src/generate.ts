import { CLUBS } from "./clubs.js";
import { rng } from "./rng.js";
import type { Club, MatchDataset, MatchScript, Outcome, Player, Position, Side, SynthEvent } from "./types.js";

export const GENERATOR = "roar-matchgen/1";

const L = 105;
const W = 68;
const MIN = 60_000;
const other = (s: Side): Side => (s === "home" ? "away" : "home");
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

const DEFENDERS: Position[] = ["LB", "CB", "RB", "DM"];
const MIDS: Position[] = ["DM", "CM", "AM"];
const ATTACK: Position[] = ["AM", "LW", "RW", "ST"];

/**
 * Expands a storyline into a full event log. Scripted goals, cards and subs happen exactly as written;
 * everything in between (passes, pressure, tackles, shots) is generated from the momentum and player abilities.
 * Unscripted shots never score, so the final score always matches the script.
 */
export function generateMatch(script: MatchScript): MatchDataset {
  const home = CLUBS[script.home];
  const away = CLUBS[script.away];
  if (!home || !away) throw new Error(`Unknown club in script ${script.id}`);
  const clubs: Record<Side, Club> = { home, away };
  const r = rng(script.seed);

  const [add1, add2] = script.addedTime ?? [r.int(1, 4), r.int(3, 6)];
  const P2_START = (45 + add1) * MIN;
  const END = P2_START + (45 + add2) * MIN;
  // Display minute (e.g. 72 or 92 for 90+2) to a point on the continuous clock, somewhere inside that minute.
  const at = (m: number) => (m <= 45 ? m * MIN : P2_START + (m - 45) * MIN) + r.int(5, 50) * 1000;

  const lineup: Record<Side, Player[]> = { home: home.players.slice(0, 11), away: away.players.slice(0, 11) };
  const bench: Record<Side, Player[]> = { home: home.players.slice(11), away: away.players.slice(11) };
  const pid = (side: Side, id: string | undefined) => (id ? clubs[side].players.find((p) => p.id === id) : undefined);

  const goals = script.goals.map((g) => ({ ...g, t: at(g.minute) })).sort((a, b) => a.t - b.t);
  const cards = script.cards.map((c) => ({ ...c, t: at(c.minute) })).sort((a, b) => a.t - b.t);
  const subs = script.subs.map((s) => ({ ...s, t: at(s.minute) })).sort((a, b) => a.t - b.t);

  const events: SynthEvent[] = [];
  let t = 0;
  let period: 1 | 2 = 1;

  // Physical data, emitted once a minute.
  const phys = new Map<string, { distanceM: number; topSpeedKmh: number }>();
  let nextTelemetry = MIN;
  const tickTelemetry = () => {
    while (t >= nextTelemetry && nextTelemetry <= END) {
      for (const side of ["home", "away"] as Side[]) {
        for (const p of lineup[side]) {
          const cur = phys.get(p.id) ?? { distanceM: 0, topSpeedKmh: 0 };
          const perMin = p.position === "GK" ? r.range(45, 70) : r.range(100, 135) * (0.9 + p.pace * 0.15);
          const sprint = p.position === "GK" ? r.range(14, 22) : r.range(22, 27) + p.pace * r.range(4, 9);
          phys.set(p.id, { distanceM: Math.round(cur.distanceM + perMin), topSpeedKmh: r1(Math.max(cur.topSpeedKmh, sprint)) });
        }
      }
      // Stamped at the current time (just after the minute boundary) so events stay in time order.
      emit({
        type: "telemetry",
        players: [...lineup.home, ...lineup.away].map((p) => ({ playerId: p.id, ...phys.get(p.id)! })),
      });
      nextTelemetry += MIN;
    }
  };

  function clock(time: number) {
    const ms = period === 1 ? time : 45 * MIN + (time - P2_START);
    return { minute: Math.floor(ms / MIN), second: Math.floor(ms / 1000) % 60 };
  }

  function emit(e: Omit<SynthEvent, "id" | "seq" | "t" | "period" | "minute" | "second">) {
    const seq = events.length;
    events.push({ id: `${script.id}-${seq}`, seq, t, period, ...clock(t), ...e });
  }

  // Positions are reasoned about in the possessing side's attacking frame (a: 0 own goal .. 105 their goal).
  const abs = (side: Side, a: number, y: number) =>
    side === "home" ? { x: r1(clamp(a, 0, L)), y: r1(clamp(y, 0, W)) } : { x: r1(clamp(L - a, 0, L)), y: r1(clamp(W - y, 0, W)) };

  const homeShare = (time: number) => {
    const m = time < P2_START ? time / MIN : 45 + (time - P2_START) / MIN;
    return script.momentum.find((w) => m >= w.from && m < w.to)?.home ?? 0.5;
  };
  const dom = (side: Side) => (side === "home" ? homeShare(t) : 1 - homeShare(t));

  const outfield = (side: Side) => lineup[side].filter((p) => p.position !== "GK");
  const byRole = (side: Side, roles: Position[]) => {
    const xs = lineup[side].filter((p) => roles.includes(p.position));
    return xs.length ? xs : outfield(side);
  };
  const keeper = (side: Side) => lineup[side].find((p) => p.position === "GK") ?? lineup[side][0]!;
  const zoneRoles = (a: number): Position[] => (a < 35 ? DEFENDERS : a < 70 ? MIDS : ATTACK);

  // ---- Scripted interruptions ----

  type Ball = { side: Side; a: number; y: number; holder: Player };
  const restart = (side: Side, a: number, y: number, holder?: Player): Ball => ({ side, a, y, holder: holder ?? r.pick(zoneRoles(a).flatMap((role) => byRole(side, [role]))) });

  function kickoff(side: Side): Ball {
    const taker = r.pick(byRole(side, ["ST", "AM", "CM"]));
    emit({ type: "kickoff", side, playerId: taker.id, ...abs(side, 52.5, 34) });
    return { side, a: 52.5, y: 34, holder: taker };
  }

  function possessionChange(ball: Ball, side: Side, a: number, y: number, holder?: Player): Ball {
    const next = restart(side, a, y, holder);
    emit({ type: "possession_change", side, playerId: next.holder.id, ...abs(side, a, y) });
    return next;
  }

  function scriptedGoal(ball: Ball, g: (typeof goals)[number]): Ball {
    const s = g.side;
    if (ball.side !== s) ball = possessionChange(ball, s, r.range(52, 62), r.range(20, 48));
    const scorer = pid(s, g.scorer) ?? r.pick(byRole(s, ["ST", "LW", "RW", "AM"]));
    const assister = pid(s, g.assist) ?? r.pick(byRole(s, ["AM", "CM", "LW", "RW"]).filter((p) => p.id !== scorer.id));
    // Build-up: one to three progressive passes, then to the assister, then the assist to the scorer.
    let holder = ball.holder.id === scorer.id ? assister : ball.holder;
    let a = Math.max(ball.a, 50);
    let y = ball.y;
    const move = (to: Player, na: number, ny: number) => {
      pass(s, holder, to, a, y, na, ny, false, true);
      holder = to;
      a = na;
      y = ny;
    };
    const free = () => outfield(s).filter((p) => p.id !== holder.id && p.id !== scorer.id && p.id !== assister.id);
    for (let i = r.int(1, 3); i > 0; i--) move(r.pick(free()), Math.min(80, a + r.range(6, 14)), clamp(r.normal(y, 12), 6, 62));
    if (holder.id !== assister.id) move(assister, Math.min(86, a + r.range(4, 10)), clamp(r.normal(y, 10), 6, 62));
    move(scorer, r.range(90, 99), r.range(26, 42));
    if (g.kind === "penalty") {
      const fouler = r.pick(byRole(other(s), ["CB", "LB", "RB", "DM"]));
      emit({ type: "foul", side: other(s), playerId: fouler.id, detail: "Foul in the box", ...abs(s, a, y) });
      a = 94;
      y = 34;
    }
    shoot(s, scorer, a, y, "goal", g.kind === "penalty" ? "Penalty" : g.kind === "header" ? "Header" : "Normal Goal");
    t += r.int(45, 75) * 1000; // celebration and restart
    return kickoff(other(s));
  }

  function scriptedCard(ball: Ball, c: (typeof cards)[number]): Ball {
    const player = pid(c.side, c.player) ?? r.pick(outfield(c.side));
    emit({ type: "foul", side: c.side, playerId: player.id, ...abs(ball.side, ball.a, ball.y) });
    emit({ type: "card", side: c.side, playerId: player.id, detail: c.color === "red" ? "Red Card" : "Yellow Card" });
    if (c.color === "red") lineup[c.side] = lineup[c.side].filter((p) => p.id !== player.id);
    t += r.int(30, 60) * 1000;
    // Free kick to the other side where the foul happened.
    const fouled = other(c.side);
    return ball.side === fouled ? ball : possessionChange(ball, fouled, L - ball.a, W - ball.y);
  }

  function scriptedSub(ball: Ball, s: (typeof subs)[number]): Ball {
    const off = pid(s.side, s.off) ?? r.pick(outfield(s.side).filter((p) => p.id !== ball.holder.id));
    const on = pid(s.side, s.on) ?? bench[s.side][0];
    if (!on || !lineup[s.side].some((p) => p.id === off.id)) return ball;
    emit({ type: "sub", side: s.side, playerId: off.id, recipientId: on.id, detail: "Substitution" });
    lineup[s.side] = lineup[s.side].map((p) => (p.id === off.id ? on : p));
    bench[s.side] = bench[s.side].filter((p) => p.id !== on.id);
    t += r.int(25, 45) * 1000;
    return ball.holder.id === off.id ? { ...ball, holder: on } : ball;
  }

  // ---- Actions ----

  function pass(side: Side, from: Player, to: Player, a: number, y: number, na: number, ny: number, underPressure: boolean, forceComplete = false) {
    const distance = Math.hypot(na - a, ny - y);
    const forward = na - a;
    const difficulty = clamp(0.06 + (distance / 50) * 0.45 + (underPressure ? 0.2 : 0) + (forward > 15 ? 0.12 : 0) + (na > 85 ? 0.1 : 0), 0, 1);
    const pSuccess = clamp(0.6 + 0.45 * from.passing - 0.5 * difficulty + (dom(side) - 0.5) * 0.2, 0.25, 0.97);
    const ok = forceComplete || r.chance(pSuccess);
    const end = abs(side, na, ny);
    const start = abs(side, a, y);
    emit({
      type: "pass",
      side,
      playerId: from.id,
      recipientId: ok ? to.id : undefined,
      x: start.x,
      y: start.y,
      endX: end.x,
      endY: end.y,
      outcome: ok ? "complete" : "incomplete",
      distance: r1(distance),
      speedKmh: r1(clamp(24 + distance * 1.35 + r.normal(0, 4), 15, 110)),
      difficulty: r2(difficulty),
      underPressure,
    });
    t += Math.round(900 + distance * 60 + r.int(300, 1400));
    return ok;
  }

  function shoot(side: Side, shooter: Player, a: number, y: number, forced?: Outcome, detail?: string): Outcome {
    const dist = Math.hypot(L - a, Math.abs(y - 34));
    const xg = forced === "goal" && detail === "Penalty" ? 0.78 : clamp(0.75 * Math.exp(-dist / 9) * (1 - Math.abs(y - 34) / 40), 0.01, 0.7);
    let outcome: Outcome = forced ?? "off_target";
    if (!forced) {
      const roll = r.next();
      const onTarget = 0.18 + shooter.finishing * 0.2;
      outcome = roll < onTarget ? "saved" : roll < onTarget + 0.25 ? "blocked" : "off_target";
    }
    emit({
      type: "shot",
      side,
      playerId: shooter.id,
      ...abs(side, a, y),
      outcome,
      xg: r2(xg),
      distance: r1(dist),
      speedKmh: r1(clamp(r.normal(76 + shooter.finishing * 26, 8), 45, 128)),
      detail,
    });
    t += r.int(2000, 4000);
    return outcome;
  }

  // ---- Main loop ----

  let ball = kickoff("home");
  const firstKick: Side = "home";

  while (true) {
    tickTelemetry();

    if (period === 1 && t >= P2_START) {
      emit({ type: "half_time" });
      period = 2;
      ball = kickoff(other(firstKick));
      continue;
    }
    if (period === 2 && t >= END) {
      if (goals.length) {
        // Never drop a scripted goal: play it in the last seconds of added time.
        ball = scriptedGoal(ball, goals.shift()!);
        continue;
      }
      emit({ type: "full_time" });
      break;
    }

    const nextScripted = Math.min(goals[0]?.t ?? Infinity, cards[0]?.t ?? Infinity, subs[0]?.t ?? Infinity);
    if (t >= nextScripted) {
      if (goals[0]?.t === nextScripted) ball = scriptedGoal(ball, goals.shift()!);
      else if (cards[0]?.t === nextScripted) ball = scriptedCard(ball, cards.shift()!);
      else ball = scriptedSub(ball, subs.shift()!);
      continue;
    }

    const s = ball.side;
    const d = dom(s);
    const { a, y, holder } = ball;
    const opp = other(s);

    // Opponents press harder in their own third and when they are on top.
    const underPressure = r.chance(clamp(0.1 + 0.25 * (a / L) + (0.5 - d) * 0.3, 0.05, 0.6));
    if (underPressure) {
      const presser = r.pick(byRole(opp, a > 60 ? DEFENDERS : a > 30 ? MIDS : ATTACK));
      emit({ type: "pressure", side: opp, playerId: presser.id, ...abs(s, a, y) });
      t += r.int(300, 900);
      if (r.chance(0.04)) {
        // Pressing foul: free kick, same side keeps the ball.
        emit({ type: "foul", side: opp, playerId: presser.id, ...abs(s, a, y) });
        t += r.int(15, 35) * 1000;
        continue;
      }
    }

    const inRange = a > 78 && Math.abs(y - 34) < 22;
    // Tuned towards top-flight averages: about 25 shots, 9 on target and 2.7 xG per match.
    const shotProb = inRange ? (0.025 + ((a - 78) / 27) * 0.1) * (0.7 + d * 0.6) : 0;

    if (holder.position !== "GK" && r.chance(shotProb)) {
      const outcome = shoot(s, holder, a, y);
      if ((outcome === "saved" && r.chance(0.35)) || (outcome === "blocked" && r.chance(0.45))) {
        const cy = r.chance(0.5) ? 1 : 67;
        const taker = r.pick(byRole(s, ["LW", "RW", "CM", "AM"]));
        emit({ type: "corner", side: s, playerId: taker.id, ...abs(s, 105, cy) });
        t += r.int(20, 40) * 1000;
        ball = { side: s, a: 104, y: cy, holder: taker };
      } else if (outcome === "blocked") {
        ball = possessionChange(ball, opp, r.range(12, 25), r.range(15, 53));
      } else {
        t += r.int(15, 30) * 1000; // goal kick or keeper holds
        ball = possessionChange(ball, opp, 6, 34, keeper(opp));
      }
      continue;
    }

    if (holder.position !== "GK" && r.chance(0.18)) {
      // Carry the ball forward.
      const gain = r.range(3, 12);
      if (underPressure && r.chance(0.35)) {
        const tackler = r.pick(byRole(opp, a > 60 ? DEFENDERS : MIDS));
        const foul = r.chance(0.3);
        emit({ type: foul ? "foul" : "tackle", side: opp, playerId: tackler.id, outcome: foul ? undefined : "won", ...abs(s, a, y) });
        t += r.int(1000, 2500);
        if (foul) {
          t += r.int(15, 35) * 1000; // free kick
          continue;
        }
        ball = possessionChange(ball, opp, L - a, W - y, tackler);
        continue;
      }
      const na = Math.min(100, a + gain);
      const ny = clamp(r.normal(y, 5), 2, 66);
      emit({ type: "carry", side: s, playerId: holder.id, ...abs(s, a, y), endX: abs(s, na, ny).x, endY: abs(s, na, ny).y, distance: r1(Math.hypot(na - a, ny - y)) });
      t += r.int(2000, 5000);
      ball = { ...ball, a: na, y: ny };
      continue;
    }

    // Pass.
    const na = clamp(r.normal(a + 4 + d * 8, 12), 2, 100);
    const ny = clamp(r.normal(y, 15), 2, 66);
    const pool = byRole(s, zoneRoles(na)).filter((p) => p.id !== holder.id);
    const to = r.pick(pool.length ? pool : outfield(s).filter((p) => p.id !== holder.id));
    if (pass(s, holder, to, a, y, na, ny, underPressure)) {
      ball = { side: s, a: na, y: ny, holder: to };
    } else {
      const winner = r.pick(byRole(opp, na > 60 ? DEFENDERS : na > 30 ? MIDS : ATTACK));
      emit({ type: r.chance(0.6) ? "interception" : "tackle", side: opp, playerId: winner.id, outcome: "won", ...abs(s, na, ny) });
      t += r.int(400, 1200);
      ball = possessionChange(ball, opp, L - na, W - ny, winner);
    }
  }

  return { schema: "roar.synthetic-match/1", generator: GENERATOR, script, home, away, events };
}
