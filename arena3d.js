/* ===== 3D SOLDIER, FPP VIEWMODEL, CODM SLIDE, DEATH FALL, BALLISTIC BULLETS, GUN AUDIO, GUNSMITH & PRIVATE 1v1/2v2 ARENA ===== */
let AR = null;

/* ===== PRIVATE ROOM STATE (1v1 / 2v2) ===== */
const PRIVATE_ROOM = {
  active: false,
  roomId: '',
  isHost: false,
  mode: '1v1', // '1v1' | '2v2'
  mapId: 'killhouse_1v1',
  mapName: 'TACTICAL KILLHOUSE 1V1',
  peers: {}
};

function genPrivateCode() {
  return 'PVP-' + Math.floor(1000 + Math.random() * 9000);
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
  return 0x6ea8dc;
}

/* ===== PROCEDURAL BALLISTIC SOUND ENGINE (REAL WEAPON ACOUSTICS PER CLASS) ===== */
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

/* ===== PROCEDURAL CANVAS TEXTURES FOR REALISTIC 3D ENVIRONMENT ===== */
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

    ctx.fillStyle = isDesert ? '#9c7f54' : isDock ? '#475569' : '#4f6d34';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      ctx.fillStyle = isDesert
        ? (Math.random() > 0.5 ? '#856941' : '#b39466')
        : isDock
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
    ctx.fillStyle = isKillhouse ? '#475569' : isDesert ? '#cfa87a' : '#78889c';
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

/* ===== DETAILED 3D WEAPON MODEL BUILDER (AR, SMG, SNIPER, SHOTGUN, LAUNCHER) ===== */
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

/* ===== FIRST-PERSON VIEWMODEL (TRUE CENTER ADS + PER-GUN RELOAD & CODM SLIDE) ===== */
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
  lForearm.rotation.set(Math.PI * 0.38, -0.35, -0.22);
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

