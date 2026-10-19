"use server";

import { revalidatePath } from "next/cache";
import { adminFetch } from "@/lib/api";

const KINDS = new Set(["CROWD", "CELEBRATION", "GOAL", "PLAYER", "FOUL", "OTHER"]);

export async function publishMoment(form: FormData) {
  const minute = Number(form.get("minute"));
  const kind = String(form.get("kind"));
  const body = {
    matchId: String(form.get("matchId")),
    mediaId: String(form.get("mediaId") ?? "") || undefined,
    kind: KINDS.has(kind) ? kind : "CROWD",
    title: String(form.get("title") ?? "").trim().slice(0, 80),
    description: String(form.get("description") ?? "").trim().slice(0, 300),
    ...(Number.isInteger(minute) && minute > 0 ? { minute } : {}),
    promoted: form.get("promoted") === "on",
  };
  if (!body.title) return;
  await adminFetch("/admin/moments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  revalidatePath("/curate");
}

export async function setPromoted(id: string, promoted: boolean) {
  await adminFetch(`/admin/moments/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ promoted }) });
  revalidatePath("/curate");
}

export async function setMomentStatus(id: string, status: "PUBLISHED" | "REMOVED") {
  await adminFetch(`/admin/moments/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
  revalidatePath("/curate");
}

export async function rejectMedia(id: string) {
  await adminFetch(`/admin/media/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "REJECTED" }) });
  revalidatePath("/curate");
}

export async function retryAnalysis(id: string) {
  await adminFetch(`/admin/media/${id}/reanalyze`, { method: "POST" });
  revalidatePath("/curate");
}
