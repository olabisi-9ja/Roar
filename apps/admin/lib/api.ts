import "server-only";

const API_URL = process.env["API_URL"] ?? "http://localhost:4000";

/** Calls the Roar API with the admin token. Server-only: the token never reaches the browser. */
export async function adminFetch(path: string, init: RequestInit = {}) {
  const token = process.env["ADMIN_TOKEN"];
  if (!token) throw new Error("ADMIN_TOKEN is not set in the repo .env");
  return fetch(`${API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: { ...(init.headers ?? {}), "x-admin-token": token },
  });
}

export async function publicJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${path} ${res.status}`);
  return res.json() as Promise<T>;
}
