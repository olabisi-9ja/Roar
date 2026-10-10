"use client";

// Offline upload queue (TRD 5.5 "Upload fails: resume/retry"). Clips wait in IndexedDB until the network is back.

type Queued = { id: string; blob: Blob; filename: string; matchId: string; section: string; audience: string; createdAt: number };

const DB = "roar";
const STORE = "uploads";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export type UploadFields = Omit<Queued, "id" | "createdAt">;

/** Throws on rejection by the API (bad file, unknown match); returns false on network failure. */
export async function upload(item: UploadFields): Promise<boolean> {
  const form = new FormData();
  // Fields before the file so the API can read them while streaming.
  form.append("matchId", item.matchId);
  form.append("section", item.section);
  form.append("audience", item.audience);
  form.append("file", item.blob, item.filename);
  let res: Response;
  try {
    res = await fetch("/api/media", { method: "POST", body: form });
  } catch {
    return false;
  }
  if (res.status >= 500) return false; // API down: keep it queued
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Upload failed (${res.status})`);
  }
  return true;
}

export const enqueue = (item: UploadFields) =>
  tx("readwrite", (s) => s.put({ ...item, id: crypto.randomUUID(), createdAt: Date.now() } satisfies Queued));

export const pending = () => tx<number>("readonly", (s) => s.count());

let flushing = false;
/** Send everything queued. Safe to call often. */
export async function flushUploads() {
  if (flushing || !("indexedDB" in window)) return;
  flushing = true;
  try {
    const items = await tx<Queued[]>("readonly", (s) => s.getAll());
    for (const item of items) {
      try {
        if (!(await upload(item))) break; // still offline, try later
      } catch {
        // Rejected by the API: retrying won't help, drop it.
      }
      await tx("readwrite", (s) => s.delete(item.id));
    }
  } finally {
    flushing = false;
  }
}
