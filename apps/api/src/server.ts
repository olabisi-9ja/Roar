import { randomUUID, timingSafeEqual } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { extname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { prisma, type IncidentType, type Severity } from "@inside/database";
import type { CuratedMoment, MediaItem } from "@inside/types";
import type { Fixture } from "@inside/types";
import { getDataset, getInsights, getMatch, listMatches, restartMatch, visibleEvents } from "./replay.js";

const app = Fastify({ logger: true });
const UPLOADS = join(process.cwd(), "uploads");
const MAX_UPLOAD = 100 * 1024 * 1024;

await app.register(cors, {
  origin: (process.env["CORS_ORIGINS"] ?? "http://localhost:3000").split(","),
});
await app.register(multipart, { limits: { fileSize: MAX_UPLOAD, files: 1 } });

app.get("/health", async (_request, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", db: "up", stats: "synthetic" };
  } catch {
    return reply.code(503).send({ status: "degraded", db: "down" });
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
app.get<{ Params: { id: string }; Querystring: { since?: string; limit?: string } }>("/matches/:id/events", async (request, reply) => {
  if (!getDataset(request.params.id)) return reply.code(404).send({ error: "Match not found." });
  const since = Number(request.query.since ?? -1);
  const limit = Math.min(Number(request.query.limit ?? 500) || 500, 2000);
  const seen = visibleEvents(request.params.id);
  const events = seen.filter((e) => e.seq > since).slice(0, limit);
  return { events, latestSeq: seen.at(-1)?.seq ?? -1 };
});

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

// ponytail: single demo fan until auth (TRD 2.9) lands. Replace with the signed-in user.
async function demoUser() {
  return prisma.user.upsert({
    where: { email: "demo@roar.local" },
    create: { name: "Ade O.", email: "demo@roar.local" },
    update: {},
  });
}

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
    const { matchId, type, section, row, description } = request.body;
    const match = await ensureMatch(matchId);
    if (!match) return reply.code(404).send({ error: "Match not found." });
    const user = await demoUser();
    // ponytail: rule-based severity until the Safety Analyst agent scores incidents.
    const severity: Severity = type === "MEDICAL" || type === "FIRE" ? "CRITICAL" : "MEDIUM";
    const incident = await prisma.incident.create({
      data: {
        matchId: match.id,
        reportedById: user.id,
        type,
        severity,
        section: row ? `${section} · Row ${row}` : section,
        description: description ?? null,
      },
    });
    return reply.code(201).send({ id: incident.id, status: incident.status, severity: incident.severity, createdAt: incident.createdAt });
  },
);

// Reading incidents (seat locations, reports) is security-staff only: see /admin/incidents below.

// ---- Media upload ----

const AUDIENCES = new Set(["community", "me", "security"]);

app.post("/media", async (request, reply) => {
  const file = await request.file();
  if (!file) return reply.code(400).send({ error: "No file uploaded." });
  const kind = file.mimetype.startsWith("video/") ? "VIDEO" : file.mimetype.startsWith("image/") ? "PHOTO" : null;
  if (!kind) {
    file.file.resume();
    return reply.code(415).send({ error: "Only photos and videos can be uploaded." });
  }

  const field = (name: string) => {
    const f = file.fields[name];
    return f && !Array.isArray(f) && "value" in f ? String(f.value) : undefined;
  };
  const matchId = field("matchId") ?? "";
  const section = (field("section") ?? "").slice(0, 10) || null;
  const audience = field("audience") ?? "community";
  if (!AUDIENCES.has(audience)) {
    file.file.resume();
    return reply.code(400).send({ error: "Unknown audience." });
  }

  // ponytail: local disk until Azure Blob Storage is provisioned (TRD 2.2). Same record shape either way.
  await mkdir(UPLOADS, { recursive: true });
  const ext = extname(file.filename).toLowerCase().replace(/[^.a-z0-9]/g, "") || (kind === "VIDEO" ? ".webm" : ".jpg");
  const name = `${randomUUID()}${ext}`;
  const path = join(UPLOADS, name);
  await pipeline(file.file, createWriteStream(path));
  if (file.file.truncated) {
    await unlink(path);
    return reply.code(413).send({ error: "File is larger than 100 MB." });
  }

  const match = await ensureMatch(matchId);
  if (!match) {
    await unlink(path);
    return reply.code(404).send({ error: "Match not found." });
  }
  const user = await demoUser();
  const media = await prisma.media.create({
    data: {
      userId: user.id,
      matchId: match.id,
      blobUrl: `/uploads/${name}`,
      type: kind,
      capturedAt: new Date(),
      section,
      audience,
    },
  });
  return reply.code(201).send({ id: media.id, status: media.status, type: media.type, audience: media.audience });
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

// Media files: anyone can view approved media; anything else needs the admin token (moderation preview).
app.get<{ Params: { id: string } }>("/media/:id/file", async (request, reply) => {
  const media = await prisma.media.findUnique({ where: { id: request.params.id } });
  if (!media) return reply.code(404).send({ error: "Not found." });
  if (media.status !== "APPROVED" && !isAdmin(request.headers["x-admin-token"])) return reply.code(404).send({ error: "Not found." });
  const name = media.blobUrl.replace(/^\/uploads\//, "");
  if (!/^[\w-]+\.[a-z0-9]+$/.test(name)) return reply.code(404).send({ error: "Not found." });
  const type = name.endsWith(".mp4") ? "video/mp4" : name.endsWith(".webm") ? "video/webm" : name.endsWith(".png") ? "image/png" : "image/jpeg";
  reply.header("Cache-Control", media.status === "APPROVED" ? "public, max-age=86400" : "no-store");
  return reply.type(type).send(createReadStream(join(UPLOADS, name)));
});

// ---- Admin (curation and moderation). ponytail: one shared token until role-based auth (TRD 2.9). ----

function isAdmin(token: unknown) {
  const expected = process.env["ADMIN_TOKEN"];
  if (!expected || typeof token !== "string" || token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

await app.register(async (admin) => {
  admin.addHook("onRequest", async (request, reply) => {
    if (!isAdmin(request.headers["x-admin-token"])) return reply.code(401).send({ error: "Admin token required." });
  });

  admin.get<{ Querystring: { matchId?: string } }>("/admin/incidents", async (request) => {
    const incidents = await prisma.incident.findMany({
      where: request.query.matchId ? { matchId: request.query.matchId } : {},
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { incidents };
  });

  admin.get<{ Params: { id: string } }>("/admin/incidents/:id", async (request, reply) => {
    const incident = await prisma.incident.findUnique({ where: { id: request.params.id } });
    if (!incident) return reply.code(404).send({ error: "Incident not found." });
    return incident;
  });

  // Demo control: restart a match's live replay at a given minute.
  admin.post<{ Params: { id: string }; Body: { minute?: number } }>(
    "/admin/matches/:id/kickoff",
    { schema: { body: { type: "object", additionalProperties: false, properties: { minute: { type: "integer", minimum: 0, maximum: 100 } } } } },
    async (request, reply) => {
      if (!restartMatch(request.params.id, request.body?.minute ?? 0)) return reply.code(404).send({ error: "Match not found." });
      return getMatch(request.params.id);
    },
  );

  admin.get<{ Querystring: { matchId?: string } }>("/admin/media", async (request) => {
    const media = await prisma.media.findMany({
      where: { ...(request.query.matchId ? { matchId: request.query.matchId } : {}), audience: "community" },
      orderBy: { uploadedAt: "desc" },
      take: 100,
    });
    const items: MediaItem[] = media.map((m) => ({
      id: m.id, matchId: m.matchId, type: m.type, status: m.status, audience: m.audience, section: m.section,
      url: mediaUrl(m.id), uploadedAt: m.uploadedAt.toISOString(),
    }));
    return { media: items };
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
      const moment = await prisma.moment.update({
        where: { id: request.params.id },
        data: request.body,
        include: { bestMedia: { select: { id: true, type: true } } },
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
      await prisma.media.update({ where: { id: request.params.id }, data: { status: request.body.status } });
      // A rejected or removed clip comes off the feed with any moment built on it.
      if (request.body.status !== "APPROVED") {
        await prisma.moment.updateMany({ where: { bestMediaId: request.params.id }, data: { status: "REMOVED" } });
      }
      return { id: request.params.id, status: request.body.status };
    },
  );
});

await app.listen({ port: Number(process.env["API_PORT"] ?? 4000), host: "0.0.0.0" });
