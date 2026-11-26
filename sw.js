// Flux Service Worker - Offline-first caching strategy
// V59: Fix Debt Activity Log clock alignment, date+time formatting, badge placement & README update
const CACHE_NAME = 'flux-v59';
// Assets to pre-cache on install
const PRE_CACHE = [
  './?v=42',
  './index.html?v=42',
  './style.css?v=5',
  './manifest.json?v=7',
  './icon.svg?v=7',
  './icon-192.png?v=7',
  './icon-512.png?v=7',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=DM+Mono:wght@300;400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.css'
];

// Install: pre-cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Force network revalidation for pre-cached assets to prevent stale HTTP cache entries
      const requests = PRE_CACHE.map((url) => new Request(url, { cache: 'reload' }));
      return cache.addAll(requests).catch((err) => {
        // If any CDN asset fails to cache during install, continue gracefully
        console.warn('[SW] Pre-cache partial failure:', err);
        // At minimum, cache the local files with forced revalidation
        const fallback = [
          './',
          './index.html',
          './style.css?v=5',
          './manifest.json?v=7',
          './icon.svg?v=7',
          './icon-192.png?v=7',
          './icon-512.png?v=7'
        ].map((url) => new Request(url, { cache: 'reload' }));
        return cache.addAll(fallback);
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
      caches.open(CACHE_NAME).then((cache) => {
        return fetch(event.request)
          .then((response) => {
            // Cache the latest version
            const clone = response.clone();
            cache.put(event.request, clone).catch(() => {});
            return response;
          })
          .catch(() =>
            cache.match(event.request).then((r) => r || cache.match('./index.html', { ignoreSearch: true }) || cache.match('./index.html'))
          );
      }).catch(() => fetch(event.request))
    );
    return;
  }

  // For everything else (CDN scripts, fonts, CSS): cache-first, update in background
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cached) => {
        // Return cache immediately if available
        const fetchPromise = fetch(event.request)
          .then((response) => {
            // Only cache successful GET responses
            if (response && response.status === 200 && event.request.method === 'GET') {
              const clone = response.clone();
              cache.put(event.request, clone).catch(() => {});
            }
            return response;
          })
          // FIXED: 503 Service Unavailable is semantically correct for offline fallback
          // (was 408 Request Timeout which is semantically wrong)
          .catch(() => cached || new Response('Service Unavailable', { status: 503, headers: { 'Content-Type': 'text/plain' } }));

        return cached || fetchPromise;
      });
    }).catch(() => fetch(event.request))
  );
});
