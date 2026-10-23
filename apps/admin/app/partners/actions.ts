"use server";

import { revalidatePath } from "next/cache";
import { adminFetch } from "@/lib/api";

export type Created = { name: string; apiKey: string; webhookSecret: string | null } | { error: string } | null;

/** The key and secret come back once; the API stores only a hash of the key. */
export async function createPartner(_prev: Created, form: FormData): Promise<Created> {
  const name = String(form.get("name") ?? "").trim();
  const webhookUrl = String(form.get("webhookUrl") ?? "").trim();
  const language = String(form.get("language") ?? "en");
  if (!name) return { error: "Give the partner a name." };
  const res = await adminFetch("/admin/partners", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, language, ...(webhookUrl ? { webhookUrl } : {}) }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; name?: string; apiKey?: string; webhookSecret?: string | null };
  if (!res.ok || !body.apiKey) return { error: body.error ?? `Could not create the partner (${res.status}).` };
  revalidatePath("/partners");
  return { name: body.name ?? name, apiKey: body.apiKey, webhookSecret: body.webhookSecret ?? null };
}

export async function revokePartner(id: string) {
  const res = await adminFetch(`/admin/partners/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Could not revoke the partner (${res.status}).`);
  revalidatePath("/partners");
}
