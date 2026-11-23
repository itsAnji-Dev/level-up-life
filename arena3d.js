/* ===== 3D ARENA STEP 6: JUMP/FALL & DEATH ANIMATIONS, FLOATING HIT NUMBERS & ENEMY HEALTH BARS ===== */
let AR = null;

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
      const len = Math.floor(ctx.sampleRate * 1.2);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.25));
      }
    }
    return ctx;
  }

  function playShot(cat = 'ar', suppressed = false) {
    const ac = ensureCtx();
    if (!ac) return;
    const now = ac.currentTime;
    const cfg = {
      ar:       { f0: 195, f1: 42, d: 0.14, nf: suppressed ? 1400 : 3200, nd: 0.17, g: suppressed ? 0.22 : 0.36 },
      smg:      { f0: 240, f1: 58, d: 0.09, nf: suppressed ? 1600 : 4100, nd: 0.11, g: suppressed ? 0.20 : 0.32 },
      sniper:   { f0: 155, f1: 28, d: 0.28, nf: 5200, nd: 0.40, g: 0.48 },
      shotgun:  { f0: 130, f1: 26, d: 0.24, nf: 2400, nd: 0.32, g: 0.46 },
      launcher: { f0: 95,  f1: 22, d: 0.35, nf: 1100, nd: 0.45, g: 0.44 }
    }[cat] || { f0: 195, f1: 42, d: 0.14, nf: 3200, nd: 0.17, g: 0.35 };

    const osc = ac.createOscillator();
    const og = ac.createGain();
    osc.type = (cat === 'sniper' || cat === 'shotgun') ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(cfg.f0, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, cfg.f1), now + cfg.d);
    og.gain.setValueAtTime(cfg.g, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + cfg.d);
    osc.connect(og).connect(ac.destination);
    osc.start(now);
    osc.stop(now + cfg.d + 0.02);

    if (noiseBuf) {
      const ns = ac.createBufferSource();
      ns.buffer = noiseBuf;
      const flt = ac.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.setValueAtTime(cfg.nf, now);
      const ng = ac.createGain();
      ng.gain.setValueAtTime(cfg.g * 0.9, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + cfg.nd);
      ns.connect(flt).connect(ng).connect(ac.destination);
      ns.start(now);
      ns.stop(now + cfg.nd + 0.02);
    }
  }

  function playReload(cat = 'ar') {
    const ac = ensureCtx();
    if (!ac) return;
    const now = ac.currentTime;
    const clicks = cat === 'shotgun' ? [0.05, 0.25, 0.45, 0.65] : [0.08, 0.48, 0.88];
    clicks.forEach((off, idx) => {
      const t = now + off;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(idx === clicks.length - 1 ? 760 : 500, t);
      o.frequency.exponentialRampToValueAtTime(190, t + 0.05);
      g.gain.setValueAtTime(0.16, t);
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
    g.gain.setValueAtTime(kill ? 0.2 : 0.12, now);
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
    o.frequency.exponentialRampToValueAtTime(20, now + 0.5);
    g.gain.setValueAtTime(0.42, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    o.connect(g).connect(ac.destination);
    o.start(now);
    o.stop(now + 0.58);
  }

  return { playShot, playReload, playHitmarker, playExplosion };
})();

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
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }
  const isDesert = mapId === 'nuketown';
  const isDock = mapId === 'shipment';

  const groundTex = makeCanvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = isDesert ? '#9c7f54' : isDock ? '#3f4c5e' : '#4a6830';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2400; i++) {
      ctx.fillStyle = isDesert ? (i % 2 ? '#856941' : '#b29364') : (i % 2 ? '#3b5424' : '#5b7d3c');
      ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }
  }, 26, 26);

  const roadTex = makeCanvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#252b36';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    ctx.fillStyle = '#facc15';
    ctx.fillRect(w / 2 - 3, 24, 6, 180);
    ctx.fillRect(w / 2 - 3, 280, 6, 180);
    ctx.fillStyle = 'rgba(226,232,240,0.5)';
    ctx.fillRect(14, 0, 6, h);
    ctx.fillRect(w - 20, 0, 6, h);
  }, 1, 14);

  const wallTex = makeCanvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = isDesert ? '#cfa87a' : '#6c7d92';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(15,23,42,0.14)';
    for (let y = 0; y < h; y += 32) ctx.fillRect(0, y, w, 2);
    ctx.strokeStyle = 'rgba(15,23,42,0.32)';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  }, 1, 1);

  const contTex = makeCanvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = 'rgba(15,23,42,0.22)';
      ctx.fillRect(x, 0, 6, h);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(x + 6, 0, 3, h);
    }
  }, 3, 1);

  const crateTex = makeCanvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#9e6938';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {
      ctx.fillStyle = 'rgba(40,22,8,0.25)';
      ctx.fillRect(0, y, w, 3);
    }
    ctx.strokeStyle = '#4a2e14';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, w - 14, h - 14);
    ctx.beginPath();
    ctx.moveTo(14, 14);
    ctx.lineTo(w - 14, h - 14);
    ctx.stroke();
  }, 1, 1);

  const sandbagTex = makeCanvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#c2a878';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 24) {
      ctx.fillStyle = 'rgba(68,54,32,0.35)';
      ctx.fillRect(0, y, w, 4);
    }
  }, 1, 1);

  TEX_CACHE[mapId] = { groundTex, roadTex, wallTex, contTex, crateTex, sandbagTex };
  return TEX_CACHE[mapId];
}

function createDetailedContainer(w, h, d, colorHex, contTex) {
  const grp = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, map: contTex, metalness: 0.45, roughness: 0.48 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.72, roughness: 0.35 });

  const core = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, h * 0.94, d * 0.98), bodyMat);
  core.position.y = h * 0.48;
  grp.add(core);

  const topRail = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.14, d + 0.08), frameMat);
  topRail.position.y = h - 0.07;
  grp.add(topRail);

  const botRail = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.14, d + 0.08), frameMat);
  botRail.position.y = 0.07;
  grp.add(botRail);

  const corners = [
    [-w / 2, h / 2, -d / 2], [w / 2, h / 2, -d / 2],
    [-w / 2, h / 2, d / 2],  [w / 2, h / 2, d / 2]
  ];
  corners.forEach(([cx, cy, cz]) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 0.16), frameMat);
    post.position.set(cx, cy, cz);
    grp.add(post);
  });

  [-0.22, 0.22].forEach(bx => {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, h * 0.78, 8), frameMat);
    bar.position.set(bx, h * 0.5, d / 2 + 0.05);
    grp.add(bar);
  });

  return grp;
}

function createSandbagBarricade(w, h, d, sandbagTex) {
  const grp = new THREE.Group();
  const bagMat = new THREE.MeshStandardMaterial({ map: sandbagTex, color: 0xcab082, roughness: 0.88, metalness: 0.04 });
  const rows = 3;
  const rowH = h / rows;
  for (let r = 0; r < rows; r++) {
    const bagsAcross = 4;
    const bagW = (w / bagsAcross) * 0.96;
    const xOff = (r % 2) * (bagW * 0.22);
    for (let c = 0; c < bagsAcross; c++) {
      const bx = -w / 2 + bagW / 2 + c * (w / bagsAcross) + (c < bagsAcross - 1 ? xOff : -xOff * 0.5);
      const bag = new THREE.Mesh(new THREE.BoxGeometry(bagW, rowH * 0.92, d * 0.92), bagMat);
      bag.position.set(bx, rowH * (r + 0.5), 0);
      grp.add(bag);
    }
  }
  return grp;
}

function createDetailedCrate(size, crateTex) {
  const grp = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.75, metalness: 0.08 });
  const braceMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.35 });

  const box = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), woodMat);
  box.position.y = size / 2;
  grp.add(box);

  const bSize = size * 0.22;
  const pts = [
    [-1, 1, -1], [1, 1, -1], [-1, 1, 1], [1, 1, 1],
    [-1, -1, -1], [1, -1, -1], [-1, -1, 1], [1, -1, 1]
  ];
  pts.forEach(([sx, sy, sz]) => {
    const br = new THREE.Mesh(new THREE.BoxGeometry(bSize, bSize, bSize), braceMat);
    br.position.set(sx * (size / 2 - bSize * 0.35), size / 2 + sy * (size / 2 - bSize * 0.35), sz * (size / 2 - bSize * 0.35));
    grp.add(br);
  });
  return grp;
}

function createFloodlightTower(x, z) {
  const grp = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.78, roughness: 0.32 });
  const lampGlow = new THREE.MeshStandardMaterial({ color: 0xfef9c3, emissive: 0xfef08a, emissiveIntensity: 1.4 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.4), steelMat);
  base.position.y = 0.25;
  grp.add(base);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 9.5, 10), steelMat);
  pole.position.y = 4.9;
  grp.add(pole);

  const crossArm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 0.22), steelMat);
  crossArm.position.y = 9.6;
  grp.add(crossArm);

  [-0.55, 0.55].forEach(lx => {
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.32, 0.28), steelMat);
    housing.position.set(lx, 9.85, 0);
    grp.add(housing);

    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.04), lampGlow);
    lens.position.set(lx, 9.85, 0.15);
    grp.add(lens);
  });

  grp.position.set(x, 0, z);
  return grp;
}