/* ===== SHARED 3D TACTICAL SOLDIER AVATAR (CODM FORWARD SLIDE + DEATH FALL + OVERHEAD TAG) ===== */
function makeSoldierAvatar(opts = {}) {
  const armorCol = opts.armorCol || 0x2e64b8;
  const tint = opts.tint || null;
  const grp = new THREE.Group();
  let mix = null, actions = {}, activeAct = null, weaponMount = null, curGunObj = null;
  let lims = null, bones = {}, axes = {}, rHandBone = null, modelRoot = null, hasSkeletal = false;
  let aimPitch = 0, firingPulse = 0, crouchLerp = 0, slideLerp = 0, reloadProg = 0, isReloading = false, weaponCat = 'ar';
  let deathFall = 0;

  let nameTagSprite = null, tagCtx = null, tagTex = null, lastTagText = '', lastTagHp = -1;
  if (opts.label) {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 64;
    tagCtx = cv.getContext('2d');
    tagTex = new THREE.CanvasTexture(cv);
    const spMat = new THREE.SpriteMaterial({ map: tagTex, transparent: true, depthTest: false });
    nameTagSprite = new THREE.Sprite(spMat);
    nameTagSprite.scale.set(1.65, 0.42, 1);
    nameTagSprite.position.set(0, 2.25, 0);
    grp.add(nameTagSprite);
  }

  function updateTag(labelText, hpVal = 100) {
    if (!tagCtx || !tagTex) return;
    const clampedHp = Math.max(0, Math.min(100, Math.ceil(hpVal)));
    if (labelText === lastTagText && clampedHp === lastTagHp) return;
    lastTagText = labelText;
    lastTagHp = clampedHp;
    tagCtx.clearRect(0, 0, 256, 64);
    tagCtx.fillStyle = 'rgba(8,14,28,0.78)';
    tagCtx.fillRect(16, 8, 224, 46);
    tagCtx.strokeStyle = opts.isEnemy ? '#ff2a55' : '#38bdf8';
    tagCtx.lineWidth = 2;
    tagCtx.strokeRect(16, 8, 224, 46);
    tagCtx.fillStyle = '#f8fafc';
    tagCtx.font = 'bold 18px sans-serif';
    tagCtx.textAlign = 'center';
    tagCtx.fillText(String(labelText).slice(0, 16), 128, 30);
    tagCtx.fillStyle = '#1e293b';
    tagCtx.fillRect(28, 38, 200, 8);
    tagCtx.fillStyle = opts.isEnemy ? '#ff2a55' : '#22c55e';
    tagCtx.fillRect(28, 38, 200 * (clampedHp / 100), 8);
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
    model.scale.setScalar(1.05);
    model.updateMatrixWorld(true);
    modelRoot = model;

    model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (tint && o.material) {
          o.material = o.material.clone();
          if (o.material.emissive) {
            o.material.emissive = new THREE.Color(tint);
            o.material.emissiveIntensity = 0.16;
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
        if (/RightLeg$/i.test(o.name)) bones.rLeg = o;
        if (/LeftUpLeg/i.test(o.name)) bones.lUpLeg = o;
        if (/LeftLeg$/i.test(o.name)) bones.lLeg = o;
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
    const vestMat = new THREE.MeshLambertMaterial({ color: armorCol });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x263147 });
    const visorMat = new THREE.MeshLambertMaterial({ color: tint || 0x38bdf8, emissive: tint || 0x38bdf8, emissiveIntensity: 0.45 });

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

/* ===== PRIVATE ROOM SECTION IN MAP SELECTOR (1v1 / 2v2 + HIGH-QUALITY BATTLE MAP) ===== */
(function initPrivateMapSection() {
  if (typeof MAPS !== 'undefined' && Array.isArray(MAPS) && !MAPS.some(m => m.id === 'killhouse_1v1')) {
    MAPS.push({
      id: 'killhouse_1v1',
      name: 'TACTICAL KILLHOUSE 1V1',
      sky: 0x1e2d4a,
      desc: 'High-Detail 3D 1v1 & 2v2 Symmetrical Arena'
    });
  }

  if (typeof window.activeMap === 'function' && !window.__origActiveMap) {
    window.__origActiveMap = window.activeMap;
    window.activeMap = function () {
      if (PRIVATE_ROOM.active) {
        return {
          id: PRIVATE_ROOM.mapId || 'killhouse_1v1',
          name: PRIVATE_ROOM.mapName || 'TACTICAL KILLHOUSE 1V1',
          sky: 0x1e2d4a,
          isPrivate: true,
          mode: PRIVATE_ROOM.mode
        };
      }
      return window.__origActiveMap.apply(this, arguments);
    };
  }

  // Cross-tab & Firebase room sync helper so friends can join by room code
  let roomBc = null;
  try {
    roomBc = new BroadcastChannel('lul_private_room_sync');
    roomBc.onmessage = ev => {
      const d = ev.data;
      if (!d || !PRIVATE_ROOM.roomId || d.roomId !== PRIVATE_ROOM.roomId) return;
      if (d.type === 'JOIN_REQ' && PRIVATE_ROOM.isHost) {
        PRIVATE_ROOM.peers[d.pid] = { pid: d.pid, name: d.name || 'FRIEND', ready: true };
        broadcastRoomState();
        updatePrivatePanelUI();
      } else if (d.type === 'ROOM_STATE') {
        PRIVATE_ROOM.mode = d.mode || PRIVATE_ROOM.mode;
        PRIVATE_ROOM.mapId = d.mapId || PRIVATE_ROOM.mapId;
        PRIVATE_ROOM.mapName = d.mapName || PRIVATE_ROOM.mapName;
        PRIVATE_ROOM.peers = d.peers || PRIVATE_ROOM.peers;
        updatePrivatePanelUI();
        if (d.started && !AR && !AR_LOADING) {
          PRIVATE_ROOM.active = true;
          startMatch(PRIVATE_ROOM.roomId);
        }
      }
    };
  } catch (e) {}

  function myPlayerInfo() {
    const pid = (typeof MY_PID !== 'undefined' && MY_PID) ? MY_PID : (window.__pvpPid || (window.__pvpPid = 'P_' + Math.random().toString(36).slice(2, 8)));
    const name = (typeof S !== 'undefined' && S && S.name) ? S.name : 'OPERATOR';
    return { pid, name };
  }

  function broadcastRoomState(started = false) {
    if (!PRIVATE_ROOM.roomId) return;
    const payload = {
      type: 'ROOM_STATE',
      roomId: PRIVATE_ROOM.roomId,
      mode: PRIVATE_ROOM.mode,
      mapId: PRIVATE_ROOM.mapId,
      mapName: PRIVATE_ROOM.mapName,
      peers: PRIVATE_ROOM.peers,
      started
    };
    if (roomBc) {
      try { roomBc.postMessage(payload); } catch (e) {}
    }
    try {
      localStorage.setItem('lul_priv_' + PRIVATE_ROOM.roomId, JSON.stringify(payload));
    } catch (e) {}
    if (typeof window.db !== 'undefined' && window.db && typeof window.db.ref === 'function') {
      try {
        window.db.ref('privateRooms/' + PRIVATE_ROOM.roomId).set(payload);
      } catch (e) {}
    }
  }

  function createPrivateRoom() {
    const me = myPlayerInfo();
    const code = genPrivateCode();
    PRIVATE_ROOM.active = true;
    PRIVATE_ROOM.roomId = code;
    PRIVATE_ROOM.isHost = true;
    PRIVATE_ROOM.mode = '1v1';
    PRIVATE_ROOM.mapId = 'killhouse_1v1';
    PRIVATE_ROOM.mapName = 'TACTICAL KILLHOUSE 1V1';
    PRIVATE_ROOM.peers = { [me.pid]: { pid: me.pid, name: me.name, isHost: true } };

    if (typeof window.SQUAD_ID !== 'undefined') window.SQUAD_ID = code;
    if (typeof window.createSquad === 'function') {
      try { window.createSquad(code); } catch (e) {}
    }
    if (typeof window.db !== 'undefined' && window.db && typeof window.db.ref === 'function') {
      try {
        window.db.ref('privateRooms/' + code).on('value', snap => {
          const val = snap && snap.val();
          if (!val) return;
          if (val.peers) PRIVATE_ROOM.peers = val.peers;
          updatePrivatePanelUI();
        });
      } catch (e) {}
    }
    broadcastRoomState(false);
    updatePrivatePanelUI();
    if (typeof toast === 'function') toast('🔒 Private Room Created: ' + code);
  }

  function joinPrivateRoom(rawCode) {
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code) {
      if (typeof toast === 'function') toast('⚠️ Enter your friend\'s Room Code');
      return;
    }
    const me = myPlayerInfo();
    PRIVATE_ROOM.active = true;
    PRIVATE_ROOM.roomId = code;
    PRIVATE_ROOM.isHost = false;
    PRIVATE_ROOM.mode = '1v1';
    PRIVATE_ROOM.mapId = 'killhouse_1v1';
    PRIVATE_ROOM.mapName = 'TACTICAL KILLHOUSE 1V1';
    PRIVATE_ROOM.peers[me.pid] = { pid: me.pid, name: me.name, isHost: false };

    if (typeof window.SQUAD_ID !== 'undefined') window.SQUAD_ID = code;
    if (typeof window.joinSquad === 'function') {
      try { window.joinSquad(code); } catch (e) {}
    }
    try {
      const cached = JSON.parse(localStorage.getItem('lul_priv_' + code) || 'null');
      if (cached && cached.peers) {
        PRIVATE_ROOM.peers = Object.assign({}, cached.peers, PRIVATE_ROOM.peers);
        PRIVATE_ROOM.mode = cached.mode || '1v1';
        PRIVATE_ROOM.mapId = cached.mapId || 'killhouse_1v1';
      }
    } catch (e) {}

    if (roomBc) {
      try { roomBc.postMessage({ type: 'JOIN_REQ', roomId: code, pid: me.pid, name: me.name }); } catch (e) {}
    }
    if (typeof window.db !== 'undefined' && window.db && typeof window.db.ref === 'function') {
      try {
        window.db.ref('privateRooms/' + code + '/peers/' + me.pid).set({ pid: me.pid, name: me.name, isHost: false });
        window.db.ref('privateRooms/' + code).on('value', snap => {
          const val = snap && snap.val();
          if (!val) return;
          PRIVATE_ROOM.mode = val.mode || PRIVATE_ROOM.mode;
          PRIVATE_ROOM.mapId = val.mapId || PRIVATE_ROOM.mapId;
          PRIVATE_ROOM.mapName = val.mapName || PRIVATE_ROOM.mapName;
          if (val.peers) PRIVATE_ROOM.peers = val.peers;
          updatePrivatePanelUI();
          if (val.started && !AR && !AR_LOADING) {
            PRIVATE_ROOM.active = true;
            startMatch(code);
          }
        });
      } catch (e) {}
    }
    updatePrivatePanelUI();
    if (typeof toast === 'function') toast('🤝 Joined Private Room: ' + code);
  }

  function buildPrivatePanelHtml() {
    const me = myPlayerInfo();
    const peerList = Object.values(PRIVATE_ROOM.peers || {});
    if (!peerList.length) peerList.push({ pid: me.pid, name: me.name, isHost: true });
    const maxSlots = PRIVATE_ROOM.mode === '2v2' ? 4 : 2;
    const slotsHtml = Array.from({ length: maxSlots }).map((_, idx) => {
      const p = peerList[idx];
      const teamLbl = idx % 2 === 0 ? 'ALPHA' : 'BRAVO';
      const teamCol = idx % 2 === 0 ? '#38bdf8' : '#ff2a55';
      return `
        <div style="flex:1;min-width:120px;background:rgba(15,23,42,0.88);border:1px solid ${p ? teamCol : 'rgba(148,163,184,0.25)'};border-radius:10px;padding:8px 10px;text-align:left">
          <div style="font-size:10px;font-weight:800;letter-spacing:.08em;color:${teamCol}">${teamLbl} TEAM · SLOT ${idx + 1}</div>
          <div style="font-size:13px;font-weight:700;color:${p ? '#f8fafc' : '#64748b'};margin-top:2px">
            ${p ? (esc(p.name) + (p.pid === me.pid ? ' (YOU)' : '')) : 'Waiting for Friend...'}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div id="priv-sec-wrap" style="margin-top:10px;display:flex;flex-direction:column;gap:10px;text-align:left">
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;background:rgba(15,23,42,0.85);border:1px solid rgba(56,189,248,0.35);border-radius:12px;padding:10px 12px">
          <div>
            <div style="font-size:11px;font-weight:800;color:#38bdf8;letter-spacing:.08em">🔒 PRIVATE CUSTOM ROOM</div>
            <div style="font-size:12px;color:#cbd5e1;margin-top:2px">
              ${PRIVATE_ROOM.roomId
                ? `Room Code: <b style="color:#facc15;font-size:14px;letter-spacing:.1em">${esc(PRIVATE_ROOM.roomId)}</b>`
                : 'Create a private room or enter your friend\'s code'}
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            <button type="button" class="sm" id="priv-create-btn">➕ CREATE ROOM</button>
            ${PRIVATE_ROOM.roomId ? `<button type="button" class="sm alt" id="priv-copy-btn">📋 COPY CODE</button>` : ''}
          </div>
        </div>

        <div style="display:flex;gap:6px;align-items:center">
          <input type="text" id="priv-code-inp" placeholder="Enter Friend Room Code (e.g. PVP-4829)" value="${esc(PRIVATE_ROOM.roomId)}" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(148,163,184,0.35);background:#0f172a;color:#f8fafc;font-weight:700;text-transform:uppercase">
          <button type="button" class="sm" id="priv-join-btn">JOIN ROOM</button>
        </div>

        <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;background:rgba(15,23,42,0.75);padding:8px 12px;border-radius:10px;border:1px solid rgba(148,163,184,0.2)">
          <span style="font-size:12px;font-weight:800;color:#e2e8f0">⚔️ MATCH FORMAT</span>
          <div style="display:flex;gap:6px">
            <button type="button" class="sm${PRIVATE_ROOM.mode === '1v1' ? '' : ' alt'}" id="priv-mode-1v1">1v1 DUEL</button>
            <button type="button" class="sm${PRIVATE_ROOM.mode === '2v2' ? '' : ' alt'}" id="priv-mode-2v2">2v2 CLASH</button>
          </div>
        </div>

        <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 55%,#172554 100%);border:2px solid #38bdf8;border-radius:12px;padding:12px;position:relative;overflow:hidden">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
            <div>
              <span style="background:#38bdf8;color:#081020;font-size:10px;font-weight:900;padding:2px 7px;border-radius:5px;letter-spacing:.06em">3D HIGH-GRAPHICS ARENA · SELECTED</span>
              <div style="font-size:15px;font-weight:900;color:#f8fafc;margin-top:5px">🏟️ TACTICAL KILLHOUSE (${PRIVATE_ROOM.mode.toUpperCase()})</div>
              <div style="font-size:11px;color:#94a3b8;margin-top:3px">Symmetrical Alpha vs Bravo Bunkers · Walkable Glass Sniper Catwalk · Stacked Shipping Containers · Real-Time Shadows</div>
            </div>
            <div style="text-align:right;min-width:68px">
              <div style="font-size:18px;font-weight:900;color:#facc15">${PRIVATE_ROOM.mode.toUpperCase()}</div>
              <div style="font-size:10px;color:#4ade80;font-weight:700">READY</div>
            </div>
          </div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${slotsHtml}
        </div>

        <button type="button" class="sm" id="priv-launch-btn" style="width:100%;padding:11px;font-size:14px;font-weight:900;background:linear-gradient(90deg,#2563eb,#06b6d4);color:#fff;border:none;border-radius:10px;cursor:pointer">
          🚀 START ${PRIVATE_ROOM.mode.toUpperCase()} BATTLE IN TACTICAL KILLHOUSE
        </button>
      </div>
    `;
  }

  function bindPrivatePanelEvents(root) {
    if (!root) return;
    const cBtn = root.querySelector('#priv-create-btn');
    const cpBtn = root.querySelector('#priv-copy-btn');
    const jBtn = root.querySelector('#priv-join-btn');
    const inp = root.querySelector('#priv-code-inp');
    const m1 = root.querySelector('#priv-mode-1v1');
    const m2 = root.querySelector('#priv-mode-2v2');
    const lBtn = root.querySelector('#priv-launch-btn');

    if (cBtn) cBtn.onclick = e => { e.stopPropagation(); createPrivateRoom(); };
    if (cpBtn) {
      cpBtn.onclick = e => {
        e.stopPropagation();
        if (navigator.clipboard && PRIVATE_ROOM.roomId) {
          navigator.clipboard.writeText(PRIVATE_ROOM.roomId).catch(() => {});
        }
        if (typeof toast === 'function') toast('📋 Copied Room Code: ' + PRIVATE_ROOM.roomId);
      };
    }
    if (jBtn) jBtn.onclick = e => { e.stopPropagation(); joinPrivateRoom(inp ? inp.value : ''); };
    if (m1) {
      m1.onclick = e => {
        e.stopPropagation();
        PRIVATE_ROOM.mode = '1v1';
        broadcastRoomState(false);
        updatePrivatePanelUI();
      };
    }
    if (m2) {
      m2.onclick = e => {
        e.stopPropagation();
        PRIVATE_ROOM.mode = '2v2';
        broadcastRoomState(false);
        updatePrivatePanelUI();
      };
    }
    if (lBtn) {
      lBtn.onclick = e => {
        e.stopPropagation();
        if (!PRIVATE_ROOM.roomId) createPrivateRoom();
        PRIVATE_ROOM.active = true;
        PRIVATE_ROOM.mapId = 'killhouse_1v1';
        PRIVATE_ROOM.mapName = 'TACTICAL KILLHOUSE ' + PRIVATE_ROOM.mode.toUpperCase();
        broadcastRoomState(true);
        const modal = root.closest('.modal');
        if (modal) modal.remove();
        startMatch(PRIVATE_ROOM.roomId);
      };
    }
  }

  function updatePrivatePanelUI() {
    const slot = document.getElementById('priv-sec-host');
    if (!slot) return;
    slot.innerHTML = buildPrivatePanelHtml();
    bindPrivatePanelEvents(slot);
  }

  window.openPrivateRoom = function () {
    if (!PRIVATE_ROOM.roomId) {
      const me = myPlayerInfo();
      PRIVATE_ROOM.roomId = genPrivateCode();
      PRIVATE_ROOM.isHost = true;
      PRIVATE_ROOM.peers = { [me.pid]: { pid: me.pid, name: me.name, isHost: true } };
    }
    const existing = document.getElementById('priv-room-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'priv-room-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="pop L" style="max-width:32rem;width:94%;text-align:left">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="rL">🔒 PRIVATE 1v1 / 2v2 ARENA</div>
          <button type="button" class="sm alt" id="priv-modal-close">✕</button>
        </div>
        <div id="priv-sec-host">${buildPrivatePanelHtml()}</div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#priv-modal-close').onclick = () => {
      PRIVATE_ROOM.active = false;
      modal.remove();
    };
    bindPrivatePanelEvents(modal);
  };

  // Automatically inject the "🔒 PRIVATE" section tab into the Map Section whenever opened
  function enhanceMapSection(container) {
    if (!container || container.dataset.privEnhanced) return;
    container.dataset.privEnhanced = '1';

    const originalChildren = Array.from(container.children);
    const pubWrap = document.createElement('div');
    pubWrap.id = 'pub-maps-wrap';
    originalChildren.forEach(ch => pubWrap.appendChild(ch));

    const privHost = document.createElement('div');
    privHost.id = 'priv-sec-host';
    privHost.style.display = 'none';

    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;gap:8px;justify-content:center;margin:8px 0 10px;border-bottom:1px solid rgba(148,163,184,0.22);padding-bottom:8px;';
    tabBar.innerHTML = `
      <button type="button" class="sm" id="map-tab-public">🗺️ PUBLIC MAPS</button>
      <button type="button" class="sm alt" id="map-tab-private">🔒 PRIVATE (1v1 / 2v2)</button>
    `;

    container.appendChild(tabBar);
    container.appendChild(pubWrap);
    container.appendChild(privHost);

    const btnPub = tabBar.querySelector('#map-tab-public');
    const btnPriv = tabBar.querySelector('#map-tab-private');

    btnPub.onclick = e => {
      e.stopPropagation();
      PRIVATE_ROOM.active = false;
      btnPub.className = 'sm';
      btnPriv.className = 'sm alt';
      pubWrap.style.display = '';
      privHost.style.display = 'none';
    };

    btnPriv.onclick = e => {
      e.stopPropagation();
      PRIVATE_ROOM.active = true;
      btnPub.className = 'sm alt';
      btnPriv.className = 'sm';
      pubWrap.style.display = 'none';
      privHost.style.display = 'block';
      privHost.innerHTML = buildPrivatePanelHtml();
      bindPrivatePanelEvents(privHost);
    };
  }

  const obs = new MutationObserver(() => {
    const candidates = document.querySelectorAll('.modal .pop, #map-sec, [data-tab="maps"]');
    candidates.forEach(el => {
      if (el.closest('#arena') || el.closest('#ar-load') || el.id === 'priv-room-modal') return;
      const txt = (el.textContent || '').toUpperCase();
      if ((txt.includes('FIRING RANGE') || txt.includes('NUKETOWN') || txt.includes('SELECT MAP')) && !el.dataset.privEnhanced) {
        enhanceMapSection(el);
      }
    });
  });
  if (document.body) {
    obs.observe(document.body, { childList: true, subtree: true });
  } else {
    window.addEventListener('DOMContentLoaded', () => obs.observe(document.body, { childList: true, subtree: true }));
  }
})();

/* ===== PRE-MATCH DEPLOYMENT LOADING SCREEN + ASSET PRELOADER ===== */
let AR_LOADING = false;
function startMatch(squadId = null) {
  if (AR || AR_LOADING) return;
  if (typeof THREE === 'undefined') return toast('3D Engine unavailable on this browser.');
  AR_LOADING = true;
  if (typeof SFX !== 'undefined' && SFX.deploy) SFX.deploy();

  const mapCfg = PRIVATE_ROOM.active
    ? { id: PRIVATE_ROOM.mapId || 'killhouse_1v1', name: PRIVATE_ROOM.mapName || 'TACTICAL KILLHOUSE 1V1', sky: 0x1e2d4a, isPrivate: true, mode: PRIVATE_ROOM.mode }
    : ((typeof activeMap === 'function') ? activeMap() : { id: 'firing_range', name: 'FIRING RANGE', sky: 0x6ea8dc });

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

/* ===== FULLSCREEN HELPER FOR MOBILE & DESKTOP ===== */
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
  const isDesert = mapCfg.id === 'nuketown';
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
    ? `<div style="background:rgba(15,23,42,0.88);border:1px solid #38bdf8;color:#f8fafc;padding:4px 10px;border-radius:8px;font-size:.75rem;font-weight:800;letter-spacing:.05em">🔒 ${esc(PRIVATE_ROOM.mode.toUpperCase())} ROOM: <span style="color:#facc15">${esc(PRIVATE_ROOM.roomId)}</span></div>`
    : '';

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
      <div class="mfeed" id="ar-feed">${isPrivatePvP ? '🔒 PRIVATE ' + esc(PRIVATE_ROOM.mode.toUpperCase()) + ' · ROOM ' + esc(PRIVATE_ROOM.roomId) + ' · ELIMINATE OPPONENT' : (isPC ? '🎯 SCROLL WHEEL: ALL GUNS · SNIPER: HOLD LMB TO SCOPE & RELEASE TO FIRE' : 'MAP: ' + esc(mapCfg.name) + ' · ELIMINATE HOSTILES')}</div>

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
  scene.fog = new THREE.Fog(skyHex, isKillhouse ? 42 : 36, isKillhouse ? 125 : 115);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.08, 140);
  scene.add(camera);

  const fppVm = createFppViewmodel();
  fppVm.setGun(weapons[0].id);
  camera.add(fppVm.root);

  scene.add(new THREE.AmbientLight(0xffffff, isKillhouse ? 0.58 : 0.72));
  scene.add(new THREE.HemisphereLight(isKillhouse ? 0xbae6fd : 0xf0f9ff, 0x334155, 0.78));
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

  /* ===== HIGH-GRAPHICS 3D BATTLE MAP: TACTICAL KILLHOUSE (1v1 / 2v2) ===== */
  if (isKillhouse) {
    const arenaW = 68, arenaD = 80;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(arenaW + 16, arenaD + 16),
      new THREE.MeshStandardMaterial({ map: tex.groundTex, roughness: 0.78, metalness: 0.12 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Center Tactical Spine Road & Midline Strip
    const midLane = new THREE.Mesh(
      new THREE.PlaneGeometry(8.5, arenaD - 6),
      new THREE.MeshStandardMaterial({ map: tex.roadTex, roughness: 0.65, metalness: 0.2 })
    );
    midLane.rotation.x = -Math.PI / 2;
    midLane.position.y = 0.02;
    midLane.receiveShadow = true;
    scene.add(midLane);

    // Glowing Midline Divider
    const centerLine = new THREE.Mesh(
      new THREE.PlaneGeometry(arenaW - 4, 0.35),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.y = 0.03;
    scene.add(centerLine);

    // Reinforced Concrete Perimeter Walls with Hazard Base
    addBox(0, 0, -arenaD / 2, arenaW + 2, 6.2, 2.0, { map: tex.wallTex, roughness: 0.7 }, true, true);
    addBox(0, 0, arenaD / 2, arenaW + 2, 6.2, 2.0, { map: tex.wallTex, roughness: 0.7 }, true, true);
    addBox(-arenaW / 2, 0, 0, 2.0, 6.2, arenaD + 2, { map: tex.wallTex, roughness: 0.7 }, true, true);
    addBox(arenaW / 2, 0, 0, 2.0, 6.2, arenaD + 2, { map: tex.wallTex, roughness: 0.7 }, true, true);

    // Symmetrical Alpha (South, z = +29) & Bravo (North, z = -29) Spawn Bunkers
    function buildSpawnBunker(zPos, isAlpha) {
      const teamCol = isAlpha ? 0x38bdf8 : 0xff2a55;
      const dir = isAlpha ? -1 : 1;

      // Bunker Back & Side Blast Walls
      addBox(0, 0, zPos - dir * 4.5, 16, 4.4, 1.4, { map: tex.wallTex, roughness: 0.65 }, true, true);
      addBox(-8.5, 0, zPos - dir * 1.5, 1.4, 4.0, 7.0, { map: tex.wallTex, roughness: 0.65 }, true, true);
      addBox(8.5, 0, zPos - dir * 1.5, 1.4, 4.0, 7.0, { map: tex.wallTex, roughness: 0.65 }, true, true);

      // Overhead Steel Canopy Roof
      addBox(0, 4.3, zPos - dir * 1.8, 18.4, 0.45, 7.6, { color: 0x1e293b, roughness: 0.4, metalness: 0.65 }, false, true);

      // Glowing Team Neon Header Strip
      const neonBar = new THREE.Mesh(
        new THREE.BoxGeometry(12.5, 0.32, 0.25),
        new THREE.MeshBasicMaterial({ color: teamCol })
      );
      neonBar.position.set(0, 4.1, zPos + dir * 2.05);
      scene.add(neonBar);

      // Forward Sandbag & Concrete Low Cover Barricades
      addBox(-3.8, 0, zPos + dir * 4.6, 4.2, 1.15, 0.95, { color: 0x64748b, roughness: 0.75 }, true, true);
      addBox(3.8, 0, zPos + dir * 4.6, 4.2, 1.15, 0.95, { color: 0x64748b, roughness: 0.75 }, true, true);

      // Base Accent Point Light
      const bLight = new THREE.PointLight(teamCol, 1.1, 22);
      bLight.position.set(0, 3.6, zPos);
      scene.add(bLight);
    }
    buildSpawnBunker(29, true);
    buildSpawnBunker(-29, false);

    // Central Elevated Glass Overlook Bridge & Walkable Ramps (z = 0)
    const bridgeY = 3.0;
    addBox(0, bridgeY - 0.35, 0, 14.0, 0.35, 6.2, { map: tex.deckTex, roughness: 0.45, metalness: 0.6 }, false, true);
    walkableSurfaces.push({ minX: -7.0, maxX: 7.0, minZ: -3.1, maxZ: 3.1, y: bridgeY, type: 'flat' });

    // Support Columns under the Bridge
    [[-5.8, -2.2], [5.8, -2.2], [-5.8, 2.2], [5.8, 2.2]].forEach(([px0, pz0]) => {
      addBox(px0, 0, pz0, 0.9, bridgeY - 0.35, 0.9, { color: 0x1e293b, roughness: 0.4, metalness: 0.75 }, true, true);
    });

    // Armored Ballistic Glass Half-Walls on North & South edges of the Bridge
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

    // Left & Right Walkable Ramps leading onto the Bridge
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

    // Center Tactical Core & Rotating Radar Dish on Overlook
    addBox(0, bridgeY, 0, 1.6, 2.2, 1.6, { color: 0x0f172a, metalness: 0.8, roughness: 0.25 }, true, true);
    const coreGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 1.8, 12),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    coreGlow.position.set(0, bridgeY + 1.1, 0);
    scene.add(coreGlow);

    // Staggered Double-Stacked Shipping Containers on Left & Right Flanks
    function buildPbrContainer(x, y, z, w, h, d, col) {
      addBox(x, y, z, w, h, d, { color: col, map: tex.contTex, roughness: 0.48, metalness: 0.52 }, true, true);
      addBox(x, y + h, z, w + 0.14, 0.14, d + 0.14, { color: 0x0f172a, roughness: 0.4, metalness: 0.7 }, false, true);
    }
    // Left Flank Containers
    buildPbrContainer(-21.5, 0, -12.5, 3.2, 2.8, 7.2, 0xdc2626);
    buildPbrContainer(-21.5, 2.94, -12.5, 3.1, 2.7, 7.0, 0x334155);
    buildPbrContainer(-21.5, 0, 12.5, 3.2, 2.8, 7.2, 0x2563eb);
    buildPbrContainer(-21.5, 2.94, 12.5, 3.1, 2.7, 7.0, 0x475569);

    // Right Flank Containers
    buildPbrContainer(21.5, 0, -12.5, 3.2, 2.8, 7.2, 0xd97706);
    buildPbrContainer(21.5, 2.94, -12.5, 3.1, 2.7, 7.0, 0x334155);
    buildPbrContainer(21.5, 0, 12.5, 3.2, 2.8, 7.2, 0x0d9488);
    buildPbrContainer(21.5, 2.94, 12.5, 3.1, 2.7, 7.0, 0x475569);

    // Mid-Lane Tactical Peek Bunkers & Crates
    [[-10.5, -14.5], [10.5, -14.5], [-10.5, 14.5], [10.5, 14.5]].forEach(([bx, bz]) => {
      addBox(bx, 0, bz, 3.8, 1.35, 1.2, { map: tex.wallTex, roughness: 0.7 }, true, true);
      addBox(bx + (bx < 0 ? -1.4 : 1.4), 0, bz + (bz < 0 ? -1.3 : 1.3), 1.3, 1.3, 1.3, { map: tex.crateTex, roughness: 0.8 }, true, true);
    });

    // Four Corner Stadium Floodlight Towers
    [[-31, -36], [31, -36], [-31, 36], [31, 36]].forEach(([tx, tz]) => {
      addBox(tx, 0, tz, 0.75, 10.5, 0.75, { color: 0x1e293b, metalness: 0.85, roughness: 0.3 }, true, true);
      addBox(tx, 10.2, tz, 2.6, 0.9, 1.2, { color: 0x0f172a, metalness: 0.8, roughness: 0.3 }, false, true);
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.55, 0.2),
        new THREE.MeshBasicMaterial({ color: 0xfef9c3 })
      );
      lamp.position.set(tx, 10.2, tz + (tz < 0 ? 0.62 : -0.62));
      scene.add(lamp);
    });
  } else {
    /* ===== EXISTING STANDARD ARENA MAPS ===== */
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
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 2.4, 0.25),
        new THREE.MeshLambertMaterial({ color: 0x0f172a })
      );
      door.position.set(x, 1.2, z + (z < 0 ? d / 2 + 0.05 : -d / 2 - 0.05));
      scene.add(door);
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

    function buildWatchtower(x, z) {
      const legMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
      [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.2, 8), legMat);
        leg.position.set(x + lx, 3.6, z + lz);
        scene.add(leg);
      });
      addBox(x, 6.4, z, 3.6, 0.28, 3.6, { color: 0x475569 }, false);
      addBox(x, 6.7, z - 1.65, 3.6, 1.1, 0.15, { color: 0x1e293b }, false);
      addBox(x, 6.7, z + 1.65, 3.6, 1.1, 0.15, { color: 0x1e293b }, false);
      addBox(x, 9.2, z, 4.0, 0.25, 4.0, { color: 0x7c2d12 }, false);
      addCollider(x, z, 3.0, 3.0, 7.5);
    }
    buildWatchtower(-34, -34);
    buildWatchtower(34, -34);

    function buildSandbagCover(x, z) {
      const bagMat = new THREE.MeshLambertMaterial({ color: 0xb59e78 });
      for (let row = 0; row < 3; row++) {
        for (let col = -2; col <= 2; col++) {
          const bag = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.36, 0.55), bagMat);
          bag.position.set(x + col * 0.84 + (row % 2) * 0.15, 0.18 + row * 0.35, z);
          scene.add(bag);
        }
      }
      addCollider(x, z, 4.4, 0.9, 1.15);
    }
    buildSandbagCover(0, -11.5);
    buildSandbagCover(0, 11.5);

    [[-6.5, 8], [6.5, -8], [-12, -26], [12, 26]].forEach(([cx, cz]) => {
      addBox(cx, 0, cz, 1.4, 1.4, 1.4, { map: tex.crateTex });
      addBox(cx + 1.45, 0, cz, 1.2, 1.2, 1.2, { map: tex.crateTex });
      addBox(cx + 0.6, 1.35, cz, 1.1, 1.1, 1.1, { map: tex.crateTex });
    });

    function buildTree(x, z, scale = 1) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24 * scale, 0.36 * scale, 2.8 * scale, 8),
        new THREE.MeshLambertMaterial({ color: 0x5c3e26 })
      );
      trunk.position.set(x, 1.4 * scale, z);
      scene.add(trunk);

      const leafMat = new THREE.MeshLambertMaterial({ color: isDesert ? 0x768745 : 0x34692d });
      [
        [0, 3.3 * scale, 0, 1.8 * scale],
        [-0.7 * scale, 2.8 * scale, 0.4 * scale, 1.3 * scale],
        [0.75 * scale, 2.9 * scale, -0.3 * scale, 1.35 * scale]
      ].forEach(([ox, oy, oz, rad]) => {
        const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(rad, 1), leafMat);
        crown.position.set(x + ox, oy, z + oz);
        scene.add(crown);
      });
      addCollider(x, z, 0.9 * scale, 0.9 * scale, 3.0 * scale);
    }
    [[-38, -14, 1.2], [-38, 18, 1.35], [38, -18, 1.25], [38, 16, 1.15], [-26, 36, 1.3], [26, 36, 1.2]].forEach(t => buildTree(t[0], t[1], t[2]));
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

  // Symmetrical 1v1 / 2v2 spawns in Private Killhouse (Host at Alpha South, Friend at Bravo North)
  const spawnIsBravo = isPrivatePvP && !PRIVATE_ROOM.isHost;
  let px = spawnIsBravo ? -2 : 0;
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

  // Outgoing PvP hit event queue for 1v1 / 2v2 friend duel sync
  let pendingHit = null;
  let hitCounter = 0;
  const processedHits = new Set();

  const playerAv = makeSoldierAvatar({
    armorCol: spawnIsBravo ? 0xdc2626 : ((safeS.eq.skin >= 0 && typeof RAR !== 'undefined' && typeof ITEMS !== 'undefined' && ITEMS[safeS.eq.skin] && RAR[ITEMS[safeS.eq.skin].r]) ? RAR[ITEMS[safeS.eq.skin].r].c : 0x2563eb),
    gunId: weapons[0].id
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

  // In Private 1v1/2v2 mode, disable AI bots so you and your friend have a clean duel
  const botSpawns = isPrivatePvP ? [] : [[-32, -32], [0, -34], [32, -32], [-34, 4], [34, -4], [0, -22]];
  const bots = botSpawns.map((sp, i) => {
    const gunId = i % 3 === 0 ? 7 : i % 2 === 0 ? 5 : 3;
    const av = makeSoldierAvatar({ armorCol: 0xdc2626, gunId, tint: 0xff2a55 });
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
      px = -2;
      pz = -29;
      yaw = Math.PI;
    } else {
      px = 0;
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

  /* ===== CODM-STYLE GUNSMITH DRAWER WITH ATTRIBUTES & ATTACHMENTS ===== */
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

  /* ===== PC MOUSE 360° AIM, SNIPER HOLD-TO-SCOPE & RELEASE-TO-FIRE, WHEEL GUN SWITCH ===== */
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
      if (e.target === acv) {
        enterPcAimMode();
      }
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

  /* ===== MOBILE TOUCH CONTROLS ===== */
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
        return `<div class="sq-bitem${m.isHost ? ' host' : ''}">
          <div><b>${m.speaking ? '🗣️ ' : ''}${esc(m.name)}</b><div class="bhp"><i style="width:${mHp}%"></i></div></div>
          <span>${mHp} HP</span>
        </div>`;
      }).join('');
    }

    const myPid = (typeof MY_PID !== 'undefined' && MY_PID) ? MY_PID : (window.__pvpPid || '');
    const activePids = new Set();
    members.forEach(m => {
      if (m.me || !m.battle || !m.battle.inMatch) return;
      activePids.add(m.pid);

      // Receive incoming PvP damage if friend hit us in 1v1/2v2
      if (isPrivatePvP && m.battle.hit && m.battle.hit.targetPid === myPid) {
        const hKey = m.pid + '_' + m.battle.hit.seq;
        if (!processedHits.has(hKey)) {
          processedHits.add(hKey);
          applyIncomingPvpDamage(m.battle.hit.dmg || 25, m.name);
        }
      }

      let rp = remotePeers[m.pid];
      if (!rp) {
        const av = makeSoldierAvatar({
          armorCol: isPrivatePvP ? 0xdc2626 : 0x38bdf8,
          gunId: m.battle.gunId || 3,
          tint: isPrivatePvP ? 0xff2a55 : 0x4ade80,
          label: m.name || 'PLAYER',
          isEnemy: isPrivatePvP
        });
        scene.add(av.grp);
        rp = remotePeers[m.pid] = {
          av,
          name: m.name || 'PLAYER',
          hp: typeof m.battle.hp === 'number' ? m.battle.hp : 100,
          tx: m.battle.x || 0,
          ty: m.battle.y || 0,
          tz: m.battle.z || (isKillhouse ? -29 : 26),
          try: m.battle.ry || 0,
          anim: m.battle.anim || 'Idle'
        };
      }
      rp.name = m.name || rp.name;
      if (typeof m.battle.hp === 'number') rp.hp = m.battle.hp;
      rp.av.updateTag(rp.name, rp.hp);
      rp.tx = m.battle.x || 0;
      rp.ty = m.battle.y || 0;
      rp.tz = m.battle.z || (isKillhouse ? -29 : 26);
      rp.try = m.battle.ry || 0;
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

    radarCtx.fillStyle = isPrivatePvP ? '#ff2a55' : '#4ade80';
    Object.values(remotePeers).forEach(rp => {
      const pt = toRadar(rp.av.grp.position.x, rp.av.grp.position.z);
      radarCtx.beginPath();
      radarCtx.arc(pt.x, pt.y, 3.2, 0, Math.PI * 2);
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

        // PvP bullet collision against friend in Private 1v1 / 2v2 mode
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
          if (typeof SFX !== 'undefined' && SFX.coin) SFX.coin();
          if (pk.isMed) {
            hp = Math.min(maxHp, hp + 40);
            setFeed('➕ MEDKIT PICKED UP (+40 HP)');
          } else {
            wState.forEach((st, i) => { st.reserve += weapons[i].mag; });
            setFeed('📦 AMMO CRATE PICKED UP!');
          }
          updateHud();
        }
      });

      for (let i = grenades.length - 1; i >= 0; i--) {
        const g = grenades[i];
        g.vy -= 22 * dt;
        g.mesh.position.x += g.vx * dt;
        g.mesh.position.y += g.vy * dt;
        g.mesh.position.z += g.vz * dt;
        if (g.mesh.position.y <= 0.16) {
          g.mesh.position.y = 0.16;
          g.vy *= -0.35;
          g.vx *= 0.65;
          g.vz *= 0.65;
        }
        g.fuse -= dt;
        if (g.fuse <= 0) {
          GUN_AUDIO.playExplosion();
          const gx = g.mesh.position.x, gz = g.mesh.position.z;
          bots.forEach(b => {
            if (b.alive && Math.hypot(b.x - gx, b.z - gz) < 7.5) damageBot(b, 130);
          });
          if (isPrivatePvP) {
            Object.entries(remotePeers).forEach(([pid, rp]) => {
              const pPos = rp.av.grp.position;
              if (Math.hypot(pPos.x - gx, pPos.z - gz) < 7.5) damageRemotePeer(pid, rp, 130);
            });
          }
          scene.remove(g.mesh);
          grenades.splice(i, 1);
        }
      }

      for (let i = tracers.length - 1; i >= 0; i--) {
        tracers[i].life -= dt;
        if (tracers[i].life <= 0) {
          scene.remove(tracers[i].line);
          tracers[i].line.geometry.dispose();
          tracers.splice(i, 1);
        }
      }
      for (let i = dustParts.length - 1; i >= 0; i--) {
        const d = dustParts[i];
        d.life -= dt;
        d.mesh.scale.addScalar(dt * 2.5);
        d.mesh.material.opacity = Math.max(0, d.life * 1.4);
        if (d.life <= 0) {
          scene.remove(d.mesh);
          d.mesh.geometry.dispose();
          dustParts.splice(i, 1);
        }
      }

      bots.forEach(b => {
        if (!b.alive) {
          if (b.dying) {
            b.deathProg = Math.min(1, b.deathProg + dt * 2.4);
            b.av.setDeathFall(b.deathProg);
            if (b.deathProg >= 1) b.dying = false;
          }
          b.respawnT -= dt;
          if (b.respawnT <= 0) {
            const sp = botSpawns[b.id % botSpawns.length];
            b.x = sp[0];
            b.z = sp[1];
            b.hp = 100;
            b.alive = true;
            b.dying = false;
            b.deathProg = 0;
            b.av.setDeathFall(0);
            b.av.grp.position.set(b.x, 0, b.z);
          }
          return;
        }

        const dx = px - b.x, dz = pz - b.z;
        const dist = Math.hypot(dx, dz);
        b.strafeT -= dt;
        if (b.strafeT <= 0) {
          b.strafeT = 1.4 + Math.random() * 2;
          b.dir = Math.atan2(dx, dz) + (Math.random() - 0.5) * 1.3;
        }

        const chasing = dist > 12;
        const moveSpd = chasing ? 3.5 : 1.7;
        const vx = Math.sin(b.dir) * moveSpd;
        const vz = Math.cos(b.dir) * moveSpd;
        const nx = Math.max(-44, Math.min(44, b.x + vx * dt));
        const nz = Math.max(-44, Math.min(44, b.z + vz * dt));
        let blocked = false;
        for (const c of colliders) {
          if (nx + 0.55 > c.minX && nx - 0.55 < c.maxX && nz + 0.55 > c.minZ && nz - 0.55 < c.maxZ) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          b.x = nx;
          b.z = nz;
        } else {
          b.dir += Math.PI * 0.65;
        }

        const faceX = chasing ? vx : dx;
        const faceZ = chasing ? vz : dz;
        const targetBotRot = Math.atan2(-faceX, -faceZ);
        b.rotY += shortestAngleDiff(b.rotY, targetBotRot) * Math.min(1, dt * 10);

        b.av.grp.position.set(b.x, 0, b.z);
        b.av.grp.rotation.y = b.rotY;
        b.av.setAnim(chasing ? 'Run' : 'Walk', chasing ? 1.0 : 0.85);
        b.av.update(dt);

        b.fireCd -= dt;
        if (b.fireCd <= 0 && dist < 38) {
          b.fireCd = 1.4 + Math.random() * 1.3;
          b.av.triggerMuzzle();
          const from = new THREE.Vector3(b.x, 1.42, b.z);
          const to = new THREE.Vector3(px + (Math.random() - 0.5) * 1.6, py + 1.2, pz + (Math.random() - 0.5) * 1.6);
          spawnTracer(from, to, 0xff2a55);
          const hitChance = slideTimer > 0 ? 0.12 : crouching ? 0.22 : 0.32;
          if (Math.random() < hitChance) {
            hp = Math.max(0, hp - 8);
            updateHud();
            if (hp <= 0) {
              hp = 100;
              px = 0;
              pz = 28;
              setFeed('⚠️ RESPAWNED AT BASE CAMP!');
              updateHud();
            }
          }
        }
      });

      Object.values(remotePeers).forEach(rp => {
        const stepD = Math.hypot(rp.tx - rp.av.grp.position.x, rp.tz - rp.av.grp.position.z);
        rp.av.grp.position.x += (rp.tx - rp.av.grp.position.x) * 0.22;
        rp.av.grp.position.y += (rp.ty - rp.av.grp.position.y) * 0.22;
        rp.av.grp.position.z += (rp.tz - rp.av.grp.position.z) * 0.22;
        rp.av.grp.rotation.y += shortestAngleDiff(rp.av.grp.rotation.y, rp.try) * 0.25;
        rp.av.setAnim(stepD > 0.04 ? 'Run' : (rp.anim || 'Idle'));
        rp.av.update(dt);
      });

      syncAccum += dt;
      if (syncAccum >= 0.25) {
        syncAccum = 0;
        if (typeof SQUAD_ID !== 'undefined' && SQUAD_ID && typeof syncBattleState === 'function') syncBattleState();
      }
    } catch (simErr) {
      console.error('Arena sim step warning:', simErr);
    }

    drawRadar();
    renderer.render(scene, camera);
  }

  function loop(nowT) {
    if (!AR) return;
    rafId = requestAnimationFrame(loop);
    stepAndRender(nowT);
  }

  AR = {
    paused: 0,
    getPacket() {
      return {
        inMatch: true,
        x: +px.toFixed(2),
        y: +py.toFixed(2),
        z: +pz.toFixed(2),
        ry: +charYaw.toFixed(3),
        anim: curAnimState,
        hp: Math.ceil(hp),
        gunId: weapons[wIdx].id,
        kills,
        hit: pendingHit,
        ts: Date.now()
      };
    },
    syncTeammates,
    cleanup() {
      cancelAnimationFrame(rafId);
      clearTimeout(cHoldTimer);
      window.removeEventListener('resize', resizeArena);
      if (isPC) {
        document.removeEventListener('pointerlockchange', onPointerLockChange);
        window.removeEventListener('mousemove', onPcMouseMove);
        window.removeEventListener('mousedown', onPcMouseDown);
        window.removeEventListener('mouseup', onPcMouseUp);
        window.removeEventListener('wheel', onPcWheel);
        window.removeEventListener('keydown', onPcKeyDown);
        window.removeEventListener('keyup', onPcKeyUp);
        try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
      }
      renderer.dispose();
      const glEl = document.getElementById('gl');
      if (glEl) glEl.style.display = 'block';
      const uiEl = document.getElementById('ui');
      if (uiEl) uiEl.style.display = 'block';
    },
    stats: () => ({ kills, mapName: mapCfg.name })
  };

  if (typeof squadMembers === 'function') syncTeammates(squadMembers());
  stepAndRender(performance.now() + 16);
  rafId = requestAnimationFrame(loop);
}

