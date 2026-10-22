import { randomUUID, timingSafeEqual } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { prisma, type IncidentStatus, type IncidentType, type Severity } from "@inside/database";
import { aiStatus } from "@inside/ai";
import type { CuratedMoment, MediaItem } from "@inside/types";
import type { Fixture } from "@inside/types";
import { processUpload, triageIncident } from "./agents.js";
import { isActorId, parseCookie } from "./cookies.js";
import { hasValidSignature } from "./file-signature.js";
import { canTransitionIncident, INCIDENT_STATUSES, severityForReport } from "./incident-rules.js";
import { pruneBuckets, take } from "./limits.js";
import { cacheControlFor, mediaVisibility } from "./media-policy.js";
import { getDataset, getInsights, getMatch, listMatches, restartMatch, visibleEvents } from "./replay.js";
import { mediaStore } from "./storage.js";

// TRUST_PROXY is a hop count (Container Apps ingress = 1). "true" trusts every hop, which lets a client
// spoof request.ip via X-Forwarded-For and dodge the rate limits, so only use it behind a proxy that overwrites the header.
const TRUST_PROXY = process.env["TRUST_PROXY"];
const TRUSTED_HOPS = Number(TRUST_PROXY) || 0;
const app = Fastify({ logger: true, trustProxy: TRUST_PROXY === "true" || ((_address: string, hop: number) => hop < TRUSTED_HOPS) });
// Staging area for in-flight uploads. Durable files live in the media store (disk or Azure Blob).
const UPLOADS = join(process.cwd(), "uploads");
const MAX_UPLOAD = 100 * 1024 * 1024;
const ACTOR_COOKIE = "roar_actor";
const SECURE_COOKIES = process.env["NODE_ENV"] === "production" || process.env["FORCE_SECURE_COOKIES"] === "true";

