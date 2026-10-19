// Per-instance token bucket for write routes. This is a stopgap: when the API runs on more than one
// instance, move the counters to Redis or @fastify/rate-limit with a shared store.
type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;
const IDLE_MS = 10 * 60_000;

/** Try to spend one token. `refillPerMs` is tokens added per millisecond. */
export function take(key: string, capacity: number, refillPerMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: capacity, updatedAt: now };
  const tokens = Math.min(capacity, bucket.tokens + (now - bucket.updatedAt) * refillPerMs);
  if (tokens >= 1) {
    buckets.set(key, { tokens: tokens - 1, updatedAt: now });
    return { ok: true, retryAfter: 0 };
  }
  buckets.set(key, { tokens, updatedAt: now });
  const retryAfter = refillPerMs > 0 ? Math.max(1, Math.ceil((1 - tokens) / refillPerMs / 1000)) : 60;
  return { ok: false, retryAfter };
}

/** Drop idle buckets so long-running processes do not grow without bound. */
export function pruneBuckets() {
  if (buckets.size <= MAX_KEYS) return;
  const cutoff = Date.now() - IDLE_MS;
  for (const [key, bucket] of buckets) {
    if (bucket.updatedAt < cutoff) buckets.delete(key);
  }
}

/** Test-only escape hatch. */
export function resetBuckets() {
  buckets.clear();
}
