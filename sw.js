/* Level Up Life Ops - Offline Service Worker v6.6 */
const CACHE = 'lul-pwa-v6.6';
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
      await Promise.allSettled(CORE.map(u => c.add(u)));
      await Promise.allSettled(SOUNDS.map(u => c.add(u)));
    }).then(() => self.skipWaiting())
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
  if (u.includes('googleapis.com') || u.includes('firebase') || u.includes('worldtimeapi')) return;

  if (e.request.mode === 'navigate' || u.endsWith('index.html') || u.endsWith('.js') || u.endsWith('.css')) {
    e.respondWith(
      fetch(e.request).then(r => {
        const cp = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, cp));
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
