/* Level Up Life Ops - Offline Service Worker v7.0 */
const CACHE = 'lul-pwa-v7.0';
const CORE = [
  './',
  './index.html',
  './style.css',
  './arena3d.js',
  './mp-voice.js',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js',
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/models/gltf/Soldier.glb'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async c => {
      await Promise.allSettled(CORE.map(u => c.add(new Request(u, { cache: 'reload' }))));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim()).then(async () => {
      const allClients = await self.clients.matchAll({ type: 'window' });
      allClients.forEach(client => client.postMessage({ type: 'SW_UPDATED', version: CACHE }));
    })
  );
});

self.addEventListener('fetch', e => {
  const u = e.request.url;
  if (e.request.method !== 'GET') return;
  if (u.includes('googleapis.com') || u.includes('firebase') || u.includes('worldtimeapi')) return;

  const isAppAsset = e.request.mode === 'navigate' || /\.(html|js|css)(\?.*)?$/i.test(u);
  if (isAppAsset) {
    e.respondWith(
      fetch(new Request(e.request, { cache: 'no-store' })).then(r => {
        if (r && r.ok) {
          const cp = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, cp));
        }
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

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
