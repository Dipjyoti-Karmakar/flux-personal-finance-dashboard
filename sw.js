// Flux Service Worker — Offline-first caching strategy
// V43: Bumped to v32 — manual link persistence fix (manualLinks subcollection), fuzzy match tightening, launch_handler
const CACHE_NAME = 'flux-v32';
// Assets to pre-cache on install
const PRE_CACHE = [
  './',
  './index.html',
  './manifest.json?v=2',
  './icon-192.png?v=2',
  './icon-512.png?v=2',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=DM+Mono:wght@300;400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// Install: pre-cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRE_CACHE).catch((err) => {
        // If any CDN asset fails to cache during install, continue gracefully
        console.warn('[SW] Pre-cache partial failure:', err);
        // At minimum, cache the local files
        return cache.addAll(['./', './index.html', './manifest.json']);
      });
    })
  );
  // Activate immediately without waiting for old tabs to close
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
  // Take control of all open clients immediately
  self.clients.claim();
});

// Fetch: network-first for navigation & Firebase, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Parentheses are used solely for readability and clarity, since && already
  // binds tighter than ||, and the expression A || B && C || D || E evaluates
  // as A || (B && C) || D || E.
  if (
    url.hostname.includes('firebaseio.com') ||
    (url.hostname.includes('googleapis.com') && url.pathname.includes('/v1/')) ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('securetoken')
  ) {
    return; // Let the browser handle these normally (Firestore offline persistence manages its own cache)
  }

  // For HTML navigation requests: network-first, fall back to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the latest version
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // For everything else (CDN scripts, fonts, CSS): cache-first, update in background
  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Return cache immediately if available
      const fetchPromise = fetch(event.request)
        .then((response) => {
          // Only cache successful GET responses
          if (response && response.status === 200 && event.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        // FIXED: 503 Service Unavailable is semantically correct for offline fallback
        // (was 408 Request Timeout which is semantically wrong)
        .catch(() => cached || new Response('Service Unavailable', { status: 503, headers: { 'Content-Type': 'text/plain' } }));

      return cached || fetchPromise;
    })
  );
});
