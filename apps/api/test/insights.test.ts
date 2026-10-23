import assert from "node:assert/strict";
import { test } from "node:test";
import { generateMatch, SCRIPTS } from "@inside/matchdata";
import { deliver, hashKey, newApiKey, signWebhook, webhookUrlProblem } from "../src/partners.js";
import { pickSegments, type RecapCandidate } from "../src/recap.js";
import { buildUp, factsOf, ruleExplanation } from "../src/tactics.js";

// ---- Tactics ----

const match = generateMatch(SCRIPTS[0]!);
const goals = match.events.filter((e) => e.type === "shot" && e.outcome === "goal");

test("every synthetic goal has a build-up with facts from the event log", () => {
  assert.ok(goals.length > 0);
  for (const g of goals) {
    const b = buildUp(match, g.id);
    assert.ok(b, `no build-up for ${g.id}`);
    assert.equal(b.side, g.side);
    assert.ok(b.playersInvolved.length >= 1);
    assert.ok(b.durationS >= 0 && b.durationS <= 45);
    assert.ok(factsOf(b).length >= 5);
    for (const depth of ["beginner", "expert"] as const) assert.ok(ruleExplanation(b, depth).points.length >= 3);
  }
});

test("non-goal events have no build-up", () => {
  const pass = match.events.find((e) => e.type === "pass")!;
  assert.equal(buildUp(match, pass.id), null);
  assert.equal(buildUp(match, "missing"), null);
});

// ---- Recaps ----

const c = (id: string, minute: number, kind: string, extra: Partial<RecapCandidate> = {}): RecapCandidate => ({
  id, minute, kind, title: id, promoted: false, media: null, official: false, ...extra,
});

test("recap segments fill the length exactly and play in match order", () => {
  const pool = [c("a", 80, "CROWD"), c("b", 10, "GOAL"), c("c", 50, "CELEBRATION"), c("d", 30, "FOUL"), c("e", 60, "PLAYER"), c("f", 5, "OTHER")];
  for (const length of [15, 30, 60] as const) {
    const s = pickSegments(pool, length);
    assert.equal(s.reduce((n, x) => n + x.seconds, 0), length);
    assert.deepEqual(s.map((x) => x.minute), [...s.map((x) => x.minute)].sort((x, y) => (x ?? 0) - (y ?? 0)));
  }
  assert.equal(pickSegments(pool, 15).length, 3);
  assert.ok(pickSegments(pool, 15).some((x) => x.id === "b"), "goals rank first");
});

test("an official goal is replaced by the fans' Moment of the same minute", () => {
  const s = pickSegments([c("official", 23, "GOAL", { official: true }), c("fans", 23, "GOAL")], 30);
  assert.deepEqual(s.map((x) => x.id), ["fans"]);
  assert.equal(pickSegments([], 30).length, 0);
});

// ---- Partners ----

test("API keys are random and stored as a stable hash", () => {
  const a = newApiKey();
  assert.match(a, /^roar_pk_/);
  assert.notEqual(a, newApiKey());
  assert.equal(hashKey(a), hashKey(a));
  assert.equal(hashKey(a).length, 64);
});

test("webhook URLs must be https outside local development", () => {
  assert.equal(webhookUrlProblem("https://studio.example/hooks", true), null);
  assert.ok(webhookUrlProblem("http://studio.example/hooks", true));
  assert.ok(webhookUrlProblem("http://localhost:9000/hook", true));
  assert.equal(webhookUrlProblem("http://localhost:9000/hook", false), null);
  assert.ok(webhookUrlProblem("https://user:pw@studio.example/", true));
  assert.ok(webhookUrlProblem("not a url", false));
});

test("webhooks are signed over timestamp and body, and retried once on 5xx", async () => {
  const calls: { headers: Record<string, string>; body: string }[] = [];
  const fake = (async (_url: string, init: RequestInit) => {
    calls.push({ headers: init.headers as Record<string, string>, body: String(init.body) });
    return new Response(null, { status: calls.length === 1 ? 503 : 204 });
  }) as typeof fetch;
  const result = await deliver({ url: "https://p.example/h", secret: "s3cret", event: "moment.published", payload: { id: "m1" } }, fake);
  assert.deepEqual(result, { ok: true, status: 204, attempts: 2 });
  const { headers, body } = calls[1]!;
  assert.equal(headers["x-roar-signature"], signWebhook("s3cret", headers["x-roar-timestamp"]!, body));
  assert.equal(JSON.parse(body).data.id, "m1");
});
