// Narrows Marina PWA Service Worker
// Strategy:
// - Navigation requests: NETWORK-FIRST (so pages like schedule.html actually load)
//   Fallback to cached response or menu.html if offline.
// - Static assets (css/js/icons): CACHE-FIRST (fast and offline-friendly).
// - Immediate activation on update (skipWaiting + clients.claim).

const CACHE_VERSION = 'nm-v5-2025-08-27';
const STATIC_CACHE = `static-${CACHE_VERSION}`;

// Precache core shell files (adjust as your repo grows)
const STATIC_ASSETS = [
  '/', 'index.html',
  'login.html', 'menu.html',
  'schedule.html', 'employees.html', 'maintenance.html', 'moveouts.html',
  'style.css', 'manifest.json',
  'common.js', 'login.js', 'schedule.js', 'employees.js', 'maintenance.js', 'moveouts.js',
  'icons/icon-192x192.png', 'icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys
      .filter((k) => k !== STATIC_CACHE)
      .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // NAVIGATION: always try the network first so routed pages are not replaced by cached menu.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((m) => m || caches.match('menu.html')))
    );
    return;
  }

  // Same-origin STATIC files: cache-first
  if (url.origin === location.origin && /\.(?:css|js|png|jpg|jpeg|gif|svg|ico|webp|json)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
          return res;
        });
      })
    );
    return;
  }

  // Default: network fallback to cache
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
