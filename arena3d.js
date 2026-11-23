/* ===== 3D SOLDIER, FPP VIEWMODEL, CODM SLIDE, DEATH FALL, BALLISTIC BULLETS, GUN AUDIO, GUNSMITH & CROSS-DEVICE PRIVATE MULTIPLAYER ===== */
let AR = null;
let lobbyBridgeActive = false;

/* ===== UNIFIED MAP REGISTRY (AVAILABLE ON BOTH PC & MOBILE) ===== */
const ALL_BATTLE_MAPS = [
  { id: 'killhouse_1v1', name: 'TACTICAL KILLHOUSE 3D', sky: 0x1e2d4a, desc: 'Symmetrical 3D PvP Arena (1v1 / 2v2 / 5v5)' },
  { id: 'firing_range',  name: 'FIRING RANGE',          sky: 0x6ea8dc, desc: 'Classic Military Compound & Containers' },
  { id: 'nuketown',      name: 'NUKETOWN OPS',          sky: 0xd99b52, desc: 'Desert Testing Ground & Sightlines' },
  { id: 'standoff',      name: 'STANDOFF',              sky: 0x5b8fb9, desc: 'Urban Crossfire Lanes & Cover' },
  { id: 'shipment',      name: 'SHIPMENT 1944',         sky: 0x475569, desc: 'Fast-Paced Dockyard Container CQB' }
];

/* ===== CODM PRIVATE MULTIPLAYER & CROSS-DEVICE MAP SYNC STATE ===== */
const PRIVATE_ROOM = {
  active: false,
  screenOpen: false,
  roomId: '',
  joinDraft: '',
  invitedIds: new Set(),
  incomingInvites: [],
  isHost: false,
  mode: '1v1', // '1v1' | '2v2' | '5v5'
  mapId: 'killhouse_1v1',
  mapName: 'TACTICAL KILLHOUSE 3D',
  fillBots: false,
  myTeam: 'alpha', // 'alpha' | 'bravo'
  myReady: false,
  started: false,
  peers: {}
};

const ROOM_CHANNEL_NAME = 'lul_codm_priv_room_bus_v2';
const ROOM_STORAGE_KEY = 'lul_codm_priv_rooms_v2';
let roomBroadcastChannel = null;

function genPrivateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getCurrentUserId() {
  if (typeof MY_PID !== 'undefined' && MY_PID) return String(MY_PID);
  if (typeof S !== 'undefined' && S && (S.pid || S.uid || S.id)) return String(S.pid || S.uid || S.id);
  if (!window.__pvpPid) {
    try {
      const saved = localStorage.getItem('lul_pvp_pid_v1');
      window.__pvpPid = saved || ('P_' + Math.random().toString(36).slice(2, 9));
      localStorage.setItem('lul_pvp_pid_v1', window.__pvpPid);
    } catch (e) {
      window.__pvpPid = 'P_' + Math.random().toString(36).slice(2, 9);
    }
  }
  return window.__pvpPid;
}

function getCurrentUserProfile() {
  const pid = getCurrentUserId();
  const name = (typeof S !== 'undefined' && S && (S.name || S.username))
    ? String(S.name || S.username)
    : 'OPERATOR';
  const lvl = (typeof S !== 'undefined' && S && (S.lvl || S.level))
    ? Number(S.lvl || S.level)
    : 1;
  const gunId = (typeof S !== 'undefined' && S && S.eq && typeof S.eq.gun === 'number' && S.eq.gun >= 0)
    ? S.eq.gun
    : 3;
  return { pid, name, lvl, gunId };
}

function getMapById(id) {
  if (!id) return ALL_BATTLE_MAPS[0];
  const found = ALL_BATTLE_MAPS.find(m => m.id === id);
  if (found) return found;
  if (typeof MAPS !== 'undefined' && Array.isArray(MAPS)) {
    const ext = MAPS.find(m => m.id === id);
    if (ext) return { id: ext.id, name: ext.name || id.toUpperCase(), sky: resolveSkyHex(ext.sky, ext.id), desc: ext.desc || '' };
  }
  return ALL_BATTLE_MAPS[0];
}

function setSyncedMapSelection(mapId, mapName) {
  const m = getMapById(mapId);
  PRIVATE_ROOM.mapId = m.id;
  PRIVATE_ROOM.mapName = mapName || m.name;
  window.__SYNCED_MATCH_MAP = { id: m.id, name: PRIVATE_ROOM.mapName, sky: resolveSkyHex(m.sky, m.id) };
  if (typeof S !== 'undefined' && S) {
    S.map = m.id;
    if (S.cfg) S.cfg.map = m.id;
  }
  if (typeof SEL_MAP !== 'undefined') {
    try { SEL_MAP = m.id; } catch (e) {}
  }
  if (typeof curMapIdx !== 'undefined' && typeof MAPS !== 'undefined' && Array.isArray(MAPS)) {
    const idx = MAPS.findIndex(x => x.id === m.id);
    if (idx >= 0) {
      try { curMapIdx = idx; } catch (e) {}
    }
  }
}

function readStoredRooms() {
  try {
    const raw = localStorage.getItem(ROOM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function writeStoredRooms(roomsObj) {
  try {
    localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(roomsObj));
  } catch (e) {}
}

function broadcastRoomEvent(payload) {
  const full = Object.assign({ fromPid: getCurrentUserId(), ts: Date.now() }, payload);
  try {
    if (roomBroadcastChannel) roomBroadcastChannel.postMessage(full);
  } catch (e) {}

  if (full.type === 'room_snapshot' && full.roomId) {
    const rooms = readStoredRooms();
    rooms[full.roomId] = Object.assign({}, rooms[full.roomId] || {}, full.snapshot, { updatedAt: Date.now() });
    writeStoredRooms(rooms);
  } else if (full.type === 'invite' && full.roomId) {
    const rooms = readStoredRooms();
    const cur = rooms[full.roomId] || { roomId: full.roomId, members: {}, invites: [] };
    cur.invites = Array.isArray(cur.invites) ? cur.invites : [];
    cur.invites = cur.invites.filter(x => !(x.roomId === full.roomId && x.targetId === full.targetId));
    cur.invites.push(full);
    cur.updatedAt = Date.now();
    rooms[full.roomId] = cur;
    writeStoredRooms(rooms);
  }
}

(function setupSwAutoSync() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', ev => {
    if (ev && ev.data && ev.data.type === 'SW_UPDATED' && !AR && !window.__lulSwReloaded) {
      window.__lulSwReloaded = true;
      if (typeof toast === 'function') toast('🔄 Updated to ' + ev.data.version + ' — refreshing...');
      setTimeout(() => window.location.reload(), 250);
    }
  });
})();

function isPCDevice() {
  const fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
  return !isMobileUA && ((navigator.maxTouchPoints || 0) === 0 || fine);
}

function shortestAngleDiff(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function resolveSkyHex(rawSky, mapId) {
  if (mapId === 'killhouse_1v1') return 0x1e2d4a;
  if (typeof rawSky === 'number' && !isNaN(rawSky)) return rawSky;
  if (typeof rawSky === 'string') {
    const clean = rawSky.trim().replace(/^#/, '').replace(/^0x/i, '');
    const parsed = parseInt(clean, 16);
    if (!isNaN(parsed)) return parsed;
  }
  if (mapId === 'nuketown') return 0xd99b52;
  if (mapId === 'shipment') return 0x475569;
  if (mapId === 'standoff') return 0x5b8fb9;
  return 0x6ea8dc;
}

/* ===== PROCEDURAL BALLISTIC SOUND ENGINE ===== */
const GUN_AUDIO = (() => {
  let ctx = null, noiseBuf = null;

  function ensureCtx() {
    if (typeof SFX !== 'undefined' && SFX.muted) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') {
      try { ctx.resume(); } catch (e) {}
    }
    if (!noiseBuf && ctx) {
      const len = Math.floor(ctx.sampleRate * 1.4);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.28));
      }
    }
    return ctx;
  }

  function playShot(cat = 'ar', suppressed = false) {
    const ac = ensureCtx();
    if (!ac) return;
    const now = ac.currentTime;

    const cfg = {
      ar:       { punchStart: 195, punchEnd: 42, punchDur: 0.14, noiseFilter: suppressed ? 1400 : 3200, noiseDur: 0.17, gain: suppressed ? 0.22 : 0.38 },
      smg:      { punchStart: 240, punchEnd: 58, punchDur: 0.09, noiseFilter: suppressed ? 1600 : 4100, noiseDur: 0.11, gain: suppressed ? 0.20 : 0.34 },
      sniper:   { punchStart: 155, punchEnd: 28, punchDur: 0.28, noiseFilter: 5200, noiseDur: 0.42, gain: 0.50 },
      shotgun:  { punchStart: 130, punchEnd: 26, punchDur: 0.24, noiseFilter: 2400, noiseDur: 0.34, gain: 0.48 },
      launcher: { punchStart: 95,  punchEnd: 22, punchDur: 0.35, noiseFilter: 1100, noiseDur: 0.48, gain: 0.46 }
    }[cat] || { punchStart: 195, punchEnd: 42, punchDur: 0.14, noiseFilter: 3200, noiseDur: 0.17, gain: 0.36 };

    const osc = ac.createOscillator();
    const oscGain = ac.createGain();
    osc.type = cat === 'sniper' || cat === 'shotgun' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(cfg.punchStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, cfg.punchEnd), now + cfg.punchDur);
    oscGain.gain.setValueAtTime(cfg.gain, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + cfg.punchDur);
    osc.connect(oscGain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + cfg.punchDur + 0.02);

    if (noiseBuf) {
      const ns = ac.createBufferSource();
      ns.buffer = noiseBuf;
      const filter = ac.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(cfg.noiseFilter, now);
      filter.Q.setValueAtTime(cat === 'sniper' ? 1.4 : 0.85, now);

      const nGain = ac.createGain();
      nGain.gain.setValueAtTime(cfg.gain * 0.95, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + cfg.noiseDur);

      ns.connect(filter).connect(nGain).connect(ac.destination);
      ns.start(now);
      ns.stop(now + cfg.noiseDur + 0.02);
    }

    if (cat === 'sniper' || cat === 'shotgun') {
      const boltAt = now + (cat === 'sniper' ? 0.24 : 0.20);
      const bOsc = ac.createOscillator();
      const bGain = ac.createGain();
      bOsc.type = 'square';
      bOsc.frequency.setValueAtTime(1150, boltAt);
      bOsc.frequency.exponentialRampToValueAtTime(320, boltAt + 0.045);
      bGain.gain.setValueAtTime(0.14, boltAt);
      bGain.gain.exponentialRampToValueAtTime(0.001, boltAt + 0.05);
      bOsc.connect(bGain).connect(ac.destination);
      bOsc.start(boltAt);
      bOsc.stop(boltAt + 0.06);
    }
  }

  function playReload(cat = 'ar') {
    const ac = ensureCtx();
    if (!ac) return;
    const now = ac.currentTime;
    const clicks = cat === 'shotgun' ? [0.05, 0.25, 0.45, 0.65, 0.88] : [0.08, 0.48, 0.92];
    clicks.forEach((off, i) => {
      const t = now + off;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(i === clicks.length - 1 ? 780 : 520, t);
      o.frequency.exponentialRampToValueAtTime(190, t + 0.055);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + 0.07);
    });
  }

  function playHitmarker(kill = false) {
    const ac = ensureCtx();
    if (!ac) return;
    const now = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(kill ? 1480 : 980, now);
    o.frequency.exponentialRampToValueAtTime(kill ? 620 : 440, now + (kill ? 0.12 : 0.05));
    g.gain.setValueAtTime(kill ? 0.22 : 0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (kill ? 0.13 : 0.06));
    o.connect(g).connect(ac.destination);
    o.start(now);
    o.stop(now + 0.14);
  }

  function playExplosion() {
    const ac = ensureCtx();
    if (!ac) return;
    const now = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, now);
    o.frequency.exponentialRampToValueAtTime(20, now + 0.55);
    g.gain.setValueAtTime(0.45, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    o.connect(g).connect(ac.destination);
    o.start(now);
    o.stop(now + 0.6);

    if (noiseBuf) {
      const ns = ac.createBufferSource();
      ns.buffer = noiseBuf;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1350, now);
      lp.frequency.exponentialRampToValueAtTime(180, now + 0.65);
      const ng = ac.createGain();
      ng.gain.setValueAtTime(0.5, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
      ns.connect(lp).connect(ng).connect(ac.destination);
      ns.start(now);
      ns.stop(now + 0.7);
    }
  }

  return { playShot, playReload, playHitmarker, playExplosion };
})();

/* ===== PROCEDURAL CANVAS TEXTURES ===== */
const TEX_CACHE = {};
function getArenaTextures(mapId = 'firing_range') {
  if (TEX_CACHE[mapId]) return TEX_CACHE[mapId];

  function makeCanvasTex(w, h, drawFn, repeatX = 1, repeatY = 1) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    drawFn(ctx, w, h);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.needsUpdate = true;
    return tex;
  }

  const isDesert = mapId === 'nuketown';
  const isDock = mapId === 'shipment';
  const isKillhouse = mapId === 'killhouse_1v1';
  const isUrban = mapId === 'standoff';

  const groundTex = makeCanvasTex(512, 512, (ctx, w, h) => {
    if (isKillhouse) {
      ctx.fillStyle = '#2b3445';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 3500; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(15,23,42,0.16)';
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      ctx.strokeStyle = 'rgba(15,23,42,0.55)';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.beginPath();
      ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
      ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(56,189,248,0.14)';
      ctx.lineWidth = 2;
      ctx.strokeRect(18, 18, w / 2 - 36, h / 2 - 36);
      ctx.strokeRect(w / 2 + 18, h / 2 + 18, w / 2 - 36, h / 2 - 36);
      return;
    }

    ctx.fillStyle = isDesert ? '#9c7f54' : isDock ? '#475569' : isUrban ? '#525b66' : '#4f6d34';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      ctx.fillStyle = isDesert
        ? (Math.random() > 0.5 ? '#856941' : '#b39466')
        : isDock || isUrban
          ? (Math.random() > 0.5 ? '#334155' : '#64748b')
          : (Math.random() > 0.45 ? '#3f5928' : Math.random() > 0.2 ? '#658843' : '#746344');
      ctx.fillRect(x, y, 2 + Math.random() * 3, 2 + Math.random() * 4);
    }
  }, isKillhouse ? 14 : 24, isKillhouse ? 16 : 24);

  const roadTex = makeCanvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = isKillhouse ? '#1e2636' : '#2a303c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1200; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#161d29' : '#334155';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    ctx.fillStyle = isKillhouse ? '#38bdf8' : '#94a3b8';
    ctx.fillRect(0, 0, 10, h);
    ctx.fillRect(w - 10, 0, 10, h);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(18, 0, 4, h);
    ctx.fillRect(w - 22, 0, 4, h);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(w / 2 - 4, 16, 3, 92);
    ctx.fillRect(w / 2 + 2, 16, 3, 92);
    ctx.fillRect(w / 2 - 4, 144, 3, 92);
    ctx.fillRect(w / 2 + 2, 144, 3, 92);
  }, 1, 14);

  const wallTex = makeCanvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = isKillhouse ? '#475569' : isDesert ? '#cfa87a' : isUrban ? '#8a7968' : '#78889c';
    ctx.fillRect(0, 0, w, h);
    if (isKillhouse) {
      for (let i = 0; i < 1200; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.18)';
        ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
      }
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, w, 18);
      ctx.fillRect(0, h - 28, w, 28);
      for (let x = -28; x < w + 28; x += 28) {
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.moveTo(x, h - 24); ctx.lineTo(x + 14, h - 24);
        ctx.lineTo(x + 4, h - 4); ctx.lineTo(x - 10, h - 4);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(15,23,42,0.45)';
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 22, w - 8, h - 54);
      return;
    }

    ctx.fillStyle = 'rgba(15,23,42,0.22)';
    for (let y = 0; y < h; y += 32) ctx.fillRect(0, y, w, 2);
    for (let x = 0; x < w; x += 64) ctx.fillRect(x, 0, 2, h);
    [[34, 42], [154, 42], [34, 148], [154, 148]].forEach(([wx, wy]) => {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(wx - 4, wy - 4, 72, 62);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(wx, wy, 64, 54);
      ctx.fillStyle = 'rgba(148,197,255,0.28)';
      ctx.beginPath();
      ctx.moveTo(wx + 4, wy + 4); ctx.lineTo(wx + 36, wy + 4); ctx.lineTo(wx + 12, wy + 50); ctx.lineTo(wx + 4, wy + 50);
      ctx.fill();
      ctx.fillStyle = '#334155';
      ctx.fillRect(wx + 30, wy, 4, 54);
      ctx.fillRect(wx, wy + 25, 64, 4);
    });
  }, isKillhouse ? 3 : 1, 1);

  const contTex = makeCanvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 12) {
      ctx.fillStyle = 'rgba(255,255,255,0.34)';
      ctx.fillRect(x, 0, 6, h);
      ctx.fillStyle = 'rgba(15,23,42,0.42)';
      ctx.fillRect(x + 6, 0, 6, h);
    }
    ctx.fillStyle = 'rgba(15,23,42,0.68)';
    ctx.fillRect(0, 0, w, 16);
    ctx.fillRect(0, h - 16, w, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillRect(22, 44, 62, 10);
    ctx.fillRect(22, 62, 40, 8);
  }, 3, 1);

  const crateTex = makeCanvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#9a683a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#784e28';
    for (let y = 0; y < h; y += 16) ctx.fillRect(0, y, w, 2);
    ctx.strokeStyle = '#523418';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.beginPath();
    ctx.moveTo(8, 8); ctx.lineTo(w - 8, h - 8);
    ctx.stroke();
  }, 1, 1);

  const deckTex = makeCanvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#475569';
    for (let y = 0; y < h; y += 16) {
      for (let x = (y % 32 === 0 ? 0 : 8); x < w; x += 16) {
        ctx.fillRect(x + 2, y + 2, 10, 4);
      }
    }
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);
  }, 4, 4);

  TEX_CACHE[mapId] = { groundTex, roadTex, wallTex, contTex, crateTex, deckTex };
  return TEX_CACHE[mapId];
}

/* ===== DETAILED 3D WEAPON MODEL BUILDER ===== */
function buildDetailedGun3D(gid, isFpp = false) {
  const it = (typeof ITEMS !== 'undefined' && ITEMS[gid]) ? ITEMS[gid] : { id: 3, r: 'R', cat: 'ar', name: 'M4A1' };
  const rCol = (typeof RAR !== 'undefined' && RAR[it.r]) ? RAR[it.r].c : 0x4aa8ff;
  const isMythic = it.r === 'M' || it.r === 'L';
  const g = new THREE.Group();

  const steel = new THREE.MeshLambertMaterial({ color: 0x242b3a });
  const gunmetal = new THREE.MeshLambertMaterial({ color: 0x3b4458 });
  const polymer = new THREE.MeshLambertMaterial({ color: 0x2a303d });
  const woodOrGold = new THREE.MeshLambertMaterial({
    color: it.id === 7 ? 0xf59e0b : it.id === 5 ? 0x9a3412 : 0x333c4d
  });
  const trim = new THREE.MeshLambertMaterial({
    color: rCol,
    emissive: rCol,
    emissiveIntensity: isMythic ? 0.55 : 0.2
  });

  const isSniper = it.cat === 'sniper';
  const isLauncher = it.cat === 'launcher';
  const isSmg = it.cat === 'smg';
  const isShotgun = it.cat === 'shotgun';

  const bodyLen = isSniper ? 0.64 : isLauncher ? 0.74 : isSmg ? 0.34 : isShotgun ? 0.54 : 0.50;
  const barrelLen = isSniper ? 0.48 : isLauncher ? 0.34 : isSmg ? 0.16 : isShotgun ? 0.34 : 0.30;

  if (!isLauncher) {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.115, 0.24), woodOrGold);
    stock.position.set(0, -0.015, -bodyLen * 0.5 - 0.08);
    g.add(stock);
  }

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.105, bodyLen), isLauncher ? woodOrGold : steel);
  receiver.position.set(0, 0.01, 0.06);
  g.add(receiver);

  const railBase = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.016, bodyLen * 0.94), gunmetal);
  railBase.position.set(0, 0.068, 0.08);
  g.add(railBase);

  if (isFpp) {
    const toothGeo = new THREE.BoxGeometry(0.048, 0.008, 0.014);
    for (let z = -0.14; z <= 0.30; z += 0.028) {
      const tooth = new THREE.Mesh(toothGeo, steel);
      tooth.position.set(0, 0.078, z);
      g.add(tooth);
    }
  }

  const sideStrip = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.02, bodyLen * 0.78), trim);
  sideStrip.position.set(0, 0.015, 0.08);
  g.add(sideStrip);

  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.084, bodyLen * 0.56), polymer);
  guard.position.set(0, 0.01, bodyLen * 0.38);
  g.add(guard);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.13, 0.065), polymer);
  grip.position.set(0, -0.075, -0.02);
  grip.rotation.x = -0.26;
  g.add(grip);

  if (!isSmg && !isLauncher) {
    const fgrip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.1, 8), polymer);
    fgrip.position.set(0, -0.075, bodyLen * 0.42);
    g.add(fgrip);
  }

  const magGroup = new THREE.Group();
  magGroup.position.set(0, -0.11, bodyLen * 0.16);
  if (!isLauncher && !isShotgun) {
    const magH = isSniper ? 0.12 : isSmg ? 0.2 : 0.23;
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.048, magH, 0.075), isMythic ? trim : steel);
    mag.rotation.x = 0.26;
    magGroup.add(mag);
  }
  g.add(magGroup);

  const boltMesh = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.018, 0.032), gunmetal);
  boltMesh.position.set(0, 0.042, 0.04);
  g.add(boltMesh);

  const barrelRad = isLauncher ? 0.056 : isShotgun ? 0.024 : 0.015;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(barrelRad, barrelRad, barrelLen, 10), steel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.024, bodyLen * 0.5 + 0.06 + barrelLen * 0.5);
  g.add(barrel);

  const muzzleZ = bodyLen * 0.5 + 0.06 + barrelLen;
  if (!isLauncher) {
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.042, 0.022), steel);
    frontSight.position.set(0, 0.055, muzzleZ - 0.04);
    g.add(frontSight);
  }

  const brake = new THREE.Mesh(new THREE.CylinderGeometry(barrelRad * 1.45, barrelRad * 1.35, 0.07, 10), trim);
  brake.rotation.x = Math.PI / 2;
  brake.position.set(0, 0.024, muzzleZ + 0.02);
  g.add(brake);

  if (isSniper) {
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.30, 12), steel);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.105, 0.02);
    g.add(scopeTube);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.02, 12), trim);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0.105, 0.17);
    g.add(lens);
  } else if (!isLauncher) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.018, 0.095), steel);
    base.position.set(0, 0.088, 0.01);
    g.add(base);
    const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.048, 0.088), steel);
    wallL.position.set(-0.025, 0.116, 0.01);
    g.add(wallL);
    const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.048, 0.088), steel);
    wallR.position.set(0.025, 0.116, 0.01);
    g.add(wallR);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.008, 0.088), steel);
    roof.position.set(0, 0.142, 0.01);
    g.add(roof);

    const glassMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.042, 0.042), glassMat);
    glass.position.set(0, 0.116, 0.02);
    g.add(glass);

    const retRing = new THREE.Mesh(
      new THREE.RingGeometry(0.006, 0.009, 16),
      new THREE.MeshBasicMaterial({ color: 0xff2a55, side: THREE.DoubleSide })
    );
    retRing.position.set(0, 0.116, 0.021);
    g.add(retRing);
  }

  const flashMat = new THREE.MeshBasicMaterial({ color: isMythic ? rCol : 0xffe066, transparent: true, opacity: 0.92 });
  const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), flashMat);
  flash.scale.set(0.8, 0.8, 2.2);
  flash.position.set(0, 0.024, muzzleZ + 0.16);
  flash.visible = false;
  g.add(flash);

  return { group: g, magGroup, boltMesh, flash, cat: it.cat };
}

