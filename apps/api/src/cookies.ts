// Minimal cookie-header parsing. The API only reads one first-party cookie, so a full cookie library
// would be more surface area than the feature needs.
export function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key !== name) continue;
    try {
      return decodeURIComponent(rest.join("="));
    } catch {
      return null;
    }
  }
  return null;
}

/** Guest ids are UUIDs; anything else is a stale or hostile value. */
export const isActorId = (value: string | null): value is string => !!value && /^[0-9a-f-]{36}$/i.test(value);
