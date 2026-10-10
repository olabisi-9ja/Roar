// Self-check: every scripted match generates, is deterministic, and passes the realism checks.
// Run: npm run check -w @inside/matchdata
import assert from "node:assert/strict";
import { analyse, generateMatch, SCRIPTS, teamStats, validateMatch, score } from "./index.js";

for (const script of SCRIPTS) {
  const a = generateMatch(script);
  const b = generateMatch(script);
  assert.deepEqual(a.events, b.events, `${script.id}: same seed must give the same match`);

  const { ok, problems } = validateMatch(a);
  const s = score(a.events);
  const stats = Object.fromEntries(teamStats(a.events).map((x) => [x.label, `${x.home}-${x.away}`]));
  const counts = a.events.reduce<Record<string, number>>((m, e) => ((m[e.type] = (m[e.type] ?? 0) + 1), m), {});
  console.log(`${script.id} ${script.title}: ${s.home}-${s.away}, ${a.events.length} events`, counts);
  console.log("   ", stats);
  assert.ok(ok, `${script.id} failed realism checks:\n  ${problems.join("\n  ")}`);

  // Scripted goals land on their minute.
  const goalMinutes = a.events.filter((e) => e.type === "shot" && e.outcome === "goal").map((e) => e.minute);
  assert.deepEqual(goalMinutes, script.goals.map((g) => g.minute), `${script.id}: goal minutes`);

  // ---- Stats engine ----
  const ins = analyse(a, a.events);
  const ids = new Set(a.events.map((e) => e.id));
  for (const m of ins.moments) for (const id of m.evidence.eventIds) assert.ok(ids.has(id), `${script.id}: moment ${m.id} cites unknown event ${id}`);
  assert.equal(ins.moments.filter((m) => m.kind === "goal").length, script.goals.length, `${script.id}: one goal moment per goal`);
  for (const p of ins.timeline) {
    assert.ok(p.homeControl >= 0 && p.homeControl <= 100 && p.chaos >= 0 && p.chaos <= 100 && Math.abs(p.momentum) <= 100, `${script.id}: index out of range at ${p.minute}'`);
  }
  assert.ok(ins.moments.filter((m) => m.kind === "state_change").length <= 20, `${script.id}: too many state changes`);
  assert.ok(ins.moments.filter((m) => m.kind === "distance").length <= 3, `${script.id}: distance moments capped`);
  // Same numbers as the team stats module.
  const acc = Object.fromEntries(teamStats(a.events).map((x) => [x.label, x]))["Pass accuracy"]!;
  assert.equal(ins.passQuality.home.accuracy, acc.home, `${script.id}: pass accuracy agrees`);
  // Works on a partial match (live), and only cites what has happened.
  const half = a.events.slice(0, Math.floor(a.events.length / 2));
  const live = analyse(a, half);
  assert.ok(live.moments.every((m) => m.t <= half.at(-1)!.t), `${script.id}: no moments from the future`);
}

// The engine reads the storyline: in rl-01 Kestrel Park (away) dominate the first half and Northgate (home) the second.
{
  const d = generateMatch(SCRIPTS.find((s) => s.id === "rl-01")!);
  const tl = analyse(d, d.events).timeline;
  const avg = (xs: number[]) => xs.reduce((n, x) => n + x, 0) / xs.length;
  const first = avg(tl.filter((p) => p.period === 1).map((p) => p.homeControl));
  const second = avg(tl.filter((p) => p.period === 2).map((p) => p.homeControl));
  assert.ok(first < 45 && second > first + 8, `rl-01 control should swing to the home side: first ${first.toFixed(0)}, second ${second.toFixed(0)}`);
}

console.log("match data: all checks passed");
