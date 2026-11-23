/* ===== 3D SOLDIER BUILDER, PLAYABLE 3D BATTLE ARENA (PC + MOBILE) & CUSTOM HUD ===== */
let AR = null;

function isPCDevice() {
  const fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
  return !isMobileUA && ((navigator.maxTouchPoints || 0) === 0 || fine);
}

/* ===== SHARED 3D TACTICAL SOLDIER AVATAR (LOBBY + ARENA BOTS + SQUAD) ===== */
function makeSoldierAvatar(opts = {}) {
  const armorCol = opts.armorCol || 0x2e64b8;
  const tint = opts.tint || null;
  const grp = new THREE.Group();
  let mix = null, actions = {}, activeAct = null, weaponMount = null, curGunMesh = null;
  let lims = null;

  function buildGunMesh(gid) {
    const it = ITEMS[gid] || ITEMS[3];
    const rCol = RAR[it.r] ? RAR[it.r].c : 0x4aa8ff;
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x181c26, roughness: 0.4, metalness: 0.7 });
    const trim = new THREE.MeshStandardMaterial({ color: rCol, roughness: 0.35, metalness: 0.6, emissive: rCol, emissiveIntensity: it.r === 'M' || it.r === 'L' ? 0.35 : 0.1 });

    const len = it.cat === 'sniper' ? 1.05 : it.cat === 'launcher' ? 0.95 : it.cat === 'smg' ? 0.52 : 0.76;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, len), dark);
    body.position.z = len * 0.35;
    g.add(body);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.03, len * 0.72), trim);
    stripe.position.set(0, 0.03, len * 0.35);
    g.add(stripe);

    if (it.cat === 'sniper' || it.cat === 'ar') {
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 8), trim);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.085, len * 0.28);
      g.add(scope);
    }
    if (it.cat !== 'launcher') {
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.18, 0.09), dark);
      mag.position.set(0, -0.1, len * 0.25);
      mag.rotation.x = 0.2;
      g.add(mag);
    }
    return g;
  }

  function setGun(gid) {
    if (!weaponMount) return;
    if (curGunMesh) weaponMount.remove(curGunMesh);
    curGunMesh = buildGunMesh(gid);
    weaponMount.add(curGunMesh);
  }

  function setAnim(name) {
    if (!mix || !actions[name] || activeAct === actions[name]) return;
    const next = actions[name];
    if (activeAct) activeAct.fadeOut(0.18);
    next.reset().fadeIn(0.18).play();
    activeAct = next;
  }

  if (GLTF_CACHE && GLTF_CACHE.soldier && THREE.SkeletonUtils) {
    const model = THREE.SkeletonUtils.clone(GLTF_CACHE.soldier.scene);
    model.scale.setScalar(1.05);
    model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        if (tint && o.material) {
          o.material = o.material.clone();
          o.material.emissive = new THREE.Color(tint);
          o.material.emissiveIntensity = 0.14;
        }
      }
      if (o.isBone && /RightHand/i.test(o.name) && !weaponMount) {
        weaponMount = new THREE.Group();
        weaponMount.position.set(0, 0.06, 0.04);
        weaponMount.rotation.set(Math.PI / 2, 0, 0);
        weaponMount.scale.setScalar(0.95);
        o.add(weaponMount);
      }
    });
    if (!weaponMount) {
      weaponMount = new THREE.Group();
      weaponMount.position.set(0.24, 1.15, 0.25);
      model.add(weaponMount);
    }
    grp.add(model);

    if (GLTF_CACHE.soldier.animations && GLTF_CACHE.soldier.animations.length) {
      mix = new THREE.AnimationMixer(model);
      GLTF_CACHE.soldier.animations.forEach(clip => {
        const key = /run/i.test(clip.name) ? 'Run' : /walk/i.test(clip.name) ? 'Walk' : 'Idle';
        actions[key] = mix.clipAction(clip);
      });
      const startClip = actions.Idle || Object.values(actions)[0];
      if (startClip) {
        startClip.play();
        activeAct = startClip;
      }
    }
  } else {
    // Articulated 3D Tactical Soldier Fallback
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a077, roughness: 0.7 });
    const vestMat = new THREE.MeshStandardMaterial({ color: armorCol, roughness: 0.6, metalness: 0.25 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1b2234, roughness: 0.8 });
    const visorMat = new THREE.MeshStandardMaterial({ color: tint || 0x38bdf8, emissive: tint || 0x38bdf8, emissiveIntensity: 0.45, roughness: 0.2 });

    const body = new THREE.Group();
    grp.add(body);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.62, 0.28), vestMat);
    torso.position.y = 1.12;
    body.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), skinMat);
    head.position.y = 1.62;
    body.add(head);

    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.33), darkMat);
    helmet.position.set(0, 1.72, -0.01);
    body.add(helmet);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.05), visorMat);
    visor.position.set(0, 1.63, 0.14);
    body.add(visor);

    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.54, 0.15), darkMat);
    armL.position.set(-0.33, 1.12, 0.08);
    armL.rotation.x = -0.35;
    body.add(armL);

    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.54, 0.15), darkMat);
    armR.position.set(0.33, 1.14, 0.16);
    armR.rotation.x = -0.85;
    body.add(armR);

    weaponMount = new THREE.Group();
    weaponMount.position.set(0, -0.22, 0.12);
    weaponMount.rotation.x = 0.85;
    armR.add(weaponMount);

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.78, 0.19), darkMat);
    legL.position.set(-0.14, 0.4, 0);
    grp.add(legL);

    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.78, 0.19), darkMat);
    legR.position.set(0.14, 0.4, 0);
    grp.add(legR);

    lims = { body, legL, legR, mode: 'Idle', t: 0 };
    mix = {
      update(dt) {
        lims.t += dt * (lims.mode === 'Run' ? 11 : 2.5);
        if (lims.mode === 'Run') {
          lims.legL.rotation.x = Math.sin(lims.t) * 0.65;
          lims.legR.rotation.x = -Math.sin(lims.t) * 0.65;
          lims.body.position.y = Math.abs(Math.cos(lims.t)) * 0.05;
        } else {
          lims.legL.rotation.x *= 0.85;
          lims.legR.rotation.x *= 0.85;
          lims.body.position.y = Math.sin(lims.t) * 0.02;
        }
      }
    };
  }

  setGun(opts.gunId != null ? opts.gunId : 3);
  return {
    grp,
    mix,
    setGun,
    setAnim: name => {
      if (lims) lims.mode = name;
      setAnim(name);
    },
    weaponMount
  };
}

