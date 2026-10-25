// Service worker: precaches the whole app (pages, styles, scripts, icons and
// every picture listed in catalog.js) so it works fully offline.
// Bump VERSION whenever files change to force clients to refresh the cache.
const VERSION = "v10";
const CACHE = `drawfun-${VERSION}`;

importScripts("catalog.js");

const APP_FILES = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "catalog.js",
  "manifest.webmanifest",
  "icon.svg"
];

const PICTURE_FILES = CATEGORIES.flatMap((cat) =>
  cat.pictures.map((pic) => `pictures/${cat.id}/${pic.id}.svg`)
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(
      [...APP_FILES, ...PICTURE_FILES].map((url) => new Request(url, { cache: "reload" }))
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
        keys.filter((key) => key.startsWith("drawfun-") && key !== CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Cache first for instant offline use; refresh the cached copy in the
// background (bypassing the HTTP cache) so edits show up on the next visit.
// A new VERSION waits until the user taps the update banner.
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
