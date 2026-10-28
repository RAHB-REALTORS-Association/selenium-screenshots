// service-worker.js

const CACHE_NAME = 'selenium-screenshots-v4';
const urlsToCache = [
  './',
  'style.css?v=202310221921',
  'client.js?v=20261028-errors',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'favicon-48x48.png',
  'apple-touch-icon-180x180.png',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'selenium-screenshots.png'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('fetch', function(event) {
    // API requests carry credentials and must never enter this cache.
    if (event.request.method !== 'GET' || event.request.headers.has('Authorization') || new URL(event.request.url).origin !== self.location.origin) return;
    if (event.request.mode === 'navigate') {
        event.respondWith(fetch(event.request).catch(() => caches.match('./')));
        return;
    }
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

self.addEventListener('activate', function(event) {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});