function buildDetailedGun3D(gid, isFpp = false) {
  const it = (typeof ITEMS !== 'undefined' && ITEMS[gid]) ? ITEMS[gid] : { id: 3, r: 'R', cat: 'ar', name: 'M4A1' };
  const rCol = (typeof RAR !== 'undefined' && RAR[it.r]) ? RAR[it.r].c : 0x4aa8ff;
  const g = new THREE.Group();

  const gunMetal = new THREE.MeshStandardMaterial({ color: 0x1e2430, metalness: 0.78, roughness: 0.28 });
  const darkPolymer = new THREE.MeshStandardMaterial({ color: 0x11151f, metalness: 0.18, roughness: 0.72 });
  const chromeSteel = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.92, roughness: 0.18 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7c3f1d, metalness: 0.06, roughness: 0.62 });
  const accentMat = new THREE.MeshStandardMaterial({ color: rCol, metalness: 0.6, roughness: 0.26, emissive: rCol, emissiveIntensity: 0.22 });
  const lensMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

  const isAK = (it.name || '').toUpperCase().includes('AK');
  const cat = it.cat || 'ar';
  let muzzleZ = 0.56;

  if (cat === 'launcher') {
    const oliveMat = new THREE.MeshStandardMaterial({ color: 0x3f4e32, metalness: 0.45, roughness: 0.5 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.84, 16), oliveMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.03, 0.04);
    g.add(tube);

    const heatShield = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.34, 16), woodMat);
    heatShield.rotation.x = Math.PI / 2;
    heatShield.position.set(0, 0.03, 0.05);
    g.add(heatShield);

    const exhaustBell = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.068, 0.15, 16), gunMetal);
    exhaustBell.rotation.x = Math.PI / 2;
    exhaustBell.position.set(0, 0.03, -0.42);
    g.add(exhaustBell);

    const warheadNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.12, 12), gunMetal);
    warheadNeck.rotation.x = Math.PI / 2;
    warheadNeck.position.set(0, 0.03, 0.51);
    g.add(warheadNeck);

    const warheadCone = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.22, 16), accentMat);
    warheadCone.rotation.x = Math.PI / 2;
    warheadCone.position.set(0, 0.03, 0.66);
    g.add(warheadCone);

    const gripF = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.13, 0.055), darkPolymer);
    gripF.position.set(0, -0.06, 0.22);
    gripF.rotation.x = 0.2;
    g.add(gripF);

    const gripR = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.13, 0.055), darkPolymer);
    gripR.position.set(0, -0.06, -0.02);
    gripR.rotation.x = 0.24;
    g.add(gripR);

    muzzleZ = 0.78;
  } else if (cat === 'sniper') {
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.095, 0.56), isAK ? woodMat : darkPolymer);
    chassis.position.set(0, 0.0, 0.02);
    g.add(chassis);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.12, 0.26), darkPolymer);
    stock.position.set(0, -0.015, -0.34);
    g.add(stock);

    const cheekPad = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.035, 0.13), accentMat);
    cheekPad.position.set(0, 0.05, -0.31);
    g.add(cheekPad);

    const heavyBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.022, 0.52, 14), chromeSteel);
    heavyBarrel.rotation.x = Math.PI / 2;
    heavyBarrel.position.set(0, 0.028, 0.54);
    g.add(heavyBarrel);

    const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.042, 0.085), gunMetal);
    muzzleBrake.position.set(0, 0.028, 0.82);
    g.add(muzzleBrake);

    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.34, 16), gunMetal);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.095, 0.06);
    g.add(scopeTube);

    const scopeTurretTop = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 12), chromeSteel);
    scopeTurretTop.position.set(0, 0.125, 0.06);
    g.add(scopeTurretTop);

    const scopeBell = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.025, 0.09, 16), gunMetal);
    scopeBell.rotation.x = Math.PI / 2;
    scopeBell.position.set(0, 0.095, 0.25);
    g.add(scopeBell);

    const scopeLens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), lensMat);
    scopeLens.position.set(0, 0.095, 0.296);
    g.add(scopeLens);

    [-0.035, 0.035].forEach(bx => {
      const bp = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 8), gunMetal);
      bp.rotation.x = Math.PI / 2 - 0.18;
      bp.position.set(bx, -0.045, 0.38);
      g.add(bp);
    });

    muzzleZ = 0.88;
  } else if (cat === 'shotgun') {
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.092, 0.34), gunMetal);
    receiver.position.set(0, 0.01, 0.02);
    g.add(receiver);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.105, 0.27), darkPolymer);
    stock.rotation.x = -0.14;
    stock.position.set(0, -0.025, -0.26);
    g.add(stock);

    const topBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.018, 0.48, 14), chromeSteel);
    topBarrel.rotation.x = Math.PI / 2;
    topBarrel.position.set(0, 0.035, 0.42);
    g.add(topBarrel);

    const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.44, 14), gunMetal);
    magTube.rotation.x = Math.PI / 2;
    magTube.position.set(0, -0.002, 0.40);
    g.add(magTube);

    const pumpHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.19, 14), accentMat);
    pumpHandle.rotation.x = Math.PI / 2;
    pumpHandle.position.set(0, -0.004, 0.34);
    g.add(pumpHandle);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.12, 0.055), darkPolymer);
    grip.rotation.x = 0.32;
    grip.position.set(0, -0.065, -0.10);
    g.add(grip);

    muzzleZ = 0.68;
  } else if (cat === 'smg') {
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.075, 0.34), gunMetal);
    upper.position.set(0, 0.025, 0.03);
    g.add(upper);

    const vectorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.11, 0.15), accentMat);
    vectorHousing.rotation.x = 0.3;
    vectorHousing.position.set(0, -0.035, 0.13);
    g.add(vectorHousing);

    const foldStock = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.065, 0.21), darkPolymer);
    foldStock.position.set(0, 0.015, -0.23);
    g.add(foldStock);

    const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 14), darkPolymer);
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0, 0.025, 0.30);
    g.add(suppressor);

    const reflexFrame = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.038, 0.065), gunMetal);
    reflexFrame.position.set(0, 0.078, 0.03);
    g.add(reflexFrame);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.115, 0.052), darkPolymer);
    grip.rotation.x = 0.26;
    grip.position.set(0, -0.055, -0.06);
    g.add(grip);

    muzzleZ = 0.43;
  } else {
    const upperRec = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.078, 0.34), isAK ? gunMetal : accentMat);
    upperRec.position.set(0, 0.024, 0.02);
    g.add(upperRec);

    const lowerRec = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.055, 0.25), gunMetal);
    lowerRec.position.set(0, -0.025, 0.01);
    g.add(lowerRec);

    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.066, 0.25), isAK ? woodMat : darkPolymer);
    handguard.position.set(0, 0.022, 0.30);
    g.add(handguard);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.105, 0.24), isAK ? woodMat : darkPolymer);
    stock.position.set(0, -0.005, -0.26);
    g.add(stock);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.125, 0.055), darkPolymer);
    grip.rotation.x = 0.28;
    grip.position.set(0, -0.072, -0.07);
    g.add(grip);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.22, 12), chromeSteel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.024, 0.51);
    g.add(barrel);

    const flashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.017, 0.055, 12), gunMetal);
    flashHider.rotation.x = Math.PI / 2;
    flashHider.position.set(0, 0.024, 0.63);
    g.add(flashHider);

    const holoHood = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.048, 0.085), darkPolymer);
    holoHood.position.set(0, 0.084, 0.04);
    g.add(holoHood);

    muzzleZ = 0.67;
  }

  const magGroup = new THREE.Group();
  magGroup.position.set(0, -0.085, 0.11);
  if (cat !== 'launcher' && cat !== 'shotgun') {
    const magH = cat === 'sniper' ? 0.11 : cat === 'smg' ? 0.22 : 0.20;
    const magD = cat === 'sniper' ? 0.085 : cat === 'smg' ? 0.042 : 0.062;
    const magMesh = new THREE.Mesh(new THREE.BoxGeometry(0.042, magH, magD), isAK ? accentMat : darkPolymer);
    magMesh.rotation.x = isAK ? 0.42 : cat === 'smg' ? 0.34 : 0.22;
    magGroup.add(magMesh);
  }
  g.add(magGroup);

  const boltMesh = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.016, 0.028), chromeSteel);
  boltMesh.position.set(0, 0.042, 0.01);
  g.add(boltMesh);

  const flash = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.13, 0),
    new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.92 })
  );
  flash.position.set(0, 0.025, muzzleZ + 0.06);
  flash.visible = false;
  g.add(flash);

  g.traverse(obj => {
    if (obj.isMesh && obj !== flash) {
      obj.castShadow = !isFpp;
      obj.receiveShadow = !isFpp;
    }
  });

  return { group: g, magGroup, boltMesh, flash, cat };
}
window.buildDetailedGun3D = buildDetailedGun3D;

function createFppViewmodel() {
  const root = new THREE.Group();
  const swayGroup = new THREE.Group();
  const weaponPivot = new THREE.Group();
  swayGroup.add(weaponPivot);
  root.add(swayGroup);

  let gunObj = null, recoilKick = 0, bobT = 0;
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
    if (recoilKick > 0) {
      recoilKick = Math.max(0, recoilKick - dt * 13);
      if (gunObj && gunObj.flash && recoilKick < 0.45) gunObj.flash.visible = false;
    }
    bobT += dt * (st.mag > 0.1 ? 9 : 2);
    const airBob = st.airborne ? -0.018 : 0;
    const landBob = -(st.landSquash || 0) * 0.045;
    const px = st.scoped ? 0 : 0.21 + Math.cos(bobT * 0.5) * 0.008 * st.mag;
    const py = (st.scoped ? -0.11 : -0.22 + Math.abs(Math.sin(bobT)) * 0.008 * st.mag) + airBob + landBob;
    const pz = (st.scoped ? -0.32 : -0.44) + recoilKick * 0.04;
    const relDrop = st.reloading ? -0.09 : 0;
    const relTilt = st.reloading ? -0.28 : 0;
    swayGroup.position.set(px, py + relDrop, pz);
    swayGroup.rotation.set(recoilKick * 0.05 + relTilt + (st.landSquash || 0) * 0.12, 0, st.slideLerp * 0.1);
    if (gunObj && gunObj.magGroup) {
      gunObj.magGroup.position.y = st.reloading ? -0.22 : -0.085;
    }
  }
  return { root, setGun, triggerRecoil, update };
}

