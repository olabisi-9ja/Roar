// Runs the AI agents after an upload or SOS lands. In-process for now.
// ponytail: move to workers/ behind Event Hubs once uploads outgrow one API instance.
import { stat, readFile } from "node:fs/promises";
import { analyseMoment, assessIncident, aiEnabled, aiModel, tellMoment, type MatchContext } from "@inside/ai";
import { prisma, type EventType, type Severity } from "@inside/database";
import { getMatch } from "./replay.js";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"] as const);
const MAX_IMAGE = 5 * 1024 * 1024; // Claude's per-image limit
// Same-event clips from different fans join one Moment if they arrive within this window (SPEC: ~30s).
const CLUSTER_MS = 60_000;
const MIN_CONFIDENCE = 0.6;
const SEVERITY_RANK: Record<Severity, number> = { NORMAL: 0, MEDIUM: 1, CRITICAL: 2 };

async function matchContext(matchId: string): Promise<MatchContext | null> {
  const d = await getMatch(matchId);
  if (!d) return null;
  const f = d.fixture;
  const team = (side: "home" | "away") => (side === "home" ? f.home.name : f.away.name);
  return {
    home: f.home.name,
    away: f.away.name,
    score: f.score ? `${f.score[0]}-${f.score[1]}` : "v",
    minute: f.minute,
    recentEvents: d.events
      .filter((e) => f.minute == null || e.minute >= f.minute - 5)
      .slice(-8)
      .map((e) => `${e.minute}' ${e.type} ${e.detail}${e.player ? ` ${e.player}` : ""} (${team(e.team)})`),
  };
}

/** Moment Analyst → Moment Matcher → Highlight Curator → Storyteller. Leaves AI Moments as drafts for a moderator. */
export async function processUpload(mediaId: string, path: string, mimetype: string) {
  if (!aiEnabled()) return;
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) return;
  const match = await matchContext(media.matchId);
  if (!match) return;

  const imageType = [...IMAGE_TYPES].find((t) => t === mimetype);
  const image = media.type === "PHOTO" && imageType && (await stat(path)).size <= MAX_IMAGE
    ? { data: await readFile(path), mediaType: imageType }
    : undefined;
  const a = await analyseMoment({ match, section: media.section, image, isVideo: media.type === "VIDEO" });
  if (!a) return;
  const eventType = a.eventType.toUpperCase() as EventType;
  const confidence = Math.min(1, Math.max(0, a.confidence));
  await prisma.aiAnalysis.create({
    data: {
      mediaId, eventType, confidence, description: a.description, playerIds: a.players,
      severity: a.severity.toUpperCase() as Severity, labels: a.tags.slice(0, 5), model: aiModel(),
    },
  });

  // Only clips shared with the match community, about the match, become Moments.
  if (media.audience !== "community" || eventType === "SECURITY" || eventType === "OTHER" || confidence < MIN_CONFIDENCE) return;

  // Moment Matcher: same match, same kind of event, close in time → another angle of the same Moment.
  // ponytail: two uploads racing can each start a Moment. Fine at demo scale; a per-match lock fixes it.
  const existing = await prisma.moment.findFirst({
    where: { matchId: media.matchId, eventType, source: "ai", status: { not: "REMOVED" }, createdAt: { gte: new Date(Date.now() - CLUSTER_MS) } },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    await prisma.momentMedia.create({ data: { momentId: existing.id, mediaId, rank: 0 } });
    await curate(existing.id);
    return;
  }

  const story = await tellMoment({ match, eventType: a.eventType, angles: 1, analyses: [a.description] }).catch(() => null);
  const moment = await prisma.moment.create({
    data: {
      matchId: media.matchId, eventType, timestamp: media.capturedAt, minute: match.minute,
      title: (story?.title ?? a.description).slice(0, 80), description: (story?.description ?? a.description).slice(0, 300),
      confidence, playerIds: a.players, source: "ai", status: "PROCESSING",
      bestMediaId: mediaId, media: { create: { mediaId, rank: 1 } },
    },
  });
  return moment.id;
}

/** Highlight Curator: rank a Moment's angles by analysis confidence; the best one fronts the Moment. */
async function curate(momentId: string) {
  const moment = await prisma.moment.findUniqueOrThrow({ where: { id: momentId } });
  const links = await prisma.momentMedia.findMany({ where: { momentId }, include: { media: { include: { analysis: true } } } });
  // A live Moment must keep a moderator-approved clip up front; unapproved angles wait their turn.
  const live = (l: (typeof links)[number]) => (moment.status === "PUBLISHED" && l.media.status !== "APPROVED" ? 0 : 1);
  // ponytail: confidence-only ranking. Add sharpness/stability from Video Indexer when it's wired in.
  links.sort((x, y) => live(y) - live(x) || (y.media.analysis?.confidence ?? 0) - (x.media.analysis?.confidence ?? 0));
  await prisma.$transaction([
    ...links.map((l, i) => prisma.momentMedia.update({ where: { momentId_mediaId: { momentId, mediaId: l.mediaId } }, data: { rank: i + 1 } })),
    prisma.moment.update({ where: { id: momentId }, data: { bestMediaId: links[0]!.mediaId, confidence: links[0]!.media.analysis?.confidence ?? 0 } }),
  ]);
}

/** Safety Analyst: re-triage a fresh SOS. Never lowers the rule-based severity: a missed emergency costs more than a false alarm. */
export async function triageIncident(incidentId: string) {
  if (!aiEnabled()) return;
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) return;
  const seat = incident.section?.split(" · ")[0];
  const nearbyReports = seat
    ? await prisma.incident.count({
        where: { matchId: incident.matchId, id: { not: incident.id }, section: { startsWith: seat }, status: { in: ["OPEN", "ACKNOWLEDGED", "ASSIGNED"] }, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } },
      })
    : 0;
  const match = await getMatch(incident.matchId);
  const s = await assessIncident({ type: incident.type, section: incident.section, description: incident.description, minute: match?.fixture.minute ?? null, nearbyReports });
  if (!s) return;
  const severity = SEVERITY_RANK[s.severity] > SEVERITY_RANK[incident.severity] ? s.severity : incident.severity;
  await prisma.incident.update({ where: { id: incident.id }, data: { type: s.type, severity, confidence: Math.min(1, Math.max(0, s.confidence)) } });
}