/* ===== FIRST-PERSON VIEWMODEL ===== */
function createFppViewmodel() {
  const root = new THREE.Group();
  const swayGroup = new THREE.Group();
  root.add(swayGroup);

  const weaponPivot = new THREE.Group();
  swayGroup.add(weaponPivot);

  const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x263449 });
  const gloveMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xd49b72 });

  const rArm = new THREE.Group();
  const rForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.34, 10), sleeveMat);
  rForearm.rotation.x = Math.PI * 0.42;
  rForearm.position.set(0.04, -0.14, -0.16);
  rArm.add(rForearm);
  const rGlove = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.075, 0.085), gloveMat);
  rGlove.position.set(0, -0.055, -0.02);
  rArm.add(rGlove);
  weaponPivot.add(rArm);

  const lArm = new THREE.Group();
  const lForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.043, 0.38, 10), sleeveMat);
  lForearm.rotation.x = Math.PI * 0.38, -0.35, -0.22;
  lForearm.position.set(-0.13, -0.13, -0.04);
  lArm.add(lForearm);
  const lWrist = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.034, 0.07, 10), skinMat);
  lWrist.rotation.set(Math.PI * 0.45, -0.2, 0);
  lWrist.position.set(-0.04, -0.055, 0.14);
  lArm.add(lWrist);
  const lGlove = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.062, 0.09), gloveMat);
  lGlove.position.set(-0.015, -0.035, 0.21);
  lArm.add(lGlove);
  weaponPivot.add(lArm);

  let gunObj = null, adsLerp = 0, bobT = 0, recoilKick = 0;

  function setGun(gid) {
    if (gunObj) weaponPivot.remove(gunObj.group);
    gunObj = buildDetailedGun3D(gid, true);
    gunObj.group.rotation.y = Math.PI;
    weaponPivot.add(gunObj.group);
  }

  function triggerRecoil() {
    recoilKick = 1.0;
    if (gunObj && gunObj.flash) gunObj.flash.visible = true;
  }

  function update(dt, st) {
    root.visible = !!st.visible;
    if (!st.visible) return;

    const targetAds = (st.scoped && !st.reloading) ? 1 : 0;
    adsLerp += (targetAds - adsLerp) * Math.min(1, dt * 16);

    if (recoilKick > 0) {
      recoilKick = Math.max(0, recoilKick - dt * 13);
      if (gunObj && gunObj.flash && recoilKick < 0.45) gunObj.flash.visible = false;
    }

    const hipX = 0.21, hipY = -0.22, hipZ = -0.44;
    const adsX = 0.00, adsY = -0.118, adsZ = -0.32;
    let px = hipX + (adsX - hipX) * adsLerp;
    let py = hipY + (adsY - hipY) * adsLerp;
    let pz = hipZ + (adsZ - hipZ) * adsLerp;

    const moveRate = st.mag > 0.1 ? (st.sprint > 1.1 ? 13 : 8.5) : 2.0;
    bobT += dt * moveRate;
    const bobAmp = (st.mag > 0.1 ? 0.012 * st.mag : 0.002) * (1 - adsLerp * 0.85);
    px += Math.cos(bobT * 0.5) * bobAmp;
    py += Math.abs(Math.sin(bobT)) * bobAmp * 0.85;
    pz += recoilKick * 0.045;

    swayGroup.position.set(px, py, pz);
    swayGroup.rotation.set(
      recoilKick * 0.065 - st.slideLerp * 0.07,
      -0.035 * (1 - adsLerp),
      st.slideLerp * 0.12 + Math.sin(bobT * 0.5) * bobAmp * 1.2
    );

    if (st.reloading && gunObj) {
      const p = st.reloadProg;
      const cat = st.weaponCat || 'ar';
      let tiltZ = 0, tiltX = 0, magDropY = 0, handOffX = 0, handOffY = 0, handOffZ = 0, boltBack = 0;

      if (cat === 'shotgun') {
        const shellWave = Math.sin(p * Math.PI);
        tiltZ = -0.25 * shellWave;
        tiltX = 0.34 * shellWave;
        handOffX = -0.04 * shellWave;
        handOffY = -0.06 * shellWave;
        handOffZ = 0.14 * Math.sin(p * Math.PI * 2);
        boltBack = 0.09 * Math.sin(Math.max(0, (p - 0.65) / 0.35) * Math.PI);
      } else if (cat === 'sniper') {
        if (p < 0.35) {
          const k = p / 0.35;
          tiltZ = -0.36 * k;
          magDropY = -0.26 * k;
          handOffY = -0.22 * k;
        } else if (p < 0.70) {
          const k = (p - 0.35) / 0.35;
          tiltZ = -0.36 * (1 - k);
          magDropY = -0.26 * (1 - k);
          handOffY = -0.22 * (1 - k);
        } else {
          const k = (p - 0.70) / 0.30;
          boltBack = 0.11 * Math.sin(k * Math.PI);
          handOffZ = 0.14 * Math.sin(k * Math.PI);
        }
      } else {
        if (p < 0.25) {
          const k = p / 0.25;
          tiltZ = -0.44 * k;
          tiltX = 0.24 * k;
          handOffY = -0.08 * k;
          handOffZ = 0.12 * k;
        } else if (p < 0.55) {
          const k = (p - 0.25) / 0.30;
          tiltZ = -0.44;
          tiltX = 0.24;
          magDropY = -0.34 * k;
          handOffY = -0.08 - 0.28 * k;
          handOffZ = 0.12;
        } else if (p < 0.80) {
          const k = (p - 0.55) / 0.25;
          tiltZ = -0.44 * (1 - k * 0.25);
          tiltX = 0.24 + Math.sin(k * Math.PI) * 0.08;
          magDropY = -0.34 * (1 - k);
          handOffY = -0.36 * (1 - k);
          handOffZ = 0.12 * (1 - k * 0.5);
        } else {
          const k = (p - 0.80) / 0.20;
          const slam = Math.sin(k * Math.PI);
          tiltZ = -0.33 * (1 - k);
          tiltX = 0.24 * (1 - k);
          boltBack = 0.09 * slam;
          handOffX = 0.06 * slam;
          handOffY = 0.07 * slam;
          handOffZ = 0.11 * slam;
        }
      }

      weaponPivot.rotation.set(tiltX, 0, tiltZ);
      lArm.position.set(handOffX, handOffY, handOffZ);
      gunObj.magGroup.position.y = -0.11 + magDropY;
      gunObj.boltMesh.position.z = 0.04 - boltBack;
    } else if (gunObj) {
      weaponPivot.rotation.set(0, 0, 0);
      lArm.position.set(0, 0, 0);
      gunObj.magGroup.position.y = -0.11;
      gunObj.boltMesh.position.z = 0.04 - recoilKick * 0.05;
    }
  }

  return { root, setGun, triggerRecoil, update };
}

/* ===== CODM-VISIBLE 3D SOLDIER AVATAR WITH OVERHEAD TEAM TAG & SHOULDER BEACON ===== */
function makeSoldierAvatar(opts = {}) {
  const armorCol = opts.armorCol || 0x2e64b8;
  const tint = opts.tint || null;
  const teamCol = opts.isEnemy ? 0xff2a55 : 0x38bdf8;
  const grp = new THREE.Group();
  let mix = null, actions = {}, activeAct = null, weaponMount = null, curGunObj = null;
  let lims = null, bones = {}, axes = {}, rHandBone = null, modelRoot = null, hasSkeletal = false;
  let aimPitch = 0, firingPulse = 0, crouchLerp = 0, slideLerp = 0, reloadProg = 0, isReloading = false, weaponCat = 'ar';
  let deathFall = 0;

  if (opts.showBeacon) {
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 8, 8),
      new THREE.MeshBasicMaterial({ color: teamCol })
    );
    beacon.position.set(-0.24, 1.48, 0);
    grp.add(beacon);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.52, 24),
      new THREE.MeshBasicMaterial({ color: teamCol, side: THREE.DoubleSide, transparent: true, opacity: 0.72 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    grp.add(ring);
  }

  let nameTagSprite = null, tagCtx = null, tagTex = null, lastTagText = '', lastTagHp = -1;
  if (opts.label) {
    const cv = document.createElement('canvas');
    cv.width = 320;
    cv.height = 80;
    tagCtx = cv.getContext('2d');
    tagTex = new THREE.CanvasTexture(cv);
    const spMat = new THREE.SpriteMaterial({ map: tagTex, transparent: true, depthTest: false });
    nameTagSprite = new THREE.Sprite(spMat);
    nameTagSprite.scale.set(2.05, 0.52, 1);
    nameTagSprite.position.set(0, 2.28, 0);
    grp.add(nameTagSprite);
  }

  function updateTag(labelText, hpVal = 100) {
    if (!tagCtx || !tagTex) return;
    const clampedHp = Math.max(0, Math.min(100, Math.ceil(hpVal)));
    if (labelText === lastTagText && clampedHp === lastTagHp) return;
    lastTagText = labelText;
    lastTagHp = clampedHp;
    tagCtx.clearRect(0, 0, 320, 80);

    tagCtx.fillStyle = 'rgba(6, 12, 26, 0.86)';
    tagCtx.fillRect(14, 10, 292, 58);
    tagCtx.strokeStyle = opts.isEnemy ? '#ff2a55' : '#38bdf8';
    tagCtx.lineWidth = 3;
    tagCtx.strokeRect(14, 10, 292, 58);

    tagCtx.fillStyle = opts.isEnemy ? '#ff2a55' : '#0284c7';
    tagCtx.fillRect(22, 16, 66, 22);
    tagCtx.fillStyle = '#ffffff';
    tagCtx.font = 'bold 13px sans-serif';
    tagCtx.textAlign = 'center';
    tagCtx.fillText(opts.isEnemy ? 'BRAVO' : 'ALPHA', 55, 31);

    tagCtx.fillStyle = '#f8fafc';
    tagCtx.font = 'bold 18px sans-serif';
    tagCtx.textAlign = 'left';
    tagCtx.fillText(String(labelText).slice(0, 14), 96, 33);

    tagCtx.fillStyle = '#1e293b';
    tagCtx.fillRect(22, 46, 276, 12);
    tagCtx.fillStyle = opts.isEnemy ? '#ff2a55' : '#22c55e';
    tagCtx.fillRect(22, 46, 276 * (clampedHp / 100), 12);
    tagTex.needsUpdate = true;
  }
  if (opts.label) updateTag(opts.label, 100);

  function setGun(gid) {
    if (!weaponMount) return;
    if (curGunObj) weaponMount.remove(curGunObj.group);
    curGunObj = buildDetailedGun3D(gid, false);
    weaponCat = curGunObj.cat || 'ar';
    weaponMount.add(curGunObj.group);
  }

  function setAnim(name, speedScale = 1.0) {
    if (lims) {
      lims.mode = name;
      lims.speed = speedScale;
    }
    if (!mix) return;
    const clipAct = actions[name] || actions.Idle || Object.values(actions)[0];
    if (!clipAct) return;
    clipAct.timeScale = speedScale;
    if (activeAct === clipAct) return;
    if (activeAct) activeAct.fadeOut(0.16);
    clipAct.reset().fadeIn(0.16).play();
    activeAct = clipAct;
  }

  function aimBoneAt(bone, childAxisLocal, targetWorldPos) {
    if (!bone || !bone.parent || !childAxisLocal) return;
    bone.updateWorldMatrix(true, false);
    bone.parent.updateWorldMatrix(true, false);
    const boneWorldPos = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);
    const desiredDirWorld = targetWorldPos.clone().sub(boneWorldPos);
    if (desiredDirWorld.lengthSq() < 1e-6) return;
    desiredDirWorld.normalize();
    const parentWorldQuat = new THREE.Quaternion();
    bone.parent.getWorldQuaternion(parentWorldQuat);
    const desiredDirLocal = desiredDirWorld.applyQuaternion(parentWorldQuat.clone().invert()).normalize();
    bone.quaternion.setFromUnitVectors(childAxisLocal, desiredDirLocal);
    bone.updateMatrixWorld(true);
  }

  function applyRifleHoldPose() {
    if (!hasSkeletal) return;

    const dropY = crouchLerp * 0.34 + slideLerp * 0.54;
    if (modelRoot) {
      modelRoot.position.y = -dropY;
      modelRoot.position.z = slideLerp * 0.16;
      modelRoot.rotation.x = -slideLerp * 0.28;
      modelRoot.rotation.z = slideLerp * 0.08;
    }

    if (bones.spine) {
      bones.spine.rotation.x = crouchLerp * 0.20 + slideLerp * 0.24;
    }

    if (crouchLerp > 0.01 || slideLerp > 0.01) {
      if (bones.rUpLeg) bones.rUpLeg.rotation.x += crouchLerp * 0.62 + slideLerp * 0.52;
      if (bones.rLeg) bones.rLeg.rotation.x -= crouchLerp * 1.02 + slideLerp * 0.68;
      if (bones.lUpLeg) bones.lUpLeg.rotation.x += crouchLerp * 0.62 - slideLerp * 0.34;
      if (bones.lLeg) bones.lLeg.rotation.x -= crouchLerp * 1.02 + slideLerp * 0.38;
    }

    grp.updateMatrixWorld(true);

    const recoilZ = firingPulse * 0.04;
    const pOff = Math.max(-0.45, Math.min(0.45, aimPitch));

    const rElbowWorld = grp.localToWorld(new THREE.Vector3(0.32, 1.08 - dropY, -0.06));
    const gripWorld = grp.localToWorld(new THREE.Vector3(0.16, 1.28 - dropY + pOff * 0.22, -0.32 + recoilZ));

    let lHandLocal = new THREE.Vector3(0.05, 1.31 - dropY + pOff * 0.45, -0.60 + recoilZ);
    let magDrop = 0;
    if (isReloading) {
      const p = reloadProg;
      if (p < 0.32) {
        const k = p / 0.32;
        lHandLocal.set(0.08, 1.12 - dropY - 0.16 * k, -0.38);
      } else if (p < 0.68) {
        const k = (p - 0.32) / 0.36;
        magDrop = (weaponCat === 'shotgun' ? 0 : -0.25 * Math.sin(k * Math.PI));
        lHandLocal.set(0.08, 0.96 - dropY + 0.22 * k, -0.38);
      } else {
        const k = (p - 0.68) / 0.32;
        lHandLocal.set(0.05, 1.28 - dropY, -0.45 - 0.15 * k);
      }
    }
    if (curGunObj) curGunObj.magGroup.position.y = -0.11 + magDrop;

    const lElbowWorld = grp.localToWorld(new THREE.Vector3(-0.22, 1.08 - dropY, -0.36));
    const foregripWorld = grp.localToWorld(lHandLocal);
    const barrelTargetWorld = grp.localToWorld(new THREE.Vector3(0.05, 1.31 - dropY + pOff * 0.45, -0.60 + recoilZ));

    aimBoneAt(bones.rArm, axes.rArm, rElbowWorld);
    aimBoneAt(bones.rForeArm, axes.rForeArm, gripWorld);
    aimBoneAt(bones.lArm, axes.lArm, lElbowWorld);
    aimBoneAt(bones.lForeArm, axes.lForeArm, foregripWorld);

    if (weaponMount && rHandBone) {
      rHandBone.updateWorldMatrix(true, false);
      const pWorldQuat = new THREE.Quaternion();
      rHandBone.getWorldQuaternion(pWorldQuat);

      const grpWorldQuat = new THREE.Quaternion();
      grp.getWorldQuaternion(grpWorldQuat);
      const worldUp = new THREE.Vector3(0, 1, 0).applyQuaternion(grpWorldQuat);

      const lookM = new THREE.Matrix4().lookAt(barrelTargetWorld, gripWorld, worldUp);
      const targetWorldQuat = new THREE.Quaternion().setFromRotationMatrix(lookM);
      weaponMount.quaternion.copy(pWorldQuat).invert().multiply(targetWorldQuat);
      weaponMount.position.set(0, 0, 0);
      weaponMount.updateMatrixWorld(true);
    }
  }

  if (typeof GLTF_CACHE !== 'undefined' && GLTF_CACHE && GLTF_CACHE.soldier && THREE.SkeletonUtils) {
    hasSkeletal = true;
    const model = THREE.SkeletonUtils.clone(GLTF_CACHE.soldier.scene);
    model.scale.setScalar(1.06);
    model.updateMatrixWorld(true);
    modelRoot = model;

    model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if ((tint || opts.showBeacon) && o.material) {
          o.material = o.material.clone();
          if (o.material.emissive) {
            o.material.emissive = new THREE.Color(tint || teamCol);
            o.material.emissiveIntensity = 0.24;
          }
        }
      }
      if (o.isBone) {
        if (/Spine1/i.test(o.name)) bones.spine = o;
        if (/RightArm$/i.test(o.name)) bones.rArm = o;
        if (/RightForeArm/i.test(o.name)) bones.rForeArm = o;
        if (/RightHand$/i.test(o.name)) { bones.rHand = o; rHandBone = o; }
        if (/LeftArm$/i.test(o.name)) bones.lArm = o;
        if (/LeftForeArm/i.test(o.name)) bones.lForeArm = o;
        if (/LeftHand$/i.test(o.name)) bones.lHand = o;
        if (/RightUpLeg/i.test(o.name)) bones.rUpLeg = o;
        if (/RightLeg/i.test(o.name)) bones.rLeg = o;
        if (/LeftUpLeg/i.test(o.name)) bones.lUpLeg = o;
        if (/LeftLeg/i.test(o.name)) bones.lLeg = o;
      }
    });

    const getChildAxis = child => (child && child.position.lengthSq() > 0.0001)
      ? child.position.clone().normalize()
      : new THREE.Vector3(0, 1, 0);

    axes.rArm = getChildAxis(bones.rForeArm);
    axes.rForeArm = getChildAxis(bones.rHand);
    axes.lArm = getChildAxis(bones.lForeArm);
    axes.lForeArm = getChildAxis(bones.lHand);

    if (rHandBone) {
      const ws = new THREE.Vector3();
      rHandBone.getWorldScale(ws);
      const invScale = ws.x > 0.0001 ? (1.0 / ws.x) : 100;

      weaponMount = new THREE.Group();
      weaponMount.scale.setScalar(invScale);
      rHandBone.add(weaponMount);
    } else {
      weaponMount = new THREE.Group();
      weaponMount.position.set(0.16, 1.28, -0.32);
      weaponMount.rotation.y = Math.PI;
      model.add(weaponMount);
    }
    grp.add(model);

    if (GLTF_CACHE.soldier.animations && GLTF_CACHE.soldier.animations.length) {
      mix = new THREE.AnimationMixer(model);
      GLTF_CACHE.soldier.animations.forEach(clip => {
        if (/tpose/i.test(clip.name)) return;
        const key = /run/i.test(clip.name) ? 'Run' : /walk/i.test(clip.name) ? 'Walk' : 'Idle';
        actions[key] = mix.clipAction(clip);
      });
      const startClip = actions.Idle || actions.Walk || actions.Run;
      if (startClip) {
        startClip.play();
        activeAct = startClip;
      }
      const origUpdate = mix.update.bind(mix);
      mix.update = dt => {
        origUpdate(dt);
        if (firingPulse > 0) {
          firingPulse = Math.max(0, firingPulse - dt * 14);
          if (curGunObj && curGunObj.flash && firingPulse <= 0.35) curGunObj.flash.visible = false;
        }
        applyRifleHoldPose();
      };
    }
    applyRifleHoldPose();
  } else {
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd9a077 });
    const vestMat = new THREE.MeshLambertMaterial({ color: armorCol, emissive: teamCol, emissiveIntensity: 0.22 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x263147 });
    const visorMat = new THREE.MeshLambertMaterial({ color: tint || teamCol, emissive: tint || teamCol, emissiveIntensity: 0.55 });

    const body = new THREE.Group();
    grp.add(body);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.62, 0.28), vestMat);
    torso.position.y = 1.12;
    torso.castShadow = true;
    body.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), skinMat);
    head.position.y = 1.62;
    head.castShadow = true;
    body.add(head);

    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.33), darkMat);
    helmet.position.set(0, 1.72, 0.01);
    body.add(helmet);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.05), visorMat);
    visor.position.set(0, 1.63, -0.14);
    body.add(visor);

    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.48, 0.14), darkMat);
    armL.position.set(-0.14, 1.24, -0.34);
    armL.rotation.set(1.25, -0.35, 0.25);
    body.add(armL);

    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.48, 0.14), darkMat);
    armR.position.set(0.22, 1.22, -0.22);
    armR.rotation.set(1.15, 0.1, -0.1);
    body.add(armR);

    weaponMount = new THREE.Group();
    weaponMount.position.set(0.16, 1.28, -0.32);
    weaponMount.rotation.y = Math.PI;
    body.add(weaponMount);

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.78, 0.19), darkMat);
    legL.position.set(-0.14, 0.4, 0);
    grp.add(legL);

    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.78, 0.19), darkMat);
    legR.position.set(0.14, 0.4, 0);
    grp.add(legR);

    lims = { body, legL, legR, mode: 'Idle', speed: 1, t: 0 };
    mix = {
      update(dt) {
        const rate = lims.mode === 'Run' ? 12 * lims.speed : lims.mode === 'Walk' ? 7 * lims.speed : 2.2;
        lims.t += dt * rate;
        const drop = crouchLerp * 0.34 + slideLerp * 0.54;
        if (slideLerp > 0.05) {
          lims.legL.rotation.x = -0.55 * slideLerp;
          lims.legR.rotation.x = 0.35 * slideLerp;
          lims.body.rotation.x = 0.24 * slideLerp;
        } else if (lims.mode === 'Run' || lims.mode === 'Walk') {
          const amp = lims.mode === 'Run' ? 0.72 : 0.42;
          lims.legL.rotation.x = Math.sin(lims.t) * amp;
          lims.legR.rotation.x = -Math.sin(lims.t) * amp;
          lims.body.rotation.x = 0;
        } else {
          lims.legL.rotation.x *= 0.82;
          lims.legR.rotation.x *= 0.82;
          lims.body.rotation.x = 0;
        }
        lims.body.position.y = -drop + Math.abs(Math.cos(lims.t)) * 0.03;
        if (firingPulse > 0) {
          firingPulse = Math.max(0, firingPulse - dt * 14);
          if (curGunObj && curGunObj.flash && firingPulse <= 0.35) curGunObj.flash.visible = false;
        }
      }
    };
  }

  setGun(opts.gunId != null ? opts.gunId : 3);

  return {
    grp,
    mix,
    setGun,
    setAnim,
    updateTag,
    setAimPitch(p) { aimPitch = p; },
    setStance(crouch, slide, rel, relP) {
      crouchLerp = crouch;
      slideLerp = slide;
      isReloading = rel;
      reloadProg = relP;
    },
    setDeathFall(f) {
      deathFall = Math.max(0, Math.min(1, f));
      const eased = 1 - Math.pow(1 - deathFall, 2);
      grp.rotation.x = eased * (Math.PI * 0.48);
      grp.rotation.z = eased * 0.22;
      grp.position.y = eased * 0.24;
    },
    triggerMuzzle() {
      firingPulse = 1.0;
      if (curGunObj && curGunObj.flash) curGunObj.flash.visible = true;
    },
    update(dt) {
      if (mix) mix.update(dt);
    },
    weaponMount
  };
}

/* ===== WEAPON SPECS & CODM GUNSMITH ATTRIBUTES ===== */
const TEST_WEAPON_POOL = [
  { id: 3, name: 'M4A1 TACTICAL', cat: 'ar', r: 'R' },
  { id: 7, name: 'AK-47 GOLD DRAGON', cat: 'ar', r: 'M' },
  { id: 0, name: 'VECTOR SMG', cat: 'smg', r: 'R' },
  { id: 5, name: 'L96A1 SNIPER', cat: 'sniper', r: 'L' },
  { id: 1, name: 'M870 SHOTGUN', cat: 'shotgun', r: 'E' },
  { id: 6, name: 'RPG-7 LAUNCHER', cat: 'launcher', r: 'L' }
];