const storedName = (value: string) => {
  const name = value.replace(/^\/uploads\//, "");
  return /^[\w-]+\.[a-z0-9]+$/i.test(name) ? name : null;
};
const contentType = (name: string) =>
  name.endsWith(".mp4") ? "video/mp4" : name.endsWith(".webm") ? "video/webm" : name.endsWith(".png") ? "image/png" : name.endsWith(".webp") ? "image/webp" : name.endsWith(".gif") ? "image/gif" : "image/jpeg";

/** Returns true when the caller is over quota; the 429 response has already been sent. */
function rateLimited(request: FastifyRequest, reply: FastifyReply, scope: string, capacity: number, windowMs: number) {
  pruneBuckets();
  const gate = take(`${scope}:${request.ip}`, capacity, capacity / windowMs);
  if (gate.ok) return false;
  reply.header("Retry-After", String(gate.retryAfter));
  void reply.code(429).send({ error: "Too many requests. Try again shortly." });
  return true;
}

/** The browser's opaque guest identity, if it has one. Never creates a user. */
async function actorFromRequest(request: FastifyRequest) {
  const id = parseCookie(request.headers.cookie, ACTOR_COOKIE);
  if (!isActorId(id)) return null;
  try {
    return await prisma.user.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

/** Read the browser's guest identity, creating one on first write. The id is the DB user id. */
async function actorUser(request: FastifyRequest, reply: FastifyReply) {
  const existing = await actorFromRequest(request);
  if (existing) return existing;
  const user = await prisma.user.create({
    data: { id: randomUUID(), name: "Guest fan", email: `${randomUUID()}@guest.roar.local` },
  });
  reply.header("Set-Cookie", `${ACTOR_COOKIE}=${user.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${SECURE_COOKIES ? "; Secure" : ""}`);
  return user;
}

await app.register(cors, {
  origin: (process.env["CORS_ORIGINS"] ?? "http://localhost:3000").split(","),
});
// One primary media file plus an optional poster frame for video analysis.
await app.register(multipart, { limits: { fileSize: MAX_UPLOAD, files: 2, fields: 10 } });

// Baseline response hardening for every API response.
app.addHook("onSend", async (_request, reply) => {
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("Referrer-Policy", "no-referrer");
});

app.get("/health", async (_request, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", db: "up", stats: "synthetic", ai: aiStatus() };
  } catch {
    return reply.code(503).send({ status: "degraded", db: "down", ai: aiStatus() });
  }
});

// ---- Matches and live stats (synthetic Roar League, replayed live) ----

app.get("/matches", async (_request, reply) => {
  try {
    return await listMatches();
  } catch (err) {
    app.log.error(err);
    return reply.code(502).send({ error: "Live match data is unavailable right now." });
  }
});

app.get<{ Params: { id: string } }>("/matches/:id", async (request, reply) => {
  try {
    const detail = await getMatch(request.params.id);
    if (!detail) return reply.code(404).send({ error: "Match not found." });
    return detail;
  } catch (err) {
    app.log.error(err);
    return reply.code(502).send({ error: "Live match data is unavailable right now." });
  }
});

// Raw event stream for agents and overlays: everything that has happened after `since` (a sequence number).
app.get<{ Params: { id: string }; Querystring: { since?: number; limit?: number } }>(
  "/matches/:id/events",
  { schema: { querystring: { type: "object", additionalProperties: false, properties: { since: { type: "integer", minimum: -1 }, limit: { type: "integer", minimum: 1, maximum: 2000 } } } } },
  async (request, reply) => {
    if (!getDataset(request.params.id)) return reply.code(404).send({ error: "Match not found." });
    const since = request.query.since ?? -1;
    const limit = Math.min(request.query.limit ?? 500, 2000);
    const seen = visibleEvents(request.params.id);
    const events = seen.filter((e) => e.seq > since).slice(0, limit);
    return { events, latestSeq: seen.at(-1)?.seq ?? -1 };
  },
);

// Stats engine output: pass quality, speed, control/chaos/momentum timeline, player lines and detected moments.
app.get<{ Params: { id: string } }>("/matches/:id/insights", async (request, reply) => {
  const insights = getInsights(request.params.id);
  if (!insights) return reply.code(404).send({ error: "Match not found." });
  return insights;
});

// The full synthetic dataset, once a match has finished (no spoilers while it is live).
app.get<{ Params: { id: string } }>("/matches/:id/dataset", async (request, reply) => {
  const d = getDataset(request.params.id);
  if (!d) return reply.code(404).send({ error: "Match not found." });
  if (visibleEvents(request.params.id).length < d.events.length) return reply.code(409).send({ error: "Match still in progress." });
  return d;
});

// ---- Shared helpers for writes ----

// Provider fixtures live outside our DB, so mirror the one we're writing against.
async function ensureMatch(fixtureId: string) {
  const detail = await getMatch(fixtureId);
  if (!detail) return null;
  const f: Fixture = detail.fixture;
  const status = f.status === "LIVE" ? "LIVE" : f.status === "FINISHED" ? "FINISHED" : "SCHEDULED";
  const data = {
    homeTeam: f.home.name,
    awayTeam: f.away.name,
    homeScore: f.score?.[0] ?? 0,
    awayScore: f.score?.[1] ?? 0,
    status,
    startTime: new Date(f.kickoff),
  } as const;
  return prisma.match.upsert({ where: { id: f.id }, create: { id: f.id, ...data }, update: data });
}

// ---- SOS incidents ----

const INCIDENT_TYPES = ["MEDICAL", "SECURITY", "FIRE", "OVERCROWDING", "OTHER"] as const;

app.post<{
  Body: { matchId: string; type: IncidentType; section: string; row?: string; description?: string };
}>(
  "/incidents",
  {
    schema: {
      body: {
        type: "object",
        required: ["matchId", "type", "section"],
        additionalProperties: false,
        properties: {
          matchId: { type: "string", maxLength: 40 },
          type: { type: "string", enum: [...INCIDENT_TYPES] },
          section: { type: "string", minLength: 1, maxLength: 10 },
          row: { type: "string", maxLength: 10 },
          description: { type: "string", maxLength: 500 },
        },
      },
    },
  },
  async (request, reply) => {
    if (rateLimited(request, reply, "incidents", 6, 5 * 60_000)) return reply;
    const { matchId, type, section, row, description } = request.body;
    const match = await ensureMatch(matchId);
    if (!match) return reply.code(404).send({ error: "Match not found." });
    const user = await actorUser(request, reply);
    const seat = row ? `${section} · Row ${row}` : section;
    // Double taps and shaky hands must not create a second incident for the same seat and type.
    const recent = await prisma.incident.findFirst({
      where: { matchId: match.id, section: seat, type, createdAt: { gte: new Date(Date.now() - 2 * 60_000) } },
      orderBy: { createdAt: "desc" },
    });
    if (recent) {
      return reply.code(200).send({ id: recent.id, status: recent.status, severity: recent.severity, createdAt: recent.createdAt, duplicate: true });
    }
    // Rule-based severity answers instantly; the Safety Analyst agent refines it a moment later.
    const severity: Severity = severityForReport(type);
    const incident = await prisma.incident.create({
      data: {
        matchId: match.id,
        reportedById: user.id,
        type,
        severity,
        section: seat,
        description: description ?? null,
      },
    });
    void triageIncident(incident.id).catch((err) => app.log.error(err, "Safety Analyst failed"));
    return reply.code(201).send({ id: incident.id, status: incident.status, severity: incident.severity, createdAt: incident.createdAt });
  },
);

// Reading incidents (seat locations, reports) is security-staff only: see /admin/incidents below.

// ---- Media upload ----

const AUDIENCES = new Set(["community", "me", "security"]);

const VIDEO_TYPES = new Set(["video/webm", "video/mp4"]);
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const extensionFor = (mimetype: string) => ({ "video/mp4": ".mp4", "video/webm": ".webm", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" })[mimetype] ?? ".jpg";

type StoredUpload = { fieldname: "file" | "poster"; name: string; path: string; mimetype: string };

app.post("/media", async (request, reply) => {
  if (!request.isMultipart()) return reply.code(415).send({ error: "Upload must be multipart/form-data." });
  if (rateLimited(request, reply, "media", 12, 10 * 60_000)) return reply;
  const files: StoredUpload[] = [];
  const fields: Record<string, string> = {};
  let rejected: { code: number; message: string } | null = null;
  const cleanup = () => Promise.all(files.map((f) => unlink(f.path).catch(() => undefined)));

  try {
    // Read fields and files in one pass. Fields are sent before files by the web client, but we do not depend on order.
    for await (const part of request.parts()) {
      if (part.type === "field") {
        fields[part.fieldname] = String(part.value);
        continue;
      }
      const fieldname = part.fieldname;
      if (fieldname !== "file" && fieldname !== "poster") {
        part.file.resume();
        continue;
      }
      if (files.some((f) => f.fieldname === fieldname)) {
        part.file.resume();
        rejected ??= { code: 400, message: `Only one ${fieldname} file is allowed.` };
        continue;
      }
      const mimetype = part.mimetype.split(";")[0]!.toLowerCase();
      const kind = fieldname === "file" ? (VIDEO_TYPES.has(mimetype) ? "VIDEO" : PHOTO_TYPES.has(mimetype) ? "PHOTO" : null) : (PHOTO_TYPES.has(mimetype) ? "PHOTO" : null);
      if (!kind) {
        part.file.resume();
        rejected ??= { code: 415, message: fieldname === "poster" ? "Poster frames must be images." : "Only photos and videos can be uploaded." };
        continue;
      }
      await mkdir(UPLOADS, { recursive: true });
      const name = `${randomUUID()}${extensionFor(mimetype)}`;
      const path = join(UPLOADS, name);
      // Stream to a .part file, then rename: a dropped connection never leaves a half-file in place.
      const temp = `${path}.part`;
      try {
        await pipeline(part.file, createWriteStream(temp));
        await rename(temp, path);
      } catch (error) {
        await unlink(temp).catch(() => undefined);
        throw error;
      }
      if (!(await hasValidSignature(path, mimetype))) {
        await unlink(path).catch(() => undefined);
        rejected ??= { code: 415, message: `The ${fieldname === "file" ? "file" : "poster"} content does not match its declared type.` };
        continue;
      }
      files.push({ fieldname, name, path, mimetype });
      if (part.file.truncated) {
        rejected ??= { code: 413, message: "File is larger than 100 MB." };
        break;
      }
    }
  } catch (error) {
    await cleanup();
    const message = error instanceof Error ? error.message : "";
    if (/file.*(size|large)|limit/i.test(message)) return reply.code(413).send({ error: "File is larger than 100 MB." });
    throw error;
  }

  if (rejected) {
    await cleanup();
    return reply.code(rejected.code).send({ error: rejected.message });
  }

  const primary = files.find((f) => f.fieldname === "file");
  let poster = files.find((f) => f.fieldname === "poster");
  if (!primary) {
    await cleanup();
    return reply.code(400).send({ error: "No file uploaded." });
  }

  const kind = VIDEO_TYPES.has(primary.mimetype) ? "VIDEO" : "PHOTO";
  const matchId = fields["matchId"] ?? "";
  const section = (fields["section"] ?? "").slice(0, 10) || null;
  const audience = fields["audience"] ?? "community";
  if (!AUDIENCES.has(audience)) {
    await cleanup();
    return reply.code(400).send({ error: "Unknown audience." });
  }
  if (!matchId) {
    await cleanup();
    return reply.code(400).send({ error: "matchId is required." });
  }
  if (kind === "PHOTO" && poster) {
    await unlink(poster.path).catch(() => undefined);
    poster = undefined;
  }

  const match = await ensureMatch(matchId);
  if (!match) {
    await cleanup();
    return reply.code(404).send({ error: "Match not found." });
  }

  // Move the validated files into durable storage before writing the media row.
  try {
    await mediaStore.put(primary.name, primary.path);
    if (poster) await mediaStore.put(poster.name, poster.path);
  } catch (error) {
    await mediaStore.remove(primary.name).catch(() => undefined);
    await cleanup();
    throw error;
  }

  let media;
  try {
    const user = await actorUser(request, reply);
    media = await prisma.media.create({
      data: {
        userId: user.id,
        matchId: match.id,
        blobUrl: `/uploads/${primary.name}`,
        // For videos this is the poster frame used by the analyst (and available for thumbnails later).
        thumbnailUrl: poster ? `/uploads/${poster.name}` : null,
        type: kind,
        capturedAt: new Date(),
        section,
        audience,
      },
    });
  } catch (error) {
    await cleanup();
    throw error;
  }

  void processUpload(media.id, primary.name, primary.mimetype, poster?.name)
    .catch((err) => app.log.error(err, "Moment agents failed"));
  return reply.code(201).send({ id: media.id, status: media.status, type: media.type, audience: media.audience, aiStatus: media.aiStatus });
});

// ---- Curated moments: audience, crowd and celebration moments on the For You feed ----

const KINDS = ["CROWD", "CELEBRATION", "GOAL", "PLAYER", "FOUL", "OTHER"] as const;
const mediaUrl = (id: string) => `/api/media/${id}/file`;

function toCurated(m: {
  id: string; matchId: string; eventType: string; title: string; description: string; minute: number | null;
  promoted: boolean; source: string; status: string; createdAt: Date; bestMedia: { id: string; type: string } | null;
}): CuratedMoment {
  return {
    id: m.id, matchId: m.matchId, kind: m.eventType as CuratedMoment["kind"], title: m.title, description: m.description,
    minute: m.minute, promoted: m.promoted, source: m.source === "ai" ? "ai" : "editor", status: m.status as CuratedMoment["status"],
    media: m.bestMedia ? { id: m.bestMedia.id, url: mediaUrl(m.bestMedia.id), type: m.bestMedia.type as "PHOTO" | "VIDEO" } : null,
    createdAt: m.createdAt.toISOString(),
  };
}

// Public: published moments for the fan feed.
app.get<{ Params: { id: string } }>("/matches/:id/moments", async (request) => {
  const moments = await prisma.moment.findMany({
    where: { matchId: request.params.id, status: "PUBLISHED" },
    include: { bestMedia: { select: { id: true, type: true } } },
    orderBy: [{ promoted: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  return { moments: moments.map(toCurated) };
});

// Upload progress and AI status for the capture screen. Media bytes are served separately with the ACL below.
app.get<{ Params: { id: string } }>("/media/:id/status", async (request, reply) => {
  const media = await prisma.media.findUnique({
    where: { id: request.params.id },
    include: {
      analysis: true,
      momentLinks: {
        orderBy: { rank: "asc" },
        take: 1,
        include: { moment: { select: { id: true, status: true, title: true } } },
      },
    },
  });
  if (!media) return reply.code(404).send({ error: "Media not found." });
  // Analysis text for private/security clips stays server-side; those audiences are never sent to AI anyway.
  const publicAnalysis = media.audience === "community" && media.analysis
    ? {
        eventType: media.analysis.eventType,
        confidence: media.analysis.confidence,
        description: media.analysis.description,
        severity: media.analysis.severity,
        safetyRelevant: media.analysis.safetyRelevant,
        labels: media.analysis.labels,
      }
    : null;
  reply.header("Cache-Control", "no-store");
  return {
    id: media.id,
    type: media.type,
    status: media.status,
    audience: media.audience,
    aiStatus: media.aiStatus,
    aiError: media.aiStatus === "FAILED" ? "AI analysis failed." : media.aiError,
    aiAttempts: media.aiAttempts,
    aiUpdatedAt: media.aiUpdatedAt,
    analysis: publicAnalysis,
    moment: publicAnalysis ? media.momentLinks[0]?.moment ?? null : null,
  };
});

// Media files: only APPROVED community media is public. Owners can see their own "me" clips, and
// moderators/security staff can preview community or security clips. A short TTL limits removed-clip caching.
app.get<{ Params: { id: string } }>("/media/:id/file", async (request, reply) => {
  const media = await prisma.media.findUnique({ where: { id: request.params.id } });
  if (!media) return reply.code(404).send({ error: "Not found." });
  const actor = await actorFromRequest(request);
  const visibility = mediaVisibility(media, { actorId: actor?.id ?? null, isStaff: isAdmin(request.headers["x-admin-token"]) });
  if (!visibility) return reply.code(404).send({ error: "Not found." });
  const name = storedName(media.blobUrl);
  if (!name) return reply.code(404).send({ error: "Not found." });
  reply.header("Cache-Control", cacheControlFor(visibility));
  reply.header("X-Content-Type-Options", "nosniff");
  try {
    return reply.type(contentType(name)).send(await mediaStore.stream(name));
  } catch {
    return reply.code(404).send({ error: "Not found." });
  }
});

// Poster frame for videos. Same audience rules as the media itself.
app.get<{ Params: { id: string } }>("/media/:id/poster", async (request, reply) => {
  const media = await prisma.media.findUnique({ where: { id: request.params.id } });
  if (!media?.thumbnailUrl) return reply.code(404).send({ error: "Not found." });
  const actor = await actorFromRequest(request);
  const visibility = mediaVisibility(media, { actorId: actor?.id ?? null, isStaff: isAdmin(request.headers["x-admin-token"]) });
  if (!visibility) return reply.code(404).send({ error: "Not found." });
  const name = storedName(media.thumbnailUrl);
  if (!name) return reply.code(404).send({ error: "Not found." });
  reply.header("Cache-Control", cacheControlFor(visibility));
  reply.header("X-Content-Type-Options", "nosniff");
  try {
    return reply.type(contentType(name)).send(await mediaStore.stream(name));
  } catch {
    return reply.code(404).send({ error: "Not found." });
  }
});

// ---- Admin (curation and moderation). ponytail: one shared token until role-based auth (TRD 2.9). ----

function isAdmin(token: unknown) {
  const expected = process.env["ADMIN_TOKEN"];
  if (!expected || typeof token !== "string") return false;
  const given = Buffer.from(token);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length) return false;
  return timingSafeEqual(given, wanted);
}

await app.register(async (admin) => {
  admin.addHook("onRequest", async (request, reply) => {
    // Throttle before comparing the token so a brute-force loop cannot hammer timingSafeEqual.
    if (rateLimited(request, reply, "admin", 300, 60_000)) return;
    if (!isAdmin(request.headers["x-admin-token"])) return reply.code(401).send({ error: "Admin token required." });
  });

  admin.get<{ Querystring: { matchId?: string; status?: string } }>("/admin/incidents", async (request) => {
    const incidents = await prisma.incident.findMany({
      where: {
        ...(request.query.matchId ? { matchId: request.query.matchId } : {}),
        ...(request.query.status && INCIDENT_STATUSES.has(request.query.status) ? { status: request.query.status as IncidentStatus } : {}),
      },
      include: {
        reportedBy: { select: { name: true } },
        media: { select: { mediaId: true } },
        match: { select: { homeTeam: true, awayTeam: true } },
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    return { incidents };
  });

  admin.get<{ Params: { id: string } }>("/admin/incidents/:id", async (request, reply) => {
    const incident = await prisma.incident.findUnique({ where: { id: request.params.id } });
    if (!incident) return reply.code(404).send({ error: "Incident not found." });
    return incident;
  });

  admin.patch<{ Params: { id: string }; Body: { status: IncidentStatus } }>(
    "/admin/incidents/:id",
    { schema: { body: { type: "object", required: ["status"], additionalProperties: false, properties: { status: { type: "string", enum: ["OPEN", "ACKNOWLEDGED", "ASSIGNED", "RESOLVED", "FALSE_POSITIVE"] } } } } },
    async (request, reply) => {
      const existing = await prisma.incident.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.code(404).send({ error: "Incident not found." });
      if (!canTransitionIncident(existing.status, request.body.status)) {
        return reply.code(409).send({ error: `Cannot move an incident from ${existing.status} to ${request.body.status}.` });
      }
      return prisma.incident.update({
        where: { id: request.params.id },
        data: { status: request.body.status },
        include: { reportedBy: { select: { name: true } }, media: { select: { mediaId: true } } },
      });
    },
  );

  // Demo control: restart a match's live replay at a given minute.
  admin.post<{ Params: { id: string }; Body: { minute?: number } }>(
    "/admin/matches/:id/kickoff",
    { schema: { body: { type: "object", additionalProperties: false, properties: { minute: { type: "integer", minimum: 0, maximum: 100 } } } } },
    async (request, reply) => {
      if (!restartMatch(request.params.id, request.body?.minute ?? 0)) return reply.code(404).send({ error: "Match not found." });
      return getMatch(request.params.id);
    },
  );

  admin.get("/admin/ai/status", async () => aiStatus());

  admin.get<{ Querystring: { matchId?: string } }>("/admin/media", async (request) => {
    const media = await prisma.media.findMany({
      where: { ...(request.query.matchId ? { matchId: request.query.matchId } : {}), audience: "community" },
      orderBy: { uploadedAt: "desc" },
      take: 100,
    });
    const items: MediaItem[] = media.map((m) => ({
      id: m.id, matchId: m.matchId, type: m.type, status: m.status, audience: m.audience, section: m.section,
      url: mediaUrl(m.id), uploadedAt: m.uploadedAt.toISOString(),
      aiStatus: m.aiStatus, aiError: m.aiError, aiAttempts: m.aiAttempts,
    }));
    return { media: items };
  });

  // Retry a failed/stuck analysis using the stored media and poster frame. Idempotent at the DB level.
  admin.post<{ Params: { id: string } }>("/admin/media/:id/reanalyze", async (request, reply) => {
    const media = await prisma.media.findUnique({ where: { id: request.params.id } });
    if (!media) return reply.code(404).send({ error: "Media not found." });
    const name = storedName(media.blobUrl);
    if (!name) return reply.code(404).send({ error: "Media file not found." });
    const posterName = media.thumbnailUrl ? storedName(media.thumbnailUrl) : null;
    await prisma.media.update({ where: { id: media.id }, data: { aiStatus: "QUEUED", aiError: null, aiUpdatedAt: new Date() } });
    void processUpload(media.id, name, contentType(name), posterName ?? undefined)
      .catch((err) => app.log.error(err, "Moment agents retry failed"));
    return reply.code(202).send({ id: media.id, aiStatus: "QUEUED" });
  });

  admin.get<{ Querystring: { matchId?: string } }>("/admin/moments", async (request) => {
    const moments = await prisma.moment.findMany({
      where: request.query.matchId ? { matchId: request.query.matchId } : {},
      include: { bestMedia: { select: { id: true, type: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { moments: moments.map(toCurated) };
  });

  admin.post<{ Body: { matchId: string; mediaId?: string; kind: (typeof KINDS)[number]; title: string; description?: string; minute?: number; promoted?: boolean; source?: "editor" | "ai" } }>(
    "/admin/moments",
    {
      schema: {
        body: {
          type: "object",
          required: ["matchId", "kind", "title"],
          additionalProperties: false,
          properties: {
            matchId: { type: "string", maxLength: 40 },
            mediaId: { type: "string", maxLength: 40 },
            kind: { type: "string", enum: [...KINDS] },
            title: { type: "string", minLength: 1, maxLength: 80 },
            description: { type: "string", maxLength: 300 },
            minute: { type: "integer", minimum: 0, maximum: 130 },
            promoted: { type: "boolean" },
            source: { type: "string", enum: ["editor", "ai"] },
          },
        },
      },
    },
    async (request, reply) => {
      const b = request.body;
      const match = await ensureMatch(b.matchId);
      if (!match) return reply.code(404).send({ error: "Match not found." });
      if (b.mediaId) {
        const media = await prisma.media.findUnique({ where: { id: b.mediaId } });
        if (!media || media.matchId !== match.id) return reply.code(404).send({ error: "Media not found for this match." });
        if (media.audience !== "community") return reply.code(400).send({ error: "That clip wasn't shared with the match community." });
        if (!["PROCESSING", "APPROVED"].includes(media.status)) return reply.code(409).send({ error: "That clip cannot be published." });
      }
      const moment = await prisma.$transaction(async (tx) => {
        if (b.mediaId) await tx.media.update({ where: { id: b.mediaId }, data: { status: "APPROVED" } });
        return tx.moment.create({
          data: {
            matchId: match.id,
            eventType: b.kind,
            timestamp: new Date(),
            title: b.title,
            description: b.description ?? "",
            confidence: 1,
            minute: b.minute ?? null,
            promoted: b.promoted ?? false,
            source: b.source ?? "editor",
            status: "PUBLISHED",
            bestMediaId: b.mediaId ?? null,
            ...(b.mediaId ? { media: { create: { mediaId: b.mediaId, rank: 1 } } } : {}),
          },
          include: { bestMedia: { select: { id: true, type: true } } },
        });
      });
      return reply.code(201).send(toCurated(moment));
    },
  );

  admin.patch<{ Params: { id: string }; Body: { promoted?: boolean; status?: "PUBLISHED" | "REMOVED" } }>(
    "/admin/moments/:id",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: { promoted: { type: "boolean" }, status: { type: "string", enum: ["PUBLISHED", "REMOVED"] } },
        },
      },
    },
    async (request, reply) => {
      const existing = await prisma.moment.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.code(404).send({ error: "Moment not found." });
      if (request.body.status === "PUBLISHED") {
        const links = await prisma.momentMedia.findMany({
          where: { momentId: request.params.id },
          include: { media: { select: { status: true, audience: true } } },
        });
        if (links.some((l) => l.media.audience !== "community" || ["REJECTED", "REMOVED"].includes(l.media.status))) {
          return reply.code(409).send({ error: "A linked clip was rejected or removed. Re-review it before publishing." });
        }
      }
      const moment = await prisma.$transaction(async (tx) => {
        // Publishing a Moment (e.g. an AI draft) approves the clips it is built from.
        if (request.body.status === "PUBLISHED") {
          const links = await tx.momentMedia.findMany({ where: { momentId: request.params.id }, select: { mediaId: true } });
          await tx.media.updateMany({ where: { id: { in: links.map((l) => l.mediaId) }, status: "PROCESSING" }, data: { status: "APPROVED" } });
        }
        // Removing a Moment also revokes every clip that was only live because of it. Clips still backing
        // another published Moment stay up.
        if (request.body.status === "REMOVED") {
          const links = await tx.momentMedia.findMany({ where: { momentId: request.params.id }, select: { mediaId: true } });
          const ids = links.map((l) => l.mediaId);
          const shared = await tx.momentMedia.findMany({
            where: { mediaId: { in: ids }, momentId: { not: request.params.id }, moment: { status: "PUBLISHED" } },
            select: { mediaId: true },
          });
          const keep = new Set(shared.map((l) => l.mediaId));
          await tx.media.updateMany({ where: { id: { in: ids.filter((id) => !keep.has(id)) } }, data: { status: "REMOVED" } });
        }
        return tx.moment.update({
          where: { id: request.params.id },
          data: request.body,
          include: { bestMedia: { select: { id: true, type: true } } },
        });
      });
      return toCurated(moment);
    },
  );

  admin.patch<{ Params: { id: string }; Body: { status: "APPROVED" | "REJECTED" | "REMOVED" } }>(
    "/admin/media/:id",
    { schema: { body: { type: "object", required: ["status"], additionalProperties: false, properties: { status: { type: "string", enum: ["APPROVED", "REJECTED", "REMOVED"] } } } } },
    async (request, reply) => {
      const existing = await prisma.media.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.code(404).send({ error: "Media not found." });
      if (request.body.status === "APPROVED" && existing.audience !== "community") {
        return reply.code(409).send({ error: "Private or security-only media cannot be approved for public serving." });
      }
      await prisma.media.update({ where: { id: request.params.id }, data: { status: request.body.status } });
      // A rejected or removed clip comes off every moment that uses it, not only the one it fronts.
      if (request.body.status !== "APPROVED") {
        const links = await prisma.momentMedia.findMany({ where: { mediaId: request.params.id }, select: { momentId: true } });
        if (links.length) {
          await prisma.moment.updateMany({ where: { id: { in: links.map((l) => l.momentId) } }, data: { status: "REMOVED" } });
        }
      }
      return { id: request.params.id, status: request.body.status };
    },
  );
});

// Recover analyses interrupted by a restart. The row itself is the durable job record; attempts are visible
// in /media/:id/status and the admin media list.
async function resumeAiAnalysis() {
  try {
    const media = await prisma.media.findMany({
      where: { aiStatus: { in: ["QUEUED", "RUNNING"] }, uploadedAt: { lt: new Date(Date.now() - 5_000) } },
      orderBy: { uploadedAt: "asc" },
      take: 25,
    });
    for (const item of media) {
      const name = storedName(item.blobUrl);
      if (!name) continue;
      const posterName = item.thumbnailUrl ? storedName(item.thumbnailUrl) : null;
      void processUpload(item.id, name, contentType(name), posterName ?? undefined)
        .catch((err) => app.log.error(err, "AI recovery failed"));
    }
    if (media.length) app.log.info({ count: media.length }, "Resumed queued AI analysis");
  } catch (error) {
    app.log.error(error, "AI recovery scan failed");
  }
}

// Drain in-flight requests on deploy/restart, then close the DB pool. AI jobs already persisted their
// status, so the startup recovery scan will pick them up again.
let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  app.log.info({ signal }, "Shutting down");
  try {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    app.log.error(error, "Shutdown failed");
    process.exit(1);
  }
}
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

await app.listen({ port: Number(process.env["API_PORT"] ?? 4000), host: "0.0.0.0" });
void resumeAiAnalysis();
