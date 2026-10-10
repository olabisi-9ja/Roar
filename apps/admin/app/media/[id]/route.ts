import { adminFetch } from "@/lib/api";

// Preview proxy: lets moderators watch clips that aren't public yet without exposing the admin token.
export async function GET(_request: Request, ctx: RouteContext<"/media/[id]">) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]+$/i.test(id)) return new Response("Not found", { status: 404 });
  const res = await adminFetch(`/media/${id}/file`);
  if (!res.ok || !res.body) return new Response("Not found", { status: 404 });
  return new Response(res.body, {
    headers: { "content-type": res.headers.get("content-type") ?? "application/octet-stream", "cache-control": "private, no-store" },
  });
}
