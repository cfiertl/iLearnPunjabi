// Minimal offline-first service worker for the app shell + cached audio.
// Upgraded in Phase 1 to precache flashcard audio for offline review.
const CACHE = "ilp-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(request);
        if (res && res.status === 200) cache.put(request, res.clone());
        return res;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const home = await cache.match("/");
          if (home) return home;
        }
        return Response.error();
      }
    })(),
  );
});
