// Service worker for wPlanner PWA (production only registration in main.jsx)
// Strategy:
// - Network-first for navigations (`/`, `index.html`) to avoid stale app shell.
// - Stale-while-revalidate for static assets.

const CACHE_NAME = 'wplanner-cache-v2';
const APP_SHELL = ['/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        )
      ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const isHttp = request.url.startsWith('http');
  if (!isHttp) return;

  // Always prefer network for page navigations.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', responseClone));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('/index.html');
          return cached || Response.error();
        })
    );
    return;
  }

  // Static assets: quick cached response + refresh in background.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});

// Background sync for offline actions (placeholder)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-songs') {
    event.waitUntil(syncSongs());
  }
});

async function syncSongs() {
  // Placeholder for syncing song data when back online
  console.log('Syncing songs...');
}
