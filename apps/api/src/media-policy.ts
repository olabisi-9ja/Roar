// One decision point for who may fetch a media file. Routes must not re-implement this.
export type MediaVisibility = "public" | "owner" | "staff" | null;

export type MediaLike = { audience: string; status: string; userId: string };
export type MediaViewer = { actorId: string | null; isStaff: boolean };

/**
 * - APPROVED community media is public.
 * - "me" media belongs to its uploader only: even staff cannot preview it.
 * - "security" media is staff-only.
 * - Everything else (pending, processing, rejected, removed) is private to its uploader or staff.
 */
export function mediaVisibility(media: MediaLike, viewer: MediaViewer): MediaVisibility {
  if (media.audience === "community" && media.status === "APPROVED") return "public";
  if (media.audience === "me" && viewer.actorId && viewer.actorId === media.userId) return "owner";
  if (viewer.isStaff && (media.audience === "community" || media.audience === "security")) return "staff";
  return null;
}

export const cacheControlFor = (visibility: Exclude<MediaVisibility, null>) => (visibility === "public" ? "public, max-age=300" : "private, no-store");