const GUNSMITH_ATTACHMENTS = {
  barrel: [
    { id: 'std_brl', label: 'Standard Barrel', dmg: 0, rng: 0, mob: 0, acc: 0, ctrl: 0 },
    { id: 'ext_brl', label: 'Ranger Marksman Barrel', dmg: 3, rng: 14, mob: -6, acc: 8, ctrl: 4 },
    { id: 'sup_brl', label: 'YKM Integral Suppressor', dmg: 0, rng: 6, mob: 2, acc: 5, ctrl: 5, suppressed: true }
  ],
  optic: [
    { id: 'iron', label: 'Iron / Holographic', zoom: 36, acc: 2, mob: 2 },
    { id: 'rds', label: 'Classic Red Dot Sight', zoom: 30, acc: 6, mob: 0 },
    { id: 'tac_x3', label: '3x Tactical Scope', zoom: 18, acc: 10, mob: -4 }
  ],
  underbarrel: [
    { id: 'none_ub', label: 'None', ctrl: 0, acc: 0, mob: 0 },
    { id: 'ranger_fg', label: 'Ranger Foregrip', ctrl: 10, acc: 6, mob: -4 },
    { id: 'strike_fg', label: 'Strike Foregrip', ctrl: 7, acc: 8, mob: -2 }
  ],
  laser: [
    { id: 'none_ls', label: 'None', acc: 0, mob: 0 },
    { id: 'owc_tac', label: 'OWC Laser - Tactical', acc: 9, mob: 3, spreadMul: 0.78 }
  ],
  grip: [
    { id: 'std_grp', label: 'Standard Grip', acc: 0, ctrl: 0 },
    { id: 'gran_grp', label: 'Granulated Grip Tape', acc: 9, ctrl: 6, spreadMul: 0.82 }
  ]
};

function getWeaponSpec(gunIdOrDef, loadCfg = null) {
  const def = typeof gunIdOrDef === 'object' && gunIdOrDef !== null ? gunIdOrDef : null;
  const gid = def ? def.id : gunIdOrDef;
  const baseItem = (typeof ITEMS !== 'undefined' && ITEMS[gid]) ? ITEMS[gid] : null;
  const it = def || baseItem || TEST_WEAPON_POOL[0];
  const cat = it.cat || 'ar';
  const r = it.r || 'R';
  const tierMul = { C: 1.0, R: 1.15, E: 1.3, L: 1.48, M: 1.7 }[r] || 1.0;

  const base = {
    smg:      { dmg: 22, rate: 105, mag: 36, res: 144, relMs: 1250, zoom: 40, spread: 0.025, pellets: 1, speed: 92, drop: 2.2,  stats: { damage: 46, fireRate: 86, accuracy: 62, mobility: 84, range: 44, control: 68 } },
    ar:       { dmg: 30, rate: 135, mag: 30, res: 120, relMs: 1450, zoom: 34, spread: 0.014, pellets: 1, speed: 115, drop: 3.0,  stats: { damage: 64, fireRate: 72, accuracy: 74, mobility: 70, range: 66, control: 72 } },
    sniper:   { dmg: 98, rate: 520, mag: 5,  res: 25,  relMs: 1750, zoom: 15, spread: 0.001, pellets: 1, speed: 185, drop: 1.2,  stats: { damage: 95, fireRate: 34, accuracy: 92, mobility: 48, range: 96, control: 58 } },
    shotgun:  { dmg: 19, rate: 480, mag: 8,  res: 32,  relMs: 1650, zoom: 42, spread: 0.068, pellets: 7, speed: 78,  drop: 7.5,  stats: { damage: 84, fireRate: 42, accuracy: 52, mobility: 72, range: 28, control: 54 } },
    launcher: { dmg: 125,rate: 850, mag: 3,  res: 12,  relMs: 1950, zoom: 32, spread: 0.006, pellets: 1, speed: 58,  drop: 5.5,  stats: { damage: 99, fireRate: 26, accuracy: 68, mobility: 42, range: 78, control: 48 }, explosive: true }
  }[cat] || { dmg: 30, rate: 135, mag: 30, res: 120, relMs: 1450, zoom: 34, spread: 0.014, pellets: 1, speed: 115, drop: 3.0, stats: { damage: 64, fireRate: 72, accuracy: 74, mobility: 70, range: 66, control: 72 } };

  const att = loadCfg || {};
  const brl = GUNSMITH_ATTACHMENTS.barrel.find(x => x.id === att.barrel) || GUNSMITH_ATTACHMENTS.barrel[0];
  const opt = GUNSMITH_ATTACHMENTS.optic.find(x => x.id === att.optic) || GUNSMITH_ATTACHMENTS.optic[0];
  const ub  = GUNSMITH_ATTACHMENTS.underbarrel.find(x => x.id === att.underbarrel) || GUNSMITH_ATTACHMENTS.underbarrel[0];
  const lsr = GUNSMITH_ATTACHMENTS.laser.find(x => x.id === att.laser) || GUNSMITH_ATTACHMENTS.laser[0];
  const grp = GUNSMITH_ATTACHMENTS.grip.find(x => x.id === att.grip) || GUNSMITH_ATTACHMENTS.grip[0];

  const clamp100 = v => Math.max(10, Math.min(100, Math.round(v)));
  const finalStats = {
    damage:   clamp100(base.stats.damage + (brl.dmg || 0) * 2),
    fireRate: clamp100(base.stats.fireRate),
    accuracy: clamp100(base.stats.accuracy + (brl.acc || 0) + (opt.acc || 0) + (ub.acc || 0) + (lsr.acc || 0) + (grp.acc || 0)),
    mobility: clamp100(base.stats.mobility + (brl.mob || 0) + (opt.mob || 0) + (ub.mob || 0) + (lsr.mob || 0)),
    range:    clamp100(base.stats.range + (brl.rng || 0)),
    control:  clamp100(base.stats.control + (brl.ctrl || 0) + (ub.ctrl || 0) + (grp.ctrl || 0))
  };

  const spreadMul = (lsr.spreadMul || 1) * (grp.spreadMul || 1) * (1 - (finalStats.accuracy - 60) * 0.003);

  return Object.assign({}, base, {
    id: it.id,
    name: it.name,
    rarity: r,
    cat,
    dmg: Math.round((base.dmg + (brl.dmg || 0)) * tierMul),
    zoom: (cat === 'sniper') ? base.zoom : (opt.zoom || base.zoom),
    spread: Math.max(0.0005, base.spread * Math.max(0.45, spreadMul)),
    suppressed: !!brl.suppressed,
    stats: finalStats,
    att: {
      barrel: brl.id,
      optic: opt.id,
      underbarrel: ub.id,
      laser: lsr.id,
      grip: grp.id
    }
  });
}