function makeSoldierAvatar(opts = {}) {
  const armorCol = opts.armorCol || 0x2563eb;
  const tint = opts.tint || 0x38bdf8;
  const grp = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a077, roughness: 0.65 });
  const bduMat = new THREE.MeshStandardMaterial({ color: 0x243044, roughness: 0.75 });
  const vestMat = new THREE.MeshStandardMaterial({ color: armorCol, metalness: 0.3, roughness: 0.45 });
  const gearMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.4, roughness: 0.5 });
  const visorMat = new THREE.MeshStandardMaterial({ color: tint, emissive: tint, emissiveIntensity: 0.6, roughness: 0.2 });

  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.86, 0);
  grp.add(pelvis);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.25), gearMat);
  pelvis.add(belt);

  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.06, 0);
  pelvis.add(torsoPivot);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.26), bduMat);
  chest.position.set(0, 0.26, 0);
  torsoPivot.add(chest);

  const plateVest = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.42, 0.30), vestMat);
  plateVest.position.set(0, 0.27, 0);
  torsoPivot.add(plateVest);

  [-0.12, 0, 0.12].forEach(px => {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.06), gearMat);
    pouch.position.set(px, 0.17, -0.17);
    torsoPivot.add(pouch);
  });

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.38, 0.15), gearMat);
  backpack.position.set(0, 0.28, 0.20);
  torsoPivot.add(backpack);

  const radioWhip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.42, 8), gearMat);
  radioWhip.position.set(0.13, 0.58, 0.20);
  torsoPivot.add(radioWhip);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.56, 0);
  torsoPivot.add(headPivot);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.10, 10), skinMat);
  neck.position.set(0, 0.02, 0);
  headPivot.add(neck);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.24), skinMat);
  head.position.set(0, 0.16, 0);
  headPivot.add(head);

  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.11, 0.25), gearMat);
  mask.position.set(0, 0.10, -0.005);
  headPivot.add(mask);

  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.16, 0.30), vestMat);
  helmet.position.set(0, 0.26, 0.01);
  headPivot.add(helmet);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.075, 0.05), visorMat);
  visor.position.set(0, 0.19, -0.125);
  headPivot.add(visor);

  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.29, 0.46, 0);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.16), vestMat);
    shoulder.add(pad);
    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, 0.12), bduMat);
    upperArm.position.set(0, -0.14, 0);
    shoulder.add(upperArm);
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.24, 0.11), gearMat);
    forearm.position.set(0, -0.34, -0.08);
    forearm.rotation.x = 0.65;
    shoulder.add(forearm);
    torsoPivot.add(shoulder);
    return shoulder;
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);
  armR.rotation.x = 0.55;
  armL.rotation.x = 0.72;
  armL.rotation.z = -0.25;

  const weaponMount = new THREE.Group();
  weaponMount.position.set(0.16, 0.28, -0.28);
  weaponMount.rotation.y = Math.PI;
  torsoPivot.add(weaponMount);

  function makeArticulatedLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.13, -0.02, 0);
    pelvis.add(hip);

    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.44, 0.17), bduMat);
    thigh.position.set(0, -0.22, 0);
    hip.add(thigh);

    const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.10, 0.06), gearMat);
    kneePad.position.set(0, -0.42, -0.08);
    hip.add(kneePad);

    const knee = new THREE.Group();
    knee.position.set(0, -0.44, 0);
    hip.add(knee);

    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.15), bduMat);
    shin.position.set(0, -0.17, 0);
    knee.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.10, 0.24), gearMat);
    boot.position.set(0, -0.37, -0.035);
    knee.add(boot);

    return { hip, knee, boot };
  }

  const legL = makeArticulatedLeg(-1);
  const legR = makeArticulatedLeg(1);

  grp.traverse(obj => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  let curGunObj = null, mode = 'Idle', speed = 1, t = 0, firingPulse = 0;
  let crouchLerp = 0, slideLerp = 0, airLerp = 0, landSquash = 0, vyFactor = 0, deathFallVal = 0;

  function setGun(gid) {
    if (curGunObj) weaponMount.remove(curGunObj.group);
    curGunObj = buildDetailedGun3D(gid, false);
    weaponMount.add(curGunObj.group);
  }
  setGun(opts.gunId != null ? opts.gunId : 3);

  return {
    grp,
    setGun,
    setAnim(name, sp = 1) { mode = name; speed = sp; },
    setAimPitch(p) {
      torsoPivot.rotation.x = Math.max(-0.45, Math.min(0.45, -p * 0.55));
    },
    setStance(c, s, air = 0, squash = 0, vNorm = 0) {
      crouchLerp = c;
      slideLerp = s;
      airLerp = air;
      landSquash = squash;
      vyFactor = vNorm;
    },
    setDeathFall(f) {
      deathFallVal = Math.max(0, Math.min(1, f));
      const e = 1 - Math.pow(1 - deathFallVal, 2.4);
      // Multi-axis collapse: stagger back, twist torso, buckle knees
      grp.rotation.x = e * (Math.PI * 0.48);
      grp.rotation.z = Math.sin(e * Math.PI) * 0.26;
      grp.position.y = Math.max(0, e * 0.12 - Math.max(0, deathFallVal - 0.8) * 0.25);
      pelvis.rotation.x = -0.32 * e;
      torsoPivot.rotation.z = 0.35 * Math.sin(e * Math.PI);
      headPivot.rotation.x = 0.55 * e;
      legL.hip.rotation.x = 0.65 * e;
      legL.knee.rotation.x = -1.1 * e;
      legR.hip.rotation.x = 0.42 * e;
      legR.knee.rotation.x = -0.85 * e;
      armL.rotation.z = -0.55 * e;
      armR.rotation.z = 0.45 * e;
    },
    triggerMuzzle() {
      firingPulse = 1;
      if (curGunObj && curGunObj.flash) curGunObj.flash.visible = true;
    },
    update(dt) {
      if (deathFallVal > 0.001) {
        if (firingPulse > 0) {
          firingPulse = Math.max(0, firingPulse - dt * 14);
          if (curGunObj && curGunObj.flash && firingPulse <= 0.35) curGunObj.flash.visible = false;
        }
        return;
      }

      const cycleRate = mode === 'Run' ? 12.5 * speed : mode === 'Walk' ? 7.5 * speed : 2.2;
      t += dt * cycleRate;

      const isMoving = mode === 'Run' || mode === 'Walk';
      const strideAmp = mode === 'Run' ? 0.72 : mode === 'Walk' ? 0.45 : 0.02;

      let standHipL = isMoving ? Math.sin(t) * strideAmp : 0;
      let standHipR = isMoving ? -Math.sin(t) * strideAmp : 0;
      let standKneeL = isMoving ? Math.max(0, -Math.sin(t)) * (strideAmp * 1.15) : 0;
      let standKneeR = isMoving ? Math.max(0, Math.sin(t)) * (strideAmp * 1.15) : 0;

      // Jump / airborne pose: knees tucked, slight stagger
      const jumpHipL = 0.55 - vyFactor * 0.25;
      const jumpKneeL = -1.05;
      const jumpHipR = 0.25 + vyFactor * 0.2;
      const jumpKneeR = -0.78;

      const crouchHipL = 0.88 + (isMoving ? Math.sin(t) * 0.25 : 0);
      const crouchKneeL = -1.55 - (isMoving ? Math.abs(Math.sin(t)) * 0.2 : 0);
      const crouchHipR = 0.35 + (isMoving ? -Math.sin(t) * 0.25 : 0);
      const crouchKneeR = -1.35;

      const slideHipL = 1.32;
      const slideKneeL = -0.14;
      const slideHipR = -0.55;
      const slideKneeR = -1.45;

      const wAir = Math.max(0, Math.min(1, airLerp)) * (1 - slideLerp);
      const wSlide = slideLerp;
      const wCrouch = crouchLerp * (1 - slideLerp) * (1 - wAir * 0.5);
      const wStand = Math.max(0, 1 - wCrouch - wSlide - wAir);

      legL.hip.rotation.x = standHipL * wStand + crouchHipL * wCrouch + slideHipL * wSlide + jumpHipL * wAir;
      legL.knee.rotation.x = standKneeL * wStand + crouchKneeL * wCrouch + slideKneeL * wSlide + jumpKneeL * wAir;
      legR.hip.rotation.x = standHipR * wStand + crouchHipR * wCrouch + slideHipR * wSlide + jumpHipR * wAir;
      legR.knee.rotation.x = standKneeR * wStand + crouchKneeR * wCrouch + slideKneeR * wSlide + jumpKneeR * wAir;

      legL.boot.rotation.x = -(legL.hip.rotation.x + legL.knee.rotation.x) * (wCrouch + wSlide * 0.6 + wAir * 0.35);
      legR.boot.rotation.x = -(legR.hip.rotation.x + legR.knee.rotation.x) * (wCrouch + wSlide * 0.6 + wAir * 0.35);

      const standY = 0.86 + (isMoving ? Math.abs(Math.cos(t)) * 0.03 : Math.sin(t) * 0.008);
      const crouchY = 0.56 + (isMoving ? Math.abs(Math.cos(t)) * 0.02 : 0);
      const slideY = 0.44;
      const jumpY = 0.80 + vyFactor * 0.05;
      const squashOffset = -landSquash * 0.16;

      pelvis.position.y = Math.max(0.40, standY * wStand + crouchY * wCrouch + slideY * wSlide + jumpY * wAir + squashOffset);
      pelvis.rotation.x = (-0.16 * wCrouch) + (-0.42 * wSlide) + (vyFactor * 0.12 * wAir) + (landSquash * 0.18);
      pelvis.rotation.z = 0.14 * wSlide;
      headPivot.rotation.x = (0.14 * wCrouch) + (0.36 * wSlide) - (landSquash * 0.12);

      armL.rotation.z = -0.25 - wAir * 0.18;
      armR.rotation.z = wAir * 0.14;

      if (firingPulse > 0) {
        firingPulse = Math.max(0, firingPulse - dt * 14);
        if (curGunObj && curGunObj.flash && firingPulse <= 0.35) curGunObj.flash.visible = false;
      }
    }
  };
}

const TEST_WEAPON_POOL = [
  { id: 3, name: 'M4A1 TACTICAL', cat: 'ar', r: 'R' },
  { id: 7, name: 'AK-47 GOLD DRAGON', cat: 'ar', r: 'M' },
  { id: 0, name: 'VECTOR SMG', cat: 'smg', r: 'R' },
  { id: 5, name: 'L96A1 SNIPER', cat: 'sniper', r: 'L' },
  { id: 1, name: 'M870 SHOTGUN', cat: 'shotgun', r: 'E' },
  { id: 6, name: 'RPG-7 LAUNCHER', cat: 'launcher', r: 'L' }
];