/* ===== WEAPON CONFIGS ===== */
function getWeaponSpec(gunId) {
  const it = ITEMS[gunId] || ITEMS[3];
  const tierMul = { C: 1.0, R: 1.15, E: 1.3, L: 1.48, M: 1.7 }[it.r] || 1.0;
  const base = {
    smg:      { dmg: 22, rate: 105, mag: 36, res: 144, relMs: 1350, zoom: 54, spread: 0.028, pellets: 1 },
    ar:       { dmg: 30, rate: 145, mag: 30, res: 120, relMs: 1550, zoom: 48, spread: 0.016, pellets: 1 },
    sniper:   { dmg: 88, rate: 650, mag: 5,  res: 25,  relMs: 1900, zoom: 24, spread: 0.002, pellets: 1 },
    shotgun:  { dmg: 17, rate: 520, mag: 8,  res: 32,  relMs: 1750, zoom: 55, spread: 0.075, pellets: 6 },
    launcher: { dmg: 115,rate: 950, mag: 3,  res: 12,  relMs: 2100, zoom: 46, spread: 0.01,  pellets: 1, explosive: true }
  }[it.cat] || { dmg: 30, rate: 145, mag: 30, res: 120, relMs: 1550, zoom: 48, spread: 0.016, pellets: 1 };

  return Object.assign({}, base, {
    id: it.id,
    name: it.name,
    rarity: it.r,
    cat: it.cat,
    dmg: Math.round(base.dmg * tierMul)
  });
}

