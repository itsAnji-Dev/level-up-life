/* Level Up Life Ops - Offline Service Worker v6.0 */
const CACHE = 'lul-pwa-v6.0';

const SOUNDS = [
  'https://actions.google.com/sounds/v1/weapons/rifle_fire_select.ogg',
  'https://actions.google.com/sounds/v1/tools/ejecting_a_cassette.ogg',
  'https://actions.google.com/sounds/v1/weapons/shell_casings_revolver.ogg',
  'https://actions.google.com/sounds/v1/weapons/gun_parts_handling.ogg',
  'https://actions.google.com/sounds/v1/weapons/rifle_charging_handle.ogg',
  'https://actions.google.com/sounds/v1/weapons/shot_gun_handling.ogg',
  'https://actions.google.com/sounds/v1/weapons/cocking_a_50cal_gun.ogg',
  'https://actions.google.com/sounds/v1/weapons/gun_reload.ogg',
  'https://actions.google.com/sounds/v1/weapons/gun_powder_ignite.ogg',
  'https://actions.google.com/sounds/v1/weapons/explosion_large.ogg',
  'https://actions.google.com/sounds/v1/science_fiction/suspense_builder.ogg',
  'https://actions.google.com/sounds/v1/science_fiction/sci_fi_vortex.ogg',
  'https://actions.google.com/sounds/v1/crowd/applause.ogg'
];

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js',
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/models/gltf/Soldier.glb'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async c => {
      await Promise.allSettled(CORE.map(u => c.add(u)));
      await Promise.allSettled(
        SOUNDS.map(async u => {
          const res = await fetch(new Request(u, { mode: 'no-cors' }));
          if (res) await c.put(u, res);
        })
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const u = e.request.url;
  if (e.request.method !== 'GET') return;

  // Bypass live multiplayer, auth, signaling, and time APIs
  if (
    u.includes('googleapis.com') ||
    u.includes('gstatic.com/firebasejs') ||
    u.includes('firebase') ||
    u.includes('worldtimeapi')
  ) {
    return;
  }

  // Handle page navigation & invite links (?squad=CODE)
  if (e.request.mode === 'navigate' || u.includes('index.html')) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          if (r && r.ok) {
            const cp = r.clone();
            caches.open(CACHE).then(c => c.put('./index.html', cp));
          }
          return r;
        })
        .catch(() => caches.match('./index.html', { ignoreSearch: true }))
    );
    return;
  }

  // Cache-first for 3D models, libraries, and opaque audio assets
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(e.request)
        .then(r => {
          if (r && (r.ok || r.type === 'opaque')) {
            const cp = r.clone();
            caches.open(CACHE).then(c => c.put(e.request, cp));
          }
          return r;
        })
        .catch(() => new Response('', { status: 503, statusText: 'Offline' }));
    })
  );
});