function getWeaponSpec(gunIdOrDef) {
  const def = typeof gunIdOrDef === 'object' && gunIdOrDef !== null ? gunIdOrDef : null;
  const gid = def ? def.id : gunIdOrDef;
  const baseItem = (typeof ITEMS !== 'undefined' && ITEMS[gid]) ? ITEMS[gid] : null;
  const it = def || baseItem || TEST_WEAPON_POOL[0];
  const cat = it.cat || 'ar';
  const r = it.r || 'R';
  const tierMul = { C: 1.0, R: 1.15, E: 1.3, L: 1.48, M: 1.7 }[r] || 1.0;
  const base = {
    smg:      { dmg: 22, rate: 105, mag: 36, res: 144, relMs: 1250, zoom: 44, spread: 0.025, pellets: 1, speed: 92, drop: 2.2 },
    ar:       { dmg: 30, rate: 135, mag: 30, res: 120, relMs: 1450, zoom: 38, spread: 0.014, pellets: 1, speed: 115, drop: 3.0 },
    sniper:   { dmg: 98, rate: 520, mag: 5,  res: 25,  relMs: 1750, zoom: 16, spread: 0.001, pellets: 1, speed: 185, drop: 1.2 },
    shotgun:  { dmg: 19, rate: 480, mag: 8,  res: 32,  relMs: 1650, zoom: 48, spread: 0.068, pellets: 7, speed: 78,  drop: 7.5 },
    launcher: { dmg: 135,rate: 850, mag: 3,  res: 12,  relMs: 1950, zoom: 34, spread: 0.006, pellets: 1, speed: 62,  drop: 4.5, explosive: true }
  }[cat] || { dmg: 30, rate: 135, mag: 30, res: 120, relMs: 1450, zoom: 38, spread: 0.014, pellets: 1, speed: 115, drop: 3.0 };
  return Object.assign({}, base, { id: it.id, name: it.name, rarity: r, cat, dmg: Math.round(base.dmg * tierMul) });
}

let AR_LOADING = false;
function startMatch(squadId = null) {
  if (AR || AR_LOADING) return;
  if (typeof THREE === 'undefined') return toast('3D Engine unavailable on this browser.');
  AR_LOADING = true;
  if (typeof SFX !== 'undefined' && SFX.deploy) SFX.deploy();
  const mapCfg = (typeof activeMap === 'function') ? activeMap() : { id: 'firing_range', name: 'FIRING RANGE', sky: 0x6ea8dc };
  setTimeout(() => {
    try {
      launchArenaWorld(squadId, mapCfg);
    } catch (err) {
      console.error('Arena launch error:', err);
      toast('⚠️ Failed to start 3D Arena');
    } finally {
      AR_LOADING = false;
    }
  }, 60);
}

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
    target.requestFullscreen().catch(() => { if (arenaEl) arenaEl.classList.toggle('mob-fs'); });
  } else if (target.webkitRequestFullscreen) {
    target.webkitRequestFullscreen();
  } else if (arenaEl) {
    arenaEl.classList.toggle('mob-fs');
  }
}