/* ===== MAIN 3D BATTLE WORLD ENGINE ===== */
function startMatch(squadId = null) {
  if (AR) return;
  if (typeof THREE === 'undefined') return toast('3D Engine unavailable on this browser.');
  SFX.deploy();

  const isPC = isPCDevice();
  const mapCfg = activeMap();
  const primaryId = S.eq.gun >= 0 ? S.eq.gun : 3;
  const secondaryId = primaryId === 0 ? 1 : 0;
  const weapons = [getWeaponSpec(primaryId), getWeaponSpec(secondaryId)];
  const wState = weapons.map(w => ({ ammo: w.mag, reserve: w.res }));
  let wIdx = 0;

  // Build Arena DOM
  const arenaEl = document.createElement('div');
  arenaEl.id = 'arena';
  const hudCfg = Object.assign(defHud(), (S.cfg && S.cfg.hud) || {});
  const hStyle = k => {
    const h = hudCfg[k] || { x: 10, y: 10, s: 100, o: 95 };
    return `left:${h.x}%;top:${h.y}%;transform:scale(${h.s / 100});opacity:${h.o / 100};${isPC && k !== 'minimap' ? 'display:none;' : ''}`;
  };

  arenaEl.innerHTML = `
    <canvas id="acv"></canvas>
    <div class="scope-ov" id="ar-scope"></div>
    <div class="xhair" id="ar-xhair"></div>
    <div class="ahud">
      <div class="atop">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <div class="hpbar">
            <b id="ar-hp-txt">HP 100 / 100</b>
            <div><i id="ar-hp-bar" style="width:100%"></i></div>
          </div>
          <div class="ammo">
            <span id="ar-wname" style="font-size:.76rem;color:var(--y)">${esc(weapons[0].name)}</span>
            <span id="ar-ammo">${wState[0].ammo} / ${wState[0].reserve}</span>
            <span id="ar-kills" style="font-size:.76rem;color:#5be58a">KILLS: 0</span>
          </div>
        </div>
        <div class="aright">
          <button class="abtn-top ${VOICE.micOn ? 'on' : 'muted'}" id="ar-mic" title="Toggle Squad Mic" onclick="VOICE.toggleMic()">${VOICE.micOn ? '🎙️' : '🔇'}</button>
          <button class="abtn-top ${VOICE.spkOn ? 'on' : 'muted'}" id="ar-spk" title="Toggle Squad Speaker" onclick="VOICE.toggleSpk()">${VOICE.spkOn ? '🔊' : '🔈'}</button>
          <button class="abtn-top exit" onclick="confirmExitMatch()">🚪 EXIT</button>
        </div>
      </div>

      <div class="sq-bhud" id="ar-sqhud" style="top:${isPC ? '138px' : '142px'}"></div>
      <div class="mfeed" id="ar-feed">${isPC ? '🎯 AIM LOCKED — [WASD] Move · [SPACE] Jump · [LMB] Fire · [RMB] Scope · [ESC] Cursor' : 'MAP: ' + esc(mapCfg.name) + ' · ELIMINATE HOSTILES'}</div>

      <div class="hctrl" style="${hStyle('minimap')}"><canvas id="radar" width="84" height="84"></canvas></div>
      <div class="hctrl joy" id="hc-joy" style="${hStyle('joy')}"><div class="knob" id="hc-knob"></div></div>
      <button class="hctrl act fire" id="hc-fire" style="${hStyle('fire')}">🔥</button>
      <button class="hctrl act" id="hc-scope" style="${hStyle('scope')}">🎯</button>
      <button class="hctrl act" id="hc-jump" style="${hStyle('jump')}">⬆️</button>
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
  const xhairEl = document.getElementById('ar-xhair');
  const radarCv = document.getElementById('radar');
  const radarCtx = radarCv ? radarCv.getContext('2d') : null;

  function setFeed(msg) {
    if (feedEl) feedEl.textContent = msg;
  }

  // Three.js Scene Setup
  const renderer = new THREE.WebGLRenderer({ canvas: acv, antialias: S.cfg.gfx !== 'Low' });
  const q = S.cfg.gfx || 'High';
  renderer.setPixelRatio(q === 'Low' ? 0.8 : q === 'Medium' ? 1.1 : Math.min(window.devicePixelRatio || 1, 1.8));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(mapCfg.sky);
  scene.fog = new THREE.Fog(mapCfg.sky, 28, 95);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 130);
  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x334155, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.15);
  sun.position.set(22, 36, 18);
  scene.add(sun);

  // Arena Ground & Highways
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: mapCfg.ground, roughness: 0.9 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const roadMat = new THREE.MeshStandardMaterial({ color: mapCfg.road, roughness: 0.85 });
  const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(9, 96), roadMat);
  roadNS.rotation.x = -Math.PI / 2;
  roadNS.position.y = 0.02;
  scene.add(roadNS);

  const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(96, 9), roadMat);
  roadEW.rotation.x = -Math.PI / 2;
  roadEW.position.y = 0.02;
  scene.add(roadEW);

  // Obstacles / Cover / Buildings (AABB list for collision)
  const colliders = [];
  function addBox(x, y, z, w, h, d, col, solid = true) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.75, flatShading: true })
    );
    mesh.position.set(x, y + h / 2, z);
    scene.add(mesh);
    if (solid) {
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, maxY: y + h });
    }
    return mesh;
  }

  // Perimeter Walls
  addBox(0, 0, -47, 96, 4.5, 2, 0x334155);
  addBox(0, 0, 47, 96, 4.5, 2, 0x334155);
  addBox(-47, 0, 0, 2, 4.5, 96, 0x334155);
  addBox(47, 0, 0, 2, 4.5, 96, 0x334155);

  // Tactical Buildings & Containers
  const bCols = mapCfg.id === 'nuketown' ? [0xb45309, 0x1d4ed8, 0x78350f] : mapCfg.id === 'standoff' ? [0x7c2d12, 0x475569, 0x92400e] : [0x1e3a5f, 0x3f6212, 0x475569];
  addBox(-16, 0, -16, 9, 5.2, 8, bCols[0]);
  addBox(16, 0, -16, 9, 5.2, 8, bCols[1]);
  addBox(-16, 0, 16, 9, 5.2, 8, bCols[1]);
  addBox(16, 0, 16, 9, 5.2, 8, bCols[0]);

  // Shipping Containers & Low Cover
  addBox(-9, 0, -4, 2.8, 2.5, 6.2, 0xb91c1c);
  addBox(9, 0, 4, 2.8, 2.5, 6.2, 0x1d4ed8);
  addBox(0, 0, -12, 4.4, 1.3, 1.4, bCols[2]);
  addBox(0, 0, 12, 4.4, 1.3, 1.4, bCols[2]);
  addBox(-26, 0, 0, 3.2, 2.6, 7.5, 0x0f766e);
  addBox(26, 0, 0, 3.2, 2.6, 7.5, 0x9a3412);

  // Supply Pickups (Medkits & Ammo Crates)
  const pickups = [];
  const pickupCoords = [[-22, -22], [22, -22], [-22, 22], [22, 22], [0, 0]];
  pickupCoords.forEach((pt, idx) => {
    const isMed = idx % 2 === 0;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.7, 0.9),
      new THREE.MeshStandardMaterial({ color: isMed ? 0x22c55e : 0xf5d300, emissive: isMed ? 0x15803d : 0xb45309, emissiveIntensity: 0.4 })
    );
    m.position.set(pt[0], 0.45, pt[1]);
    scene.add(m);
    pickups.push({ mesh: m, x: pt[0], z: pt[1], isMed, cd: 0 });
  });

  // Player State
  let px = 0, py = 0, pz = 28, vy = 0;
  let yaw = 0, pitch = 0.05;
  let hp = 100, maxHp = 100, kills = 0;
  let scoped = false, fpp = false, reloading = false, lastShotTs = 0;
  let pcAimMode = false, pcFiring = false, touchFiring = false;
  let joyX = 0, joyY = 0;
  const keysDown = {};

  const playerAv = makeSoldierAvatar({
    armorCol: S.eq.skin >= 0 ? RAR[ITEMS[S.eq.skin].r].c : 0x2563eb,
    gunId: weapons[0].id
  });
  scene.add(playerAv.grp);

  // Projectiles, Grenades & Tracers
  const tracers = [];
  const grenades = [];

  function spawnTracer(from, to, col = 0xfef08a) {
    const geom = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: col }));
    scene.add(line);
    tracers.push({ line, life: 0.08 });
  }

  // 6 AI Enemy 3D Soldier Bots
  const botSpawns = [[-32, -32], [0, -34], [32, -32], [-34, 4], [34, -4], [0, -22]];
  const bots = botSpawns.map((sp, i) => {
    const av = makeSoldierAvatar({ armorCol: 0xb91c1c, gunId: i % 2 === 0 ? 5 : 3, tint: 0xff2a55 });
    av.grp.position.set(sp[0], 0, sp[1]);
    scene.add(av.grp);
    return {
      id: i,
      av,
      x: sp[0],
      y: 0,
      z: sp[1],
      hp: 100,
      alive: true,
      respawnT: 0,
      dir: Math.random() * Math.PI * 2,
      strafeT: 1 + Math.random() * 2,
      fireCd: 1.2 + Math.random() * 1.5
    };
  });

  // Remote Squad Teammates Map
  const remotePeers = {};

  function updateHud() {
    const w = weapons[wIdx], st = wState[wIdx];
    if (hpTxt) hpTxt.textContent = `HP ${Math.max(0, Math.ceil(hp))} / ${maxHp}`;
    if (hpBar) hpBar.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
    if (wNameEl) wNameEl.textContent = w.name;
    if (ammoEl) ammoEl.textContent = reloading ? 'RELOADING...' : `${st.ammo} / ${st.reserve}`;
    if (killsEl) killsEl.textContent = `KILLS: ${kills}`;
    if (scopeOv) scopeOv.classList.toggle('on', scoped);
    const scBtn = document.getElementById('hc-scope');
    if (scBtn) scBtn.classList.toggle('scoped', scoped);
  }

  function toggleScope(forceVal) {
    scoped = typeof forceVal === 'boolean' ? forceVal : !scoped;
    updateHud();
  }

  function toggleCam() {
    fpp = !fpp;
    playerAv.grp.visible = !fpp;
    setFeed(fpp ? '📷 FIRST-PERSON VIEW (FPP)' : '📷 THIRD-PERSON VIEW (TPP)');
  }

  function switchWeapon(forceIdx) {
    if (reloading) return;
    wIdx = typeof forceIdx === 'number' ? forceIdx : (wIdx + 1) % weapons.length;
    playerAv.setGun(weapons[wIdx].id);
    SFX.equip('gun', weapons[wIdx].rarity);
    updateHud();
    setFeed(`🔫 EQUIPPED: ${weapons[wIdx].name}`);
  }

  function reloadWeapon() {
    const w = weapons[wIdx], st = wState[wIdx];
    if (reloading || st.ammo >= w.mag || st.reserve <= 0) return;
    reloading = true;
    SFX.reload();
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

  function throwGrenade() {
    SFX.click();
    const dir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch) + 0.35, -Math.cos(yaw) * Math.cos(pitch)).normalize();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x3f6212, emissive: 0xff2a55, emissiveIntensity: 0.4 })
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
    if (py <= 0.02) {
      vy = 7.6;
      SFX.click();
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
    SFX.shot();
    updateHud();

    // Crosshair punch feedback
    if (xhairEl) {
      xhairEl.style.transform = 'translate(-50%,-50%) scale(1.45)';
      setTimeout(() => { if (xhairEl) xhairEl.style.transform = 'translate(-50%,-50%) scale(1)'; }, 70);
    }

    const origin = new THREE.Vector3(px, py + 1.48, pz);
    const baseDir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).normalize();

    for (let p = 0; p < w.pellets; p++) {
      const sp = scoped ? w.spread * 0.25 : w.spread;
      const dir = baseDir.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * sp,
        (Math.random() - 0.5) * sp,
        (Math.random() - 0.5) * sp
      )).normalize();

      let maxDist = 75;
      // Check wall intersection
      for (const c of colliders) {
        const cx = (c.minX + c.maxX) * 0.5, cz = (c.minZ + c.maxZ) * 0.5;
        const toBox = new THREE.Vector3(cx - origin.x, 0, cz - origin.z);
        const proj = toBox.dot(dir);
        if (proj > 0 && proj < maxDist) {
          const hitPt = origin.clone().addScaledVector(dir, proj);
          if (hitPt.x >= c.minX && hitPt.x <= c.maxX && hitPt.z >= c.minZ && hitPt.z <= c.maxZ && hitPt.y <= c.maxY) {
            maxDist = proj;
          }
        }
      }

      // Check Bot Hits
      let hitBot = null, bestD = maxDist;
      for (const b of bots) {
        if (!b.alive) continue;
        const target = new THREE.Vector3(b.x, b.y + 1.15, b.z);
        const toB = target.clone().sub(origin);
        const proj = toB.dot(dir);
        if (proj > 0 && proj < bestD) {
          const closest = origin.clone().addScaledVector(dir, proj);
          if (closest.distanceTo(target) < 0.72) {
            bestD = proj;
            hitBot = b;
          }
        }
      }

      const endPt = origin.clone().addScaledVector(dir, bestD);
      spawnTracer(origin.clone().addScaledVector(dir, 0.6), endPt, w.rarity === 'M' ? 0xff2a55 : 0xfef08a);

      if (hitBot) {
        if (w.explosive) {
          SFX.boom();
          bots.forEach(ob => {
            if (ob.alive && Math.hypot(ob.x - endPt.x, ob.z - endPt.z) < 6) damageBot(ob, w.dmg);
          });
        } else {
          damageBot(hitBot, w.dmg);
        }
      }
    }
  }

  function damageBot(b, amount) {
    if (!b.alive) return;
    b.hp -= amount;
    if (b.hp <= 0) {
      b.alive = false;
      b.respawnT = 4.0;
      b.av.grp.rotation.x = -Math.PI / 2;
      b.av.grp.position.y = 0.25;
      kills++;
      S.coins += 8;
      addXP(15);
      SFX.coin();
      updateHud();
      setFeed(`💀 ELIMINATED HOSTILE SOLDIER! (+15 XP · +8 🪙)`);
    }
  }

  /* ===== PC MOUSE 360° AIM ROTATION (POINTER LOCK) & ESC MODE TOGGLE ===== */
  function enterPcAimMode() {
    if (!isPC || !AR || AR.paused) return;
    pcAimMode = true;
    setFeed('🎯 360° AIM MODE — [LMB] Fire · [RMB] Scope · [SPACE] Jump · [ESC] Cursor Mode');
    try {
      const p = acv.requestPointerLock && acv.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }

  function exitPcAimMode() {
    pcAimMode = false;
    pcFiring = false;
    if (scoped) toggleScope(false);
    setFeed('🖱️ CURSOR MODE — Left-click UI normally · Press [ESC] or click arena to Aim');
    try {
      if (document.pointerLockElement) document.exitPointerLock();
    } catch (e) {}
  }

  function onPointerLockChange() {
    if (!isPC || !AR) return;
    const locked = document.pointerLockElement === acv;
    if (locked) {
      pcAimMode = true;
      setFeed('🎯 360° AIM MODE — [LMB] Fire · [RMB] Scope · [SPACE] Jump · [ESC] Cursor Mode');
    } else {
      pcAimMode = false;
      pcFiring = false;
      setFeed('🖱️ CURSOR MODE — Left-click UI normally · Press [ESC] or click arena to Aim');
    }
  }

  function onPcMouseMove(e) {
    if (!isPC || !AR || AR.paused) return;
    if (document.pointerLockElement === acv) {
      const sens = ((S.cfg && S.cfg.sens) || 100) / 100;
      const aimMul = scoped ? 0.42 : 1.0;
      yaw -= (e.movementX || 0) * 0.0024 * sens * aimMul;
      pitch = Math.max(-1.25, Math.min(1.25, pitch - (e.movementY || 0) * 0.0021 * sens * aimMul));
    }
  }

  function onPcMouseDown(e) {
    if (!isPC || !AR || AR.paused) return;
    if (e.target.closest('button, .modal, .atop')) return;

    // If pointer is not locked yet, clicking the 3D arena locks into 360° Aim Mode
    if (document.pointerLockElement !== acv) {
      if (e.target === acv) {
        enterPcAimMode();
        if (e.button === 0) pcFiring = true;
      }
      return;
    }

    // In 360° Aim Rotation Mode: Left Click = Fire, Right Click = Scope/ADS
    if (e.button === 0) {
      pcFiring = true;
      fireWeapon();
    } else if (e.button === 2) {
      toggleScope();
    }
  }

  function onPcMouseUp(e) {
    if (!isPC) return;
    if (e.button === 0) pcFiring = false;
  }

  function onPcKeyDown(e) {
    if (!isPC || !AR) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;

    // ESC toggles back to 360° Aim Rotation Mode when in Cursor Mode
    // (When in Aim Mode, browser natively exits pointerLock on ESC and triggers onPointerLockChange)
    if (e.key === 'Escape') {
      e.preventDefault();
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
    keysDown[e.code] = true;

    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      doJump();
    } else if (e.code === 'KeyR') {
      reloadWeapon();
    } else if (e.code === 'KeyG') {
      throwGrenade();
    } else if (e.code === 'KeyQ' || e.code === 'Digit1' || e.code === 'Digit2') {
      switchWeapon(e.code === 'Digit1' ? 0 : e.code === 'Digit2' ? 1 : undefined);
    } else if (e.code === 'KeyV' || e.code === 'KeyC') {
      toggleCam();
    }
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
    window.addEventListener('keydown', onPcKeyDown);
    window.addEventListener('keyup', onPcKeyUp);
    // Enter 360° Aim Mode immediately from the user's Start button click
    enterPcAimMode();
  }

  /* ===== MOBILE TOUCH CONTROLS (UNCHANGED FOR MOBILE DEVICES) ===== */
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
      const sens = ((S.cfg && S.cfg.sens) || 100) / 100;
      const aimMul = scoped ? 0.45 : 1.0;
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
    fBtn.addEventListener('pointerdown', e => { e.stopPropagation(); touchFiring = true; fireWeapon(); });
    fBtn.addEventListener('pointerup', () => { touchFiring = false; });
    fBtn.addEventListener('pointercancel', () => { touchFiring = false; });

    document.getElementById('hc-scope').addEventListener('pointerdown', e => { e.stopPropagation(); toggleScope(); });
    document.getElementById('hc-jump').addEventListener('pointerdown', e => { e.stopPropagation(); doJump(); });
    document.getElementById('hc-reload').addEventListener('pointerdown', e => { e.stopPropagation(); reloadWeapon(); });
    document.getElementById('hc-grenade').addEventListener('pointerdown', e => { e.stopPropagation(); throwGrenade(); });
    document.getElementById('hc-wswitch').addEventListener('pointerdown', e => { e.stopPropagation(); switchWeapon(); });
    document.getElementById('hc-cam').addEventListener('pointerdown', e => { e.stopPropagation(); toggleCam(); });
  }

  // Collision Check Helper
  function resolveCollisions(nx, nz, rad = 0.55) {
    nx = Math.max(-45, Math.min(45, nx));
    nz = Math.max(-45, Math.min(45, nz));
    for (const c of colliders) {
      if (py >= c.maxY - 0.1) continue;
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

  // Resize Handler
  function resizeArena() {
    const w = isPortrait() ? window.innerHeight : window.innerWidth;
    const h = isPortrait() ? window.innerWidth : window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resizeArena();
  window.addEventListener('resize', resizeArena);

  // Squad HUD & Remote Teammates Sync
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

    const activePids = new Set();
    members.forEach(m => {
      if (m.me || !m.battle || !m.battle.inMatch) return;
      activePids.add(m.pid);
      let rp = remotePeers[m.pid];
      if (!rp) {
        const av = makeSoldierAvatar({ armorCol: 0x38bdf8, gunId: m.battle.gunId || 3, tint: 0x4ade80 });
        scene.add(av.grp);
        rp = remotePeers[m.pid] = { av, tx: m.battle.x || 0, ty: m.battle.y || 0, tz: m.battle.z || 26, try: m.battle.ry || 0 };
      }
      rp.tx = m.battle.x || 0;
      rp.ty = m.battle.y || 0;
      rp.tz = m.battle.z || 26;
      rp.try = m.battle.ry || 0;
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

    // Sight cone
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

    // Enemies (Red)
    radarCtx.fillStyle = '#ff2a55';
    bots.forEach(b => {
      if (!b.alive) return;
      const pt = toRadar(b.x, b.z);
      radarCtx.beginPath();
      radarCtx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      radarCtx.fill();
    });

    // Squad Teammates (Green)
    radarCtx.fillStyle = '#4ade80';
    Object.values(remotePeers).forEach(rp => {
      const pt = toRadar(rp.av.grp.position.x, rp.av.grp.position.z);
      radarCtx.beginPath();
      radarCtx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      radarCtx.fill();
    });

    // Self (Gold center)
    radarCtx.fillStyle = '#f5d300';
    radarCtx.beginPath();
    radarCtx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    radarCtx.fill();
  }

  // Main Arena Simulation Loop
  let prevT = performance.now(), syncAccum = 0, rafId = 0;
  function loop(nowT) {
    if (!AR) return;
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (nowT - prevT) / 1000);
    prevT = nowT;
    if (AR.paused) return;

    // Movement Input (PC Keyboard OR Mobile Joystick)
    let moveF = 0, moveR = 0, sprint = 1;
    if (isPC) {
      if (keysDown.KeyW || keysDown.ArrowUp) moveF += 1;
      if (keysDown.KeyS || keysDown.ArrowDown) moveF -= 1;
      if (keysDown.KeyD || keysDown.ArrowRight) moveR += 1;
      if (keysDown.KeyA || keysDown.ArrowLeft) moveR -= 1;
      if ((keysDown.ShiftLeft || keysDown.ShiftRight) && moveF > 0) sprint = 1.45;
    } else {
      moveF = -joyY;
      moveR = joyX;
    }

    const mag = Math.hypot(moveF, moveR);
    if (mag > 1) { moveF /= mag; moveR /= mag; }

    const speed = (scoped ? 4.2 : 7.8) * sprint;
    const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
    const stepX = (fwdX * moveF + rightX * moveR) * speed * dt;
    const stepZ = (fwdZ * moveF + rightZ * moveR) * speed * dt;

    const pos = resolveCollisions(px + stepX, pz + stepZ);
    px = pos.x;
    pz = pos.z;

    // Gravity & Jump Physics
    vy -= 21 * dt;
    py += vy * dt;
    if (py <= 0) {
      py = 0;
      vy = 0;
    }

    // Update Local Soldier Avatar
    playerAv.grp.position.set(px, py, pz);
    playerAv.grp.rotation.y = yaw + Math.PI;
    playerAv.setAnim(mag > 0.1 ? 'Run' : 'Idle');
    if (playerAv.mix) playerAv.mix.update(dt);

    // Continuous Fire when holding Left Click (PC Aim Mode) or Touch Fire Button
    if ((isPC && pcAimMode && pcFiring) || (!isPC && touchFiring)) {
      fireWeapon();
    }

    // Camera Positioning (FPP vs TPP Over-Shoulder + Scope FOV)
    const targetFov = scoped ? weapons[wIdx].zoom : 62;
    camera.fov += (targetFov - camera.fov) * 0.22;
    camera.updateProjectionMatrix();

    if (fpp || scoped) {
      camera.position.set(px, py + 1.62, pz);
      const lookTarget = new THREE.Vector3(
        px - Math.sin(yaw) * Math.cos(pitch) * 10,
        py + 1.62 + Math.sin(pitch) * 10,
        pz - Math.cos(yaw) * Math.cos(pitch) * 10
      );
      camera.lookAt(lookTarget);
    } else {
      const camDist = 3.4;
      const shoulderX = Math.cos(yaw) * 0.62;
      const shoulderZ = -Math.sin(yaw) * 0.62;
      const cx = px + Math.sin(yaw) * camDist + shoulderX;
      const cz = pz + Math.cos(yaw) * camDist + shoulderZ;
      const cy = py + 2.05 - Math.sin(pitch) * 1.4;
      camera.position.set(cx, Math.max(0.6, cy), cz);
      camera.lookAt(
        px - Math.sin(yaw) * 8 + shoulderX * 0.5,
        py + 1.45 + Math.sin(pitch) * 7,
        pz - Math.cos(yaw) * 8 + shoulderZ * 0.5
      );
    }

    // Update Pickups
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
        SFX.coin();
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

    // Update Grenades
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
        SFX.boom();
        const gx = g.mesh.position.x, gz = g.mesh.position.z;
        bots.forEach(b => {
          if (b.alive && Math.hypot(b.x - gx, b.z - gz) < 7.5) damageBot(b, 130);
        });
        scene.remove(g.mesh);
        grenades.splice(i, 1);
      }
    }

    // Update Tracers
    for (let i = tracers.length - 1; i >= 0; i--) {
      tracers[i].life -= dt;
      if (tracers[i].life <= 0) {
        scene.remove(tracers[i].line);
        tracers[i].line.geometry.dispose();
        tracers.splice(i, 1);
      }
    }

    // Update Enemy Bots AI
    bots.forEach(b => {
      if (!b.alive) {
        b.respawnT -= dt;
        if (b.respawnT <= 0) {
          const sp = botSpawns[b.id % botSpawns.length];
          b.x = sp[0];
          b.z = sp[1];
          b.hp = 100;
          b.alive = true;
          b.av.grp.rotation.x = 0;
          b.av.grp.position.set(b.x, 0, b.z);
        }
        return;
      }

      const dx = px - b.x, dz = pz - b.z;
      const dist = Math.hypot(dx, dz);
      b.strafeT -= dt;
      if (b.strafeT <= 0) {
        b.strafeT = 1.5 + Math.random() * 2;
        b.dir = Math.atan2(dx, dz) + (Math.random() - 0.5) * 1.4;
      }

      const moveSpd = dist > 14 ? 3.2 : 1.8;
      const nx = Math.max(-44, Math.min(44, b.x + Math.sin(b.dir) * moveSpd * dt));
      const nz = Math.max(-44, Math.min(44, b.z + Math.cos(b.dir) * moveSpd * dt));
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

      b.av.grp.position.set(b.x, 0, b.z);
      b.av.grp.rotation.y = Math.atan2(dx, dz);
      b.av.setAnim('Run');
      if (b.av.mix) b.av.mix.update(dt);

      // Bot Shoots at Player
      b.fireCd -= dt;
      if (b.fireCd <= 0 && dist < 38) {
        b.fireCd = 1.4 + Math.random() * 1.3;
        const from = new THREE.Vector3(b.x, 1.4, b.z);
        const to = new THREE.Vector3(px + (Math.random() - 0.5) * 1.6, py + 1.2, pz + (Math.random() - 0.5) * 1.6);
        spawnTracer(from, to, 0xff2a55);
        if (Math.random() < 0.32) {
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

    // Smoothly interpolate Remote Teammates
    Object.values(remotePeers).forEach(rp => {
      rp.av.grp.position.x += (rp.tx - rp.av.grp.position.x) * 0.2;
      rp.av.grp.position.y += (rp.ty - rp.av.grp.position.y) * 0.2;
      rp.av.grp.position.z += (rp.tz - rp.av.grp.position.z) * 0.2;
      rp.av.grp.rotation.y = rp.try + Math.PI;
      if (rp.av.mix) rp.av.mix.update(dt);
    });

    // Sync Squad Packet every 350ms
    syncAccum += dt;
    if (syncAccum >= 0.35) {
      syncAccum = 0;
      if (SQUAD_ID && typeof syncBattleState === 'function') syncBattleState();
    }

    drawRadar();
    renderer.render(scene, camera);
  }

  AR = {
    paused: 0,
    getPacket() {
      return {
        inMatch: true,
        x: +px.toFixed(2),
        y: +py.toFixed(2),
        z: +pz.toFixed(2),
        ry: +yaw.toFixed(3),
        hp: Math.ceil(hp),
        gunId: weapons[wIdx].id,
        kills,
        ts: Date.now()
      };
    },
    syncTeammates,
    cleanup() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resizeArena);
      if (isPC) {
        document.removeEventListener('pointerlockchange', onPointerLockChange);
        window.removeEventListener('mousemove', onPcMouseMove);
        window.removeEventListener('mousedown', onPcMouseDown);
        window.removeEventListener('mouseup', onPcMouseUp);
        window.removeEventListener('keydown', onPcKeyDown);
        window.removeEventListener('keyup', onPcKeyUp);
        try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
      }
      renderer.dispose();
    },
    stats: () => ({ kills, mapName: mapCfg.name })
  };

  syncTeammates(squadMembers());
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
    addXP(bonusXp);
    save();
    SFX.lvlup();
    toast(`🏆 EXTRACTED (${esc(mapName)})! ${kills} Kills · +${bonusXp} XP · +${bonusCoins} 🪙 · +${bonusCp} 💎 CP`);
  } else {
    toast('🚪 Exited 3D Battle Arena');
  }
  render();
}

/* ===== CUSTOM HUD LAYOUT EDITOR (SETTINGS -> CUSTOMIZE HUD) ===== */
function openHudEditor() {
  const keys = [
    ['joy', 'JOYSTICK', 86],
    ['fire', 'FIRE', 64],
    ['scope', 'SCOPE', 50],
    ['jump', 'JUMP', 50],
    ['reload', 'RELOAD', 50],
    ['grenade', 'GRENADE', 46],
    ['wswitch', 'GUN', 50],
    ['cam', 'CAM', 48],
    ['minimap', 'RADAR', 76]
  ];
  const draft = JSON.parse(JSON.stringify(Object.assign(defHud(), S.cfg.hud || {})));
  let sel = 'fire';

  const ed = document.createElement('div');
  ed.className = 'hud-ed';
  ed.innerHTML = `
    <div class="hud-bar">
      <b style="color:var(--y)">🎛️ CUSTOM HUD</b>
      <span class="s" id="he-lbl">Selected: FIRE</span>
      <label class="s">Size <input type="range" id="he-s" min="60" max="150" value="${draft[sel].s}" style="width:5.5rem"></label>
      <label class="s">Alpha <input type="range" id="he-o" min="30" max="100" value="${draft[sel].o}" style="width:5.5rem"></label>
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
    const d = draft[k], el = els[k];
    el.style.left = d.x + '%';
    el.style.top = d.y + '%';
    el.style.transform = `scale(${d.s / 100})`;
    el.style.opacity = d.o / 100;
  }

  function selectKey(k) {
    sel = k;
    Object.keys(els).forEach(x => els[x].classList.toggle('sel', x === k));
    lbl.textContent = 'Selected: ' + k.toUpperCase();
    sInp.value = draft[k].s;
    oInp.value = draft[k].o;
  }

  keys.forEach(([k, name, sz]) => {
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
      draft[k].y = Math.max(8, Math.min(88, Math.round(((p.y - oy) / h) * 100)));
      applyItem(k);
    });
    it.addEventListener('pointerup', () => { dragging = false; });
    it.addEventListener('pointercancel', () => { dragging = false; });
  });

  sInp.oninput = () => { draft[sel].s = +sInp.value; applyItem(sel); };
  oInp.oninput = () => { draft[sel].o = +oInp.value; applyItem(sel); };
  document.getElementById('he-rst').onclick = () => {
    Object.assign(draft, defHud());
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