/* ===== CROSS-DEVICE PRIVATE MULTIPLAYER, REAL INVITE BRIDGE & HOME-LOBBY MAP SYNC ===== */
(function initCrossDeviceMultiplayerAndMapSync() {
  if (typeof MAPS !== 'undefined' && Array.isArray(MAPS)) {
    ALL_BATTLE_MAPS.forEach(bm => {
      if (!MAPS.some(m => m.id === bm.id)) {
        MAPS.push({
          id: bm.id,
          name: bm.name,
          sky: bm.sky,
          desc: bm.desc
        });
      }
    });
  }

  if (typeof window.activeMap === 'function' && !window.__origActiveMap) {
    window.__origActiveMap = window.activeMap;
    window.activeMap = function () {
      if (PRIVATE_ROOM.active) {
        const m = getMapById(PRIVATE_ROOM.mapId);
        return {
          id: m.id,
          name: PRIVATE_ROOM.mapName || m.name,
          sky: resolveSkyHex(m.sky, m.id),
          isPrivate: true,
          mode: PRIVATE_ROOM.mode
        };
      }
      if (window.__SYNCED_MATCH_MAP && window.__SYNCED_MATCH_MAP.id) {
        const m = getMapById(window.__SYNCED_MATCH_MAP.id);
        return {
          id: m.id,
          name: window.__SYNCED_MATCH_MAP.name || m.name,
          sky: resolveSkyHex(m.sky, m.id)
        };
      }
      return window.__origActiveMap.apply(this, arguments);
    };
  }

  try {
    if ('BroadcastChannel' in window) {
      roomBroadcastChannel = new BroadcastChannel(ROOM_CHANNEL_NAME);
      roomBroadcastChannel.onmessage = ev => {
        if (ev && ev.data) handleIncomingRoomMessage(ev.data);
      };
    }
  } catch (e) {}

  window.addEventListener('storage', ev => {
    if (ev.key === ROOM_STORAGE_KEY && ev.newValue) {
      try {
        const rooms = JSON.parse(ev.newValue);
        if (PRIVATE_ROOM.roomId && rooms[PRIVATE_ROOM.roomId]) {
          applyRoomSnapshot(rooms[PRIVATE_ROOM.roomId]);
        }
        syncInvitesFromStorage(rooms);
      } catch (e) {}
    }
  });

  function syncInvitesFromStorage(roomsObj) {
    const rooms = roomsObj || readStoredRooms();
    const me = getCurrentUserProfile();
    const foundInvites = [];
    Object.values(rooms).forEach(rm => {
      if (!rm || !rm.roomId || !Array.isArray(rm.invites)) return;
      rm.invites.forEach(inv => {
        if (inv && (inv.targetId === me.pid || inv.targetName === me.name) && inv.fromPid !== me.pid) {
          foundInvites.push(inv);
        }
      });
    });
    PRIVATE_ROOM.incomingInvites = foundInvites;
  }

  function applyRoomSnapshot(snap) {
    if (!snap || snap.roomId !== PRIVATE_ROOM.roomId) return;
    if (snap.mode) PRIVATE_ROOM.mode = snap.mode;
    if (snap.mapId) setSyncedMapSelection(snap.mapId, snap.mapName);
    if (typeof snap.fillBots === 'boolean') PRIVATE_ROOM.fillBots = snap.fillBots;

    const me = getCurrentUserProfile();
    let hostStarted = false;

    if (snap.members && typeof snap.members === 'object') {
      Object.entries(snap.members).forEach(([pid, member]) => {
        if (!member) return;
        if (pid === me.pid) {
          if (member.team) PRIVATE_ROOM.myTeam = member.team;
          if (typeof member.ready === 'boolean') PRIVATE_ROOM.myReady = member.ready;
          if (typeof member.isHost === 'boolean') PRIVATE_ROOM.isHost = member.isHost;
        }
        PRIVATE_ROOM.peers[pid] = Object.assign({}, PRIVATE_ROOM.peers[pid] || {}, member, {
          pid,
          name: pid === me.pid ? me.name : (member.name || 'PLAYER'),
          lvl: pid === me.pid ? me.lvl : (member.lvl || 1),
          team: pid === me.pid ? PRIVATE_ROOM.myTeam : (member.team || 'bravo'),
          ready: pid === me.pid ? PRIVATE_ROOM.myReady : !!member.ready
        });
        if (pid !== me.pid && member.isHost && (member.started || snap.started)) {
          hostStarted = true;
        }
      });
    }

    if (snap.started && !PRIVATE_ROOM.isHost) {
      hostStarted = true;
    }

    if (PRIVATE_ROOM.screenOpen) {
      renderPrivateSlideBody();
    }

    if (hostStarted && PRIVATE_ROOM.screenOpen && !AR_LOADING && !AR) {
      PRIVATE_ROOM.active = true;
      PRIVATE_ROOM.started = true;
      closePrivateSlide(true);
      startMatch(PRIVATE_ROOM.roomId || (typeof SQUAD_ID !== 'undefined' ? SQUAD_ID : null));
    }
  }

  function handleIncomingRoomMessage(msg) {
    const me = getCurrentUserProfile();
    if (!msg || !msg.type) return;

    if (msg.type === 'invite') {
      if (msg.targetId === me.pid || msg.targetName === me.name) {
        PRIVATE_ROOM.incomingInvites = [
          ...PRIVATE_ROOM.incomingInvites.filter(x => !(x.roomId === msg.roomId && x.fromPid === msg.fromPid)),
          msg
        ];
        if (typeof toast === 'function') {
          toast(`📨 Room Invite from ${msg.fromName || 'Friend'} · Room ${msg.roomId}`);
        }
        if (PRIVATE_ROOM.screenOpen) renderPrivateSlideBody();
      }
      return;
    }

    if (msg.type === 'room_snapshot' && msg.roomId === PRIVATE_ROOM.roomId) {
      applyRoomSnapshot(msg.snapshot);
    }
  }

  function publishRoomSnapshot() {
    if (!PRIVATE_ROOM.roomId) return;
    const me = getCurrentUserProfile();
    const membersMap = Object.assign({}, PRIVATE_ROOM.peers || {});
    membersMap[me.pid] = {
      pid: me.pid,
      name: me.name,
      lvl: me.lvl,
      isHost: PRIVATE_ROOM.isHost,
      team: PRIVATE_ROOM.myTeam,
      ready: PRIVATE_ROOM.myReady,
      speaking: false,
      gunId: me.gunId,
      started: PRIVATE_ROOM.started
    };

    const rooms = readStoredRooms();
    const existing = rooms[PRIVATE_ROOM.roomId] || {};
    const snapshot = {
      roomId: PRIVATE_ROOM.roomId,
      hostPid: PRIVATE_ROOM.isHost ? me.pid : (existing.hostPid || me.pid),
      mode: PRIVATE_ROOM.mode,
      mapId: PRIVATE_ROOM.mapId,
      mapName: PRIVATE_ROOM.mapName,
      fillBots: PRIVATE_ROOM.fillBots,
      started: PRIVATE_ROOM.started,
      members: membersMap,
      invites: existing.invites || []
    };

    broadcastRoomEvent({
      type: 'room_snapshot',
      roomId: PRIVATE_ROOM.roomId,
      snapshot
    });
  }

  // Does NOT overwrite global `AR` while in lobby so `!AR` remains accurate for auto-deploy
  function ensureLobbyNetworkBridge() {
    if (AR) return;
    lobbyBridgeActive = true;
  }

  function pushLobbySync() {
    if (AR) return;
    ensureLobbyNetworkBridge();
    publishRoomSnapshot();
    syncInvitesFromStorage();
    if (typeof pushMyPlayerDoc === 'function' && (PRIVATE_ROOM.roomId || (typeof SQUAD_ID !== 'undefined' && SQUAD_ID))) {
      const me = getCurrentUserProfile();
      const curMap = getMapById(PRIVATE_ROOM.mapId || (typeof S !== 'undefined' && S && S.map) || 'killhouse_1v1');
      try {
        pushMyPlayerDoc({
          battle: {
            inMatch: false,
            privLobby: PRIVATE_ROOM.screenOpen || PRIVATE_ROOM.active,
            roomId: PRIVATE_ROOM.roomId || (typeof SQUAD_ID !== 'undefined' ? SQUAD_ID : ''),
            mode: PRIVATE_ROOM.mode,
            mapId: curMap.id,
            mapName: PRIVATE_ROOM.mapName || curMap.name,
            fillBots: PRIVATE_ROOM.fillBots,
            team: PRIVATE_ROOM.myTeam,
            ready: PRIVATE_ROOM.myReady,
            started: PRIVATE_ROOM.started,
            gunId: me.gunId,
            lvl: me.lvl,
            ts: Date.now()
          }
        });
      } catch (e) {}
    }
  }

  function ingestSquadMembers(members) {
    if (!Array.isArray(members) || !members.length) return;
    const me = getCurrentUserProfile();
    let hostStarted = false;

    members.forEach((m, idx) => {
      const b = m.battle || {};
      const pid = String(m.pid || (m.me ? me.pid : ('M_' + idx)));
      const isHostMember = !!m.isHost || (PRIVATE_ROOM.isHost && m.me);
      const team = m.me
        ? PRIVATE_ROOM.myTeam
        : (b.team || (isHostMember ? 'alpha' : 'bravo'));
      const ready = m.me
        ? PRIVATE_ROOM.myReady
        : (isHostMember ? true : !!b.ready);

      PRIVATE_ROOM.peers[pid] = {
        pid,
        name: m.name || (m.me ? me.name : 'PLAYER'),
        lvl: b.lvl || (m.me ? me.lvl : 1),
        isHost: isHostMember,
        team,
        ready,
        speaking: !!m.speaking,
        gunId: b.gunId != null ? b.gunId : 3
      };

      if (!m.me && isHostMember) {
        if (b.mapId) {
          setSyncedMapSelection(b.mapId, b.mapName);
        }
        if (b.mode) PRIVATE_ROOM.mode = b.mode;
        if (typeof b.fillBots === 'boolean') PRIVATE_ROOM.fillBots = b.fillBots;
        if (b.started || b.inMatch) {
          hostStarted = true;
        }
      }
    });

    if (PRIVATE_ROOM.screenOpen) {
      renderPrivateSlideBody();
    }

    if (hostStarted && PRIVATE_ROOM.screenOpen && !AR_LOADING && !AR) {
      PRIVATE_ROOM.active = true;
      PRIVATE_ROOM.started = true;
      closePrivateSlide(true);
      startMatch(PRIVATE_ROOM.roomId || (typeof SQUAD_ID !== 'undefined' ? SQUAD_ID : null));
    }
  }

  function connectToBackendRoom(code, isCreating) {
    const cleanCode = String(code || '').trim();
    if (!cleanCode) return;

    if (typeof SQUAD_ID !== 'undefined') {
      try { SQUAD_ID = cleanCode; } catch (e) {}
    }
    window.SQUAD_ID = cleanCode;

    if (isCreating) {
      if (typeof createSquad === 'function') {
        try {
          createSquad(cleanCode);
          if (typeof SQUAD_ID !== 'undefined' && SQUAD_ID) {
            PRIVATE_ROOM.roomId = String(SQUAD_ID);
          }
        } catch (e) {}
      }
    } else {
      const sqInp = document.getElementById('sq-inp') || document.querySelector('input[placeholder*="code" i], input[placeholder*="room" i], input[placeholder*="squad" i]');
      if (sqInp) sqInp.value = cleanCode;
      if (typeof joinSquad === 'function') {
        try { joinSquad(cleanCode); } catch (e) {}
      }
    }

    if (typeof squadMembers === 'function') {
      try {
        const mems = squadMembers();
        if (Array.isArray(mems) && mems.length) ingestSquadMembers(mems);
      } catch (e) {}
    }
  }

  function createRoomNow() {
    const me = getCurrentUserProfile();
    const initialCode = (typeof SQUAD_ID !== 'undefined' && SQUAD_ID) ? String(SQUAD_ID) : genPrivateCode();

    PRIVATE_ROOM.active = true;
    PRIVATE_ROOM.roomId = initialCode;
    PRIVATE_ROOM.isHost = true;
    PRIVATE_ROOM.myTeam = 'alpha';
    PRIVATE_ROOM.myReady = true;
    PRIVATE_ROOM.started = false;
    setSyncedMapSelection(PRIVATE_ROOM.mapId || 'killhouse_1v1', PRIVATE_ROOM.mapName);

    connectToBackendRoom(initialCode, true);

    PRIVATE_ROOM.peers = {
      [me.pid]: {
        pid: me.pid,
        name: me.name,
        lvl: me.lvl,
        isHost: true,
        team: 'alpha',
        ready: true,
        speaking: false,
        gunId: me.gunId
      }
    };

    ensureLobbyNetworkBridge();
    pushLobbySync();
    renderPrivateSlideBody();
    if (typeof toast === 'function') toast('🔒 Private Room Created: ' + PRIVATE_ROOM.roomId);
  }

  function joinRoomNow(rawCode) {
    const code = String(rawCode || PRIVATE_ROOM.joinDraft || '').trim();
    if (!code) {
      if (typeof toast === 'function') toast('⚠️ Enter a Room ID to join');
      return;
    }
    PRIVATE_ROOM.joinDraft = code;
    const me = getCurrentUserProfile();

    const rooms = readStoredRooms();
    const existingRoom = rooms[code];
    const isExistingHost = !!(existingRoom && existingRoom.hostPid === me.pid);

    PRIVATE_ROOM.active = true;
    PRIVATE_ROOM.roomId = code;
    PRIVATE_ROOM.isHost = isExistingHost;
    PRIVATE_ROOM.myTeam = isExistingHost ? 'alpha' : 'bravo';
    PRIVATE_ROOM.myReady = true;
    PRIVATE_ROOM.started = false;

    const nextPeers = {};
    if (existingRoom && existingRoom.members && typeof existingRoom.members === 'object') {
      Object.entries(existingRoom.members).forEach(([pid, m]) => {
        if (m && pid !== me.pid) nextPeers[pid] = Object.assign({}, m, { pid });
      });
    }
    nextPeers[me.pid] = {
      pid: me.pid,
      name: me.name,
      lvl: me.lvl,
      isHost: isExistingHost,
      team: PRIVATE_ROOM.myTeam,
      ready: true,
      speaking: false,
      gunId: me.gunId
    };
    PRIVATE_ROOM.peers = nextPeers;

    if (existingRoom) {
      if (existingRoom.mode) PRIVATE_ROOM.mode = existingRoom.mode;
      if (existingRoom.mapId) setSyncedMapSelection(existingRoom.mapId, existingRoom.mapName);
      if (typeof existingRoom.fillBots === 'boolean') PRIVATE_ROOM.fillBots = existingRoom.fillBots;
    }

    connectToBackendRoom(code, false);
    ensureLobbyNetworkBridge();
    pushLobbySync();
    renderPrivateSlideBody();
    if (typeof toast === 'function') toast('🤝 Joined Room: ' + code);
  }

  function getRosterList() {
    const me = getCurrentUserProfile();
    const list = Object.values(PRIVATE_ROOM.peers || {});
    if (!list.some(p => p.pid === me.pid)) {
      list.unshift({
        pid: me.pid,
        name: me.name,
        lvl: me.lvl,
        isHost: PRIVATE_ROOM.isHost,
        team: PRIVATE_ROOM.myTeam,
        ready: PRIVATE_ROOM.myReady,
        speaking: false,
        gunId: me.gunId
      });
    }
    return list;
  }

  function collectRealFriends() {
    const candidates = [];
    const pushSource = src => {
      if (!src) return;
      if (Array.isArray(src)) {
        src.forEach(item => candidates.push(item));
      } else if (typeof src === 'object') {
        if (Array.isArray(src.friends)) src.friends.forEach(item => candidates.push(item));
        else if (Array.isArray(src.members)) src.members.forEach(item => candidates.push(item));
        else Object.entries(src).forEach(([k, item]) => {
          if (item && typeof item === 'object') candidates.push(Object.assign({ id: k }, item));
          else if (typeof item === 'string') candidates.push({ id: k, name: item });
        });
      }
    };

    if (typeof S !== 'undefined' && S) pushSource(S.friends);
    if (typeof FRIENDS !== 'undefined') pushSource(FRIENDS);
    if (typeof window.FRIENDS !== 'undefined') pushSource(window.FRIENDS);
    if (typeof CLAN !== 'undefined') pushSource(CLAN);
    if (typeof SQUAD_FRIENDS !== 'undefined') pushSource(SQUAD_FRIENDS);
    if (typeof squadMembers === 'function') {
      try { pushSource(squadMembers()); } catch (e) {}
    }

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || '';
        if (/friend|clan|squad/i.test(k) && !/priv_rooms/i.test(k)) {
          const parsed = JSON.parse(localStorage.getItem(k) || 'null');
          pushSource(parsed);
        }
      }
    } catch (e) {}

    const me = getCurrentUserProfile();
    const seen = new Set([me.pid, me.name.toLowerCase()]);
    const result = [];

    candidates.forEach((raw, idx) => {
      if (!raw) return;
      let id = '', name = '', lvl = 1, online = true;
      if (typeof raw === 'string') {
        name = raw.trim();
        id = 'fr_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + idx;
      } else if (typeof raw === 'object') {
        name = String(raw.name || raw.username || raw.nick || raw.tag || '').trim();
        id = String(raw.pid || raw.id || raw.uid || raw.tag || ('fr_' + idx));
        lvl = Number(raw.lvl || raw.level || 1);
        online = raw.online !== false && raw.status !== 'offline';
      }
      if (!name || /^friend\s*\d+$/i.test(name)) return;
      const key = (id + '|' + name.toLowerCase());
      if (seen.has(id) || seen.has(name.toLowerCase()) || seen.has(key)) return;
      seen.add(id);
      seen.add(name.toLowerCase());
      seen.add(key);
      result.push({ id, name, lvl, online });
    });

    return result;
  }

  function triggerNativeTeamInvite(friend, roomCode) {
    const fId = friend.id;
    const fName = friend.name;
    let invoked = false;

    const fns = [
      typeof inviteFriendToPlay === 'function' ? inviteFriendToPlay : null,
      typeof sendInvite === 'function' ? sendInvite : null,
      typeof inviteFriend === 'function' ? inviteFriend : null,
      typeof inviteToSquad === 'function' ? inviteToSquad : null,
      typeof sendSquadInvite === 'function' ? sendSquadInvite : null
    ].filter(Boolean);

    fns.forEach(fn => {
      if (invoked) return;
      try {
        fn(fId, fName);
        invoked = true;
      } catch (e) {
        try {
          fn(fId, roomCode);
          invoked = true;
        } catch (e2) {}
      }
    });

    return invoked;
  }

  function sendFriendInvite(friend) {
    if (!friend) return;
    if (!PRIVATE_ROOM.roomId) createRoomNow();
    const me = getCurrentUserProfile();
    PRIVATE_ROOM.invitedIds.add(friend.id);

    triggerNativeTeamInvite(friend, PRIVATE_ROOM.roomId);

    broadcastRoomEvent({
      type: 'invite',
      roomId: PRIVATE_ROOM.roomId,
      fromPid: me.pid,
      fromName: me.name,
      targetId: friend.id,
      targetName: friend.name,
      mode: PRIVATE_ROOM.mode,
      mapId: PRIVATE_ROOM.mapId,
      mapName: PRIVATE_ROOM.mapName
    });

    pushLobbySync();

    if (navigator.clipboard && PRIVATE_ROOM.roomId) {
      navigator.clipboard.writeText(PRIVATE_ROOM.roomId).catch(() => {});
    }
    if (typeof toast === 'function') {
      toast(`📨 Invited ${friend.name} to Room ${PRIVATE_ROOM.roomId}!`);
    }
    renderPrivateSlideBody();
  }

  function renderSlotCard(player, teamKey) {
    const isAlpha = teamKey === 'alpha';
    const teamCol = isAlpha ? '#38bdf8' : '#ff2a55';
    if (!player) {
      return `
        <div class="codm-slot empty" data-team="${teamKey}" title="Tap to switch to ${teamKey.toUpperCase()} team" style="flex:1 1 112px;max-width:140px;background:rgba(10,16,30,0.86);border:1px solid rgba(148,163,184,0.28);border-radius:4px;padding:10px 8px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;min-height:128px">
          <div style="width:52px;height:52px;border-radius:4px;background:rgba(30,41,59,0.75);display:flex;align-items:center;justify-content:center;font-size:26px;color:#475569">👤</div>
          <div style="margin-top:7px;font-size:10px;font-weight:800;color:#64748b;letter-spacing:.06em">EMPTY SLOT</div>
          <div style="margin-top:2px;font-size:9px;color:${teamCol};font-weight:700">+ JOIN ${teamKey.toUpperCase()}</div>
        </div>
      `;
    }

    const readyBadge = player.isHost
      ? `<span style="background:rgba(250,204,21,0.18);border:1px solid #facc15;color:#facc15;font-size:9px;font-weight:900;padding:2px 6px;border-radius:3px">🏠 HOST</span>`
      : player.ready
        ? `<span style="background:rgba(34,197,94,0.2);border:1px solid #22c55e;color:#4ade80;font-size:9px;font-weight:900;padding:2px 6px;border-radius:3px">✅ READY</span>`
        : `<span style="background:rgba(245,158,11,0.18);border:1px solid #f59e0b;color:#fbbf24;font-size:9px;font-weight:900;padding:2px 6px;border-radius:3px">⏳ NOT READY</span>`;

    return `
      <div class="codm-slot filled" style="flex:1 1 112px;max-width:140px;background:linear-gradient(180deg,rgba(22,33,58,0.95),rgba(10,16,30,0.96));border:2px solid ${player.ready || player.isHost ? teamCol : 'rgba(148,163,184,0.45)'};border-radius:4px;padding:8px 6px;display:flex;flex-direction:column;align-items:center;min-height:128px;box-shadow:0 6px 18px rgba(0,0,0,0.45)">
        <div style="width:52px;height:52px;border-radius:4px;background:linear-gradient(135deg,${isAlpha ? '#1d4ed8,#0f172a' : '#b91c1c,#0f172a'});border:1px solid ${teamCol};display:flex;align-items:center;justify-content:center;font-size:24px;position:relative">
          🪖
          ${player.speaking ? '<span style="position:absolute;bottom:2px;right:2px;font-size:11px">🗣️</span>' : ''}
        </div>
        <div style="margin-top:6px;font-size:11px;font-weight:900;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:116px">
          ${esc(player.name)}
        </div>
        <div style="font-size:10px;color:#facc15;font-weight:800;margin-top:1px">⭐ LV ${player.lvl || 1}</div>
        <div style="margin-top:5px">${readyBadge}</div>
      </div>
    `;
  }

  function renderPrivateSlideBody() {
    const screen = document.getElementById('priv-screen');
    if (!screen) return;

    const prevInp = screen.querySelector('#pm-join-inp');
    const wasFocused = prevInp && document.activeElement === prevInp;
    const selStart = wasFocused ? prevInp.selectionStart : null;
    const selEnd = wasFocused ? prevInp.selectionEnd : null;
    if (prevInp) PRIVATE_ROOM.joinDraft = prevInp.value;

    const roster = getRosterList();
    const alphaPlayers = roster.filter(p => p.team === 'alpha');
    const bravoPlayers = roster.filter(p => p.team === 'bravo');
    const slotsPerTeam = PRIVATE_ROOM.mode === '1v1' ? 1 : PRIVATE_ROOM.mode === '2v2' ? 2 : 5;

    const alphaSlotsHtml = Array.from({ length: slotsPerTeam }).map((_, i) => renderSlotCard(alphaPlayers[i], 'alpha')).join('');
    const bravoSlotsHtml = Array.from({ length: slotsPerTeam }).map((_, i) => renderSlotCard(bravoPlayers[i], 'bravo')).join('');

    const totalPlayers = roster.length;
    const readyCount = roster.filter(p => p.isHost || p.ready).length;
    const micOn = (typeof VOICE !== 'undefined' && VOICE.micOn);
    const spkOn = (typeof VOICE !== 'undefined' && VOICE.spkOn);

    const friendsList = collectRealFriends();
    const friendsHtml = friendsList.length
      ? friendsList.map((f, idx) => {
          const invited = PRIVATE_ROOM.invitedIds.has(f.id);
          const alreadyInRoom = roster.some(r => r.pid === f.id || r.name.toLowerCase() === f.name.toLowerCase());
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;background:rgba(15,23,42,0.92);border:1px solid rgba(148,163,184,0.22);padding:7px 8px;border-radius:3px">
              <div style="min-width:0">
                <div style="font-size:11px;font-weight:900;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                  <span style="color:${f.online ? '#22c55e' : '#64748b'}">●</span> ${esc(f.name)}
                </div>
                <div style="font-size:9px;color:#94a3b8;font-weight:700">LV ${f.lvl} · ${alreadyInRoom ? 'IN ROOM' : (f.online ? 'ONLINE' : 'OFFLINE')}</div>
              </div>
              <button type="button" class="pm-inv-friend" data-fidx="${idx}" ${alreadyInRoom ? 'disabled' : ''} style="background:${alreadyInRoom ? '#334155' : (invited ? '#22c55e' : '#facc15')};color:${alreadyInRoom ? '#94a3b8' : '#080e1c'};font-weight:900;font-size:10px;padding:5px 8px;border:none;border-radius:3px;cursor:${alreadyInRoom ? 'default' : 'pointer'};flex-shrink:0">
                ${alreadyInRoom ? 'JOINED' : (invited ? '✓ SENT' : '+ INVITE')}
              </button>
            </div>
          `;
        }).join('')
      : `<div style="font-size:11px;color:#94a3b8;text-align:center;padding:10px 8px;background:rgba(15,23,42,0.75);border-radius:3px;border:1px dashed rgba(148,163,184,0.25)">
           No friends found in your friends list.<br><span style="color:#38bdf8">Add friends in Clan/Social or share your Room ID.</span>
         </div>`;

    const invitesHtml = PRIVATE_ROOM.incomingInvites.length
      ? `
        <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:4px">
          ${PRIVATE_ROOM.incomingInvites.map((inv, idx) => `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;background:rgba(56,189,248,0.16);border:1px solid #38bdf8;padding:6px 8px;border-radius:3px">
              <div style="min-width:0;font-size:10px;color:#f8fafc">
                <b>${esc(inv.fromName || 'Friend')}</b> invited you<br><span style="color:#facc15">ID: ${esc(inv.roomId)} · ${esc(inv.mapName || '')}</span>
              </div>
              <button type="button" class="pm-accept-inv" data-iidx="${idx}" style="background:#22c55e;color:#080e1c;font-weight:900;font-size:10px;padding:5px 9px;border:none;border-radius:3px;cursor:pointer">JOIN</button>
            </div>
          `).join('')}
        </div>
      `
      : '';

    screen.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(7,12,24,0.96);border-bottom:1px solid rgba(56,189,248,0.28);gap:8px;flex-wrap:wrap;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button type="button" id="pm-back-btn" style="background:rgba(30,41,59,0.9);border:1px solid rgba(148,163,184,0.35);color:#facc15;font-weight:900;font-size:12px;padding:6px 10px;border-radius:3px;cursor:pointer">◀ BACK</button>
          <span style="font-size:15px;font-weight:900;letter-spacing:.06em;color:#f8fafc">PRIVATE MULTIPLAYER</span>
          <span style="background:rgba(15,23,42,0.95);border:1px solid #38bdf8;color:#facc15;font-weight:900;font-size:11px;padding:4px 8px;border-radius:3px;letter-spacing:.06em">
            ROOM ID: ${esc(PRIVATE_ROOM.roomId || 'GENERATING...')}
          </span>
          <button type="button" id="pm-copy-btn" style="background:#1e293b;border:1px solid #38bdf8;color:#38bdf8;font-weight:800;font-size:10px;padding:5px 8px;border-radius:3px;cursor:pointer">📋 COPY ID</button>
        </div>

        <div style="display:flex;align-items:center;gap:6px">
          <button type="button" id="pm-mic-btn" style="background:${micOn ? 'rgba(34,197,94,0.22)' : 'rgba(30,41,59,0.9)'};border:1px solid ${micOn ? '#22c55e' : 'rgba(148,163,184,0.35)'};color:#f8fafc;font-size:12px;padding:5px 9px;border-radius:3px;cursor:pointer">
            ${micOn ? '🎙️ MIC ON' : '🔇 MIC OFF'}
          </button>
          <button type="button" id="pm-spk-btn" style="background:${spkOn ? 'rgba(56,189,248,0.22)' : 'rgba(30,41,59,0.9)'};border:1px solid ${spkOn ? '#38bdf8' : 'rgba(148,163,184,0.35)'};color:#f8fafc;font-size:12px;padding:5px 9px;border-radius:3px;cursor:pointer">
            ${spkOn ? '🔊 SPK ON' : '🔈 SPK OFF'}
          </button>
        </div>
      </div>

      <div class="pm-grid" style="flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 14px">
        <style>
          .pm-grid { display:grid; grid-template-columns:255px 1fr 240px; gap:12px; align-content:start; }
          @media (max-width: 820px) {
            .pm-grid { grid-template-columns:1fr; gap:12px; padding-bottom:24px; }
          }
        </style>

        <div style="background:rgba(10,16,30,0.92);border:1px solid rgba(148,163,184,0.25);border-radius:4px;padding:11px;display:flex;flex-direction:column;gap:10px">
          <div style="background:#1e293b;padding:6px 10px;font-weight:900;font-size:11px;letter-spacing:.08em;color:#f8fafc;border-left:3px solid #facc15">
            MATCH SETTINGS
          </div>

          <div>
            <div style="font-size:10px;font-weight:800;color:#94a3b8;letter-spacing:.06em;margin-bottom:5px">JOIN FRIEND'S ROOM</div>
            <div style="display:flex;gap:5px">
              <input type="text" id="pm-join-inp" autocomplete="off" spellcheck="false" value="${esc(PRIVATE_ROOM.joinDraft)}" placeholder="ENTER ROOM ID" style="flex:1;min-width:0;padding:8px;background:#060b16;border:1px solid #38bdf8;color:#f8fafc;font-weight:900;font-size:12px;border-radius:3px;outline:none;user-select:text;-webkit-user-select:text">
              <button type="button" id="pm-join-btn" style="background:#38bdf8;color:#080e1c;font-weight:900;font-size:11px;padding:0 12px;border:none;border-radius:3px;cursor:pointer">JOIN</button>
            </div>
            <button type="button" id="pm-new-btn" style="width:100%;margin-top:6px;background:rgba(250,204,21,0.14);border:1px solid rgba(250,204,21,0.45);color:#facc15;font-weight:800;font-size:11px;padding:6px;border-radius:3px;cursor:pointer">➕ CREATE NEW ROOM</button>
          </div>

          <div>
            <div style="font-size:10px;font-weight:800;color:#94a3b8;letter-spacing:.06em;margin-bottom:5px">TEAM SIZE</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px">
              ${['1v1', '2v2', '5v5'].map(m => `
                <button type="button" class="pm-mode-btn" data-mode="${m}" style="padding:7px 4px;font-weight:900;font-size:11px;border-radius:3px;cursor:pointer;border:1px solid ${PRIVATE_ROOM.mode === m ? '#facc15' : 'rgba(148,163,184,0.3)'};background:${PRIVATE_ROOM.mode === m ? '#facc15' : '#0f172a'};color:${PRIVATE_ROOM.mode === m ? '#080e1c' : '#e2e8f0'}">
                  ${m.toUpperCase()}
                </button>
              `).join('')}
            </div>
          </div>

          <div>
            <div style="font-size:10px;font-weight:800;color:#94a3b8;letter-spacing:.06em;margin-bottom:5px">BATTLE MAP (SYNCED FOR ALL)</div>
            <div style="display:flex;flex-direction:column;gap:4px">
              ${ALL_BATTLE_MAPS.map(mp => `
                <button type="button" class="pm-map-btn" data-map="${mp.id}" data-name="${mp.name}" style="text-align:left;padding:7px 9px;font-weight:800;font-size:11px;border-radius:3px;cursor:pointer;border:1px solid ${PRIVATE_ROOM.mapId === mp.id ? '#38bdf8' : 'rgba(148,163,184,0.22)'};background:${PRIVATE_ROOM.mapId === mp.id ? 'rgba(56,189,248,0.2)' : '#0f172a'};color:${PRIVATE_ROOM.mapId === mp.id ? '#38bdf8' : '#cbd5e1'}">
                  ${mp.name}
                </button>
              `).join('')}
            </div>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;background:#0f172a;padding:7px 9px;border-radius:3px;border:1px solid rgba(148,163,184,0.22)">
            <span style="font-size:11px;font-weight:800;color:#cbd5e1">AI BOTS FILL</span>
            <button type="button" id="pm-bots-btn" style="padding:4px 10px;font-weight:900;font-size:10px;border-radius:3px;cursor:pointer;border:none;background:${PRIVATE_ROOM.fillBots ? '#22c55e' : '#334155'};color:#fff">
              ${PRIVATE_ROOM.fillBots ? 'ON' : 'OFF (PVP)'}
            </button>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:14px;padding:4px 6px">
          <div style="background:rgba(10,16,30,0.65);border:1px solid rgba(56,189,248,0.25);border-radius:4px;padding:10px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <span style="font-size:12px;font-weight:900;letter-spacing:.08em;color:#38bdf8">▲ TEAM ALPHA (SOUTH BASE)</span>
              <span style="font-size:11px;color:#94a3b8">${alphaPlayers.length} / ${slotsPerTeam} PLAYERS</span>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              ${alphaSlotsHtml}
            </div>
          </div>

          <div style="background:rgba(10,16,30,0.65);border:1px solid rgba(255,42,85,0.28);border-radius:4px;padding:10px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <span style="font-size:12px;font-weight:900;letter-spacing:.08em;color:#ff2a55">▼ TEAM BRAVO (NORTH BASE)</span>
              <span style="font-size:11px;color:#94a3b8">${bravoPlayers.length} / ${slotsPerTeam} PLAYERS</span>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              ${bravoSlotsHtml}
            </div>
          </div>
        </div>

        <div style="background:rgba(10,16,30,0.92);border:1px solid rgba(148,163,184,0.25);border-radius:4px;padding:11px;display:flex;flex-direction:column;gap:9px">
          <div style="background:#e2e8f0;color:#080e1c;padding:6px 10px;font-weight:900;font-size:11px;letter-spacing:.1em;text-align:center;border-radius:2px">
            INVITE FRIENDS ≪
          </div>

          ${invitesHtml}

          <button type="button" id="pm-share-invite-btn" style="background:linear-gradient(90deg,#0284c7,#2563eb);border:1px solid #38bdf8;color:#fff;font-weight:900;font-size:11px;padding:7px;border-radius:3px;cursor:pointer">
            📤 COPY ROOM ID & INVITE LINK
          </button>

          <div style="font-size:10px;font-weight:800;color:#94a3b8;letter-spacing:.06em">YOUR FRIENDS (${friendsList.length})</div>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:260px;overflow-y:auto">
            ${friendsHtml}
          </div>
        </div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;background:rgba(7,12,24,0.97);border-top:1px solid rgba(148,163,184,0.22);gap:10px;flex-wrap:wrap;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button type="button" id="pm-loadout-btn" style="background:#1e293b;border:1px solid rgba(148,163,184,0.4);color:#f8fafc;font-weight:900;font-size:11px;padding:8px 13px;border-radius:3px;cursor:pointer">🎒 LOADOUT</button>
          <div style="background:rgba(15,23,42,0.9);border:1px solid rgba(148,163,184,0.22);padding:8px 12px;border-radius:3px;font-size:11px;color:#cbd5e1">
            <b style="color:#facc15">[ROOM ${esc(PRIVATE_ROOM.roomId)}]</b> ${totalPlayers < 2 ? 'Invite a friend or have them enter Room ID...' : `${readyCount}/${totalPlayers} Ready · Map: ${esc(PRIVATE_ROOM.mapName)}`}
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:8px">
          <div style="background:rgba(250,204,21,0.15);border:1px solid #facc15;padding:6px 12px;border-radius:3px;text-align:right">
            <div style="font-size:9px;font-weight:800;color:#facc15">${esc(PRIVATE_ROOM.mapName)}</div>
            <div style="font-size:12px;font-weight:900;color:#f8fafc">${PRIVATE_ROOM.mode.toUpperCase()} PRIVATE</div>
          </div>

          ${!PRIVATE_ROOM.isHost ? `
            <button type="button" id="pm-ready-btn" style="background:${PRIVATE_ROOM.myReady ? '#22c55e' : '#facc15'};color:#080e1c;font-weight:900;font-size:13px;letter-spacing:.06em;padding:10px 22px;border:none;border-radius:3px;cursor:pointer">
              ${PRIVATE_ROOM.myReady ? '✅ READY!' : '⚡ READY'}
            </button>
          ` : `
            <button type="button" id="pm-start-btn" style="background:#facc15;color:#080e1c;font-weight:900;font-size:13px;letter-spacing:.08em;padding:10px 24px;border:none;border-radius:3px;cursor:pointer;box-shadow:0 0 20px rgba(250,204,21,0.35)">
              ▶ START (${readyCount}/${totalPlayers})
            </button>
          `}
        </div>
      </div>
    `;

    const joinInp = screen.querySelector('#pm-join-inp');
    const joinBtn = screen.querySelector('#pm-join-btn');
    if (joinInp) {
      ['keydown', 'keyup', 'keypress', 'pointerdown', 'mousedown', 'click'].forEach(evt => {
        joinInp.addEventListener(evt, e => e.stopPropagation());
      });
      joinInp.addEventListener('input', () => {
        PRIVATE_ROOM.joinDraft = joinInp.value;
      });
      joinInp.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          joinRoomNow(joinInp.value);
        }
      });
      if (wasFocused) {
        joinInp.focus();
        if (selStart !== null && selEnd !== null) {
          try { joinInp.setSelectionRange(selStart, selEnd); } catch (e) {}
        }
      }
    }
    if (joinBtn) {
      joinBtn.onclick = () => joinRoomNow(joinInp ? joinInp.value : PRIVATE_ROOM.joinDraft);
    }

    screen.querySelectorAll('.pm-accept-inv').forEach(btn => {
      btn.onclick = () => {
        const inv = PRIVATE_ROOM.incomingInvites[+btn.dataset.iidx];
        if (inv && inv.roomId) {
          PRIVATE_ROOM.joinDraft = inv.roomId;
          joinRoomNow(inv.roomId);
        }
      };
    });

    screen.querySelectorAll('.pm-inv-friend').forEach(btn => {
      btn.onclick = () => {
        const f = friendsList[+btn.dataset.fidx];
        if (f) sendFriendInvite(f);
      };
    });

    const shareInvBtn = screen.querySelector('#pm-share-invite-btn');
    if (shareInvBtn) {
      shareInvBtn.onclick = () => {
        const shareUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(PRIVATE_ROOM.roomId)}`;
        const shareText = `Join my Private ${PRIVATE_ROOM.mode.toUpperCase()} Room on ${PRIVATE_ROOM.mapName}! Room ID: ${PRIVATE_ROOM.roomId}\n${shareUrl}`;
        if (navigator.share) {
          navigator.share({ title: 'Private Multiplayer Invite', text: shareText, url: shareUrl }).catch(() => {});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(shareText).catch(() => {});
        }
        if (typeof toast === 'function') toast('📤 Room ID & Invite Link copied!');
      };
    }

    const backBtn = screen.querySelector('#pm-back-btn');
    if (backBtn) backBtn.onclick = () => closePrivateSlide(false);

    const copyBtn = screen.querySelector('#pm-copy-btn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        if (navigator.clipboard && PRIVATE_ROOM.roomId) {
          navigator.clipboard.writeText(PRIVATE_ROOM.roomId).catch(() => {});
        }
        if (typeof toast === 'function') toast('📋 Copied Room ID: ' + PRIVATE_ROOM.roomId);
      };
    }

    const micBtn = screen.querySelector('#pm-mic-btn');
    if (micBtn) {
      micBtn.onclick = () => {
        if (typeof VOICE !== 'undefined' && VOICE.toggleMic) VOICE.toggleMic();
        setTimeout(renderPrivateSlideBody, 80);
      };
    }

    const spkBtn = screen.querySelector('#pm-spk-btn');
    if (spkBtn) {
      spkBtn.onclick = () => {
        if (typeof VOICE !== 'undefined' && VOICE.toggleSpk) VOICE.toggleSpk();
        setTimeout(renderPrivateSlideBody, 80);
      };
    }

    const newBtn = screen.querySelector('#pm-new-btn');
    if (newBtn) newBtn.onclick = () => createRoomNow();

    screen.querySelectorAll('.pm-mode-btn').forEach(btn => {
      btn.onclick = () => {
        if (!PRIVATE_ROOM.isHost) return toast('Only the Room Host can change match mode');
        PRIVATE_ROOM.mode = btn.dataset.mode;
        pushLobbySync();
        renderPrivateSlideBody();
      };
    });

    screen.querySelectorAll('.pm-map-btn').forEach(btn => {
      btn.onclick = () => {
        if (!PRIVATE_ROOM.isHost) return toast('Only the Room Host can change map');
        setSyncedMapSelection(btn.dataset.map, btn.dataset.name);
        pushLobbySync();
        renderPrivateSlideBody();
      };
    });

    const botsBtn = screen.querySelector('#pm-bots-btn');
    if (botsBtn) {
      botsBtn.onclick = () => {
        if (!PRIVATE_ROOM.isHost) return toast('Only the Room Host can toggle bots');
        PRIVATE_ROOM.fillBots = !PRIVATE_ROOM.fillBots;
        pushLobbySync();
        renderPrivateSlideBody();
      };
    }

    screen.querySelectorAll('.codm-slot.empty').forEach(slot => {
      slot.onclick = () => {
        const targetTeam = slot.dataset.team;
        if (!targetTeam || PRIVATE_ROOM.myTeam === targetTeam) return;
        PRIVATE_ROOM.myTeam = targetTeam;
        const me = getCurrentUserProfile();
        if (PRIVATE_ROOM.peers[me.pid]) PRIVATE_ROOM.peers[me.pid].team = targetTeam;
        pushLobbySync();
        renderPrivateSlideBody();
      };
    });

    const loadoutBtn = screen.querySelector('#pm-loadout-btn');
    if (loadoutBtn) {
      loadoutBtn.onclick = () => {
        if (typeof openLoadout === 'function') openLoadout();
        else if (typeof S !== 'undefined') toast('Current Weapon Equipped — Press [B] in-game for Gunsmith!');
      };
    }

    const readyBtn = screen.querySelector('#pm-ready-btn');
    if (readyBtn) {
      readyBtn.onclick = () => {
        PRIVATE_ROOM.myReady = !PRIVATE_ROOM.myReady;
        const me = getCurrentUserProfile();
        if (PRIVATE_ROOM.peers[me.pid]) PRIVATE_ROOM.peers[me.pid].ready = PRIVATE_ROOM.myReady;
        pushLobbySync();
        renderPrivateSlideBody();
      };
    }

    const startBtn = screen.querySelector('#pm-start-btn');
    if (startBtn) {
      startBtn.onclick = () => {
        PRIVATE_ROOM.active = true;
        PRIVATE_ROOM.started = true;
        pushLobbySync();
        closePrivateSlide(true);
        if (typeof launchSquadMatch === 'function' && typeof SQUAD_ID !== 'undefined' && SQUAD_ID && typeof isSquadHost === 'function' && isSquadHost()) {
          launchSquadMatch();
        } else {
          startMatch(PRIVATE_ROOM.roomId || (typeof SQUAD_ID !== 'undefined' ? SQUAD_ID : null));
        }
      };
    }
  }

  let lobbyPollTimer = null;

  function openPrivateSlide(autoJoinCode = '') {
    PRIVATE_ROOM.active = true;
    PRIVATE_ROOM.screenOpen = true;
    syncInvitesFromStorage();

    if (autoJoinCode) {
      joinRoomNow(autoJoinCode);
    } else if (!PRIVATE_ROOM.roomId) {
      createRoomNow();
    } else {
      ensureLobbyNetworkBridge();
      pushLobbySync();
    }

    let screen = document.getElementById('priv-screen');
    if (!screen) {
      screen = document.createElement('div');
      screen.id = 'priv-screen';
      screen.style.cssText = 'position:fixed;inset:0;z-index:9990;background:radial-gradient(circle at 50% 35%,#172544 0%,#070c18 100%);color:#f8fafc;display:flex;flex-direction:column;font-family:inherit;height:100dvh;max-height:100dvh;overflow:hidden;';
      document.body.appendChild(screen);
    }
    screen.style.display = 'flex';
    renderPrivateSlideBody();

    clearInterval(lobbyPollTimer);
    lobbyPollTimer = setInterval(() => {
      if (!PRIVATE_ROOM.screenOpen || AR) {
        clearInterval(lobbyPollTimer);
        return;
      }
      const rooms = readStoredRooms();
      syncInvitesFromStorage(rooms);
      if (PRIVATE_ROOM.roomId && rooms[PRIVATE_ROOM.roomId]) {
        applyRoomSnapshot(rooms[PRIVATE_ROOM.roomId]);
      }
      const inp = document.getElementById('pm-join-inp');
      if (inp && document.activeElement === inp) {
        pushLobbySync();
        return;
      }
      if (typeof squadMembers === 'function') {
        try { ingestSquadMembers(squadMembers()); } catch (e) {}
      }
      pushLobbySync();
    }, 550);
  }

  function closePrivateSlide(launchingMatch = false) {
    PRIVATE_ROOM.screenOpen = false;
    clearInterval(lobbyPollTimer);
    const screen = document.getElementById('priv-screen');
    if (screen) screen.style.display = 'none';
    if (!launchingMatch) {
      PRIVATE_ROOM.active = false;
      PRIVATE_ROOM.started = false;
    }
  }

  window.openPrivateRoom = openPrivateSlide;

  setInterval(() => {
    if (AR) return;
    if (typeof SQUAD_ID !== 'undefined' && SQUAD_ID) {
      ensureLobbyNetworkBridge();
      if (typeof squadMembers === 'function') {
        try { ingestSquadMembers(squadMembers()); } catch (e) {}
      }
    }
  }, 900);

  const urlRoom = new URLSearchParams(window.location.search).get('room');
  if (urlRoom) {
    setTimeout(() => openPrivateSlide(urlRoom), 450);
  }

  function injectIntoBattleMapsScreen() {
    const ui = document.getElementById('ui');
    if (!ui) return;
    const upper = (ui.textContent || '').toUpperCase();
    if (!upper.includes('3D BATTLE MAPS')) return;

    if (!document.getElementById('priv-top-btn')) {
      const allNodes = Array.from(ui.querySelectorAll('*'));
      const titleEl = allNodes.find(el => el.children.length === 0 && (el.textContent || '').toUpperCase().includes('3D BATTLE MAPS'));
      if (titleEl && titleEl.parentElement) {
        const topBtn = document.createElement('button');
        topBtn.id = 'priv-top-btn';
        topBtn.type = 'button';
        topBtn.textContent = '🔒 PRIVATE MULTIPLAYER (1v1 / 2v2)';
        topBtn.style.cssText = 'margin-left:14px;padding:6px 12px;border-radius:4px;border:1px solid #facc15;background:rgba(250,204,21,0.16);color:#facc15;font-weight:900;font-size:12px;letter-spacing:.06em;cursor:pointer;';
        topBtn.onclick = e => {
          e.stopPropagation();
          openPrivateSlide();
        };
        titleEl.parentElement.appendChild(topBtn);
      }
    }

    const allEls = Array.from(ui.querySelectorAll('*'));
    const shipmentCard = allEls.find(el => {
      const t = (el.textContent || '').toUpperCase();
      const pt = el.parentElement ? (el.parentElement.textContent || '').toUpperCase() : '';
      return t.includes('SHIPMENT 1944') && !t.includes('FIRING RANGE') && pt.includes('FIRING RANGE') && pt.includes('NUKETOWN OPS');
    });

    if (shipmentCard && shipmentCard.parentElement) {
      const mapListCol = shipmentCard.parentElement;

      if (!document.getElementById('killhouse-map-card') && !(mapListCol.textContent || '').toUpperCase().includes('TACTICAL KILLHOUSE')) {
        const khCard = document.createElement('div');
        khCard.id = 'killhouse-map-card';
        khCard.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:11px 14px;margin-top:6px;border-radius:3px;border:1px solid rgba(56,189,248,0.45);background:rgba(15,23,42,0.85);cursor:pointer;';
        khCard.innerHTML = `
          <div>
            <div style="font-weight:900;font-size:13px;color:#38bdf8;letter-spacing:.04em">TACTICAL KILLHOUSE 3D</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px">SYMMETRICAL 3D PVP ARENA · PC & MOBILE</div>
          </div>
          <span style="background:#38bdf8;color:#080e1c;font-weight:900;font-size:10px;padding:4px 8px;border-radius:2px">SELECT</span>
        `;
        khCard.onclick = e => {
          e.stopPropagation();
          setSyncedMapSelection('killhouse_1v1', 'TACTICAL KILLHOUSE 3D');
          pushLobbySync();
          if (typeof toast === 'function') toast('🗺️ Map Selected: TACTICAL KILLHOUSE 3D');
        };
        mapListCol.appendChild(khCard);
      }

      Array.from(mapListCol.children).forEach(child => {
        if (child.dataset.syncHooked || child.id === 'priv-map-card') return;
        child.dataset.syncHooked = '1';
        child.addEventListener('click', () => {
          const txt = (child.textContent || '').toUpperCase();
          const matched = ALL_BATTLE_MAPS.find(m => txt.includes(m.name));
          if (matched) {
            setSyncedMapSelection(matched.id, matched.name);
            pushLobbySync();
          }
        });
      });

      if (!document.getElementById('priv-map-card')) {
        const privCard = document.createElement('div');
        privCard.id = 'priv-map-card';
        privCard.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 14px;margin-top:6px;border-radius:3px;border:1px solid rgba(250,204,21,0.55);background:rgba(15,23,42,0.9);cursor:pointer;';
        privCard.innerHTML = `
          <div>
            <div style="font-weight:900;font-size:14px;color:#facc15;letter-spacing:.04em">
              🔒 PRIVATE MULTIPLAYER <span style="font-size:11px;color:#38bdf8;font-weight:800">(CODM LOBBY)</span>
            </div>
            <div style="font-size:11px;color:#cbd5e1;margin-top:2px">1V1 / 2V2 / 5V5 · MAP SELECT · FRIEND INVITE</div>
          </div>
          <span style="background:#facc15;color:#080e1c;font-weight:900;font-size:11px;padding:5px 10px;border-radius:2px;letter-spacing:.05em">OPEN LOBBY</span>
        `;
        privCard.onclick = e => {
          e.stopPropagation();
          openPrivateSlide();
        };
        mapListCol.appendChild(privCard);
      }
    }
  }

  const obs = new MutationObserver(() => injectIntoBattleMapsScreen());
  if (document.body) {
    obs.observe(document.body, { childList: true, subtree: true });
    injectIntoBattleMapsScreen();
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      obs.observe(document.body, { childList: true, subtree: true });
      injectIntoBattleMapsScreen();
    });
  }
})();

/* ===== PRE-MATCH DEPLOYMENT LOADING SCREEN ===== */
let AR_LOADING = false;
function startMatch(squadId = null) {
  if (AR || AR_LOADING) return;
  if (typeof THREE === 'undefined') return toast('3D Engine unavailable on this browser.');
  AR_LOADING = true;
  lobbyBridgeActive = false;
  if (typeof SFX !== 'undefined' && SFX.deploy) SFX.deploy();

  let resolvedMap = null;
  if (PRIVATE_ROOM.active) {
    const m = getMapById(PRIVATE_ROOM.mapId);
    resolvedMap = {
      id: m.id,
      name: PRIVATE_ROOM.mapName || m.name,
      sky: resolveSkyHex(m.sky, m.id),
      isPrivate: true,
      mode: PRIVATE_ROOM.mode
    };
  } else {
    if (typeof squadMembers === 'function') {
      try {
        const mems = squadMembers();
        const hostMem = Array.isArray(mems) ? mems.find(m => m && m.isHost && m.battle && m.battle.mapId) : null;
        if (hostMem) {
          setSyncedMapSelection(hostMem.battle.mapId, hostMem.battle.mapName);
        }
      } catch (e) {}
    }
    if (window.__SYNCED_MATCH_MAP && window.__SYNCED_MATCH_MAP.id) {
      const m = getMapById(window.__SYNCED_MATCH_MAP.id);
      resolvedMap = { id: m.id, name: window.__SYNCED_MATCH_MAP.name || m.name, sky: resolveSkyHex(m.sky, m.id) };
    } else if (typeof activeMap === 'function') {
      resolvedMap = activeMap();
    } else {
      resolvedMap = getMapById('firing_range');
    }
  }

  const mapCfg = resolvedMap;

  const loadEl = document.createElement('div');
  loadEl.id = 'ar-load';
  loadEl.className = 'ar-load';
  loadEl.innerHTML = `
    <div class="al-box">
      <div class="al-tag">${mapCfg.isPrivate ? '🔒 PRIVATE ' + esc((mapCfg.mode || '1V1').toUpperCase()) + ' DEPLOYMENT' : 'TACTICAL DEPLOYMENT'}</div>
      <div class="al-map">${esc(mapCfg.name)}</div>
      <div class="al-sub" id="al-step">DOWNLOADING 3D SOLDIER & WEAPON ASSETS...</div>
      <div class="al-bar"><i id="al-fill" style="width:12%"></i></div>
      <div class="al-pct" id="al-pct">12%</div>
    </div>
  `;
  document.body.appendChild(loadEl);

  const stepEl = document.getElementById('al-step');
  const fillEl = document.getElementById('al-fill');
  const pctEl = document.getElementById('al-pct');
  const setProg = (pct, msg) => {
    if (fillEl) fillEl.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
    if (stepEl && msg) stepEl.textContent = msg;
  };

  const preloadSoldier = new Promise(resolve => {
    if (typeof GLTF_CACHE !== 'undefined' && GLTF_CACHE && GLTF_CACHE.soldier) return resolve();
    if (!THREE.GLTFLoader) return resolve();
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    setTimeout(finish, 650);
    try {
      new THREE.GLTFLoader().load(
        'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/models/gltf/Soldier.glb',
        gltf => {
          if (typeof GLTF_CACHE === 'object') GLTF_CACHE.soldier = gltf;
          finish();
        },
        undefined,
        finish
      );
    } catch (e) {
      finish();
    }
  });

  setTimeout(() => setProg(38, 'GENERATING HIGH-RES PBR TEXTURES & SHADOWS...'), 160);
  setTimeout(() => {
    try { getArenaTextures(mapCfg.id); } catch (e) {}
    setProg(68, 'CONSTRUCTING 3D BUNKERS, CATWALKS & WEAPONS...');
  }, 360);

  Promise.all([
    preloadSoldier,
    new Promise(r => setTimeout(r, 750))
  ]).then(() => {
    setProg(92, 'INITIALIZING 3D BATTLE ARENA...');
    requestAnimationFrame(() => {
      try {
        launchArenaWorld(squadId, mapCfg);
        setProg(100, 'READY!');
        setTimeout(() => {
          loadEl.style.opacity = '0';
          setTimeout(() => {
            loadEl.remove();
            AR_LOADING = false;
          }, 180);
        }, 120);
      } catch (err) {
        console.error('Arena launch error:', err);
        loadEl.remove();
        AR_LOADING = false;
        toast('⚠️ Failed to start 3D Arena: ' + (err && err.message ? err.message : 'WebGL error'));
      }
    });
  });
}

/* ===== FULLSCREEN HELPER ===== */
function toggleArenaFullscreen() {
  const arenaEl = document.getElementById('arena');
  const target = arenaEl || document.documentElement;
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  if (fsEl) {
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    if (arenaEl) arenaEl.classList.remove('mob-fs');
    return;
  }
  if (target.requestFullscreen) {
    target.requestFullscreen().catch(() => {
      if (arenaEl) arenaEl.classList.toggle('mob-fs');
    });
  } else if (target.webkitRequestFullscreen) {
    target.webkitRequestFullscreen();
  } else if (arenaEl) {
    arenaEl.classList.toggle('mob-fs');
  }
}

/* ===== MAIN 3D BATTLE WORLD ENGINE ===== */
function launchArenaWorld(squadId, mapCfg) {
  const isPC = isPCDevice();
  const safeS = (typeof S === 'object' && S) ? S : { eq: { gun: 3, skin: -1 }, cfg: { gfx: 'High', sens: 100 }, coins: 0, cp: 0, wins: 0 };
  if (!safeS.eq) safeS.eq = { gun: 3, skin: -1 };
  if (!safeS.cfg) safeS.cfg = { gfx: 'High', sens: 100 };
  if (!safeS.cfg.gunsmith) safeS.cfg.gunsmith = {};

  const primaryBase = getWeaponSpec(safeS.eq.gun >= 0 ? safeS.eq.gun : 7, safeS.cfg.gunsmith[safeS.eq.gun >= 0 ? safeS.eq.gun : 7]);
  const extraSpecs = TEST_WEAPON_POOL
    .filter(w => w.id !== primaryBase.id)
    .map(w => getWeaponSpec(w, safeS.cfg.gunsmith[w.id]));
  const weapons = [primaryBase, ...extraSpecs];
  const wState = weapons.map(w => ({ ammo: w.mag, reserve: w.res }));
  let wIdx = 0;

  const lobbyUi = document.getElementById('ui');
  if (lobbyUi) lobbyUi.style.display = 'none';
  const lobbyGl = document.getElementById('gl');
  if (lobbyGl) lobbyGl.style.display = 'none';

  const skyHex = resolveSkyHex(mapCfg.sky, mapCfg.id);
  const isKillhouse = mapCfg.id === 'killhouse_1v1';
  const isPrivatePvP = !!PRIVATE_ROOM.active;

  const arenaEl = document.createElement('div');
  arenaEl.id = 'arena';
  arenaEl.style.background = '#' + skyHex.toString(16).padStart(6, '0');

  const defaultHudPositions = {
    minimap: { x: 2, y: 18, s: 100, o: 95 },
    joy:     { x: 4, y: 68, s: 100, o: 95 },
    fire:    { x: 84, y: 64, s: 100, o: 95 },
    scope:   { x: 75, y: 50, s: 90, o: 90 },
    jump:    { x: 88, y: 46, s: 90, o: 90 },
    crouch:  { x: 88, y: 31, s: 90, o: 90 },
    reload:  { x: 76, y: 76, s: 90, o: 90 },
    grenade: { x: 67, y: 64, s: 88, o: 90 },
    wswitch: { x: 67, y: 40, s: 88, o: 90 },
    cam:     { x: 76, y: 24, s: 88, o: 90 },
    hp:      { x: 1, y: 1, s: 100, o: 95 },
    ammo:    { x: 16, y: 1, s: 100, o: 95 },
    sqhud:   { x: 1, y: 12, s: 100, o: 95 },
    pckeys:  { x: 1, y: 74, s: 100, o: 95 }
  };

  const hudCfg = Object.assign({}, defaultHudPositions, (typeof defHud === 'function' ? defHud() : {}), safeS.cfg.hud || {});
  const hStyle = (k, mobileOnly = true) => {
    const h = hudCfg[k] || defaultHudPositions[k] || { x: 10, y: 10, s: 100, o: 95 };
    const hideOnPc = mobileOnly && isPC && k !== 'minimap';
    return `left:${h.x}%;top:${h.y}%;transform:scale(${h.s / 100});opacity:${h.o / 100};${hideOnPc ? 'display:none;' : ''}`;
  };

  const pcKeysHtml = isPC ? `
    <div class="pc-keys hud-movable" id="ar-pckeys" style="${hStyle('pckeys', false)}">
      <div class="pk-hdr">
        <span>⌨️ PC CONTROLS</span>
        <button class="pk-close" id="ar-pckeys-close" title="Hide Controls">✕</button>
      </div>
      <div><span class="kcap">W A S D</span> Move · <span class="kcap">SHIFT</span> Sprint · <span class="kcap">SPACE</span> Jump</div>
      <div><span class="kcap">C</span> Tap: Slide · Hold: Crouch</div>
      <div><span class="kcap">LMB</span> Fire (Sniper: Hold=Scope, Release=Shot)</div>
      <div><span class="kcap">RMB</span> Scope/ADS · <span class="kcap">WHEEL</span> Scroll Test Guns</div>
      <div><span class="kcap">R</span> Reload · <span class="kcap">G</span> Grenade · <span class="kcap">V</span> FPP/TPP</div>
      <div><span class="kcap">B</span> Loadout Menu · <span class="kcap">ESC</span> Aim ↔ Cursor</div>
    </div>` : '';

  const roomBannerHtml = isPrivatePvP
    ? `<div style="background:rgba(15,23,42,0.92);border:1px solid #facc15;color:#f8fafc;padding:4px 10px;border-radius:6px;font-size:.75rem;font-weight:900;letter-spacing:.05em">🔒 ${esc(PRIVATE_ROOM.mode.toUpperCase())} · ${esc(mapCfg.name)} · TEAM ${esc(PRIVATE_ROOM.myTeam.toUpperCase())}</div>`
    : `<div style="background:rgba(15,23,42,0.88);border:1px solid #38bdf8;color:#38bdf8;padding:4px 10px;border-radius:6px;font-size:.75rem;font-weight:900;letter-spacing:.05em">🗺️ ${esc(mapCfg.name)}</div>`;

  arenaEl.innerHTML = `
    <canvas id="acv"></canvas>
    <div class="slide-fx" id="ar-slidefx"></div>
    <div class="scope-ov" id="ar-scope"></div>
    <div class="xhair" id="ar-xhair"></div>
    <div class="ahud">
      <div class="atop">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <div class="hpbar hud-movable" id="ar-hpbox" style="${hStyle('hp', false)}">
            <b id="ar-hp-txt">HP 100 / 100</b>
            <div><i id="ar-hp-bar" style="width:100%"></i></div>
          </div>
          <div class="ammo hud-movable" id="ar-ammobox" style="${hStyle('ammo', false)}">
            <span id="ar-wname" style="font-size:.76rem;color:var(--y)">${esc(weapons[0].name)}</span>
            <span id="ar-ammo">${wState[0].ammo} / ${wState[0].reserve}</span>
            <span id="ar-kills" style="font-size:.76rem;color:#5be58a">${isPrivatePvP ? 'SCORE: 0' : 'KILLS: 0'}</span>
          </div>
          <button class="abtn-top loadout-btn" id="ar-loadout-btn" title="CODM Loadout Menu [B]">🎒 LOADOUT</button>
          ${roomBannerHtml}
        </div>
        <div class="aright">
          <button class="abtn-top" id="ar-settings-btn" title="Battle Settings">⚙️</button>
          <button class="abtn-top fs-btn" id="ar-fs-btn" title="Toggle Fullscreen">⛶</button>
          <button class="abtn-top ${(typeof VOICE !== 'undefined' && VOICE.micOn) ? 'on' : 'muted'}" id="ar-mic" title="Toggle Squad Mic" onclick="VOICE.toggleMic()">${(typeof VOICE !== 'undefined' && VOICE.micOn) ? '🎙️' : '🔇'}</button>
          <button class="abtn-top ${(typeof VOICE !== 'undefined' && VOICE.spkOn) ? 'on' : 'muted'}" id="ar-spk" title="Toggle Squad Speaker" onclick="VOICE.toggleSpk()">${(typeof VOICE !== 'undefined' && VOICE.spkOn) ? '🔊' : '🔈'}</button>
          <button class="abtn-top exit" onclick="confirmExitMatch()">🚪 EXIT</button>
        </div>
      </div>

      <div class="codm-gunsmith" id="ar-gunsmith" style="display:none">
        <div class="gs-top">
          <div class="gs-title">
            <span class="gs-badge">MAX</span>
            <b id="gs-gun-title">${esc(weapons[0].name)}</b>
            <small id="gs-gun-cat">${weapons[0].cat.toUpperCase()}</small>
          </div>
          <div class="gs-tabs" id="gs-gun-tabs"></div>
          <button class="ld-close" id="ar-gs-close">✕</button>
        </div>
        <div class="gs-body">
          <div class="gs-left">
            <div class="gs-att-row" id="gs-att-top"></div>
            <div class="gs-preview">
              <canvas id="gs-gun-cv" width="380" height="150"></canvas>
              <div class="gs-blueprint-bar">CODM GUNSMITH · REAL BALLISTICS & RECOIL</div>
            </div>
            <div class="gs-att-row" id="gs-att-bot"></div>
          </div>
          <div class="gs-right">
            <div class="gs-stats-box" id="gs-stats"></div>
            <div class="gs-actions">
              <button class="sm alt" id="gs-reset-att">RESET</button>
              <button class="sm" id="gs-equip-btn">EQUIP & PLAY</button>
            </div>
          </div>
        </div>
      </div>

      <div class="sq-bhud hud-movable" id="ar-sqhud" style="${hStyle('sqhud', false)}"></div>
      ${pcKeysHtml}
      <div class="mfeed" id="ar-feed">${isPrivatePvP ? '🔒 PRIVATE ' + esc(PRIVATE_ROOM.mode.toUpperCase()) + ' · MAP: ' + esc(mapCfg.name) : 'MAP: ' + esc(mapCfg.name) + ' · ELIMINATE HOSTILES'}</div>

      <div class="hctrl" id="hc-minimap" style="${hStyle('minimap')}"><canvas id="radar" width="84" height="84"></canvas></div>
      <div class="hctrl joy" id="hc-joy" style="${hStyle('joy')}"><div class="knob" id="hc-knob"></div></div>
      <button class="hctrl act fire" id="hc-fire" style="${hStyle('fire')}">🔥</button>
      <button class="hctrl act" id="hc-scope" style="${hStyle('scope')}">🎯</button>
      <button class="hctrl act" id="hc-jump" style="${hStyle('jump')}">⬆️</button>
      <button class="hctrl act" id="hc-crouch" style="${hStyle('crouch')}">🤸</button>
      <button class="hctrl act" id="hc-reload" style="${hStyle('reload')}">🔄</button>
      <button class="hctrl act" id="hc-grenade" style="${hStyle('grenade')}">💣</button>
      <button class="hctrl act" id="hc-wswitch" style="${hStyle('wswitch')}">🔫</button>
      <button class="hctrl act" id="hc-cam" style="${hStyle('cam')}">🎥</button>
    </div>
  `;
  document.body.appendChild(arenaEl);

  const acv = document.getElementById('acv');
  const feedEl = document.getElementById('ar-feed');
  const hpTxt = document.getElementById('ar-hp-txt');
  const hpBar = document.getElementById('ar-hp-bar');
  const wNameEl = document.getElementById('ar-wname');
  const ammoEl = document.getElementById('ar-ammo');
  const killsEl = document.getElementById('ar-kills');
  const scopeOv = document.getElementById('ar-scope');
  const slideFxEl = document.getElementById('ar-slidefx');
  const xhairEl = document.getElementById('ar-xhair');
  const radarCv = document.getElementById('radar');
  const radarCtx = radarCv ? radarCv.getContext('2d') : null;
  const gunsmithEl = document.getElementById('ar-gunsmith');

  function setFeed(msg) {
    if (feedEl) feedEl.textContent = msg;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: acv, antialias: safeS.cfg.gfx !== 'Low', alpha: false });
  } catch (e) {
    renderer = new THREE.WebGLRenderer({ canvas: acv, antialias: false, alpha: false });
  }
  const q = safeS.cfg.gfx || 'High';
  renderer.setPixelRatio(q === 'Low' ? 0.85 : q === 'Medium' ? 1.15 : Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(skyHex, 1);
  if (q !== 'Low') {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(skyHex);
  scene.fog = new THREE.Fog(skyHex, isKillhouse ? 45 : 36, isKillhouse ? 130 : 115);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.08, 140);
  scene.add(camera);

  const fppVm = createFppViewmodel();
  fppVm.setGun(weapons[0].id);
  camera.add(fppVm.root);

  scene.add(new THREE.AmbientLight(0xffffff, isKillhouse ? 0.65 : 0.72));
  scene.add(new THREE.HemisphereLight(isKillhouse ? 0xbae6fd : 0xf0f9ff, 0x334155, 0.82));
  const sun = new THREE.DirectionalLight(isKillhouse ? 0xfff3d6 : 0xfffbeb, 1.08);
  sun.position.set(24, 42, 20);
  if (q !== 'Low') {
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 110;
    const d = 46;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
  }
  scene.add(sun);

  const tex = getArenaTextures(mapCfg.id);
  const colliders = [];
  const walkableSurfaces = [];

  function addCollider(x, z, w, d, maxY) {
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, maxY });
  }

  function addBox(x, y, z, w, h, d, matOpts, solid = true, usePbr = false) {
    const MatCtor = usePbr ? THREE.MeshStandardMaterial : THREE.MeshLambertMaterial;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new MatCtor(matOpts)
    );
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (solid) addCollider(x, z, w, d, y + h);
    return mesh;
  }

  if (isKillhouse) {
    const arenaW = 68, arenaD = 80;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(arenaW + 16, arenaD + 16),
      new THREE.MeshStandardMaterial({ map: tex.groundTex, roughness: 0.78, metalness: 0.12 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const midLane = new THREE.Mesh(
      new THREE.PlaneGeometry(8.5, arenaD - 6),
      new THREE.MeshStandardMaterial({ map: tex.roadTex, roughness: 0.65, metalness: 0.2 })
    );
    midLane.rotation.x = -Math.PI / 2;
    midLane.position.y = 0.02;
    midLane.receiveShadow = true;
    scene.add(midLane);

    const centerLine = new THREE.Mesh(
      new THREE.PlaneGeometry(arenaW - 4, 0.35),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.y = 0.03;
    scene.add(centerLine);

    addBox(0, 0, -arenaD / 2, arenaW + 2, 6.2, 2.0, { map: tex.wallTex, roughness: 0.7 }, true, true);
    addBox(0, 0, arenaD / 2, arenaW + 2, 6.2, 2.0, { map: tex.wallTex, roughness: 0.7 }, true, true);
    addBox(-arenaW / 2, 0, 0, 2.0, 6.2, arenaD + 2, { map: tex.wallTex, roughness: 0.7 }, true, true);
    addBox(arenaW / 2, 0, 0, 2.0, 6.2, arenaD + 2, { map: tex.wallTex, roughness: 0.7 }, true, true);

    function buildSpawnBunker(zPos, isAlpha) {
      const teamCol = isAlpha ? 0x38bdf8 : 0xff2a55;
      const dir = isAlpha ? -1 : 1;

      addBox(0, 0, zPos - dir * 4.5, 16, 4.4, 1.4, { map: tex.wallTex, roughness: 0.65 }, true, true);
      addBox(-8.5, 0, zPos - dir * 1.5, 1.4, 4.0, 7.0, { map: tex.wallTex, roughness: 0.65 }, true, true);
      addBox(8.5, 0, zPos - dir * 1.5, 1.4, 4.0, 7.0, { map: tex.wallTex, roughness: 0.65 }, true, true);
      addBox(0, 4.3, zPos - dir * 1.8, 18.4, 0.45, 7.6, { color: 0x1e293b, roughness: 0.4, metalness: 0.65 }, false, true);

      const neonBar = new THREE.Mesh(
        new THREE.BoxGeometry(12.5, 0.32, 0.25),
        new THREE.MeshBasicMaterial({ color: teamCol })
      );
      neonBar.position.set(0, 4.1, zPos + dir * 2.05);
      scene.add(neonBar);

      addBox(-3.8, 0, zPos + dir * 4.6, 4.2, 1.15, 0.95, { color: 0x64748b, roughness: 0.75 }, true, true);
      addBox(3.8, 0, zPos + dir * 4.6, 4.2, 1.15, 0.95, { color: 0x64748b, roughness: 0.75 }, true, true);

      const bLight = new THREE.PointLight(teamCol, 1.1, 22);
      bLight.position.set(0, 3.6, zPos);
      scene.add(bLight);
    }
    buildSpawnBunker(29, true);
    buildSpawnBunker(-29, false);

    const bridgeY = 3.0;
    addBox(0, bridgeY - 0.35, 0, 14.0, 0.35, 6.2, { map: tex.deckTex, roughness: 0.45, metalness: 0.6 }, false, true);
    walkableSurfaces.push({ minX: -7.0, maxX: 7.0, minZ: -3.1, maxZ: 3.1, y: bridgeY, type: 'flat' });

    [[-5.8, -2.2], [5.8, -2.2], [-5.8, 2.2], [5.8, 2.2]].forEach(([px0, pz0]) => {
      addBox(px0, 0, pz0, 0.9, bridgeY - 0.35, 0.9, { color: 0x1e293b, roughness: 0.4, metalness: 0.75 }, true, true);
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.34,
      roughness: 0.12,
      metalness: 0.25
    });
    [-2.95, 2.95].forEach(gz => {
      const gPanel = new THREE.Mesh(new THREE.BoxGeometry(13.6, 1.15, 0.14), glassMat);
      gPanel.position.set(0, bridgeY + 0.58, gz);
      scene.add(gPanel);
      addBox(0, bridgeY + 1.15, gz, 13.8, 0.12, 0.22, { color: 0x0f172a, metalness: 0.8, roughness: 0.3 }, false, true);
    });

    function buildWalkableRamp(xStart, xEnd, zCenter, widthZ, hTop) {
      const lenX = Math.abs(xEnd - xStart);
      const midX = (xStart + xEnd) / 2;
      const slopeAng = Math.atan2(hTop, lenX) * (xEnd > xStart ? 1 : -1);
      const hyp = Math.hypot(lenX, hTop);
      const rampMesh = new THREE.Mesh(
        new THREE.BoxGeometry(hyp, 0.28, widthZ),
        new THREE.MeshStandardMaterial({ map: tex.deckTex, roughness: 0.5, metalness: 0.55 })
      );
      rampMesh.position.set(midX, hTop / 2 - 0.1, zCenter);
      rampMesh.rotation.z = slopeAng;
      rampMesh.castShadow = true;
      rampMesh.receiveShadow = true;
      scene.add(rampMesh);

      walkableSurfaces.push({
        minX: Math.min(xStart, xEnd),
        maxX: Math.max(xStart, xEnd),
        minZ: zCenter - widthZ / 2,
        maxZ: zCenter + widthZ / 2,
        xStart,
        xEnd,
        yTop: hTop,
        type: 'rampX'
      });
    }
    buildWalkableRamp(-14.5, -7.0, 0, 4.2, bridgeY);
    buildWalkableRamp(14.5, 7.0, 0, 4.2, bridgeY);

    addBox(0, bridgeY, 0, 1.6, 2.2, 1.6, { color: 0x0f172a, metalness: 0.8, roughness: 0.25 }, true, true);
    const coreGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 1.8, 12),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    coreGlow.position.set(0, bridgeY + 1.1, 0);
    scene.add(coreGlow);

    function buildPbrContainer(x, y, z, w, h, d, col) {
      addBox(x, y, z, w, h, d, { color: col, map: tex.contTex, roughness: 0.48, metalness: 0.52 }, true, true);
      addBox(x, y + h, z, w + 0.14, 0.14, d + 0.14, { color: 0x0f172a, roughness: 0.4, metalness: 0.7 }, false, true);
    }
    buildPbrContainer(-21.5, 0, -12.5, 3.2, 2.8, 7.2, 0xdc2626);
    buildPbrContainer(-21.5, 2.94, -12.5, 3.1, 2.7, 7.0, 0x334155);
    buildPbrContainer(-21.5, 0, 12.5, 3.2, 2.8, 7.2, 0x2563eb);
    buildPbrContainer(-21.5, 2.94, 12.5, 3.1, 2.7, 7.0, 0x475569);

    buildPbrContainer(21.5, 0, -12.5, 3.2, 2.8, 7.2, 0xd97706);
    buildPbrContainer(21.5, 2.94, -12.5, 3.1, 2.7, 7.0, 0x334155);
    buildPbrContainer(21.5, 0, 12.5, 3.2, 2.8, 7.2, 0x0d9488);
    buildPbrContainer(21.5, 2.94, 12.5, 3.1, 2.7, 7.0, 0x475569);

    [[-10.5, -14.5], [10.5, -14.5], [-10.5, 14.5], [10.5, 14.5]].forEach(([bx, bz]) => {
      addBox(bx, 0, bz, 3.8, 1.35, 1.2, { map: tex.wallTex, roughness: 0.7 }, true, true);
      addBox(bx + (bx < 0 ? -1.4 : 1.4), 0, bz + (bz < 0 ? -1.3 : 1.3), 1.3, 1.3, 1.3, { map: tex.crateTex, roughness: 0.8 }, true, true);
    });
  } else {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(110, 110),
      new THREE.MeshLambertMaterial({ map: tex.groundTex })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const roadMat = new THREE.MeshLambertMaterial({ map: tex.roadTex });
    const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 98), roadMat);
    roadNS.rotation.x = -Math.PI / 2;
    roadNS.position.y = 0.02;
    scene.add(roadNS);

    const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(98, 9.5), roadMat);
    roadEW.rotation.x = -Math.PI / 2;
    roadEW.rotation.z = Math.PI / 2;
    roadEW.position.y = 0.025;
    scene.add(roadEW);

    addBox(0, 0, -48, 98, 4.8, 2.2, { map: tex.wallTex });
    addBox(0, 0, 48, 98, 4.8, 2.2, { map: tex.wallTex });
    addBox(-48, 0, 0, 2.2, 4.8, 98, { map: tex.wallTex });
    addBox(48, 0, 0, 2.2, 4.8, 98, { map: tex.wallTex });

    function buildTacticalBuilding(x, z, w, h, d, tintCol) {
      addBox(x, 0, z, w, h, d, { map: tex.wallTex, color: tintCol });
      addBox(x, h, z, w + 0.5, 0.45, d + 0.5, { color: 0x1e293b }, false);
    }
    buildTacticalBuilding(-17, -17, 9.5, 5.6, 8.5, 0xffffff);
    buildTacticalBuilding(17, -17, 9.5, 5.6, 8.5, 0xdbeafe);
    buildTacticalBuilding(-17, 17, 9.5, 5.6, 8.5, 0xe2e8f0);
    buildTacticalBuilding(17, 17, 9.5, 5.6, 8.5, 0xfef3c7);

    function buildContainer(x, z, w, h, d, col) {
      addBox(x, 0, z, w, h, d, { color: col, map: tex.contTex });
      addBox(x, h, z, w + 0.12, 0.14, d + 0.12, { color: 0x1e293b }, false);
    }
    buildContainer(-9.5, -4.5, 2.9, 2.6, 6.4, 0xdc2626);
    buildContainer(9.5, 4.5, 2.9, 2.6, 6.4, 0x2563eb);
    buildContainer(-27, 0, 3.2, 2.7, 7.6, 0x0d9488);
    buildContainer(27, 0, 3.2, 2.7, 7.6, 0xd97706);
  }

  const pickups = [];
  const pickupCoords = isKillhouse
    ? [[-21.5, 0], [21.5, 0], [0, -18], [0, 18]]
    : [[-22, -22], [22, -22], [-22, 22], [22, 22], [0, 0]];
  pickupCoords.forEach((pt, idx) => {
    const isMed = idx % 2 === 0;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.7, 0.9),
      new THREE.MeshLambertMaterial({ color: isMed ? 0x22c55e : 0xf5d300, emissive: isMed ? 0x15803d : 0xb45309, emissiveIntensity: 0.45 })
    );
    m.position.set(pt[0], 0.45, pt[1]);
    scene.add(m);
    pickups.push({ mesh: m, x: pt[0], z: pt[1], isMed, cd: 0 });
  });

  const spawnIsBravo = isPrivatePvP && PRIVATE_ROOM.myTeam === 'bravo';
  let px = spawnIsBravo ? -1.5 : 1.5;
  let py = 0;
  let pz = spawnIsBravo ? -29 : (isKillhouse ? 29 : 28);
  let vy = 0;
  let yaw = spawnIsBravo ? Math.PI : 0;
  let pitch = 0.04;
  let charYaw = yaw;
  let curAnimState = 'Idle';
  let hp = 100, maxHp = 100, kills = 0;
  let scoped = false, fpp = false, reloading = false, reloadStartTs = 0, reloadDurMs = 1500, lastShotTs = 0;
  let crouching = false, crouchLerp = 0, slideTimer = 0, slideLerp = 0, slideDirX = 0, slideDirZ = 0;
  let pcAimMode = false, pcFiring = false, touchFiring = false;
  let joyX = 0, joyY = 0;
  const keysDown = {};

  let pendingHit = null;
  let hitCounter = 0;
  const processedHits = new Set();

  const playerAv = makeSoldierAvatar({
    armorCol: spawnIsBravo ? 0xdc2626 : 0x2563eb,
    gunId: weapons[0].id,
    isEnemy: spawnIsBravo,
    showBeacon: isPrivatePvP
  });
  scene.add(playerAv.grp);

  const bullets = [];
  const tracers = [];
  const grenades = [];
  const dustParts = [];

  function spawnTracer(from, to, col = 0xfef08a) {
    const geom = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: col }));
    scene.add(line);
    tracers.push({ line, life: 0.07 });
  }

  function spawnDust(x, z) {
    const m = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.22, 0),
      new THREE.MeshBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.55 })
    );
    m.position.set(x + (Math.random() - 0.5) * 0.5, py + 0.2, z + (Math.random() - 0.5) * 0.5);
    scene.add(m);
    dustParts.push({ mesh: m, life: 0.35 });
  }

  const spawnBots = !isPrivatePvP || PRIVATE_ROOM.fillBots;
  const botSpawns = spawnBots ? [[-32, -32], [0, -34], [32, -32], [-34, 4], [34, -4], [0, -22]] : [];
  const bots = botSpawns.map((sp, i) => {
    const gunId = i % 3 === 0 ? 7 : i % 2 === 0 ? 5 : 3;
    const av = makeSoldierAvatar({ armorCol: 0xdc2626, gunId, tint: 0xff2a55, label: 'BOT ' + (i + 1), isEnemy: true, showBeacon: true });
    av.grp.position.set(sp[0], 0, sp[1]);
    scene.add(av.grp);
    return {
      id: i,
      av,
      x: sp[0],
      y: 0,
      z: sp[1],
      rotY: 0,
      hp: 100,
      alive: true,
      dying: false,
      deathProg: 0,
      respawnT: 0,
      dir: Math.random() * Math.PI * 2,
      strafeT: 1 + Math.random() * 2,
      fireCd: 1.2 + Math.random() * 1.5
    };
  });

  const remotePeers = {};

  function respawnPrivatePlayer() {
    hp = 100;
    py = 0;
    vy = 0;
    if (spawnIsBravo) {
      px = -1.5;
      pz = -29;
      yaw = Math.PI;
    } else {
      px = 1.5;
      pz = isKillhouse ? 29 : 28;
      yaw = 0;
    }
    charYaw = yaw;
    updateHud();
  }

  function applyIncomingPvpDamage(dmgAmt, attackerName = 'FRIEND') {
    if (!isPrivatePvP) return;
    hp = Math.max(0, hp - dmgAmt);
    updateHud();
    if (hp <= 0) {
      setFeed(`💀 ELIMINATED BY ${esc(attackerName)}! RESPAWNING AT BASE...`);
      respawnPrivatePlayer();
    }
  }

  /* ===== CODM GUNSMITH ===== */
  let gsSelectedIdx = 0;

  function drawGunsmithPreview(spec) {
    const cv = document.getElementById('gs-gun-cv');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(148,163,184,0.16)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y <= h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    const col = spec.cat === 'sniper' ? '#38bdf8' : spec.cat === 'shotgun' ? '#f59e0b' : spec.cat === 'launcher' ? '#ef4444' : '#f5d300';
    ctx.save();
    ctx.translate(w * 0.5, h * 0.55);
    ctx.strokeStyle = col;
    ctx.fillStyle = 'rgba(30,41,59,0.92)';
    ctx.lineWidth = 2;

    if (spec.cat === 'launcher') {
      ctx.fillRect(-130, -16, 250, 32);
      ctx.strokeRect(-130, -16, 250, 32);
      ctx.fillRect(-20, 16, 24, 34);
    } else {
      ctx.beginPath();
      ctx.moveTo(-145, -18); ctx.lineTo(-75, -12); ctx.lineTo(-75, 16); ctx.lineTo(-145, 26);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillRect(-75, -18, 105, 34);
      ctx.strokeRect(-75, -18, 105, 34);
      const bLen = spec.cat === 'sniper' ? 128 : spec.cat === 'shotgun' ? 92 : 76;
      ctx.fillRect(30, -9, bLen, 16);
      ctx.strokeRect(30, -9, bLen, 16);
      if (spec.suppressed) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(30 + bLen, -12, 42, 22);
        ctx.strokeRect(30 + bLen, -12, 42, 22);
      }
      if (spec.cat !== 'shotgun') {
        ctx.save();
        ctx.translate(-12, 16);
        ctx.rotate(0.22);
        ctx.fillStyle = col;
        ctx.fillRect(-10, 0, 22, spec.cat === 'sniper' ? 28 : 42);
        ctx.restore();
      }
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-35, -32, spec.cat === 'sniper' ? 68 : 34, 14);
      ctx.strokeRect(-35, -32, spec.cat === 'sniper' ? 68 : 34, 14);
    }
    ctx.restore();
  }

  function renderGunsmith() {
    if (!gunsmithEl) return;
    const spec = weapons[gsSelectedIdx] || weapons[0];
    const titleEl = document.getElementById('gs-gun-title');
    const catEl = document.getElementById('gs-gun-cat');
    const tabsEl = document.getElementById('gs-gun-tabs');
    const topAttEl = document.getElementById('gs-att-top');
    const botAttEl = document.getElementById('gs-att-bot');
    const statsEl = document.getElementById('gs-stats');

    if (titleEl) titleEl.textContent = spec.name;
    if (catEl) catEl.textContent = spec.cat.toUpperCase() + (spec.id === weapons[wIdx].id ? ' · ACTIVE' : '');

    if (tabsEl) {
      tabsEl.innerHTML = weapons.map((w, idx) =>
        `<button class="gs-wtab${idx === gsSelectedIdx ? ' on' : ''}" data-idx="${idx}">${esc(w.cat.toUpperCase())}</button>`
      ).join('');
      tabsEl.querySelectorAll('.gs-wtab').forEach(b => {
        b.addEventListener('click', e => {
          e.stopPropagation();
          gsSelectedIdx = +b.dataset.idx;
          renderGunsmith();
        });
      });
    }

    const renderSlot = (slotKey, slotTitle) => {
      const list = GUNSMITH_ATTACHMENTS[slotKey];
      const curId = spec.att[slotKey];
      const curObj = list.find(x => x.id === curId) || list[0];
      return `<div class="gs-slot" data-slot="${slotKey}">
        <span>${slotTitle}</span>
        <b>${esc(curObj.label)}</b>
      </div>`;
    };

    if (topAttEl) {
      topAttEl.innerHTML = renderSlot('barrel', 'BARREL') + renderSlot('optic', 'OPTIC') + renderSlot('underbarrel', 'UNDERBARREL');
    }
    if (botAttEl) {
      botAttEl.innerHTML = renderSlot('laser', 'LASER') + renderSlot('grip', 'REAR GRIP');
    }

    gunsmithEl.querySelectorAll('.gs-slot').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const sKey = el.dataset.slot;
        const list = GUNSMITH_ATTACHMENTS[sKey];
        const idx = list.findIndex(x => x.id === spec.att[sKey]);
        const nextObj = list[(idx + 1) % list.length];
        safeS.cfg.gunsmith[spec.id] = Object.assign({}, spec.att, { [sKey]: nextObj.id });
        weapons[gsSelectedIdx] = getWeaponSpec(spec, safeS.cfg.gunsmith[spec.id]);
        if (typeof save === 'function') save();
        renderGunsmith();
      });
    });

    if (statsEl) {
      const rows = [
        ['DAMAGE', spec.stats.damage],
        ['FIRE RATE', spec.stats.fireRate],
        ['ACCURACY', spec.stats.accuracy],
        ['MOBILITY', spec.stats.mobility],
        ['RANGE', spec.stats.range],
        ['CONTROL', spec.stats.control]
      ];
      statsEl.innerHTML = rows.map(([lbl, val]) => `
        <div class="gs-srow">
          <span>${lbl}</span>
          <div class="gs-bar"><i style="width:${val}%"></i></div>
          <b>${val}</b>
        </div>
      `).join('');
    }

    drawGunsmithPreview(weapons[gsSelectedIdx]);
  }

  function toggleGunsmith(forceOpen) {
    if (!gunsmithEl) return;
    const next = typeof forceOpen === 'boolean' ? forceOpen : (gunsmithEl.style.display === 'none');
    gunsmithEl.style.display = next ? 'block' : 'none';
    if (next) {
      gsSelectedIdx = wIdx;
      renderGunsmith();
      if (isPC && document.pointerLockElement === acv) {
        try { document.exitPointerLock(); } catch (e) {}
      }
    } else if (isPC && AR && !AR.paused) {
      enterPcAimMode();
    }
  }

  /* ===== BATTLE WORLD SETTINGS MODAL ===== */
  function openBattleSettings() {
    if (!AR || AR.paused) return;
    AR.paused = 1;
    pcFiring = false;
    touchFiring = false;
    if (isPC && document.pointerLockElement === acv) {
      try { document.exitPointerLock(); } catch (e) {}
    }

    const g = safeS.cfg;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="pop L" style="max-width:29rem;width:92%;text-align:left">
        <div class="rL" style="text-align:center">⚙️ BATTLE WORLD SETTINGS</div>
        <div class="fr" style="margin-top:8px">
          <div style="flex:1"><b>Aim Sensitivity (<span id="bs-sens-v">${g.sens || 100}</span>%)</b><div class="s">Camera & scope turn speed</div></div>
          <input type="range" id="bs-sens" min="20" max="200" value="${g.sens || 100}" style="width:8.5rem">
        </div>
        <div class="fr">
          <div style="flex:1"><b>Graphics Quality</b><div class="s">Low / Medium / High / Ultra</div></div>
          <select id="bs-gfx" style="width:auto">
            ${['Low', 'Medium', 'High', 'Ultra'].map(v => `<option${(g.gfx || 'High') === v ? ' selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="fr">
          <div style="flex:1"><b>SFX Volume (<span id="bs-vol-v">${g.vol ?? 85}</span>%)</b><div class="s">Gunshots & combat audio</div></div>
          <input type="range" id="bs-vol" min="0" max="100" value="${g.vol ?? 85}" style="width:8.5rem">
        </div>
        <div class="fr">
          <div style="flex:1"><b>Vibration / Haptics</b><div class="s">Tactile feedback on action</div></div>
          <button class="sm${g.vib ? '' : ' alt'}" id="bs-vib">${g.vib ? 'ON' : 'OFF'}</button>
        </div>
        <div class="row" style="justify-content:flex-end;margin-top:12px;gap:8px">
          <button class="sm" id="bs-save">SAVE & RESUME</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const sensEl = document.getElementById('bs-sens');
    const sensV = document.getElementById('bs-sens-v');
    const volEl = document.getElementById('bs-vol');
    const volV = document.getElementById('bs-vol-v');
    const gfxEl = document.getElementById('bs-gfx');
    const vibEl = document.getElementById('bs-vib');
    let vibDraft = g.vib ? 1 : 0;

    sensEl.oninput = () => { sensV.textContent = sensEl.value; };
    volEl.oninput = () => { volV.textContent = volEl.value; };
    vibEl.onclick = e => {
      e.stopPropagation();
      vibDraft = vibDraft ? 0 : 1;
      vibEl.textContent = vibDraft ? 'ON' : 'OFF';
      vibEl.className = 'sm' + (vibDraft ? '' : ' alt');
    };

    document.getElementById('bs-save').onclick = e => {
      e.stopPropagation();
      g.sens = +sensEl.value;
      g.vol = +volEl.value;
      g.gfx = gfxEl.value;
      g.vib = vibDraft;
      const pr = g.gfx === 'Low' ? 0.85 : g.gfx === 'Medium' ? 1.15 : Math.min(window.devicePixelRatio || 1, 1.75);
      renderer.setPixelRatio(pr);
      resizeArena();
      if (typeof save === 'function') save();
      modal.remove();
      if (AR) {
        AR.paused = 0;
        prevT = performance.now();
      }
      if (isPC) enterPcAimMode();
      toast('⚙️ Battle settings saved');
    };
  }

  function updateHud() {
    const w = weapons[wIdx], st = wState[wIdx];
    if (hpTxt) hpTxt.textContent = `HP ${Math.max(0, Math.ceil(hp))} / ${maxHp}`;
    if (hpBar) hpBar.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
    if (wNameEl) wNameEl.textContent = `${w.name} [${w.cat.toUpperCase()}]`;
    if (ammoEl) ammoEl.textContent = reloading ? 'RELOADING...' : `${st.ammo} / ${st.reserve}`;
    if (killsEl) killsEl.textContent = `${isPrivatePvP ? 'SCORE' : 'KILLS'}: ${kills}`;
    const showBlackScope = scoped && (!fpp || w.cat === 'sniper' || w.cat === 'launcher');
    if (scopeOv) scopeOv.classList.toggle('on', showBlackScope);
    if (xhairEl) xhairEl.style.opacity = (fpp && scoped && !showBlackScope) ? '0' : '1';
    const scBtn = document.getElementById('hc-scope');
    if (scBtn) scBtn.classList.toggle('scoped', scoped);
  }

  function toggleScope(forceVal) {
    scoped = typeof forceVal === 'boolean' ? forceVal : !scoped;
    updateHud();
  }

  function toggleCam() {
    fpp = !fpp;
    updateHud();
    setFeed(fpp ? '📷 FIRST-PERSON VIEW (FPP — CENTER AIM)' : '📷 THIRD-PERSON VIEW (TPP)');
  }

  function switchWeapon(forceIdx) {
    if (reloading) return;
    scoped = false;
    wIdx = typeof forceIdx === 'number' ? forceIdx : (wIdx + 1) % weapons.length;
    playerAv.setGun(weapons[wIdx].id);
    fppVm.setGun(weapons[wIdx].id);
    if (typeof SFX !== 'undefined' && SFX.equip) SFX.equip('gun', weapons[wIdx].rarity);
    updateHud();
    setFeed(`🔫 [${wIdx + 1}/${weapons.length}] ${weapons[wIdx].name} (${weapons[wIdx].cat.toUpperCase()})`);
  }

  function reloadWeapon() {
    const w = weapons[wIdx], st = wState[wIdx];
    if (reloading || st.ammo >= w.mag || st.reserve <= 0) return;
    reloading = true;
    reloadStartTs = performance.now();
    reloadDurMs = w.relMs;
    if (scoped) toggleScope(false);
    GUN_AUDIO.playReload(w.cat);
    updateHud();
    setFeed(`🔄 RELOADING ${w.name}...`);
    setTimeout(() => {
      if (!AR) return;
      const need = w.mag - st.ammo;
      const take = Math.min(need, st.reserve);
      st.ammo += take;
      st.reserve -= take;
      reloading = false;
      updateHud();
    }, w.relMs);
  }

  function triggerSlideOrCrouch(isTap, isMoving) {
    const floorNow = getFloorHeight(px, pz);
    if (isTap && isMoving && (py - floorNow) <= 0.08 && slideTimer <= 0) {
      crouching = false;
      slideTimer = 0.72;
      slideDirX = -Math.sin(yaw);
      slideDirZ = -Math.cos(yaw);
      if (typeof SFX !== 'undefined' && SFX.back) SFX.back();
      setFeed('⚡ COMBAT SLIDE!');
    } else if (isTap) {
      crouching = !crouching;
      setFeed(crouching ? '🧎 CROUCHED' : '🧍 STANDING');
    } else {
      crouching = true;
      setFeed('🧎 CROUCHING (HOLD C)');
    }
  }

  function throwGrenade() {
    if (typeof SFX !== 'undefined' && SFX.click) SFX.click();
    const dir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch) + 0.35, -Math.cos(yaw) * Math.cos(pitch)).normalize();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 10),
      new THREE.MeshLambertMaterial({ color: 0x3f6212, emissive: 0xff2a55, emissiveIntensity: 0.45 })
    );
    mesh.position.set(px, py + 1.45, pz);
    scene.add(mesh);
    grenades.push({
      mesh,
      vx: dir.x * 18,
      vy: dir.y * 14,
      vz: dir.z * 18,
      fuse: 1.8
    });
    setFeed('💣 FRAG GRENADE OUT!');
  }

  function doJump() {
    const floorNow = getFloorHeight(px, pz);
    if ((py - floorNow) <= 0.06) {
      const boost = slideTimer > 0 ? 1.15 : 1.0;
      slideTimer = 0;
      crouching = false;
      vy = 7.6 * boost;
      if (typeof SFX !== 'undefined' && SFX.click) SFX.click();
    }
  }

  function fireWeapon() {
    if (!AR || AR.paused || reloading) return;
    const w = weapons[wIdx], st = wState[wIdx];
    const nowMs = performance.now();
    if (nowMs - lastShotTs < w.rate) return;
    if (st.ammo <= 0) {
      reloadWeapon();
      return;
    }
    lastShotTs = nowMs;
    st.ammo--;
    GUN_AUDIO.playShot(w.cat, w.suppressed);
    playerAv.triggerMuzzle();
    fppVm.triggerRecoil();
    updateHud();

    if (xhairEl) {
      xhairEl.style.transform = 'translate(-50%,-50%) scale(1.45)';
      setTimeout(() => { if (xhairEl) xhairEl.style.transform = 'translate(-50%,-50%) scale(1)'; }, 70);
    }

    const eyeH = 1.62 - crouchLerp * 0.48 - slideLerp * 0.72;
    const origin = new THREE.Vector3(px, py + eyeH, pz);
    const baseDir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).normalize();

    for (let p = 0; p < w.pellets; p++) {
      const crouchAccuracy = crouching ? 0.74 : 1.0;
      const sp = (scoped ? w.spread * 0.14 : w.spread) * crouchAccuracy;
      const dir = baseDir.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * sp,
        (Math.random() - 0.5) * sp,
        (Math.random() - 0.5) * sp
      )).normalize();

      const startPos = origin.clone().addScaledVector(dir, 0.75);
      const bMesh = new THREE.Mesh(
        new THREE.SphereGeometry(w.explosive ? 0.14 : 0.045, 6, 6),
        new THREE.MeshBasicMaterial({ color: w.explosive ? 0xff5722 : (w.rarity === 'M' ? 0xff2a55 : 0xfef08a) })
      );
      bMesh.position.copy(startPos);
      scene.add(bMesh);

      bullets.push({
        mesh: bMesh,
        pos: startPos,
        prevPos: startPos.clone(),
        vel: dir.clone().multiplyScalar(w.speed),
        gravity: w.drop || 2.5,
        dmg: w.dmg,
        explosive: !!w.explosive,
        tracerColor: w.rarity === 'M' ? 0xff2a55 : 0xfef08a,
        life: 1.35
      });
    }
  }

  function damageBot(b, amount) {
    if (!b.alive || b.dying) return;
    b.hp -= amount;
    if (b.hp <= 0) {
      b.alive = false;
      b.dying = true;
      b.deathProg = 0;
      b.respawnT = 4.2;
      kills++;
      safeS.coins = (safeS.coins || 0) + 8;
      if (typeof addXP === 'function') addXP(15);
      GUN_AUDIO.playHitmarker(true);
      updateHud();
      setFeed(`💀 ELIMINATED HOSTILE SOLDIER! (+15 XP · +8 🪙)`);
    } else {
      GUN_AUDIO.playHitmarker(false);
    }
  }

  function damageRemotePeer(pid, rp, amount) {
    if (!isPrivatePvP || !rp) return;
    if (rp.team === PRIVATE_ROOM.myTeam) return;
    hitCounter++;
    pendingHit = { targetPid: pid, dmg: amount, seq: hitCounter, ts: Date.now() };
    rp.hp = Math.max(0, (rp.hp || 100) - amount);
    rp.av.updateTag(rp.name || 'FRIEND', rp.hp);
    if (rp.hp <= 0) {
      rp.hp = 100;
      kills++;
      GUN_AUDIO.playHitmarker(true);
      updateHud();
      setFeed(`🏆 ROUND POINT! YOU ELIMINATED ${esc(rp.name || 'FRIEND')} (${kills} PTS)`);
    } else {
      GUN_AUDIO.playHitmarker(false);
    }
  }

  const setBtn = document.getElementById('ar-settings-btn');
  if (setBtn) setBtn.addEventListener('click', e => { e.stopPropagation(); openBattleSettings(); });

  const fsBtn = document.getElementById('ar-fs-btn');
  if (fsBtn) fsBtn.addEventListener('click', e => { e.stopPropagation(); toggleArenaFullscreen(); });

  const ldBtn = document.getElementById('ar-loadout-btn');
  const gsClose = document.getElementById('ar-gs-close');
  const gsReset = document.getElementById('gs-reset-att');
  const gsEquip = document.getElementById('gs-equip-btn');
  if (ldBtn) ldBtn.addEventListener('click', e => { e.stopPropagation(); toggleGunsmith(); });
  if (gsClose) gsClose.addEventListener('click', e => { e.stopPropagation(); toggleGunsmith(false); });
  if (gsReset) {
    gsReset.addEventListener('click', e => {
      e.stopPropagation();
      const spec = weapons[gsSelectedIdx];
      delete safeS.cfg.gunsmith[spec.id];
      weapons[gsSelectedIdx] = getWeaponSpec(spec, null);
      if (typeof save === 'function') save();
      renderGunsmith();
    });
  }
  if (gsEquip) {
    gsEquip.addEventListener('click', e => {
      e.stopPropagation();
      const chosen = weapons[gsSelectedIdx];
      safeS.eq.gun = chosen.id;
      if (typeof save === 'function') save();
      switchWeapon(gsSelectedIdx);
      toggleGunsmith(false);
    });
  }

  const pcKeysClose = document.getElementById('ar-pckeys-close');
  if (pcKeysClose) {
    pcKeysClose.addEventListener('click', e => {
      e.stopPropagation();
      const pkEl = document.getElementById('ar-pckeys');
      if (pkEl) pkEl.style.display = 'none';
    });
  }

  let cHoldTimer = null, cHeldTriggered = false;

  function enterPcAimMode() {
    if (!isPC || !AR || AR.paused) return;
    if (gunsmithEl && gunsmithEl.style.display !== 'none') return;
    pcAimMode = true;
    setFeed('🎯 360° AIM MODE — [WHEEL] Switch Gun · [LMB Hold→Release] Sniper Scope/Shot');
    try {
      const p = acv.requestPointerLock && acv.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }

  function onPointerLockChange() {
    if (!isPC || !AR) return;
    const locked = document.pointerLockElement === acv;
    if (locked) {
      pcAimMode = true;
      setFeed('🎯 360° AIM MODE — [WHEEL] Switch Gun · [LMB Hold→Release] Sniper Scope/Shot');
    } else {
      pcAimMode = false;
      pcFiring = false;
      if (weapons[wIdx] && (weapons[wIdx].cat === 'sniper' || weapons[wIdx].cat === 'launcher')) {
        toggleScope(false);
      }
      setFeed('🖱️ CURSOR MODE — Click [🎒 LOADOUT] or press [ESC] / click arena to Aim');
    }
  }

  function onPcMouseMove(e) {
    if (!isPC || !AR || AR.paused) return;
    if (document.pointerLockElement === acv) {
      const sens = ((safeS.cfg && safeS.cfg.sens) || 100) / 100;
      const aimMul = scoped ? 0.36 : 1.0;
      yaw -= (e.movementX || 0) * 0.0024 * sens * aimMul;
      pitch = Math.max(-1.25, Math.min(1.25, pitch - (e.movementY || 0) * 0.0021 * sens * aimMul));
    }
  }

  function onPcMouseDown(e) {
    if (!isPC || !AR || AR.paused) return;
    if (e.target.closest('button, .modal, .atop, .pc-keys, .codm-gunsmith')) return;

    if (document.pointerLockElement !== acv) {
      if (e.target === acv) enterPcAimMode();
      return;
    }

    const curCat = weapons[wIdx] && weapons[wIdx].cat;
    if (e.button === 0) {
      pcFiring = true;
      if (curCat === 'sniper' || curCat === 'launcher') {
        toggleScope(true);
      } else {
        fireWeapon();
      }
    } else if (e.button === 2) {
      toggleScope();
    }
  }

  function onPcMouseUp(e) {
    if (!isPC) return;
    if (e.button === 0) {
      const wasFiring = pcFiring;
      pcFiring = false;
      const curCat = weapons[wIdx] && weapons[wIdx].cat;
      if (wasFiring && AR && !AR.paused && (curCat === 'sniper' || curCat === 'launcher')) {
        fireWeapon();
        toggleScope(false);
      }
    }
  }

  function onPcWheel(e) {
    if (!isPC || !AR || AR.paused) return;
    if (e.target.closest('.modal, .codm-gunsmith')) return;
    const step = e.deltaY > 0 ? 1 : -1;
    const nextIdx = (wIdx + step + weapons.length) % weapons.length;
    switchWeapon(nextIdx);
  }

  function onPcKeyDown(e) {
    if (!isPC || !AR) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      if (gunsmithEl && gunsmithEl.style.display !== 'none') {
        toggleGunsmith(false);
        return;
      }
      const openModal = document.querySelector('.modal');
      if (openModal) {
        openModal.remove();
        AR.paused = 0;
        enterPcAimMode();
        return;
      }
      if (document.pointerLockElement !== acv) {
        enterPcAimMode();
      }
      return;
    }

    if (AR.paused) return;
    const wasDown = !!keysDown[e.code];
    keysDown[e.code] = true;

    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      doJump();
    } else if (e.code === 'KeyC' && !wasDown) {
      cHeldTriggered = false;
      clearTimeout(cHoldTimer);
      cHoldTimer = setTimeout(() => {
        if (keysDown.KeyC && AR && !AR.paused) {
          cHeldTriggered = true;
          triggerSlideOrCrouch(false, false);
        }
      }, 210);
    } else if (e.code === 'KeyR') {
      reloadWeapon();
    } else if (e.code === 'KeyG') {
      throwGrenade();
    } else if (e.code === 'KeyB') {
      toggleGunsmith();
    } else if (e.code === 'KeyQ' || e.code === 'Digit1' || e.code === 'Digit2') {
      switchWeapon(e.code === 'Digit1' ? 0 : e.code === 'Digit2' ? 1 : undefined);
    } else if (e.code === 'KeyV') {
      toggleCam();
    }
  }

  function onPcKeyUp(e) {
    if (!isPC) return;
    keysDown[e.code] = false;
    if (e.code === 'KeyC') {
      clearTimeout(cHoldTimer);
      if (cHeldTriggered) {
        crouching = false;
        cHeldTriggered = false;
      } else {
        const movingNow = !!(keysDown.KeyW || keysDown.KeyS || keysDown.KeyA || keysDown.KeyD || keysDown.ArrowUp || keysDown.ArrowDown || keysDown.ArrowLeft || keysDown.ArrowRight);
        triggerSlideOrCrouch(true, movingNow);
      }
    }
  }

  if (isPC) {
    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('mousemove', onPcMouseMove);
    window.addEventListener('mousedown', onPcMouseDown);
    window.addEventListener('mouseup', onPcMouseUp);
    window.addEventListener('wheel', onPcWheel, { passive: true });
    window.addEventListener('keydown', onPcKeyDown);
    window.addEventListener('keyup', onPcKeyUp);
    enterPcAimMode();
  }

  if (!isPC) {
    const joyEl = document.getElementById('hc-joy');
    const knobEl = document.getElementById('hc-knob');
    let joyPid = null, lookPid = null, lookLast = null;

    joyEl.addEventListener('pointerdown', e => {
      e.stopPropagation();
      joyPid = e.pointerId;
      joyEl.setPointerCapture(e.pointerId);
    });
    joyEl.addEventListener('pointermove', e => {
      if (e.pointerId !== joyPid) return;
      const r = joyEl.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const p1 = normPt(e.clientX, e.clientY), p0 = normPt(cx, cy);
      let dx = p1.x - p0.x, dy = p1.y - p0.y;
      const maxR = 36, dist = Math.hypot(dx, dy);
      if (dist > maxR) { dx = (dx / dist) * maxR; dy = (dy / dist) * maxR; }
      knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
      joyX = dx / maxR;
      joyY = dy / maxR;
    });
    const endJoy = e => {
      if (e.pointerId !== joyPid) return;
      joyPid = null;
      joyX = 0;
      joyY = 0;
      knobEl.style.transform = 'translate(0,0)';
    };
    joyEl.addEventListener('pointerup', endJoy);
    joyEl.addEventListener('pointercancel', endJoy);

    acv.addEventListener('pointerdown', e => {
      if (lookPid !== null) return;
      lookPid = e.pointerId;
      lookLast = normPt(e.clientX, e.clientY);
    });
    acv.addEventListener('pointermove', e => {
      if (e.pointerId !== lookPid || !lookLast) return;
      const curP = normPt(e.clientX, e.clientY);
      const sens = ((safeS.cfg && safeS.cfg.sens) || 100) / 100;
      const aimMul = scoped ? 0.42 : 1.0;
      yaw -= (curP.x - lookLast.x) * 0.0065 * sens * aimMul;
      pitch = Math.max(-1.15, Math.min(1.15, pitch - (curP.y - lookLast.y) * 0.0055 * sens * aimMul));
      lookLast = curP;
    });
    const endLook = e => {
      if (e.pointerId === lookPid) { lookPid = null; lookLast = null; }
    };
    acv.addEventListener('pointerup', endLook);
    acv.addEventListener('pointercancel', endLook);

    const fBtn = document.getElementById('hc-fire');
    fBtn.addEventListener('pointerdown', e => {
      e.stopPropagation();
      touchFiring = true;
      const curCat = weapons[wIdx] && weapons[wIdx].cat;
      if (curCat === 'sniper' || curCat === 'launcher') {
        toggleScope(true);
      } else {
        fireWeapon();
      }
    });
    const releaseTouchFire = () => {
      const wasFiring = touchFiring;
      touchFiring = false;
      const curCat = weapons[wIdx] && weapons[wIdx].cat;
      if (wasFiring && AR && !AR.paused && (curCat === 'sniper' || curCat === 'launcher')) {
        fireWeapon();
        toggleScope(false);
      }
    };
    fBtn.addEventListener('pointerup', releaseTouchFire);
    fBtn.addEventListener('pointercancel', releaseTouchFire);

    document.getElementById('hc-scope').addEventListener('pointerdown', e => { e.stopPropagation(); toggleScope(); });
    document.getElementById('hc-jump').addEventListener('pointerdown', e => { e.stopPropagation(); doJump(); });
    document.getElementById('hc-crouch').addEventListener('pointerdown', e => {
      e.stopPropagation();
      triggerSlideOrCrouch(true, Math.hypot(joyX, joyY) > 0.35);
    });
    document.getElementById('hc-reload').addEventListener('pointerdown', e => { e.stopPropagation(); reloadWeapon(); });
    document.getElementById('hc-grenade').addEventListener('pointerdown', e => { e.stopPropagation(); throwGrenade(); });
    document.getElementById('hc-wswitch').addEventListener('pointerdown', e => { e.stopPropagation(); switchWeapon(); });
    document.getElementById('hc-cam').addEventListener('pointerdown', e => { e.stopPropagation(); toggleCam(); });
  }

  function getFloorHeight(x, z) {
    let h = 0;
    for (const s of walkableSurfaces) {
      if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) {
        if (s.type === 'flat') {
          h = Math.max(h, s.y);
        } else if (s.type === 'rampX') {
          const t = Math.max(0, Math.min(1, (x - s.xStart) / (s.xEnd - s.xStart)));
          h = Math.max(h, t * s.yTop);
        }
      }
    }
    return h;
  }

  function resolveCollisions(nx, nz, rad = 0.55) {
    const limX = isKillhouse ? 32 : 45;
    const limZ = isKillhouse ? 38 : 45;
    nx = Math.max(-limX, Math.min(limX, nx));
    nz = Math.max(-limZ, Math.min(limZ, nz));
    for (const c of colliders) {
      if (py >= c.maxY - 0.12) continue;
      if (nx + rad > c.minX && nx - rad < c.maxX && nz + rad > c.minZ && nz - rad < c.maxZ) {
        const penL = (nx + rad) - c.minX;
        const penR = c.maxX - (nx - rad);
        const penT = (nz + rad) - c.minZ;
        const penB = c.maxZ - (nz - rad);
        const minP = Math.min(penL, penR, penT, penB);
        if (minP === penL) nx = c.minX - rad;
        else if (minP === penR) nx = c.maxX + rad;
        else if (minP === penT) nz = c.minZ - rad;
        else nz = c.maxZ + rad;
      }
    }
    return { x: nx, z: nz };
  }

  function resizeArena() {
    const w = Math.max(1, isPortrait() ? window.innerHeight : window.innerWidth);
    const h = Math.max(1, isPortrait() ? window.innerWidth : window.innerHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resizeArena();
  window.addEventListener('resize', resizeArena);

  function syncTeammates(members) {
    const hud = document.getElementById('ar-sqhud');
    if (hud) {
      hud.innerHTML = members.map(m => {
        const mHp = m.me ? Math.max(0, Math.ceil(hp)) : (m.battle && typeof m.battle.hp === 'number' ? m.battle.hp : 100);
        const mTeam = m.me ? PRIVATE_ROOM.myTeam : ((m.battle && m.battle.team) || 'bravo');
        const tCol = mTeam === 'bravo' ? '#ff2a55' : '#38bdf8';
        return `<div class="sq-bitem${m.isHost ? ' host' : ''}" style="border-left:3px solid ${tCol}">
          <div><b>${m.speaking ? '🗣️ ' : ''}${esc(m.name)}</b><div class="bhp"><i style="width:${mHp}%;background:${tCol}"></i></div></div>
          <span>${mHp} HP</span>
        </div>`;
      }).join('');
    }

    const myPid = getCurrentUserId();
    const activePids = new Set();
    members.forEach(m => {
      if (m.me || !m.battle) return;
      activePids.add(m.pid);

      if (isPrivatePvP && m.battle.hit && m.battle.hit.targetPid === myPid) {
        const hKey = m.pid + '_' + m.battle.hit.seq;
        if (!processedHits.has(hKey)) {
          processedHits.add(hKey);
          applyIncomingPvpDamage(m.battle.hit.dmg || 25, m.name);
        }
      }

      const peerTeam = m.battle.team || 'bravo';
      const isEnemyPeer = isPrivatePvP ? (peerTeam !== PRIVATE_ROOM.myTeam) : false;

      let rp = remotePeers[m.pid];
      if (!rp) {
        const av = makeSoldierAvatar({
          armorCol: isEnemyPeer ? 0xdc2626 : 0x2563eb,
          gunId: m.battle.gunId || 3,
          tint: isEnemyPeer ? 0xff2a55 : 0x38bdf8,
          label: m.name || 'PLAYER',
          isEnemy: isEnemyPeer,
          showBeacon: true
        });
        scene.add(av.grp);
        rp = remotePeers[m.pid] = {
          av,
          name: m.name || 'PLAYER',
          team: peerTeam,
          hp: typeof m.battle.hp === 'number' ? m.battle.hp : 100,
          tx: m.battle.x != null ? m.battle.x : (peerTeam === 'bravo' ? -1.5 : 1.5),
          ty: m.battle.y || 0,
          tz: m.battle.z != null ? m.battle.z : (peerTeam === 'bravo' ? -29 : 29),
          try: m.battle.ry != null ? m.battle.ry : (peerTeam === 'bravo' ? Math.PI : 0),
          anim: m.battle.anim || 'Idle'
        };
      }
      rp.name = m.name || rp.name;
      rp.team = peerTeam;
      if (typeof m.battle.hp === 'number') rp.hp = m.battle.hp;
      rp.av.updateTag(rp.name, rp.hp);
      if (m.battle.x != null) rp.tx = m.battle.x;
      if (m.battle.y != null) rp.ty = m.battle.y;
      if (m.battle.z != null) rp.tz = m.battle.z;
      if (m.battle.ry != null) rp.try = m.battle.ry;
      rp.anim = m.battle.anim || 'Idle';
      if (m.battle.gunId != null) rp.av.setGun(m.battle.gunId);
    });

    Object.keys(remotePeers).forEach(pid => {
      if (!activePids.has(pid)) {
        scene.remove(remotePeers[pid].av.grp);
        delete remotePeers[pid];
      }
    });
  }

  function drawRadar() {
    if (!radarCtx) return;
    const w = 84, h = 84, cx = 42, cy = 42;
    radarCtx.clearRect(0, 0, w, h);
    radarCtx.fillStyle = '#060d1ecc';
    radarCtx.beginPath();
    radarCtx.arc(cx, cy, 40, 0, Math.PI * 2);
    radarCtx.fill();

    radarCtx.fillStyle = 'rgba(74, 168, 255, 0.22)';
    radarCtx.beginPath();
    radarCtx.moveTo(cx, cy);
    radarCtx.arc(cx, cy, 36, -Math.PI / 2 - 0.45, -Math.PI / 2 + 0.45);
    radarCtx.closePath();
    radarCtx.fill();

    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const toRadar = (wx, wz) => {
      const dx = (wx - px) * 0.85, dz = (wz - pz) * 0.85;
      const rx = dx * cosY - dz * sinY;
      const rz = dx * sinY + dz * cosY;
      return { x: cx + Math.max(-35, Math.min(35, rx)), y: cy + Math.max(-35, Math.min(35, rz)) };
    };

    radarCtx.fillStyle = '#ff2a55';
    bots.forEach(b => {
      if (!b.alive && !b.dying) return;
      const pt = toRadar(b.x, b.z);
      radarCtx.beginPath();
      radarCtx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      radarCtx.fill();
    });

    Object.values(remotePeers).forEach(rp => {
      radarCtx.fillStyle = (isPrivatePvP && rp.team !== PRIVATE_ROOM.myTeam) ? '#ff2a55' : '#4ade80';
      const pt = toRadar(rp.av.grp.position.x, rp.av.grp.position.z);
      radarCtx.beginPath();
      radarCtx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
      radarCtx.fill();
    });

    radarCtx.fillStyle = '#f5d300';
    radarCtx.beginPath();
    radarCtx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    radarCtx.fill();
  }

  let prevT = performance.now(), syncAccum = 0, rafId = 0, dustAccum = 0;
  function stepAndRender(nowT) {
    const dt = Math.max(0.001, Math.min(0.05, (nowT - prevT) / 1000));
    prevT = nowT;
    if (AR && AR.paused) return;

    try {
      let moveF = 0, moveR = 0, sprint = 1;
      if (isPC) {
        if (keysDown.KeyW || keysDown.ArrowUp) moveF += 1;
        if (keysDown.KeyS || keysDown.ArrowDown) moveF -= 1;
        if (keysDown.KeyD || keysDown.ArrowRight) moveR += 1;
        if (keysDown.KeyA || keysDown.ArrowLeft) moveR -= 1;
        if ((keysDown.ShiftLeft || keysDown.ShiftRight) && moveF > 0 && !crouching) sprint = 1.42;
      } else {
        moveF = -joyY;
        moveR = joyX;
      }

      const rawMag = Math.hypot(moveF, moveR);
      const mag = Math.min(1, rawMag);
      if (rawMag > 1) { moveF /= rawMag; moveR /= rawMag; }

      crouchLerp += ((crouching ? 1 : 0) - crouchLerp) * Math.min(1, dt * 14);
      if (slideTimer > 0) {
        slideTimer = Math.max(0, slideTimer - dt);
        slideLerp += (1 - slideLerp) * Math.min(1, dt * 18);
        dustAccum += dt;
        if (dustAccum > 0.06) {
          dustAccum = 0;
          spawnDust(px, pz);
        }
      } else {
        slideLerp += (0 - slideLerp) * Math.min(1, dt * 12);
      }
      if (slideFxEl) slideFxEl.style.opacity = (slideLerp * 0.85).toFixed(2);

      let stepX = 0, stepZ = 0;
      if (slideTimer > 0) {
        const slideSpd = 13.6 * (0.45 + 0.55 * (slideTimer / 0.72));
        stepX = slideDirX * slideSpd * dt;
        stepZ = slideDirZ * slideSpd * dt;
      } else {
        const stanceMul = crouching ? 0.56 : 1.0;
        const speed = (scoped ? 4.4 : 8.0) * sprint * stanceMul;
        const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
        const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
        stepX = (fwdX * moveF + rightX * moveR) * speed * dt;
        stepZ = (fwdZ * moveF + rightZ * moveR) * speed * dt;
      }

      const pos = resolveCollisions(px + stepX, pz + stepZ);
      px = pos.x;
      pz = pos.z;

      const floorH = getFloorHeight(px, pz);
      vy -= 21 * dt;
      py += vy * dt;
      if (py <= floorH) {
        py = floorH;
        vy = 0;
      }

      const curW = weapons[wIdx];
      const isHoldToScopeWeapon = curW && (curW.cat === 'sniper' || curW.cat === 'launcher');
      const isFiringNow = !isHoldToScopeWeapon && ((isPC && pcAimMode && pcFiring) || (!isPC && touchFiring));

      let targetCharYaw = yaw;
      if (slideTimer > 0) {
        targetCharYaw = Math.atan2(-slideDirX, -slideDirZ);
      } else if (mag > 0.08) {
        if (isFiringNow || scoped) {
          targetCharYaw = yaw + Math.atan2(-moveR * 0.45, Math.abs(moveF) + 0.55);
        } else {
          targetCharYaw = yaw + Math.atan2(-moveR, moveF);
        }
      }
      charYaw += shortestAngleDiff(charYaw, targetCharYaw) * Math.min(1, dt * 16);

      if (slideLerp > 0.35) {
        curAnimState = 'Idle';
        playerAv.setAnim('Idle', 1.0);
      } else if (mag > 0.55 && !crouching) {
        curAnimState = 'Run';
        playerAv.setAnim('Run', Math.max(0.85, mag * sprint));
      } else if (mag > 0.08) {
        curAnimState = 'Walk';
        playerAv.setAnim('Walk', Math.max(0.75, mag * (crouching ? 1.0 : 1.4)));
      } else {
        curAnimState = 'Idle';
        playerAv.setAnim('Idle', 1.0);
      }

      const reloadProg = reloading ? Math.min(1, (nowT - reloadStartTs) / reloadDurMs) : 0;

      playerAv.grp.position.set(px, py, pz);
      playerAv.grp.rotation.y = charYaw;
      playerAv.setAimPitch(pitch);
      playerAv.setStance(crouchLerp, slideLerp, reloading, reloadProg);
      playerAv.update(dt);

      if (isFiringNow) {
        fireWeapon();
      }

      for (let i = bullets.length - 1; i >= 0; i--) {
        const bl = bullets[i];
        bl.life -= dt;
        bl.prevPos.copy(bl.pos);
        bl.vel.y -= bl.gravity * dt;
        bl.pos.addScaledVector(bl.vel, dt);
        bl.mesh.position.copy(bl.pos);

        let hitSomething = false;
        let hitPoint = bl.pos.clone();

        if (bl.pos.y <= 0.05) {
          hitSomething = true;
          hitPoint.y = 0.05;
        }

        if (!hitSomething) {
          for (const c of colliders) {
            if (bl.pos.x >= c.minX && bl.pos.x <= c.maxX && bl.pos.z >= c.minZ && bl.pos.z <= c.maxZ && bl.pos.y <= c.maxY) {
              hitSomething = true;
              break;
            }
          }
        }

        if (!hitSomething) {
          for (const b of bots) {
            if (!b.alive) continue;
            const center = new THREE.Vector3(b.x, b.y + 1.1, b.z);
            if (bl.pos.distanceTo(center) < 0.72 || bl.prevPos.distanceTo(center) < 0.65) {
              hitSomething = true;
              if (bl.explosive) {
                GUN_AUDIO.playExplosion();
                bots.forEach(ob => {
                  if (ob.alive && Math.hypot(ob.x - hitPoint.x, ob.z - hitPoint.z) < 6.5) damageBot(ob, bl.dmg);
                });
              } else {
                damageBot(b, bl.dmg);
              }
              break;
            }
          }
        }

        if (!hitSomething && isPrivatePvP) {
          for (const [pid, rp] of Object.entries(remotePeers)) {
            const pPos = rp.av.grp.position;
            const center = new THREE.Vector3(pPos.x, pPos.y + 1.1, pPos.z);
            if (bl.pos.distanceTo(center) < 0.76 || bl.prevPos.distanceTo(center) < 0.68) {
              hitSomething = true;
              if (bl.explosive) GUN_AUDIO.playExplosion();
              damageRemotePeer(pid, rp, bl.dmg);
              break;
            }
          }
        }

        if (hitSomething && bl.explosive && bl.pos.y <= 0.08) {
          GUN_AUDIO.playExplosion();
          bots.forEach(ob => {
            if (ob.alive && Math.hypot(ob.x - hitPoint.x, ob.z - hitPoint.z) < 6.5) damageBot(ob, bl.dmg);
          });
        }

        if (hitSomething || bl.life <= 0) {
          spawnTracer(bl.prevPos, hitPoint, bl.tracerColor);
          scene.remove(bl.mesh);
          bl.mesh.geometry.dispose();
          bullets.splice(i, 1);
        }
      }

      const isBlackSniperScope = scoped && (!fpp || curW.cat === 'sniper' || curW.cat === 'launcher');
      const targetFov = scoped ? curW.zoom : (slideLerp > 0.2 ? 68 : 62);
      camera.fov += (targetFov - camera.fov) * 0.25;
      camera.updateProjectionMatrix();

      const eyeH = 1.62 - crouchLerp * 0.48 - slideLerp * 0.72;

      if (fpp || isBlackSniperScope) {
        playerAv.grp.visible = false;
        camera.position.set(px, py + eyeH, pz);
        const lookTarget = new THREE.Vector3(
          px - Math.sin(yaw) * Math.cos(pitch) * 10,
          py + eyeH + Math.sin(pitch) * 10,
          pz - Math.cos(yaw) * Math.cos(pitch) * 10
        );
        camera.lookAt(lookTarget);

        fppVm.update(dt, {
          visible: !isBlackSniperScope,
          scoped,
          mag,
          sprint,
          reloading,
          reloadProg,
          weaponCat: curW.cat,
          crouching,
          slideLerp
        });
      } else {
        playerAv.grp.visible = true;
        fppVm.update(dt, { visible: false });

        const camDist = 3.5;
        const shoulderX = Math.cos(yaw) * 0.62;
        const shoulderZ = -Math.sin(yaw) * 0.62;
        const cx = px + Math.sin(yaw) * camDist + shoulderX;
        const cz = pz + Math.cos(yaw) * camDist + shoulderZ;
        const cy = py + (2.05 - crouchLerp * 0.45 - slideLerp * 0.68) - Math.sin(pitch) * 1.4;
        camera.position.set(cx, Math.max(0.45, cy), cz);
        camera.lookAt(
          px - Math.sin(yaw) * 8 + shoulderX * 0.5,
          py + (1.45 - crouchLerp * 0.42 - slideLerp * 0.62) + Math.sin(pitch) * 7,
          pz - Math.cos(yaw) * 8 + shoulderZ * 0.5
        );
      }

      pickups.forEach(pk => {
        pk.mesh.rotation.y += dt * 2.2;
        if (pk.cd > 0) {
          pk.cd -= dt;
          pk.mesh.visible = pk.cd <= 0;
          return;
        }
        if (Math.hypot(px - pk.x, pz - pk.z) < 1.35) {
          pk.cd = 10;
          pk.mesh.visible = false;
          if (pk.isMed) {
            hp = Math.min(maxHp, hp + 40);
            setFeed('💚 MEDKIT +40 HP');
          } else {
            wState[wIdx].reserve += weapons[wIdx].mag;
            setFeed('🟡 AMMO PACK +MAGAZINE');
          }
          if (typeof SFX !== 'undefined' && SFX.coin) SFX.coin();
          updateHud();
        }
      });

      bots.forEach(b => {
        if (b.dying) {
          b.deathProg = Math.min(1, b.deathProg + dt * 2.8);
          b.av.setDeathFall(b.deathProg);
          b.av.update(dt);
          if (b.deathProg >= 1) {
            b.dying = false;
            b.av.grp.visible = false;
          }
          return;
        }

        if (!b.alive) {
          b.respawnT -= dt;
          if (b.respawnT <= 0) {
            b.alive = true;
            b.dying = false;
            b.deathProg = 0;
            b.hp = 100;
            b.av.setDeathFall(0);
            b.av.updateTag('BOT ' + (b.id + 1), 100);
            b.av.grp.visible = true;
            const sp = botSpawns[b.id % botSpawns.length];
            b.x = sp[0];
            b.z = sp[1];
            b.y = getFloorHeight(b.x, b.z);
            b.av.grp.position.set(b.x, b.y, b.z);
          }
          return;
        }

        const dx = px - b.x, dz = pz - b.z, dist = Math.hypot(dx, dz);
        b.strafeT -= dt;
        if (b.strafeT <= 0) {
          b.strafeT = 1.4 + Math.random() * 2.0;
          b.dir = dist < 34 ? Math.atan2(dx, dz) + (Math.random() - 0.5) * 1.1 : Math.random() * Math.PI * 2;
        }
        const bSpd = dist < 34 ? 4.2 : 3.2;
        const bPos = resolveCollisions(b.x + Math.sin(b.dir) * bSpd * dt, b.z + Math.cos(b.dir) * bSpd * dt, 0.55);
        b.x = bPos.x;
        b.z = bPos.z;
        b.y = getFloorHeight(b.x, b.z);
        b.rotY = dist < 34 ? Math.atan2(dx, dz) : b.dir;
        b.av.grp.position.set(b.x, b.y, b.z);
        b.av.grp.rotation.y = b.rotY;
        b.av.updateTag('BOT ' + (b.id + 1), b.hp);
        b.av.setAnim('Walk', 1.0);
        b.av.update(dt);

        if (dist < 22) {
          b.fireCd -= dt;
          if (b.fireCd <= 0) {
            b.fireCd = 1.6 + Math.random() * 1.5;
            b.av.triggerMuzzle();
            const bOrigin = new THREE.Vector3(b.x, b.y + 1.35, b.z);
            const bTarget = new THREE.Vector3(px, py + 1.1, pz);
            spawnTracer(bOrigin, bTarget, 0xff5577);
            if (!isPrivatePvP) {
              hp = Math.max(0, hp - 7);
              updateHud();
              if (hp <= 0) {
                hp = 100;
                px = 1.5;
                pz = isKillhouse ? 29 : 28;
                py = getFloorHeight(px, pz);
                updateHud();
                setFeed('💀 DOWNED! RESPAWNED AT BASE');
              }
            }
          }
        }
      });

      Object.values(remotePeers).forEach(rp => {
        const g = rp.av.grp;
        const dx = rp.tx - g.position.x, dz = rp.tz - g.position.z;
        const moving = Math.hypot(dx, dz) > 0.08;
        g.position.x += dx * Math.min(1, dt * 12);
        g.position.y += ((rp.ty || 0) - g.position.y) * Math.min(1, dt * 12);
        g.position.z += dz * Math.min(1, dt * 12);
        g.rotation.y += shortestAngleDiff(g.rotation.y, rp.try) * Math.min(1, dt * 14);
        rp.av.setAnim(moving ? (rp.anim === 'Run' ? 'Run' : 'Walk') : 'Idle', 1.0);
        rp.av.update(dt);
      });

      for (let i = tracers.length - 1; i >= 0; i--) {
        tracers[i].life -= dt;
        if (tracers[i].life <= 0) {
          scene.remove(tracers[i].line);
          tracers[i].line.geometry.dispose();
          tracers.splice(i, 1);
        }
      }

      for (let i = grenades.length - 1; i >= 0; i--) {
        const gr = grenades[i];
        gr.fuse -= dt;
        gr.vy -= 18 * dt;
        gr.mesh.position.x += gr.vx * dt;
        gr.mesh.position.y += gr.vy * dt;
        gr.mesh.position.z += gr.vz * dt;
        if (gr.mesh.position.y < 0.16) {
          gr.mesh.position.y = 0.16;
          gr.vy = Math.abs(gr.vy) * 0.45;
          gr.vx *= 0.72;
          gr.vz *= 0.72;
        }
        if (gr.fuse <= 0) {
          const ex = gr.mesh.position.x, ez = gr.mesh.position.z;
          scene.remove(gr.mesh);
          gr.mesh.geometry.dispose();
          grenades.splice(i, 1);
          GUN_AUDIO.playExplosion();
          if (typeof SFX !== 'undefined' && SFX.boom) SFX.boom();
          bots.forEach(b => {
            if (b.alive && Math.hypot(b.x - ex, b.z - ez) < 7.5) damageBot(b, 120);
          });
        }
      }

      for (let i = dustParts.length - 1; i >= 0; i--) {
        const dp = dustParts[i];
        dp.life -= dt;
        dp.mesh.position.y += dt * 1.4;
        dp.mesh.scale.addScalar(dt * 1.8);
        dp.mesh.material.opacity = Math.max(0, dp.life * 1.4);
        if (dp.life <= 0) {
          scene.remove(dp.mesh);
          dp.mesh.geometry.dispose();
          dustParts.splice(i, 1);
        }
      }

      drawRadar();
      renderer.render(scene, camera);

      syncAccum += dt;
      if (syncAccum > 0.14) {
        syncAccum = 0;
        if (typeof syncBattleState === 'function') syncBattleState();
        if (isPrivatePvP) {
          const me = getCurrentUserProfile();
          const rooms = readStoredRooms();
          const ex = rooms[PRIVATE_ROOM.roomId] || {};
          const members = Object.assign({}, ex.members || {});
          members[me.pid] = Object.assign({}, members[me.pid] || {}, {
            pid: me.pid,
            name: me.name,
            lvl: me.lvl,
            isHost: PRIVATE_ROOM.isHost,
            team: PRIVATE_ROOM.myTeam,
            ready: true,
            gunId: weapons[wIdx].id,
            started: true,
            x: +px.toFixed(2),
            y: +py.toFixed(2),
            z: +pz.toFixed(2),
            ry: +charYaw.toFixed(2),
            hp: Math.ceil(hp),
            anim: curAnimState,
            hit: pendingHit
          });
          broadcastRoomEvent({
            type: 'room_snapshot',
            roomId: PRIVATE_ROOM.roomId,
            snapshot: Object.assign({}, ex, {
              roomId: PRIVATE_ROOM.roomId,
              mode: PRIVATE_ROOM.mode,
              mapId: mapCfg.id,
              mapName: mapCfg.name,
              started: true,
              members
            })
          });
        }
      }
    } catch (frameErr) {
      console.error('Arena frame error:', frameErr);
    }

    rafId = requestAnimationFrame(stepAndRender);
  }

  function cleanup() {
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resizeArena);
    clearTimeout(cHoldTimer);
    if (isPC) {
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('mousemove', onPcMouseMove);
      window.removeEventListener('mousedown', onPcMouseDown);
      window.removeEventListener('mouseup', onPcMouseUp);
      window.removeEventListener('wheel', onPcWheel);
      window.removeEventListener('keydown', onPcKeyDown);
      window.removeEventListener('keyup', onPcKeyUp);
      try { if (document.pointerLockElement === acv) document.exitPointerLock(); } catch (e) {}
    }
    if (arenaEl) arenaEl.remove();
    if (lobbyUi) lobbyUi.style.display = '';
    if (lobbyGl) lobbyGl.style.display = '';
    if (typeof look === 'function') look();
    if (typeof render === 'function') render();
  }

  AR = {
    paused: 0,
    getPacket() {
      const pkt = {
        inMatch: true,
        privLobby: false,
        roomId: PRIVATE_ROOM.roomId || squadId || '',
        mode: PRIVATE_ROOM.mode,
        mapId: mapCfg.id,
        mapName: mapCfg.name,
        team: PRIVATE_ROOM.myTeam,
        ready: true,
        started: true,
        x: +px.toFixed(2),
        y: +py.toFixed(2),
        z: +pz.toFixed(2),
        ry: +charYaw.toFixed(2),
        hp: Math.ceil(hp),
        gunId: weapons[wIdx].id,
        anim: curAnimState,
        ts: Date.now()
      };
      if (pendingHit) {
        pkt.hit = pendingHit;
        pendingHit = null;
      }
      return pkt;
    },
    syncTeammates,
    cleanup,
    stats: () => ({ kills, mapName: mapCfg.name })
  };

  updateHud();
  prevT = performance.now();
  rafId = requestAnimationFrame(stepAndRender);
}

