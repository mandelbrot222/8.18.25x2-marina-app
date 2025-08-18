/*
 * Service worker for offline support.  This script caches all static
 * assets during installation and serves them from the cache when
 * offline.  When updated, old caches are purged upon activation.
 */

const CACHE_NAME = 'pwa-app-cache-v1';
// List all resources you want to cache for offline access.
const URLS_TO_CACHE = [
  './',
  'index.html',
  'menu.html',
  'schedule.html',
  'employees.html',
  'maintenance.html',
  'moveouts.html',
  'style.css',
  'common.js',
  'schedule.js',
  'employees.js',
  'maintenance.js',
  'moveouts.js',
  'manifest.json',
  // Icon files
  'icons/icon-72x72.png',
  'icons/icon-96x96.png',
  'icons/icon-128x128.png',
  'icons/icon-144x144.png',
  'icons/icon-152x152.png',
  'icons/icon-192x192.png',
  'icons/icon-384x384.png',
  'icons/icon-512x512.png'
  , 'assets/narrows_logo.png'
];

// Install event: cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

// Fetch event: serve cached content if available, otherwise perform network request
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

// Activate event: remove outdated caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});