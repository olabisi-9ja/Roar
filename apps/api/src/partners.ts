// Studios and streaming partners: API keys, and signed webhooks when a Moment is published.
import { createHash, createHmac, randomBytes } from "node:crypto";

export const newApiKey = () => `roar_pk_${randomBytes(24).toString("base64url")}`;
export const newWebhookSecret = () => `roar_whsec_${randomBytes(24).toString("base64url")}`;
/** Keys are stored hashed; the plain key is shown once at creation. */
export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** Signature over "<timestamp>.<body>", so a captured delivery cannot be replayed with a new timestamp. */
export function signWebhook(secret: string, timestamp: string, body: string) {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

/** Webhooks must use https in production. Plain http is allowed only for localhost while developing. */
export function webhookUrlProblem(raw: string, production: boolean): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "Webhook URL is not a valid URL.";
  }
  if (url.username || url.password) return "Webhook URL must not contain credentials.";
  if (url.protocol === "https:") return null;
  if (!production && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) return null;
  return "Webhook URL must use https.";
}

export type Delivery = { url: string; secret: string; event: string; payload: unknown };

/** POST one signed event. One retry on a network error or 5xx; 4xx means the partner rejected it. */
export async function deliver({ url, secret, event, payload }: Delivery, fetchImpl: typeof fetch = fetch) {
  const body = JSON.stringify({ type: event, createdAt: new Date().toISOString(), data: payload });
  for (let attempt = 1; attempt <= 2; attempt++) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "Roar-Webhooks/1",
          "x-roar-event": event,
          "x-roar-timestamp": timestamp,
          "x-roar-signature": signWebhook(secret, timestamp, body),
        },
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(5_000),
      });
      if (res.status < 500) return { ok: res.ok, status: res.status, attempts: attempt };
    } catch {
      // network error or timeout: retry once
    }
  }
  return { ok: false, status: 0, attempts: 2 };
}
