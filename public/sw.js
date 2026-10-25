// Version the storage format, not each deployment. Mutable assets are refreshed
// from the network; only content-hashed Next.js assets use cache-first.
const CACHE_NAME = "kids-geo-v3";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(["/"]);
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (names) => {
      await Promise.all(
        names
          .filter((name) => name.startsWith("kids-geo-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname === "/sw.js"
  ) {
    return;
  }

  // Development and RSC responses must never enter the offline cache.
  if (url.pathname.startsWith("/_next/") && !url.pathname.startsWith("/_next/static/")) return;
  if (url.searchParams.has("_rsc") || request.headers?.get("RSC") === "1") return;

  const refresh = async () => {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
    }
    return response;
  };

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      if (url.pathname.startsWith("/_next/static/")) {
        const cached = await cache.match(request);
        if (cached) return cached;
      }
      try {
        return await refresh();
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const home = await cache.match("/");
          if (home) return home;
        }
        throw error;
      }
    }),
  );
});
