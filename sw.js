// Finasset Service Worker
// Strategy: Cache-First for static assets, Network-First for API calls
// Provides offline shell + background sync for critical data

const CACHE_VERSION = 'finasset-v86';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const DATA_CACHE    = `${CACHE_VERSION}-data`;

// Static assets to precache (app shell)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// API routes to cache with Network-First strategy (short TTL)
const API_CACHE_ROUTES = [
  '/api/portfolio/intraday',
  '/api/portfolio/real-history',
  '/api/dividends/history',
  '/api/etf/profile',
];

// ── Install: precache static shell ───────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      // Force no-cache so SW always fetches fresh HTML on version bump
      return Promise.all(
        STATIC_ASSETS.map(url =>
          fetch(new Request(url, { cache: 'no-store' }))
            .then(res => cache.put(url, res))
            .catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ───────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('finasset-') && k !== STATIC_CACHE && k !== DATA_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: routing strategy ─────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests — let all external CDN/font requests bypass the SW
  // (external resources have their own HTTP cache; SW interference can break them)
  if (url.origin !== self.location.origin) {
    return;
  }

  // API routes: Network-First with 5s timeout for known cache routes; all other /api/ bypass SW entirely
  if (url.pathname.startsWith('/api/')) {
    if (API_CACHE_ROUTES.some(r => url.pathname.startsWith(r))) {
      event.respondWith(networkFirstWithCache(request, DATA_CACHE, 5000));
    }
    // /api/auth/config and all other API routes go straight to network (no SW interference)
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Static assets & app shell: Cache-First
  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

// ── Cache-First strategy ─────────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      const cached = await caches.match('/index.html');
      if (cached) return cached;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// ── Network-First with timeout and cache fallback ────────────────────────
async function networkFirstWithCache(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);

  try {
    const networkPromise = fetch(request.clone());
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    );

    const response = await Promise.race([networkPromise, timeoutPromise]);

    if (response.ok) {
      // Store fresh response (max-age: 5 minutes)
      const responseToCache = response.clone();
      cache.put(request, responseToCache);
    }
    return response;
  } catch {
    // Network failed or timed out — return stale cache if available
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'offline', cached: false }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ── Background sync: retry failed data fetches ───────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-portfolio') {
    event.waitUntil(syncPortfolio());
  }
});

async function syncPortfolio() {
  try {
    const cache = await caches.open(DATA_CACHE);
    const response = await fetch('/api/portfolio/real-history');
    if (response.ok) cache.put('/api/portfolio/real-history', response);
  } catch (_) {}
}

// ── Push notifications (placeholder for future dividend alerts) ──────────
self.addEventListener('push', event => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch (_) { data.body = event.data.text(); }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Finasset', {
      body: data.body || 'Tienes novedades en tu cartera.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      tag: 'finasset-notification',
      renotify: true,
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