function exitMatch(claimReward) {
  if (!AR) return;
  const st = AR.stats ? AR.stats() : { kills: 0, mapName: '' };
  AR.cleanup();
  AR = null;
  AR_LOADING = false;
  PRIVATE_ROOM.started = false;

  if (typeof SQUAD_META !== 'undefined' && SQUAD_META && typeof isSquadHost === 'function' && isSquadHost()) {
    SQUAD_META.status = 'lobby';
    if (typeof pushMyPlayerDoc === 'function') {
      try { pushMyPlayerDoc(); } catch (e) {}
    }
  }

  if (PRIVATE_ROOM.roomId) {
    const me = getCurrentUserProfile();
    const rooms = readStoredRooms();
    const ex = rooms[PRIVATE_ROOM.roomId] || {};
    const members = Object.assign({}, ex.members || {});
    if (members[me.pid]) {
      members[me.pid] = Object.assign({}, members[me.pid], { started: false, ready: true });
    }
    broadcastRoomEvent({
      type: 'room_snapshot',
      roomId: PRIVATE_ROOM.roomId,
      snapshot: Object.assign({}, ex, { started: false, members })
    });
  }

  if (claimReward && typeof S === 'object' && S) {
    const bonusCoins = 25 + st.kills * 10;
    const bonusCp = st.kills >= 2 ? 10 : 0;
    S.coins = (S.coins || 0) + bonusCoins;
    S.cp = (S.cp || 0) + bonusCp;
    S.wins = (S.wins || 0) + (st.kills >= 1 ? 1 : 0);
    if (typeof addXP === 'function') addXP(35 + st.kills * 15);
    if (typeof SFX !== 'undefined' && SFX.quest) SFX.quest();
    if (typeof save === 'function') save();
    if (typeof render === 'function') render();
    toast(`🏆 Extracted from ${st.mapName}! +${bonusCoins} 🪙` + (bonusCp ? ` +${bonusCp} 💎 CP` : ''));
  } else {
    if (typeof save === 'function') save();
    if (typeof render === 'function') render();
    toast('Exited 3D Battle Arena');
  }
}
