const CACHE_VERSION = 'daily-dose-pwa-v9';
const CORE_CACHE = `${CACHE_VERSION}-core`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const CORE_ASSETS = [
  '/',
  '/devotions',
  '/series',
  '/verse-library',
  '/start-here',
  '/what-we-believe',
  '/need-help-now',
  '/privacy',
  '/story',
  '/prayer-admin.html',
  '/pwa-stats.html',
  '/offline',
  '/styles.css?v=warm-readable-5',
  '/script.js?v=prayer-wall-4',
  '/pwa.js?v=pwa-4',
  '/verse-of-the-day.js?v=verse-share-2',
  '/verses-of-the-day.json',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CORE_CACHE)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => ![CORE_CACHE, RUNTIME_CACHE].includes(key))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

function isStaticAsset(url) {
  return [
    '.css',
    '.js',
    '.json',
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.svg',
    '.webmanifest'
  ].some(ext => url.pathname.endsWith(ext));
}

async function networkFirstPage(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    return await cache.match(request)
      || await caches.match(request)
      || await caches.match('/offline');
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || fresh;
}
