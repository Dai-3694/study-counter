const CACHE_NAME = "study-tv-timer-v3";
const ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "assets/icon.svg",
  "assets/icon-192.png",
  "assets/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const results = await Promise.allSettled(ASSETS.map((asset) => cache.add(asset)));
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.warn(`キャッシュに追加できませんでした: ${ASSETS[index]}`, result.reason);
        }
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      try {
        return await fetch(event.request);
      } catch (error) {
        if (event.request.mode === "navigate") {
          const fallback = await caches.match("./") || await caches.match("index.html");
          if (fallback) return fallback;
        }

        return new Response("オフラインのため、このファイルを読み込めませんでした。", {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
          status: 503,
          statusText: "Service Unavailable",
        });
      }
    })()
  );
});
