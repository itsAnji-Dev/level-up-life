const CACHE_NAME = 'levelup-life-ops-v4';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept Firebase Auth redirects, Google Sign-In, or Firestore live sync
  if (
    url.pathname.startsWith('/__/auth') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('accounts.google.com')
  ) {
    return;
  }

  // Network-First for HTML pages so mobile & desktop always get the latest index.html
  if (event.request.mode === 'navigate' || url.pathname.endsWith('index.html')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-First for icons, manifest, and static assets
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (res && res.status === 200 && url.origin === location.origin) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
          }
          return res;
        });
      })
    );
  }
});
