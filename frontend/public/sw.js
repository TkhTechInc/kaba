const CACHE_NAME = 'kaba-v2';
const STATIC_ASSETS = [
  '/',
  '/favicon.ico',
  '/images/logo/logo.svg',
  '/images/logo/logo-dark.svg',
  '/images/logo/logo-icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - GET /api/* → network first, fallback cache
// - POST/PUT/DELETE /api/* → network only (mutations go via sync queue in app)
// - /_next/static/* → cache first (immutable Next.js build assets)
// - Everything else → cache first (static shell)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) {
    if (request.method === 'GET') {
      event.respondWith(
        fetch(request.clone())
          .then((res) => {
            const cloned = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
            return res;
          })
          .catch(() => caches.match(request))
      );
    }
    return;
  }

  // Cache-first for all non-API requests, including /_next/static/ build assets
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'kaba-sync') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SYNC_REQUESTED' }));
      })
    );
  }
});
