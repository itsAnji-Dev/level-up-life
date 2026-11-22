/* Level Up Life Ops - Offline Service Worker */
const CACHE = 'lul-pwa-v1';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== 'lul1').map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const u = e.request.url;
  if (e.request.method !== 'GET') return;
  /* Never cache Firebase Auth/Firestore or live time APIs */
  if (u.includes('googleapis.com') || u.includes('firebase') || u.includes('worldtimeapi')) return;

  /* Network-first for HTML so GitHub updates arrive immediately, fallback to cache offline */
  if (e.request.mode === 'navigate' || u.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request).then(r => {
        const cp = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, cp));
        return r;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* Cache-first for scripts, icons, and 3D assets */
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r && r.ok) {
        const cp = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, cp));
      }
      return r;
    }).catch(() => new Response('', { status: 503 })))
  );
});
