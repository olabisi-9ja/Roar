"use server";

import { revalidatePath } from "next/cache";
import { adminFetch } from "@/lib/api";

export async function setIncidentStatus(id: string, status: string) {
  const res = await adminFetch(`/admin/incidents/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Could not update the incident (${res.status}).`);
  }
  revalidatePath("/incidents");
}
