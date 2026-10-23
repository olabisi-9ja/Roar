// Fan-facing AI features on top of published Moments: translation, tactics explanations, recaps, and the
// partner webhooks. Every feature degrades to rule-based English when AI is off.
import { aiEnabled, explainTactics, isLanguage, writeRecap, type Depth, type Language } from "@inside/ai";
import { prisma } from "@inside/database";
import type { CuratedMoment } from "@inside/types";
import { matchContext } from "./agents.js";
import { toCurated } from "./curated.js";
import { translate } from "./i18n.js";
import { deliver } from "./partners.js";
import { pickSegments, type RecapCandidate, type RecapLength } from "./recap.js";
import { getDataset, getMatch } from "./replay.js";
import { buildUp, factsOf, ruleExplanation } from "./tactics.js";

export async function publishedMoments(matchId: string): Promise<CuratedMoment[]> {
  const moments = await prisma.moment.findMany({
    where: { matchId, status: "PUBLISHED" },
    include: { bestMedia: { select: { id: true, type: true } } },
    orderBy: [{ promoted: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  return moments.map(toCurated);
}

/** Titles and descriptions in the fan's language. Untranslatable text stays in English. */
export async function localizeMoments(moments: CuratedMoment[], lang: Language): Promise<CuratedMoment[]> {
  if (lang === "en" || !moments.length) return moments;
  const texts = moments.flatMap((m) => [m.title, m.description]);
  const out = await translate(texts, lang);
  return moments.map((m, i) => ({ ...m, title: out[2 * i]!, description: out[2 * i + 1]! }));
}

/** Absolute media URLs for partners outside the fan web app's origin (PUBLIC_WEB_URL). */
export function absoluteMedia<T extends { url: string }>(media: T | null): T | null {
  const base = process.env["PUBLIC_WEB_URL"]?.replace(/\/+$/, "");
  return base && media ? { ...media, url: `${base}${media.url}` } : media;
}

export const absolutize = (moment: CuratedMoment): CuratedMoment => ({ ...moment, media: absoluteMedia(moment.media) });

// ---- Tactics ----

const tacticsCache = new Map<string, { headline: string; points: string[]; source: "ai" | "rules" }>();

/** null: not a goal (or not one that has happened yet in the replay). */
export async function tacticsFor(matchId: string, eventId: string, depth: Depth, lang: Language) {
  const d = getDataset(matchId);
  const detail = await getMatch(matchId);
  if (!d || !detail?.events.some((e) => e.id === eventId)) return null;
  const b = buildUp(d, eventId);
  if (!b) return null;
  const cacheKey = `${eventId}|${depth}|${lang}`;
  const facts = { passes: b.passes, players: b.playersInvolved.length, progressM: b.progressM, durationS: b.durationS, xg: b.shot.xg, startZone: b.startZone };
  const hit = tacticsCache.get(cacheKey);
  if (hit) return { eventId, depth, lang, ...hit, facts };

  let result: { headline: string; points: string[]; source: "ai" | "rules" } | null = null;
  if (aiEnabled()) {
    const match = await matchContext(matchId);
    const ai = match ? await explainTactics({ match, facts: factsOf(b), depth, lang }).catch(() => null) : null;
    if (ai?.points.length) result = { headline: ai.headline, points: ai.points.slice(0, 4), source: "ai" };
  }
  if (!result) {
    const rules = ruleExplanation(b, depth);
    const [headline, ...points] = await translate([rules.headline, ...rules.points], lang);
    result = { headline: headline!, points, source: "rules" };
  }
  // Rule-based text is only cached once it is in the requested language, so a later AI recovery still applies.
  if (result.source === "ai" || lang === "en") tacticsCache.set(cacheKey, result);
  return { eventId, depth, lang, ...result, facts };
}

// ---- Recaps ----

const recapCache = new Map<string, { at: number; value: Awaited<ReturnType<typeof buildRecap>> }>();
const RECAP_TTL_MS = 60_000;

export async function recapFor(matchId: string, length: RecapLength, lang: Language) {
  const key = `${matchId}|${length}|${lang}`;
  const hit = recapCache.get(key);
  if (hit && Date.now() - hit.at < RECAP_TTL_MS) return hit.value;
  const value = await buildRecap(matchId, length, lang);
  if (value) recapCache.set(key, { at: Date.now(), value });
  return value;
}

async function buildRecap(matchId: string, length: RecapLength, lang: Language) {
  const detail = await getMatch(matchId);
  if (!detail) return null;
  const f = detail.fixture;
  const moments = await publishedMoments(matchId);
  const candidates: RecapCandidate[] = [
    ...moments.map((m) => ({ id: m.id, minute: m.minute, kind: m.kind, title: m.title, promoted: m.promoted, media: m.media, official: false })),
    ...detail.events.filter((e) => e.type === "Goal").map((e) => ({
      id: e.id, minute: e.minute, kind: "GOAL", promoted: false, media: null, official: true,
      title: `${e.player ?? (e.team === "home" ? f.home.name : f.away.name)} scores for ${e.team === "home" ? f.home.name : f.away.name}`,
    })),
  ];
  const segments = pickSegments(candidates, length);
  const score = f.score ? `${f.home.short} ${f.score[0]}–${f.score[1]} ${f.away.short}` : `${f.home.short} v ${f.away.short}`;

  let headline = `${score}: the ${length}-second recap`;
  let lines = segments.map((s) => s.title);
  let source: "ai" | "rules" = "rules";
  if (segments.length && aiEnabled()) {
    const match = await matchContext(matchId);
    const ai = match
      ? await writeRecap({ match, seconds: length, segments: segments.map((s) => ({ minute: s.minute, seconds: s.seconds, what: s.title })), lang }).catch(() => null)
      : null;
    if (ai && ai.lines.length === segments.length) {
      headline = ai.headline;
      lines = ai.lines;
      source = "ai";
    }
  }
  if (source === "rules") [headline = headline, ...lines] = await translate([headline, ...lines], lang);

  return {
    matchId, length, lang, source, headline, score,
    segments: segments.map((s, i) => ({ id: s.id, minute: s.minute, kind: s.kind, official: s.official, seconds: s.seconds, line: lines[i]!, media: s.media })),
  };
}

// ---- Partner webhooks ----

/** Tell every active partner with a webhook that a Moment went live, in the partner's language. */
export async function notifyPartners(moment: CuratedMoment, log: (msg: string, extra?: object) => void) {
  const partners = await prisma.partner.findMany({ where: { active: true, webhookUrl: { not: null }, webhookSecret: { not: null } } });
  await Promise.all(partners.map(async (p) => {
    const lang: Language = isLanguage(p.language) ? p.language : "en";
    const [localized] = await localizeMoments([moment], lang);
    const result = await deliver({ url: p.webhookUrl!, secret: p.webhookSecret!, event: "moment.published", payload: absolutize(localized!) });
    log("Partner webhook delivered", { partner: p.id, moment: moment.id, ...result });
  }));
}
