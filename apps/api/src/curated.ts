import type { CuratedMoment } from "@inside/types";

export const mediaUrl = (id: string) => `/api/media/${id}/file`;

export function toCurated(m: {
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
