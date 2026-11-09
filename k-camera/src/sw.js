// Service worker: precaches the whole app so it works fully offline.
// Bump VERSION whenever files change to force clients to refresh the cache.
const VERSION = "v15";
const CACHE = `sillyfaces-${VERSION}`;

const APP_FILES = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "items.js",
  "vendor/tfjs/tf.min.js",
  "vendor/tfjs/tf-backend-webgpu.min.js",
  "vendor/tfjs/face-landmarks-detection.min.js",
  "vendor/tfjs/detector/model.json",
  "vendor/tfjs/detector/group1-shard1of1.bin",
  "vendor/tfjs/mesh/model.json",
  "vendor/tfjs/mesh/group1-shard1of1.bin",
  "manifest.webmanifest",
  "icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(
      APP_FILES.map((url) => new Request(url, { cache: "reload" }))
    ))
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("sillyfaces-") && key !== CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Cache first for instant offline use; refresh the cached copy in the
// background so edits show up on the next visit.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const network = fetch(request, { cache: "no-cache" })
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => undefined);

      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      const response = await network;
      if (response) return response;
      if (request.mode === "navigate") {
        const page = await cache.match("index.html");
        if (page) return page;
      }
      return Response.error();
    })
  );
});