function exitMatch(claimRewards = false) {
  if (!AR) return;
  const { kills, mapName } = AR.stats();
  AR.cleanup();
  AR = null;
  const el = document.getElementById('arena');
  if (el) el.remove();
  if (typeof markExitedBattle === 'function') markExitedBattle();

  if (claimRewards) {
    const bonusCoins = 30 + kills * 12;
    const bonusCp = kills >= 3 ? 15 : 5;
    const bonusXp = 45 + kills * 20;
    S.coins += bonusCoins;
    S.cp += bonusCp;
    if (kills >= 1) S.wins = (S.wins || 0) + 1;
    if (typeof addXP === 'function') addXP(bonusXp);
    if (typeof save === 'function') save();
    if (typeof SFX !== 'undefined' && SFX.lvlup) SFX.lvlup();
    toast(`🏆 EXTRACTED (${esc(mapName)})! ${kills} Kills · +${bonusXp} XP · +${bonusCoins} 🪙 · +${bonusCp} 💎 CP`);
  } else {
    toast('🚪 Exited 3D Battle Arena');
  }
  if (typeof render === 'function') render();
}

/* ===== CUSTOM HUD LAYOUT EDITOR (EVERY HUD BUTTON & INFO BLOCK MOVABLE/ADJUSTABLE ON DEMAND) ===== */
function openHudEditor() {
  const keys = [
    ['joy', 'JOYSTICK', 86],
    ['fire', 'FIRE', 64],
    ['scope', 'SCOPE', 50],
    ['jump', 'JUMP', 50],
    ['crouch', 'SLIDE', 48],
    ['reload', 'RELOAD', 50],
    ['grenade', 'GRENADE', 46],
    ['wswitch', 'GUN', 50],
    ['cam', 'CAM', 48],
    ['minimap', 'RADAR', 76],
    ['hp', 'HP BAR', 72],
    ['ammo', 'AMMO HUD', 76],
    ['sqhud', 'SQUAD HUD', 76],
    ['pckeys', 'PC KEYS', 74]
  ];
  const baseDefaults = {
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
  const draft = JSON.parse(JSON.stringify(Object.assign({}, baseDefaults, (typeof defHud === 'function' ? defHud() : {}), (S.cfg && S.cfg.hud) || {})));
  let sel = 'fire';

  const ed = document.createElement('div');
  ed.className = 'hud-ed';
  ed.innerHTML = `
    <div class="hud-bar">
      <b style="color:var(--y)">🎛️ CUSTOM HUD (ALL ITEMS)</b>
      <span class="s" id="he-lbl">Selected: FIRE</span>
      <label class="s">Size <input type="range" id="he-s" min="55" max="150" value="${draft[sel].s}" style="width:5.2rem"></label>
      <label class="s">Alpha <input type="range" id="he-o" min="25" max="100" value="${draft[sel].o}" style="width:5.2rem"></label>
      <button class="sm alt" id="he-rst">RESET</button>
      <button class="sm" id="he-save">SAVE & EXIT</button>
    </div>
  `;
  document.body.appendChild(ed);

  const sInp = document.getElementById('he-s');
  const oInp = document.getElementById('he-o');
  const lbl = document.getElementById('he-lbl');
  const els = {};

  function applyItem(k) {
    const d = draft[k] || baseDefaults[k], el = els[k];
    if (!d || !el) return;
    el.style.left = d.x + '%';
    el.style.top = d.y + '%';
    el.style.transform = `scale(${d.s / 100})`;
    el.style.opacity = d.o / 100;
  }

  function selectKey(k) {
    sel = k;
    if (!draft[sel]) draft[sel] = Object.assign({}, baseDefaults[sel] || { x: 20, y: 20, s: 100, o: 95 });
    Object.keys(els).forEach(x => els[x].classList.toggle('sel', x === k));
    lbl.textContent = 'Selected: ' + k.toUpperCase();
    sInp.value = draft[sel].s;
    oInp.value = draft[sel].o;
  }

  keys.forEach(([k, name, sz]) => {
    if (!draft[k]) draft[k] = Object.assign({}, baseDefaults[k] || { x: 20, y: 20, s: 100, o: 95 });
    const it = document.createElement('div');
    it.className = 'hud-item' + (k === sel ? ' sel' : '');
    it.style.width = sz + 'px';
    it.style.height = sz + 'px';
    it.textContent = name;
    els[k] = it;
    applyItem(k);
    ed.appendChild(it);

    let dragging = false, ox = 0, oy = 0;
    it.addEventListener('pointerdown', e => {
      e.stopPropagation();
      selectKey(k);
      dragging = true;
      it.setPointerCapture(e.pointerId);
      const p = normPt(e.clientX, e.clientY);
      const w = isPortrait() ? window.innerHeight : window.innerWidth;
      const h = isPortrait() ? window.innerWidth : window.innerHeight;
      ox = p.x - (draft[k].x / 100) * w;
      oy = p.y - (draft[k].y / 100) * h;
    });
    it.addEventListener('pointermove', e => {
      if (!dragging) return;
      const p = normPt(e.clientX, e.clientY);
      const w = isPortrait() ? window.innerHeight : window.innerWidth;
      const h = isPortrait() ? window.innerWidth : window.innerHeight;
      draft[k].x = Math.max(0, Math.min(92, Math.round(((p.x - ox) / w) * 100)));
      draft[k].y = Math.max(6, Math.min(88, Math.round(((p.y - oy) / h) * 100)));
      applyItem(k);
    });
    it.addEventListener('pointerup', () => { dragging = false; });
    it.addEventListener('pointercancel', () => { dragging = false; });
  });

  sInp.oninput = () => { draft[sel].s = +sInp.value; applyItem(sel); };
  oInp.oninput = () => { draft[sel].o = +oInp.value; applyItem(sel); };
  document.getElementById('he-rst').onclick = () => {
    Object.assign(draft, baseDefaults, (typeof defHud === 'function' ? defHud() : {}));
    keys.forEach(([k]) => applyItem(k));
    selectKey(sel);
  };
  document.getElementById('he-save').onclick = () => {
    S.cfg.hud = draft;
    save();
    ed.remove();
    toast('🎛️ Custom HUD layout saved!');
  };
}
