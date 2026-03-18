/* ── Vibron Service Worker ── */
const CACHE_NAME = 'vibron-v1';

// Core assets to cache on install (app shell)
const PRECACHE_ASSETS = [
  '/',
  '/normal',
  '/mood',
  '/css/normal.css',
  '/css/mood.css',
  '/normal.js',
  '/mood.js',
  '/v.png',
  '/v.ico',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;700&display=swap'
];

/* ── INSTALL: cache app shell ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache what we can, don't fail install if some assets miss
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url =>
          cache.add(url).catch(() => console.warn('[SW] Failed to cache:', url))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE: clean old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH: network-first for API, cache-first for assets ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept socket.io or API calls — always go to network
  if (
    url.pathname.startsWith('/socket.io') ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('apivibron') ||
    url.hostname.includes('socket.io') ||
    url.hostname.includes('vibron-sockets') ||
    url.hostname.includes('uselessfacts') ||
    event.request.method !== 'GET'
  ) {
    return; // let browser handle it
  }

  // For navigation requests (page loads) — network first, fall back to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache fresh page
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For CSS/JS/fonts/images — cache first, then network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});

/* ── PUSH NOTIFICATIONS (future use) ── */
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Vibron', {
      body: data.body || '',
      icon: '/v.png',
      badge: '/v.png',
    })
  );
});