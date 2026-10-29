// service-worker.js

const CACHE_NAME = "selenium-screenshots-v5";
const urlsToCache = [
  "./",
  "style.css?v=1.7.0",
  "client.js?v=1.7.0",
  "mark.svg",
  "manifest.json?v=1.7.0",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        console.log("Opened cache");
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("fetch", function (event) {
  // API requests carry credentials and must never enter this cache.
  if (
    event.request.method !== "GET" ||
    event.request.headers.has("Authorization") ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  if (
    event.request.mode === "navigate" ||
    ["script", "style"].includes(event.request.destination)
  ) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request.mode === "navigate" ? "./" : event.request),
      ),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function (response) {
      if (response) {
        return response;
      }
      return fetch(event.request);
    }),
  );
});

self.addEventListener("activate", function (event) {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches
      .keys()
      .then(function (cacheNames) {
        return Promise.all(
          cacheNames.map(function (cacheName) {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});
