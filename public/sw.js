const CACHE = "gym-chat-v2";

const ASSETS = [
  "/",
  "/styles.css",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Never serve stale JavaScript.
  if (url.pathname === "/app.js") {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
    );
    return;
  }

  // Everything else: newest version first,
  // cached version only if the network fails.
  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then(response => {
        const copy = response.clone();

        caches.open(CACHE).then(cache => {
          cache.put(event.request, copy);
        });

        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
