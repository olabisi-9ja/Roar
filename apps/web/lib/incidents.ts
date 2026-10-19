"use client";

// SOS reports must never pretend to be sent. This queue keeps a report on the device until the API
// acknowledges it, and the UI shows a receipt only for accepted reports.

export type IncidentPayload = {
  matchId: string;
  type: string;
  section: string;
  row?: string;
  description?: string;
};

type Queued = { id: string; payload: IncidentPayload; createdAt: number };
const KEY = "roar.sosQueue";

function read(): Queued[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as Queued[]) : [];
  } catch {
    return [];
  }
}

function write(items: Queued[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Private mode: keep the in-memory caller responsible for the 999 message.
  }
}

export type SendResult =
  | { ok: true; id: string; duplicate: boolean }
  | { ok: false; reason: "network" | "retryable" | "rejected"; error?: string };

const RETRYABLE = new Set([408, 425, 429]);

export async function sendIncident(payload: IncidentPayload): Promise<SendResult> {
  let res: Response;
  try {
    res = await fetch("/api/incidents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, reason: "network" };
  }
  const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string; duplicate?: boolean };
  if (!res.ok || !body.id) {
    // Never discard a report because the queue was busy or the server hiccuped: it can be retried.
    const retryable = RETRYABLE.has(res.status) || res.status >= 500;
    return { ok: false, reason: retryable ? "retryable" : "rejected", error: body.error ?? `Request failed (${res.status})` };
  }
  return { ok: true, id: body.id, duplicate: body.duplicate === true };
}

export function queueIncident(payload: IncidentPayload): string {
  const id = crypto.randomUUID();
  write([...read().filter((item) => item.payload.matchId !== payload.matchId || item.payload.section !== payload.section || item.payload.type !== payload.type), { id, payload, createdAt: Date.now() }]);
  return id;
}

export function queuedIncidentCount() {
  return read().length;
}

/** Try to flush the queue; stop on the first network failure so order is preserved. */
export async function flushIncidents() {
  const items = read();
  if (items.length === 0) return;
  const remaining: Queued[] = [];
  let online = true;
  for (const item of items) {
    if (!online) {
      remaining.push(item);
      continue;
    }
    const result = await sendIncident(item.payload);
    if (result.ok) continue;
    if (result.reason === "rejected") continue; // invalid report: retrying will never succeed
    // Network failure or a busy/5xx queue: keep this report and everything after it.
    online = false;
    remaining.push(item);
  }
  write(remaining);
}
