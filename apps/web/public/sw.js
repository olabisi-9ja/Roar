// Roar service worker. Hand-written on purpose: small, no build step.
// Pages and match data: network first, last good copy when offline.
// Hashed build assets: cache first in production (they never change). Writes are never cached.

const VERSION = "roar-v3";
const SHELL = `${VERSION}-shell`;
const PAGES = `${VERSION}-pages`;
const DATA = `${VERSION}-data`;
const ASSETS = `${VERSION}-assets`;
const PROD = new URL(self.location.href).searchParams.get("mode") === "prod";
const PRECACHE = ["/offline.html", "/mark.svg", "/icon-192.png", "/apple-touch-icon.png"];
// Core screens available offline from first launch. SOS matters most: it must open with no signal.
// Dev routes compile on demand, so only precache them in production.
const ROUTES = PROD ? ["/home", "/sos", "/live", "/stats", "/capture", "/play"] : [];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await (await caches.open(SHELL)).addAll(PRECACHE);
      const pages = await caches.open(PAGES);
      // One failing route shouldn't block installing the worker.
      await Promise.allSettled(ROUTES.map((r) => pages.add(new Request(r, { credentials: "same-origin" }))));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request, { ignoreVary: true });
    if (hit) return hit;
    if (fallbackUrl) return (await caches.match(fallbackUrl)) ?? Response.error();
    throw err;
  }
}

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) (await caches.open(ASSETS)).put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Leave dev tooling and React Server Component fetches to Next.js (its useOffline handles retries).
  if (url.pathname.includes("webpack-hmr") || url.pathname.includes("__nextjs") || request.headers.has("RSC") || url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGES, "/offline.html"));
  } else if (url.pathname === "/api/matches" || url.pathname.startsWith("/api/matches/")) {
    // Last known score and stats stay visible when the stadium network drops.
    event.respondWith(networkFirst(request, DATA));
  } else if (url.pathname.startsWith("/api/")) {
    return; // everything else on the API is live-only
  } else if (PROD && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(networkFirst(request, ASSETS));
  }
});