function launchArenaWorld(squadId, mapCfg) {
  const isPC = isPCDevice();
  const safeS = (typeof S === 'object' && S) ? S : { eq: { gun: 3, skin: -1 }, cfg: { gfx: 'High', sens: 100 }, coins: 0, cp: 0, wins: 0 };
  if (!safeS.eq) safeS.eq = { gun: 3, skin: -1 };
  if (!safeS.cfg) safeS.cfg = { gfx: 'High', sens: 100 };

  const primaryBase = getWeaponSpec(safeS.eq.gun >= 0 ? safeS.eq.gun : 7);
  const extraSpecs = TEST_WEAPON_POOL.filter(w => w.id !== primaryBase.id).map(getWeaponSpec);
  const weapons = [primaryBase, ...extraSpecs];
  const wState = weapons.map(w => ({ ammo: w.mag, reserve: w.res }));
  let wIdx = 0;

  const lobbyUi = document.getElementById('ui');
  if (lobbyUi) lobbyUi.style.display = 'none';
  const lobbyGl = document.getElementById('gl');
  if (lobbyGl) lobbyGl.style.display = 'none';

  const skyHex = resolveSkyHex(mapCfg.sky, mapCfg.id);
  const arenaEl = document.createElement('div');
  arenaEl.id = 'arena';
  arenaEl.style.background = '#' + skyHex.toString(16).padStart(6, '0');

  const defaultHudPositions = {
    minimap: { x: 2, y: 18, s: 100, o: 95 },
    joy:     { x: 4, y: 68, s: 100, o: 95 },
    fire:    { x: 83, y: 62, s: 100, o: 95 },
    scope:   { x: 74, y: 48, s: 90, o: 92 },
    jump:    { x: 88, y: 44, s: 90, o: 92 },
    crouch:  { x: 88, y: 29, s: 90, o: 92 },
    reload:  { x: 75, y: 76, s: 90, o: 92 },
    grenade: { x: 65, y: 64, s: 88, o: 92 },
    wswitch: { x: 65, y: 40, s: 88, o: 92 },
    cam:     { x: 75, y: 24, s: 88, o: 92 },
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
        <span>PC CONTROLS</span>
        <button class="pk-close" id="ar-pckeys-close" title="Hide Controls">✕</button>
      </div>
      <div><span class="kcap">W A S D</span> Move · <span class="kcap">SHIFT</span> Sprint · <span class="kcap">SPACE</span> Jump</div>
      <div><span class="kcap">C</span> Tap: Slide/Crouch · <span class="kcap">CTRL</span> Crouch</div>
      <div><span class="kcap">LMB</span> Fire · <span class="kcap">RMB</span> ADS · <span class="kcap">WHEEL</span> Gun</div>
      <div><span class="kcap">R</span> Reload · <span class="kcap">G</span> Frag · <span class="kcap">V</span> FPP/TPP · <span class="kcap">ESC</span> Aim</div>
    </div>` : '';

  arenaEl.innerHTML = `
    <canvas id="acv"></canvas>
    <div class="world-overlay" id="ar-world-ov"></div>
    <div class="slide-fx" id="ar-slidefx"></div>
    <div class="dmg-fx" id="ar-dmgfx"></div>
    <div class="scope-ov" id="ar-scope"></div>
    <div class="xhair" id="ar-xhair"></div>
    <div class="hitmark" id="ar-hitmark"></div>
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
            <span id="ar-kills" style="font-size:.76rem;color:#5be58a">KILLS: 0</span>
          </div>
        </div>
        <div class="aright">
          <button class="abtn-top set-btn" id="ar-set-btn" title="Battle Settings">⚙️</button>
          <button class="abtn-top fs-btn" id="ar-fs-btn" title="Toggle Fullscreen">⛶</button>
          <button class="abtn-top exit" onclick="confirmExitMatch()">EXIT</button>
        </div>
      </div>

      <div class="bset-panel" id="ar-bset" style="display:none">
        <div class="bs-hdr">
          <b>BATTLE SETTINGS</b>
          <button class="ld-close" id="ar-bs-close">✕</button>
        </div>
        <div class="bs-row">
          <label>SENSITIVITY <b id="bs-sens-v">${safeS.cfg.sens || 100}%</b></label>
          <input type="range" id="bs-sens" min="30" max="220" value="${safeS.cfg.sens || 100}">
        </div>
        <div class="bs-row">
          <label>GRAPHICS</label>
          <div class="bs-opts" id="bs-gfx">
            ${['Low', 'Medium', 'High'].map(g => `<button class="bs-opt${(safeS.cfg.gfx || 'High') === g ? ' on' : ''}" data-g="${g}">${g}</button>`).join('')}
          </div>
        </div>
        <div class="bs-row">
          <label>SOUND FX</label>
          <button class="bs-opt${(typeof SFX === 'undefined' || !SFX.muted) ? ' on' : ''}" id="bs-sfx">${(typeof SFX === 'undefined' || !SFX.muted) ? 'ON' : 'MUTED'}</button>
        </div>
      </div>

      <div class="sq-bhud hud-movable" id="ar-sqhud" style="${hStyle('sqhud', false)}"></div>
      ${pcKeysHtml}
      <div class="mfeed" id="ar-feed">${isPC ? 'WHEEL: ALL GUNS · SNIPER: HOLD LMB TO SCOPE & RELEASE TO FIRE' : 'MAP: ' + esc(mapCfg.name)}</div>

      <div class="hctrl" id="hc-minimap" style="${hStyle('minimap')}"><canvas id="radar" width="84" height="84"></canvas></div>
      <div class="hctrl joy" id="hc-joy" style="${hStyle('joy')}"><div class="knob" id="hc-knob"></div></div>
      <button class="hctrl tac-btn fire" id="hc-fire" style="${hStyle('fire')}">FIRE</button>
      <button class="hctrl tac-btn" id="hc-scope" style="${hStyle('scope')}">ADS</button>
      <button class="hctrl tac-btn" id="hc-jump" style="${hStyle('jump')}">JUMP</button>
      <button class="hctrl tac-btn" id="hc-crouch" style="${hStyle('crouch')}">CROUCH</button>
      <button class="hctrl tac-btn" id="hc-reload" style="${hStyle('reload')}">RELOAD</button>
      <button class="hctrl tac-btn" id="hc-grenade" style="${hStyle('grenade')}">FRAG</button>
      <button class="hctrl tac-btn" id="hc-wswitch" style="${hStyle('wswitch')}">GUN</button>
      <button class="hctrl tac-btn" id="hc-cam" style="${hStyle('cam')}">TPP/FPP</button>
    </div>
  `;
  document.body.appendChild(arenaEl);

  const acv = document.getElementById('acv');
  const worldOv = document.getElementById('ar-world-ov');
  const feedEl = document.getElementById('ar-feed');
  const hpTxt = document.getElementById('ar-hp-txt');
  const hpBar = document.getElementById('ar-hp-bar');
  const wNameEl = document.getElementById('ar-wname');
  const ammoEl = document.getElementById('ar-ammo');
  const killsEl = document.getElementById('ar-kills');
  const scopeOv = document.getElementById('ar-scope');
  const slideFxEl = document.getElementById('ar-slidefx');
  const dmgFxEl = document.getElementById('ar-dmgfx');
  const xhairEl = document.getElementById('ar-xhair');
  const hitmarkEl = document.getElementById('ar-hitmark');
  const radarCv = document.getElementById('radar');
  const radarCtx = radarCv ? radarCv.getContext('2d') : null;
  const bsetEl = document.getElementById('ar-bset');

  function setFeed(msg) {
    if (feedEl) feedEl.textContent = msg;
  }

  let hitmarkTimer = null;
  function flashHitmarker(isKill = false) {
    if (!hitmarkEl) return;
    hitmarkEl.classList.toggle('kill', isKill);
    hitmarkEl.classList.add('on');
    clearTimeout(hitmarkTimer);
    hitmarkTimer = setTimeout(() => hitmarkEl.classList.remove('on', 'kill'), isKill ? 240 : 130);
  }

  // Floating hit numbers state
  const hitPopups = [];
  function spawnHitNumber(worldPos, dmg, isKill = false) {
    if (!worldOv) return;
    const el = document.createElement('div');
    el.className = 'hit-num' + (isKill ? ' crit' : '');
    el.textContent = isKill ? `-${dmg} KO` : `-${dmg}`;
    worldOv.appendChild(el);
    hitPopups.push({
      el,
      pos: worldPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.45, 0.2, (Math.random() - 0.5) * 0.45)),
      rise: 0,
      life: 0.72,
      maxLife: 0.72
    });
  }

  let dmgFlash = 0;

  const renderer = new THREE.WebGLRenderer({ canvas: acv, antialias: safeS.cfg.gfx !== 'Low', alpha: false });
  const initQ = safeS.cfg.gfx || 'High';
  renderer.setPixelRatio(initQ === 'Low' ? 0.9 : initQ === 'Medium' ? 1.25 : Math.min(window.devicePixelRatio || 1, 2.0));
  renderer.setClearColor(skyHex, 1);
  if (THREE.ACESFilmicToneMapping) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
  }
  renderer.shadowMap.enabled = initQ !== 'Low';
  if (renderer.shadowMap.enabled && THREE.PCFSoftShadowMap) {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(skyHex);
  scene.fog = new THREE.Fog(skyHex, 38, 120);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.08, 150);
  scene.add(camera);

  const fppVm = createFppViewmodel();
  fppVm.setGun(weapons[0].id);
  camera.add(fppVm.root);

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  scene.add(new THREE.HemisphereLight(0xf0f9ff, 0x3f4e63, 0.82));
  const sun = new THREE.DirectionalLight(0xfffbeb, 1.25);
  sun.position.set(24, 42, 20);
  sun.castShadow = initQ !== 'Low';
  sun.shadow.mapSize.set(initQ === 'High' ? 2048 : 1024, initQ === 'High' ? 2048 : 1024);
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45;
  sun.shadow.camera.bottom = -45;
  scene.add(sun);

  const tex = getArenaTextures(mapCfg.id);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), new THREE.MeshStandardMaterial({ map: tex.groundTex, roughness: 0.85, metalness: 0.05 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const roadMat = new THREE.MeshStandardMaterial({ map: tex.roadTex, roughness: 0.72, metalness: 0.12 });
  const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 98), roadMat);
  roadNS.rotation.x = -Math.PI / 2;
  roadNS.position.y = 0.02;
  roadNS.receiveShadow = true;
  scene.add(roadNS);

  const colliders = [];
  function addCollider(x, z, w, d, maxY) {
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, maxY });
  }
  function addBox(x, y, z, w, h, d, matOpts, solid = true) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.65, metalness: 0.15 }, matOpts))
    );
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (solid) addCollider(x, z, w, d, y + h);
    return mesh;
  }

  function addPropGroup(grp, x, y, z, w, h, d, solid = true) {
    grp.position.set(x, y, z);
    grp.traverse(obj => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    scene.add(grp);
    if (solid) addCollider(x, z, w, d, y + h);
    return grp;
  }

  addBox(0, 0, -48, 98, 4.8, 2.2, { map: tex.wallTex });
  addBox(0, 0, 48, 98, 4.8, 2.2, { map: tex.wallTex });
  addBox(-48, 0, 0, 2.2, 4.8, 98, { map: tex.wallTex });
  addBox(48, 0, 0, 2.2, 4.8, 98, { map: tex.wallTex });

  addPropGroup(createDetailedContainer(2.9, 2.6, 6.4, 0xdc2626, tex.contTex), -9.5, 0, -4.5, 2.9, 2.6, 6.4);
  addPropGroup(createDetailedContainer(2.9, 2.6, 6.4, 0x2563eb, tex.contTex), 9.5, 0, 4.5, 2.9, 2.6, 6.4);
  addPropGroup(createSandbagBarricade(4.4, 1.0, 0.9, tex.sandbagTex), 0, 0, -11.5, 4.4, 1.0, 0.9);
  addPropGroup(createSandbagBarricade(4.4, 1.0, 0.9, tex.sandbagTex), 0, 0, 11.5, 4.4, 1.0, 0.9);
  [[-6.5, 8], [6.5, -8]].forEach(([cx, cz]) => addPropGroup(createDetailedCrate(1.4, tex.crateTex), cx, 0, cz, 1.4, 1.4, 1.4));

  [[-36, -36], [36, -36], [-36, 36], [36, 36]].forEach(([tx, tz]) => {
    const tower = createFloodlightTower(tx, tz);
    tower.traverse(obj => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
    scene.add(tower);
  });

  let px = 0, py = 0, pz = 28, vy = 0;
  let yaw = 0, pitch = 0.04, charYaw = 0, curAnimState = 'Idle';
  let hp = 100, maxHp = 100, kills = 0;
  let scoped = false, fpp = false, reloading = false, lastShotTs = 0;
  let crouching = false, crouchLerp = 0, slideTimer = 0, slideLerp = 0, slideDirX = 0, slideDirZ = 0;
  let landSquash = 0, wasAirborne = false;
  let pcAimMode = false, pcFiring = false, touchFiring = false;
  let joyX = 0, joyY = 0;
  const keysDown = {};

  const playerAv = makeSoldierAvatar({ armorCol: 0x2563eb, gunId: weapons[0].id });
  scene.add(playerAv.grp);

  const bullets = [];
  const tracers = [];
  const grenades = [];
  const explosions = [];

  function spawnTracer(from, to, col = 0xfef08a) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), new THREE.LineBasicMaterial({ color: col }));
    scene.add(line);
    tracers.push({ line, life: 0.07 });
  }

  function triggerExplosion(pos, radius = 7.2, maxDmg = 135) {
    GUN_AUDIO.playExplosion();
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff7b00, transparent: true, opacity: 0.9 })
    );
    sphere.position.copy(pos);
    scene.add(sphere);
    explosions.push({ mesh: sphere, life: 0.34, maxLife: 0.34, maxScale: radius * 0.65 });

    bots.forEach(b => {
      if (!b.alive) return;
      const dist = Math.hypot(b.x - pos.x, b.z - pos.z);
      if (dist < radius) {
        const falloff = Math.max(0.35, 1 - dist / radius);
        damageBot(b, Math.round(maxDmg * falloff), new THREE.Vector3(b.x, b.y + 1.45, b.z));
      }
    });
  }

  const botSpawns = [[-24, -28], [0, -32], [24, -28], [-26, 4], [26, -4]];
  const bots = botSpawns.map((sp, i) => {
    const av = makeSoldierAvatar({ armorCol: 0xdc2626, gunId: i % 2 === 0 ? 7 : 3, tint: 0xff2a55 });
    av.grp.position.set(sp[0], 0, sp[1]);
    scene.add(av.grp);

    let hpEl = null, hpFill = null, hpLabel = null;
    if (worldOv) {
      hpEl = document.createElement('div');
      hpEl.className = 'enemy-hp-tag';
      hpEl.innerHTML = `<div class="ehp-bar"><i></i></div><span>100</span>`;
      worldOv.appendChild(hpEl);
      hpFill = hpEl.querySelector('.ehp-bar > i');
      hpLabel = hpEl.querySelector('span');
    }

    return {
      id: i, av, hpEl, hpFill, hpLabel,
      x: sp[0], y: 0, z: sp[1], rotY: 0, hp: 100, maxHp: 100,
      alive: true, dying: false, deathProg: 0, respawnT: 0,
      dir: Math.random() * Math.PI * 2, strafeT: 1.5, fireCd: 1.6 + i * 0.35
    };
  });

  function syncEnemyHealthBar(b) {
    if (!b.hpEl) return;
    if (!b.alive || b.hp <= 0) {
      b.hpEl.style.display = 'none';
      return;
    }
    const worldPt = new THREE.Vector3(b.x, b.y + 2.18, b.z);
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const toBot = worldPt.clone().sub(camera.position);
    if (toBot.dot(camDir) <= 0.1 || toBot.length() > 52) {
      b.hpEl.style.display = 'none';
      return;
    }
    const proj = worldPt.project(camera);
    const vw = renderer.domElement.clientWidth || window.innerWidth;
    const vh = renderer.domElement.clientHeight || window.innerHeight;
    const sx = (proj.x * 0.5 + 0.5) * vw;
    const sy = (-proj.y * 0.5 + 0.5) * vh;
    b.hpEl.style.display = 'flex';
    b.hpEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
    const pct = Math.max(0, Math.min(100, (b.hp / b.maxHp) * 100));
    if (b.hpFill) b.hpFill.style.width = pct + '%';
    if (b.hpLabel) b.hpLabel.textContent = Math.max(0, Math.ceil(b.hp));
  }

  function updateHitPopups(dt) {
    const vw = renderer.domElement.clientWidth || window.innerWidth;
    const vh = renderer.domElement.clientHeight || window.innerHeight;
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);

    for (let i = hitPopups.length - 1; i >= 0; i--) {
      const p = hitPopups[i];
      p.life -= dt;
      p.rise += dt * 0.95;
      if (p.life <= 0) {
        p.el.remove();
        hitPopups.splice(i, 1);
        continue;
      }
      const pt = p.pos.clone().add(new THREE.Vector3(0, p.rise, 0));
      const toPt = pt.clone().sub(camera.position);
      if (toPt.dot(camDir) <= 0.1) {
        p.el.style.opacity = '0';
        continue;
      }
      const proj = pt.project(camera);
      const sx = (proj.x * 0.5 + 0.5) * vw;
      const sy = (-proj.y * 0.5 + 0.5) * vh;
      const alpha = Math.min(1, p.life / (p.maxLife * 0.45));
      p.el.style.opacity = alpha.toFixed(2);
      p.el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%) scale(${(0.9 + (1 - p.life / p.maxLife) * 0.2).toFixed(2)})`;
    }
  }

  function updateHud() {
    const w = weapons[wIdx], st = wState[wIdx];
    if (hpTxt) hpTxt.textContent = `HP ${Math.max(0, Math.ceil(hp))} / ${maxHp}`;
    if (hpBar) hpBar.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
    if (wNameEl) wNameEl.textContent = `${w.name} [${w.cat.toUpperCase()}]`;
    if (ammoEl) ammoEl.textContent = reloading ? 'RELOADING...' : `${st.ammo} / ${st.reserve}`;
    if (killsEl) killsEl.textContent = `KILLS: ${kills}`;
    const showBlackScope = scoped && (!fpp || w.cat === 'sniper' || w.cat === 'launcher');
    if (scopeOv) scopeOv.classList.toggle('on', showBlackScope);
    if (xhairEl) xhairEl.style.opacity = (fpp && scoped && !showBlackScope) ? '0' : '1';
    const scBtn = document.getElementById('hc-scope');
    if (scBtn) scBtn.classList.toggle('scoped', scoped);
    const crBtn = document.getElementById('hc-crouch');
    if (crBtn) crBtn.classList.toggle('scoped', crouching || slideTimer > 0);
  }

  function toggleScope(forceVal) {
    scoped = typeof forceVal === 'boolean' ? forceVal : !scoped;
    updateHud();
  }

  function toggleCam() {
    fpp = !fpp;
    updateHud();
    setFeed(fpp ? 'FIRST-PERSON VIEW (FPP)' : 'THIRD-PERSON VIEW (TPP)');
  }

  function switchWeapon(forceIdx) {
    if (reloading) return;
    scoped = false;
    wIdx = typeof forceIdx === 'number' ? forceIdx : (wIdx + 1) % weapons.length;
    playerAv.setGun(weapons[wIdx].id);
    fppVm.setGun(weapons[wIdx].id);
    updateHud();
    setFeed(`[${wIdx + 1}/${weapons.length}] ${weapons[wIdx].name}`);
  }

  function reloadWeapon() {
    const w = weapons[wIdx], st = wState[wIdx];
    if (reloading || st.ammo >= w.mag || st.reserve <= 0) return;
    reloading = true;
    if (scoped) toggleScope(false);
    GUN_AUDIO.playReload(w.cat);
    updateHud();
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
    if (isTap && isMoving && py <= 0.05 && slideTimer <= 0) {
      crouching = false;
      slideTimer = 0.72;
      slideDirX = -Math.sin(yaw);
      slideDirZ = -Math.cos(yaw);
      setFeed('TACTICAL SLIDE');
    } else if (isTap) {
      crouching = !crouching;
      setFeed(crouching ? 'CROUCH STANCE' : 'STANDING STANCE');
    } else {
      crouching = true;
    }
    updateHud();
  }

  function throwGrenade() {
    const dir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch) + 0.35, -Math.cos(yaw) * Math.cos(pitch)).normalize();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), new THREE.MeshLambertMaterial({ color: 0x3f6212, emissive: 0xff2a55, emissiveIntensity: 0.45 }));
    mesh.position.set(px, py + 1.45, pz);
    mesh.castShadow = true;
    scene.add(mesh);
    grenades.push({ mesh, vx: dir.x * 18, vy: dir.y * 14, vz: dir.z * 18, fuse: 1.7 });
  }

  function doJump() {
    if (py <= getFloorHeightAt(px, pz) + 0.04) {
      slideTimer = 0;
      crouching = false;
      landSquash = 0;
      vy = 7.8;
      updateHud();
    }
  }

  function damageBot(b, amount, hitPos = null) {
    if (!b.alive || b.dying) return;
    b.hp -= amount;
    const isKill = b.hp <= 0;
    spawnHitNumber(hitPos || new THREE.Vector3(b.x, b.y + 1.4, b.z), amount, isKill);
    if (isKill) {
      b.alive = false;
      b.dying = true;
      b.deathProg = 0;
      b.respawnT = 4.0;
      kills++;
      flashHitmarker(true);
      GUN_AUDIO.playHitmarker(true);
      updateHud();
      setFeed('ENEMY ELIMINATED');
    } else {
      flashHitmarker(false);
      GUN_AUDIO.playHitmarker(false);
    }
    syncEnemyHealthBar(b);
  }

  function fireWeapon() {
    if (!AR || AR.paused || reloading) return;
    const w = weapons[wIdx], st = wState[wIdx];
    const nowMs = performance.now();
    if (nowMs - lastShotTs < w.rate) return;
    if (st.ammo <= 0) { reloadWeapon(); return; }
    lastShotTs = nowMs;
    st.ammo--;
    GUN_AUDIO.playShot(w.cat);
    playerAv.triggerMuzzle();
    fppVm.triggerRecoil();
    updateHud();

    const eyeH = 1.62 - crouchLerp * 0.36 - slideLerp * 0.52;
    const origin = new THREE.Vector3(px, py + eyeH, pz);
    const baseDir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).normalize();

    for (let p = 0; p < w.pellets; p++) {
      const sp = scoped ? w.spread * 0.15 : w.spread;
      const dir = baseDir.clone().add(new THREE.Vector3((Math.random() - 0.5) * sp, (Math.random() - 0.5) * sp, (Math.random() - 0.5) * sp)).normalize();
      const startPos = origin.clone().addScaledVector(dir, 0.7);
      const bMesh = new THREE.Mesh(new THREE.SphereGeometry(w.explosive ? 0.14 : 0.045, 8, 8), new THREE.MeshBasicMaterial({ color: w.explosive ? 0xff7b00 : 0xfef08a }));
      bMesh.position.copy(startPos);
      scene.add(bMesh);
      bullets.push({ mesh: bMesh, pos: startPos, prevPos: startPos.clone(), vel: dir.clone().multiplyScalar(w.speed), gravity: w.drop || 2.5, dmg: w.dmg, explosive: !!w.explosive, life: 1.35, fromBot: false });
    }
  }

  const fsBtn = document.getElementById('ar-fs-btn');
  if (fsBtn) fsBtn.addEventListener('click', e => { e.stopPropagation(); toggleArenaFullscreen(); });

  const setBtn = document.getElementById('ar-set-btn');
  const bsClose = document.getElementById('ar-bs-close');
  const bsSens = document.getElementById('bs-sens');
  const bsSensV = document.getElementById('bs-sens-v');
  const bsSfx = document.getElementById('bs-sfx');

  function toggleBattleSettings(forceOpen) {
    if (!bsetEl) return;
    const next = typeof forceOpen === 'boolean' ? forceOpen : (bsetEl.style.display === 'none');
    bsetEl.style.display = next ? 'block' : 'none';
    if (next && isPC && document.pointerLockElement === acv) {
      try { document.exitPointerLock(); } catch (e) {}
    } else if (!next && isPC && AR && !AR.paused) {
      enterPcAimMode();
    }
  }

  if (setBtn) setBtn.addEventListener('click', e => { e.stopPropagation(); toggleBattleSettings(); });
  if (bsClose) bsClose.addEventListener('click', e => { e.stopPropagation(); toggleBattleSettings(false); });
  if (bsSens) {
    bsSens.addEventListener('input', () => {
      safeS.cfg.sens = +bsSens.value;
      if (bsSensV) bsSensV.textContent = safeS.cfg.sens + '%';
      if (typeof save === 'function') save();
    });
  }
  if (bsetEl) {
    bsetEl.querySelectorAll('#bs-gfx .bs-opt').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const g = btn.dataset.g;
        safeS.cfg.gfx = g;
        renderer.setPixelRatio(g === 'Low' ? 0.9 : g === 'Medium' ? 1.25 : Math.min(window.devicePixelRatio || 1, 2.0));
        const shOn = g !== 'Low';
        renderer.shadowMap.enabled = shOn;
        sun.castShadow = shOn;
        sun.shadow.mapSize.set(g === 'High' ? 2048 : 1024, g === 'High' ? 2048 : 1024);
        bsetEl.querySelectorAll('#bs-gfx .bs-opt').forEach(x => x.classList.toggle('on', x === btn));
        if (typeof save === 'function') save();
      });
    });
  }
  if (bsSfx) {
    bsSfx.addEventListener('click', e => {
      e.stopPropagation();
      if (typeof SFX !== 'undefined') {
        SFX.muted = !SFX.muted;
        bsSfx.textContent = SFX.muted ? 'MUTED' : 'ON';
        bsSfx.classList.toggle('on', !SFX.muted);
      }
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

  function enterPcAimMode() {
    if (!isPC || !AR || AR.paused) return;
    if (bsetEl && bsetEl.style.display !== 'none') return;
    pcAimMode = true;
    try {
      const p = acv.requestPointerLock && acv.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }

  function onPointerLockChange() {
    if (!isPC || !AR) return;
    pcAimMode = document.pointerLockElement === acv;
    if (!pcAimMode) pcFiring = false;
  }

  function onPcMouseMove(e) {
    if (!isPC || !AR || AR.paused || document.pointerLockElement !== acv) return;
    const sens = ((safeS.cfg && safeS.cfg.sens) || 100) / 100;
    const aimMul = scoped ? 0.36 : 1.0;
    yaw -= (e.movementX || 0) * 0.0024 * sens * aimMul;
    pitch = Math.max(-1.25, Math.min(1.25, pitch - (e.movementY || 0) * 0.0021 * sens * aimMul));
  }

  function onPcMouseDown(e) {
    if (!isPC || !AR || AR.paused) return;
    if (e.target.closest('button, .modal, .atop, .pc-keys, .bset-panel')) return;
    if (document.pointerLockElement !== acv) { if (e.target === acv) enterPcAimMode(); return; }
    const curCat = weapons[wIdx] && weapons[wIdx].cat;
    if (e.button === 0) {
      pcFiring = true;
      if (curCat === 'sniper' || curCat === 'launcher') toggleScope(true);
      else fireWeapon();
    } else if (e.button === 2) {
      toggleScope();
    }
  }

  function onPcMouseUp(e) {
    if (!isPC || e.button !== 0) return;
    const wasFiring = pcFiring;
    pcFiring = false;
    const curCat = weapons[wIdx] && weapons[wIdx].cat;
    if (wasFiring && AR && !AR.paused && (curCat === 'sniper' || curCat === 'launcher')) {
      fireWeapon();
      toggleScope(false);
    }
  }

  function onPcWheel(e) {
    if (!isPC || !AR || AR.paused) return;
    switchWeapon((wIdx + (e.deltaY > 0 ? 1 : -1) + weapons.length) % weapons.length);
  }

  function onPcKeyDown(e) {
    if (!isPC || !AR || AR.paused) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const wasDown = !!keysDown[e.code];
    keysDown[e.code] = true;
    if (e.code === 'Space') { e.preventDefault(); doJump(); }
    else if (e.code === 'KeyC' && !wasDown) {
      const movingNow = !!(keysDown.KeyW || keysDown.KeyS || keysDown.KeyA || keysDown.KeyD);
      triggerSlideOrCrouch(true, movingNow);
    } else if (e.code === 'ControlLeft' && !wasDown) {
      triggerSlideOrCrouch(true, false);
    } else if (e.code === 'KeyR') reloadWeapon();
    else if (e.code === 'KeyG') throwGrenade();
    else if (e.code === 'KeyQ') switchWeapon();
    else if (e.code === 'KeyV') toggleCam();
  }

  function onPcKeyUp(e) {
    if (!isPC) return;
    keysDown[e.code] = false;
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

    joyEl.addEventListener('pointerdown', e => { e.stopPropagation(); joyPid = e.pointerId; joyEl.setPointerCapture(e.pointerId); });
    joyEl.addEventListener('pointermove', e => {
      if (e.pointerId !== joyPid) return;
      const r = joyEl.getBoundingClientRect();
      const p1 = normPt(e.clientX, e.clientY), p0 = normPt(r.left + r.width / 2, r.top + r.height / 2);
      let dx = p1.x - p0.x, dy = p1.y - p0.y;
      const maxR = 36, dist = Math.hypot(dx, dy);
      if (dist > maxR) { dx = (dx / dist) * maxR; dy = (dy / dist) * maxR; }
      knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
      joyX = dx / maxR;
      joyY = dy / maxR;
    });
    const endJoy = e => {
      if (e.pointerId !== joyPid) return;
      joyPid = null; joyX = 0; joyY = 0; knobEl.style.transform = 'translate(0,0)';
    };
    joyEl.addEventListener('pointerup', endJoy);
    joyEl.addEventListener('pointercancel', endJoy);

    acv.addEventListener('pointerdown', e => {
      if (lookPid !== null) return;
      lookPid = e.pointerId; lookLast = normPt(e.clientX, e.clientY);
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
    const endLook = e => { if (e.pointerId === lookPid) { lookPid = null; lookLast = null; } };
    acv.addEventListener('pointerup', endLook);
    acv.addEventListener('pointercancel', endLook);

    const fBtn = document.getElementById('hc-fire');
    fBtn.addEventListener('pointerdown', e => {
      e.stopPropagation(); touchFiring = true;
      const curCat = weapons[wIdx] && weapons[wIdx].cat;
      if (curCat === 'sniper' || curCat === 'launcher') toggleScope(true);
      else fireWeapon();
    });
    const relTouchFire = () => {
      const wasFiring = touchFiring; touchFiring = false;
      const curCat = weapons[wIdx] && weapons[wIdx].cat;
      if (wasFiring && AR && !AR.paused && (curCat === 'sniper' || curCat === 'launcher')) {
        fireWeapon(); toggleScope(false);
      }
    };
    fBtn.addEventListener('pointerup', relTouchFire);
    fBtn.addEventListener('pointercancel', relTouchFire);

    document.getElementById('hc-scope').addEventListener('pointerdown', e => { e.stopPropagation(); toggleScope(); });
    document.getElementById('hc-jump').addEventListener('pointerdown', e => { e.stopPropagation(); doJump(); });
    document.getElementById('hc-crouch').addEventListener('pointerdown', e => { e.stopPropagation(); triggerSlideOrCrouch(true, Math.hypot(joyX, joyY) > 0.35); });
    document.getElementById('hc-reload').addEventListener('pointerdown', e => { e.stopPropagation(); reloadWeapon(); });
    document.getElementById('hc-grenade').addEventListener('pointerdown', e => { e.stopPropagation(); throwGrenade(); });
    document.getElementById('hc-wswitch').addEventListener('pointerdown', e => { e.stopPropagation(); switchWeapon(); });
    document.getElementById('hc-cam').addEventListener('pointerdown', e => { e.stopPropagation(); toggleCam(); });
  }

  function getFloorHeightAt(x, z, rad = 0.45) {
    let floorY = 0;
    for (const c of colliders) {
      if (x + rad > c.minX && x - rad < c.maxX && z + rad > c.minZ && z - rad < c.maxZ) {
        if (c.maxY <= 1.5 && c.maxY > floorY) floorY = c.maxY;
      }
    }
    return floorY;
  }

  function resolveCollisions(nx, nz, entityY = 0, rad = 0.55) {
    nx = Math.max(-45, Math.min(45, nx));
    nz = Math.max(-45, Math.min(45, nz));
    for (const c of colliders) {
      if (entityY >= c.maxY - 0.12) continue;
      if (nx + rad > c.minX && nx - rad < c.maxX && nz + rad > c.minZ && nz - rad < c.maxZ) {
        const penL = (nx + rad) - c.minX, penR = c.maxX - (nx - rad), penT = (nz + rad) - c.minZ, penB = c.maxZ - (nz - rad);
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

  function drawRadar() {
    if (!radarCtx) return;
    const cx = 42, cy = 42;
    radarCtx.clearRect(0, 0, 84, 84);
    radarCtx.fillStyle = '#060d1ecc';
    radarCtx.beginPath(); radarCtx.arc(cx, cy, 40, 0, Math.PI * 2); radarCtx.fill();
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    radarCtx.fillStyle = '#ff2a55';
    bots.forEach(b => {
      if (!b.alive) return;
      const dx = (b.x - px) * 0.85, dz = (b.z - pz) * 0.85;
      const rx = dx * cosY - dz * sinY, rz = dx * sinY + dz * cosY;
      radarCtx.beginPath();
      radarCtx.arc(cx + Math.max(-35, Math.min(35, rx)), cy + Math.max(-35, Math.min(35, rz)), 3, 0, Math.PI * 2);
      radarCtx.fill();
    });
    radarCtx.fillStyle = '#f5d300';
    radarCtx.beginPath(); radarCtx.arc(cx, cy, 3.5, 0, Math.PI * 2); radarCtx.fill();
  }

  let prevT = performance.now(), rafId = 0;
  function stepAndRender(nowT) {
    const dt = Math.max(0.001, Math.min(0.05, (nowT - prevT) / 1000));
    prevT = nowT;
    if (AR && AR.paused) return;

    let moveF = 0, moveR = 0, sprint = 1;
    if (isPC) {
      if (keysDown.KeyW || keysDown.ArrowUp) moveF += 1;
      if (keysDown.KeyS || keysDown.ArrowDown) moveF -= 1;
      if (keysDown.KeyD || keysDown.ArrowRight) moveR += 1;
      if (keysDown.KeyA || keysDown.ArrowLeft) moveR -= 1;
      if ((keysDown.ShiftLeft || keysDown.ShiftRight) && moveF > 0 && !crouching) sprint = 1.4;
    } else {
      moveF = -joyY;
      moveR = joyX;
    }

    const rawMag = Math.hypot(moveF, moveR);
    const mag = Math.min(1, rawMag);
    if (rawMag > 1) { moveF /= rawMag; moveR /= rawMag; }

    if (!isPC) {
      const crBtn = document.getElementById('hc-crouch');
      if (crBtn) {
        const wantSlide = mag > 0.35 && slideTimer <= 0 && !crouching;
        if (crBtn.textContent !== (wantSlide ? 'SLIDE' : 'CROUCH')) {
          crBtn.textContent = wantSlide ? 'SLIDE' : 'CROUCH';
        }
      }
    }

    crouchLerp += ((crouching ? 1 : 0) - crouchLerp) * Math.min(1, dt * 14);
    if (slideTimer > 0) {
      slideTimer = Math.max(0, slideTimer - dt);
      slideLerp += (1 - slideLerp) * Math.min(1, dt * 18);
      if (slideTimer === 0) updateHud();
    } else {
      slideLerp += (0 - slideLerp) * Math.min(1, dt * 12);
    }
    if (slideFxEl) slideFxEl.style.opacity = (slideLerp * 0.8).toFixed(2);
    if (dmgFlash > 0) {
      dmgFlash = Math.max(0, dmgFlash - dt * 2.2);
      if (dmgFxEl) dmgFxEl.style.opacity = dmgFlash.toFixed(2);
    }

    let stepX = 0, stepZ = 0;
    if (slideTimer > 0) {
      const sp = 13.5 * (0.45 + 0.55 * (slideTimer / 0.72));
      stepX = slideDirX * sp * dt;
      stepZ = slideDirZ * sp * dt;
    } else {
      const sp = (scoped ? 4.4 : 8.0) * sprint * (crouching ? 0.58 : 1);
      stepX = (-Math.sin(yaw) * moveF + Math.cos(yaw) * moveR) * sp * dt;
      stepZ = (-Math.cos(yaw) * moveF - Math.sin(yaw) * moveR) * sp * dt;
    }

    const colPos = resolveCollisions(px + stepX, pz + stepZ, py);
    px = colPos.x; pz = colPos.z;
    const floorY = getFloorHeightAt(px, pz);
    const prevVy = vy;
    vy -= 21 * dt;
    py += vy * dt;

    const isAirborne = py > floorY + 0.03;
    if (py <= floorY) {
      if (wasAirborne && prevVy < -3.5) {
        landSquash = Math.min(1, Math.abs(prevVy) / 10);
      }
      py = floorY;
      vy = 0;
    }
    wasAirborne = isAirborne;
    if (landSquash > 0) {
      landSquash = Math.max(0, landSquash - dt * 5.2);
    }

    const airFactor = isAirborne ? 1 : 0;
    const vNorm = Math.max(-1, Math.min(1, vy / 8));

    charYaw += shortestAngleDiff(charYaw, yaw) * Math.min(1, dt * 15);
    curAnimState = isAirborne ? (vy > 0 ? 'Jump' : 'Fall') : (mag > 0.5 ? 'Run' : mag > 0.08 ? 'Walk' : 'Idle');
    playerAv.grp.position.set(px, py, pz);
    playerAv.grp.rotation.y = charYaw;
    playerAv.setAnim(curAnimState, sprint);
    playerAv.setAimPitch(pitch);
    playerAv.setStance(crouchLerp, slideLerp, airFactor, landSquash, vNorm);
    playerAv.update(dt);

    const curW = weapons[wIdx];
    const isHoldToScope = curW && (curW.cat === 'sniper' || curW.cat === 'launcher');
    if (!isHoldToScope && ((isPC && pcAimMode && pcFiring) || (!isPC && touchFiring))) {
      fireWeapon();
    }

    const targetFov = scoped ? (curW.zoom || 36) : (slideTimer > 0 ? 67 : 62);
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 16);
      camera.updateProjectionMatrix();
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const bl = bullets[i];
      bl.life -= dt;
      bl.prevPos.copy(bl.pos);
      bl.vel.y -= bl.gravity * dt;
      bl.pos.addScaledVector(bl.vel, dt);
      bl.mesh.position.copy(bl.pos);

      let hit = bl.pos.y <= 0.05;
      if (!hit) {
        for (const c of colliders) {
          if (bl.pos.x >= c.minX && bl.pos.x <= c.maxX && bl.pos.z >= c.minZ && bl.pos.z <= c.maxZ && bl.pos.y <= c.maxY) {
            hit = true; break;
          }
        }
      }
      if (!hit && !bl.fromBot) {
        for (const b of bots) {
          if (!b.alive) continue;
          if (bl.pos.distanceTo(new THREE.Vector3(b.x, b.y + 1.1, b.z)) < 0.72) {
            hit = true;
            if (!bl.explosive) damageBot(b, bl.dmg, bl.pos);
            break;
          }
        }
      }
      if (!hit && bl.fromBot) {
        const curEye = py + (1.15 - crouchLerp * 0.3 - slideLerp * 0.45);
        if (bl.pos.distanceTo(new THREE.Vector3(px, curEye, pz)) < 0.65) {
          hit = true;
          hp = Math.max(0, hp - bl.dmg);
          dmgFlash = 0.75;
          updateHud();
          if (hp <= 0) {
            hp = maxHp;
            px = 0; py = 0; pz = 28; vy = 0;
            updateHud();
            setFeed('RESPAWNED AT BASE');
          }
        }
      }
      if (hit || bl.life <= 0) {
        if (hit && bl.explosive) {
          triggerExplosion(bl.pos, 7.5, bl.dmg);
        }
        spawnTracer(bl.prevPos, bl.pos, bl.fromBot ? 0xff4d6d : 0xfef08a);
        scene.remove(bl.mesh);
        bl.mesh.geometry.dispose();
        bullets.splice(i, 1);
      }
    }

    for (let i = explosions.length - 1; i >= 0; i--) {
      const ex = explosions[i];
      ex.life -= dt;
      const p = 1 - Math.max(0, ex.life / ex.maxLife);
      const sc = 0.4 + p * ex.maxScale;
      ex.mesh.scale.set(sc, sc, sc);
      ex.mesh.material.opacity = (1 - p) * 0.85;
      if (ex.life <= 0) {
        scene.remove(ex.mesh);
        ex.mesh.geometry.dispose();
        ex.mesh.material.dispose();
        explosions.splice(i, 1);
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

    for (let i = grenades.length - 1; i >= 0; i--) {
      const g = grenades[i];
      g.vy -= 22 * dt;
      g.mesh.position.x += g.vx * dt;
      g.mesh.position.y = Math.max(0.16, g.mesh.position.y + g.vy * dt);
      g.mesh.position.z += g.vz * dt;
      g.fuse -= dt;
      if (g.fuse <= 0) {
        triggerExplosion(g.mesh.position, 7.2, 130);
        scene.remove(g.mesh);
        g.mesh.geometry.dispose();
        grenades.splice(i, 1);
      }
    }

    bots.forEach(b => {
      if (!b.alive) {
        if (b.hpEl) b.hpEl.style.display = 'none';
        if (b.dying) {
          b.deathProg = Math.min(1, b.deathProg + dt * 2.1);
          b.av.setDeathFall(b.deathProg);
          if (b.deathProg >= 1) b.dying = false;
        }
        b.respawnT -= dt;
        if (b.respawnT <= 0) {
          const sp = botSpawns[b.id % botSpawns.length];
          b.x = sp[0]; b.z = sp[1]; b.hp = b.maxHp; b.alive = true; b.dying = false; b.deathProg = 0; b.fireCd = 1.5;
          b.av.grp.rotation.set(0, 0, 0);
          b.av.setDeathFall(0);
          b.av.grp.position.set(b.x, 0, b.z);
        }
        return;
      }
      b.strafeT -= dt;
      if (b.strafeT <= 0) {
        b.strafeT = 1.6;
        b.dir = Math.atan2(px - b.x, pz - b.z) + (Math.random() - 0.5) * 1.1;
      }
      const nextBotPos = resolveCollisions(b.x + Math.sin(b.dir) * 2.4 * dt, b.z + Math.cos(b.dir) * 2.4 * dt, 0, 0.52);
      b.x = nextBotPos.x;
      b.z = nextBotPos.z;
      b.rotY = Math.atan2(-(px - b.x), -(pz - b.z));
      b.av.grp.position.set(b.x, 0, b.z);
      b.av.grp.rotation.y = b.rotY;
      b.av.setAnim('Walk', 0.9);
      b.av.setStance(0, 0, 0, 0, 0);
      b.av.update(dt);
      syncEnemyHealthBar(b);

      const distToPlayer = Math.hypot(px - b.x, pz - b.z);
      b.fireCd -= dt;
      if (distToPlayer < 36 && b.fireCd <= 0) {
        b.fireCd = 1.8 + Math.random() * 0.9;
        const aimOrigin = new THREE.Vector3(b.x, 1.35, b.z);
        const targetPt = new THREE.Vector3(px, py + 1.1, pz);
        const aimDir = targetPt.sub(aimOrigin).add(new THREE.Vector3((Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 2.2)).normalize();
        const bMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff4d6d }));
        bMesh.position.copy(aimOrigin);
        scene.add(bMesh);
        b.av.triggerMuzzle();
        bullets.push({ mesh: bMesh, pos: aimOrigin, prevPos: aimOrigin.clone(), vel: aimDir.multiplyScalar(68), gravity: 1.5, dmg: 7, explosive: false, life: 1.2, fromBot: true });
      }
    });

    const eyeH = 1.62 - crouchLerp * 0.36 - slideLerp * 0.52 - landSquash * 0.14;
    if (fpp) {
      playerAv.grp.visible = false;
      camera.position.set(px, py + eyeH, pz);
      camera.lookAt(px - Math.sin(yaw) * Math.cos(pitch) * 10, py + eyeH + Math.sin(pitch) * 10, pz - Math.cos(yaw) * Math.cos(pitch) * 10);
      fppVm.update(dt, { visible: true, scoped, mag, slideLerp, reloading, airborne: isAirborne, landSquash });
    } else {
      playerAv.grp.visible = true;
      fppVm.update(dt, { visible: false, reloading });
      camera.position.set(px + Math.sin(yaw) * 3.5, Math.max(0.5, py + 2.0 - crouchLerp * 0.25 - slideLerp * 0.45 - landSquash * 0.12), pz + Math.cos(yaw) * 3.5);
      camera.lookAt(px - Math.sin(yaw) * 8, py + 1.4 - crouchLerp * 0.25 - slideLerp * 0.35, pz - Math.cos(yaw) * 8);
    }

    drawRadar();
    renderer.render(scene, camera);
    updateHitPopups(dt);
  }

  function loop(nowT) {
    if (!AR) return;
    rafId = requestAnimationFrame(loop);
    stepAndRender(nowT);
  }

  AR = {
    paused: 0,
    cleanup() {
      cancelAnimationFrame(rafId);
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
      if (worldOv) worldOv.innerHTML = '';
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
      const glEl = document.getElementById('gl');
      if (glEl) glEl.style.display = 'block';
      const uiEl = document.getElementById('ui');
      if (uiEl) uiEl.style.display = 'block';
    },
    stats: () => ({ kills, mapName: mapCfg.name })
  };

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
    S.coins += 30 + kills * 12;
    S.cp += kills >= 3 ? 15 : 5;
    if (typeof save === 'function') save();
    toast(`EXTRACTED (${esc(mapName)}) · ${kills} Kills`);
  }
  if (typeof render === 'function') render();
}

function openHudEditor() {
  const keys = [
    ['joy', 'MOVE', 86],
    ['fire', 'FIRE', 64],
    ['scope', 'ADS', 50],
    ['jump', 'JUMP', 50],
    ['crouch', 'CROUCH/SLIDE', 56],
    ['reload', 'RELOAD', 50],
    ['grenade', 'FRAG', 46],
    ['wswitch', 'GUN', 50],
    ['cam', 'CAM', 48],
    ['minimap', 'RADAR', 76]
  ];
  const baseDefaults = {
    minimap: { x: 2, y: 18, s: 100, o: 95 },
    joy:     { x: 4, y: 68, s: 100, o: 95 },
    fire:    { x: 83, y: 62, s: 100, o: 95 },
    scope:   { x: 74, y: 48, s: 90, o: 92 },
    jump:    { x: 88, y: 44, s: 90, o: 92 },
    crouch:  { x: 88, y: 29, s: 90, o: 92 },
    reload:  { x: 75, y: 76, s: 90, o: 92 },
    grenade: { x: 65, y: 64, s: 88, o: 92 },
    wswitch: { x: 65, y: 40, s: 88, o: 92 },
    cam:     { x: 75, y: 24, s: 88, o: 92 }
  };
  const draft = JSON.parse(JSON.stringify(Object.assign({}, baseDefaults, (S.cfg && S.cfg.hud) || {})));
  let sel = 'fire';

  const ed = document.createElement('div');
  ed.className = 'hud-ed';
  ed.innerHTML = `
    <div class="hud-bar">
      <b style="color:var(--y)">CUSTOM HUD</b>
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
    Object.keys(els).forEach(x => els[x].classList.toggle('sel', x === k));
    lbl.textContent = 'Selected: ' + k.toUpperCase();
    sInp.value = draft[sel].s;
    oInp.value = draft[sel].o;
  }

  keys.forEach(([k, name, sz]) => {
    if (!draft[k]) draft[k] = Object.assign({}, baseDefaults[k]);
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
      e.stopPropagation(); selectKey(k); dragging = true; it.setPointerCapture(e.pointerId);
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
    Object.assign(draft, baseDefaults);
    keys.forEach(([k]) => applyItem(k));
    selectKey(sel);
  };
  document.getElementById('he-save').onclick = () => {
    S.cfg.hud = draft;
    save();
    ed.remove();
    toast('Custom HUD saved!');
  };
}
