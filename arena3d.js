/* ===== 3D SOLDIER BUILDER, TWO-HANDED GUN POSE, PLAYABLE 3D ARENA & CUSTOM HUD ===== */
let AR = null;

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

/* ===== SHARED 3D TACTICAL SOLDIER AVATAR (LOBBY + ARENA BOTS + SQUAD) ===== */
function makeSoldierAvatar(opts = {}) {
  const armorCol = opts.armorCol || 0x2e64b8;
  const tint = opts.tint || null;
  const grp = new THREE.Group();
  let mix = null, actions = {}, activeAct = null, weaponMount = null, curGunMesh = null, muzzleMesh = null;
  let lims = null, bones = {}, axes = {}, rHandBone = null, hasSkeletal = false, aimPitch = 0, firingPulse = 0;

  function buildGunMesh(gid) {
    const it = ITEMS[gid] || ITEMS[3];
    const rCol = RAR[it.r] ? RAR[it.r].c : 0x4aa8ff;
    const isMythic = it.r === 'M' || it.r === 'L';
    const g = new THREE.Group();

    const steel = new THREE.MeshStandardMaterial({ color: 0x1a1f2b, roughness: 0.35, metalness: 0.8 });
    const polymer = new THREE.MeshStandardMaterial({ color: 0x2b313e, roughness: 0.65, metalness: 0.25 });
    const woodOrGold = new THREE.MeshStandardMaterial({
      color: it.id === 7 ? 0xf59e0b : it.id === 5 ? 0x7c2d12 : 0x232936,
      roughness: it.id === 7 ? 0.25 : 0.6,
      metalness: it.id === 7 ? 0.85 : 0.3
    });
    const trim = new THREE.MeshStandardMaterial({
      color: rCol,
      roughness: 0.3,
      metalness: 0.7,
      emissive: rCol,
      emissiveIntensity: isMythic ? 0.55 : 0.15
    });

    const isSniper = it.cat === 'sniper';
    const isLauncher = it.cat === 'launcher';
    const isSmg = it.cat === 'smg';
    const isShotgun = it.cat === 'shotgun';

    // Gun barrel points along +Z in local mount space
    const bodyLen = isSniper ? 0.62 : isLauncher ? 0.72 : isSmg ? 0.34 : 0.48;
    const barrelLen = isSniper ? 0.46 : isLauncher ? 0.32 : isSmg ? 0.16 : 0.28;

    // Buttstock (points backward along -Z toward right shoulder)
    if (!isLauncher) {
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.24), woodOrGold);
      stock.position.set(0, -0.015, -bodyLen * 0.5 - 0.1);
      g.add(stock);
    }

    // Upper & Lower Receiver
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.105, bodyLen), isLauncher ? woodOrGold : steel);
    receiver.position.set(0, 0.01, 0.06);
    g.add(receiver);

    // Rarity Neon/Metallic Top & Side Rails
    const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, bodyLen * 0.9), trim);
    railTop.position.set(0, 0.068, 0.08);
    g.add(railTop);

    const sideStrip = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.022, bodyLen * 0.75), trim);
    sideStrip.position.set(0, 0.015, 0.08);
    g.add(sideStrip);

    // Forward Handguard / Shroud (where left hand holds)
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.082, bodyLen * 0.55), polymer);
    guard.position.set(0, 0.01, bodyLen * 0.38);
    g.add(guard);

    // Pistol Grip (origin 0,0,0 sits right in soldier's right hand)
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.13, 0.065), polymer);
    grip.position.set(0, -0.075, -0.02);
    grip.rotation.x = -0.26;
    g.add(grip);

    // Forward Vertical Foregrip
    if (!isSmg && !isLauncher) {
      const fgrip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.1, 8), polymer);
      fgrip.position.set(0, -0.075, bodyLen * 0.42);
      g.add(fgrip);
    }

    // Magazine
    if (!isLauncher && !isShotgun) {
      const magH = isSniper ? 0.12 : isSmg ? 0.2 : 0.22;
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.048, magH, 0.075), isMythic ? trim : steel);
      mag.position.set(0, -0.11, bodyLen * 0.16);
      mag.rotation.x = 0.26;
      g.add(mag);
    }

    // Heavy Barrel + Muzzle Brake
    const barrelRad = isLauncher ? 0.055 : isShotgun ? 0.022 : 0.015;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(barrelRad, barrelRad, barrelLen, 10), steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.022, bodyLen * 0.5 + 0.06 + barrelLen * 0.5);
    g.add(barrel);

    const muzzleZ = bodyLen * 0.5 + 0.06 + barrelLen;
    const brake = new THREE.Mesh(new THREE.CylinderGeometry(barrelRad * 1.45, barrelRad * 1.35, 0.07, 10), trim);
    brake.rotation.x = Math.PI / 2;
    brake.position.set(0, 0.022, muzzleZ + 0.02);
    g.add(brake);

    // Tactical Scope / Holographic Sight
    if (isSniper) {
      const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.025, 0.28, 12), steel);
      scopeTube.rotation.x = Math.PI / 2;
      scopeTube.position.set(0, 0.105, 0.04);
      g.add(scopeTube);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.02, 12), trim);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, 0.105, 0.18);
      g.add(lens);
    } else if (!isLauncher) {
      const holo = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.048, 0.085), steel);
      holo.position.set(0, 0.098, 0.02);
      g.add(holo);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.036, 0.01), trim);
      glass.position.set(0, 0.1, 0.05);
      g.add(glass);
    }

    // Muzzle Flash Burst Mesh
    const flashMat = new THREE.MeshBasicMaterial({ color: isMythic ? rCol : 0xffe066, transparent: true, opacity: 0.92 });
    const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), flashMat);
    flash.scale.set(0.8, 0.8, 2.2);
    flash.position.set(0, 0.022, muzzleZ + 0.16);
    flash.visible = false;
    g.add(flash);
    muzzleMesh = flash;

    return g;
  }

  function setGun(gid) {
    if (!weaponMount) return;
    if (curGunMesh) weaponMount.remove(curGunMesh);
    curGunMesh = buildGunMesh(gid);
    weaponMount.add(curGunMesh);
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

  // World-space two-handed rifle hold pose (eliminates reversed guns & backward left arm)
  function applyRifleHoldPose() {
    if (!hasSkeletal) return;
    grp.updateMatrixWorld(true);

    const recoilZ = firingPulse * 0.04;
    const pOff = Math.max(-0.45, Math.min(0.45, aimPitch));

    // In grp local space: -Z is forward, +X is right, -X is left, +Y is up
    const rElbowWorld = grp.localToWorld(new THREE.Vector3(0.32, 1.08, -0.06));
    const gripWorld = grp.localToWorld(new THREE.Vector3(0.16, 1.28 + pOff * 0.22, -0.32 + recoilZ));
    const lElbowWorld = grp.localToWorld(new THREE.Vector3(-0.22, 1.08, -0.36));
    const foregripWorld = grp.localToWorld(new THREE.Vector3(0.05, 1.31 + pOff * 0.45, -0.60 + recoilZ));

    // Aim both upper arms and forearms directly to their natural grip targets
    aimBoneAt(bones.rArm, axes.rArm, rElbowWorld);
    aimBoneAt(bones.rForeArm, axes.rForeArm, gripWorld);
    aimBoneAt(bones.lArm, axes.lArm, lElbowWorld);
    aimBoneAt(bones.lForeArm, axes.lForeArm, foregripWorld);

    // Orient weaponMount so barrel (+Z) points straight from right hand (grip) through left hand (foregrip)
    if (weaponMount && rHandBone) {
      rHandBone.updateWorldMatrix(true, false);
      const pWorldQuat = new THREE.Quaternion();
      rHandBone.getWorldQuaternion(pWorldQuat);

      const grpWorldQuat = new THREE.Quaternion();
      grp.getWorldQuaternion(grpWorldQuat);
      const worldUp = new THREE.Vector3(0, 1, 0).applyQuaternion(grpWorldQuat);

      const lookM = new THREE.Matrix4().lookAt(foregripWorld, gripWorld, worldUp);
      const targetWorldQuat = new THREE.Quaternion().setFromRotationMatrix(lookM);
      weaponMount.quaternion.copy(pWorldQuat).invert().multiply(targetWorldQuat);
      weaponMount.position.set(0, 0, 0);
      weaponMount.updateMatrixWorld(true);
    }
  }

  if (GLTF_CACHE && GLTF_CACHE.soldier && THREE.SkeletonUtils) {
    hasSkeletal = true;
    const model = THREE.SkeletonUtils.clone(GLTF_CACHE.soldier.scene);
    model.scale.setScalar(1.05);
    model.updateMatrixWorld(true);

    model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        if (tint && o.material) {
          o.material = o.material.clone();
          o.material.emissive = new THREE.Color(tint);
          o.material.emissiveIntensity = 0.14;
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
          if (muzzleMesh && firingPulse <= 0.35) muzzleMesh.visible = false;
        }
        applyRifleHoldPose();
      };
    }
    applyRifleHoldPose();
  } else {
    // Articulated 3D Tactical Soldier Fallback (Oriented facing -Z)
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
        if (lims.mode === 'Run' || lims.mode === 'Walk') {
          const amp = lims.mode === 'Run' ? 0.72 : 0.42;
          lims.legL.rotation.x = Math.sin(lims.t) * amp;
          lims.legR.rotation.x = -Math.sin(lims.t) * amp;
          lims.body.position.y = Math.abs(Math.cos(lims.t)) * 0.05;
        } else {
          lims.legL.rotation.x *= 0.82;
          lims.legR.rotation.x *= 0.82;
          lims.body.position.y = Math.sin(lims.t) * 0.02;
        }
        if (firingPulse > 0) {
          firingPulse = Math.max(0, firingPulse - dt * 14);
          if (muzzleMesh && firingPulse <= 0.35) muzzleMesh.visible = false;
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
    setAimPitch(p) { aimPitch = p; },
    triggerMuzzle() {
      firingPulse = 1.0;
      if (muzzleMesh) muzzleMesh.visible = true;
    },
    update(dt) {
      if (mix) mix.update(dt);
    },
    weaponMount
  };
}

/* ===== WEAPON CONFIGS ===== */
function getWeaponSpec(gunId) {
  const it = ITEMS[gunId] || ITEMS[3];
  const tierMul = { C: 1.0, R: 1.15, E: 1.3, L: 1.48, M: 1.7 }[it.r] || 1.0;
  const base = {
    smg:      { dmg: 22, rate: 105, mag: 36, res: 144, relMs: 1350, zoom: 42, spread: 0.028, pellets: 1 },
    ar:       { dmg: 30, rate: 145, mag: 30, res: 120, relMs: 1550, zoom: 36, spread: 0.016, pellets: 1 },
    sniper:   { dmg: 88, rate: 650, mag: 5,  res: 25,  relMs: 1900, zoom: 18, spread: 0.002, pellets: 1 },
    shotgun:  { dmg: 17, rate: 520, mag: 8,  res: 32,  relMs: 1750, zoom: 44, spread: 0.075, pellets: 6 },
    launcher: { dmg: 115,rate: 950, mag: 3,  res: 12,  relMs: 2100, zoom: 34, spread: 0.01,  pellets: 1, explosive: true }
  }[it.cat] || { dmg: 30, rate: 145, mag: 30, res: 120, relMs: 1550, zoom: 36, spread: 0.016, pellets: 1 };

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

  const pcKeysHtml = isPC ? `
    <div class="pc-keys">
      <div class="pk-hdr">⌨️ PC CONTROLS</div>
      <div><span class="kcap">W A S D</span> Move / Run</div>
      <div><span class="kcap">SHIFT</span> Sprint</div>
      <div><span class="kcap">SPACE</span> Jump</div>
      <div><span class="kcap">LMB</span> Fire Gun</div>
      <div><span class="kcap">RMB</span> Scope / ADS</div>
      <div><span class="kcap">R</span> Reload · <span class="kcap">G</span> Grenade</div>
      <div><span class="kcap">Q / 1-2</span> Switch Gun</div>
      <div><span class="kcap">V</span> FPP / TPP View</div>
      <div><span class="kcap">ESC</span> Aim ↔ Cursor</div>
    </div>` : '';

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
      ${pcKeysHtml}
      <div class="mfeed" id="ar-feed">${isPC ? '🎯 AIM LOCKED — [W/A/S/D] Move · [SPACE] Jump · [LMB] Fire · [RMB] Scope · [ESC] Cursor' : 'MAP: ' + esc(mapCfg.name) + ' · ELIMINATE HOSTILES'}</div>

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
  let yaw = 0, pitch = 0.05, charYaw = 0, curAnimState = 'Idle';
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
    const gunId = i % 3 === 0 ? 7 : i % 2 === 0 ? 5 : 3;
    const av = makeSoldierAvatar({ armorCol: 0xb91c1c, gunId, tint: 0xff2a55 });
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
    // Hide local soldier mesh when scoped or in FPP so helmet/shoulders NEVER block scope sides
    playerAv.grp.visible = !(fpp || scoped);
  }

  function toggleScope(forceVal) {
    scoped = typeof forceVal === 'boolean' ? forceVal : !scoped;
    updateHud();
  }

  function toggleCam() {
    fpp = !fpp;
    updateHud();
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
    playerAv.triggerMuzzle();
    updateHud();

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
      spawnTracer(origin.clone().addScaledVector(dir, 0.65), endPt, w.rarity === 'M' ? 0xff2a55 : 0xfef08a);

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
    setFeed('🎯 360° AIM MODE — [W/A/S/D] Run · [SPACE] Jump · [LMB] Fire · [RMB] Scope · [ESC] Cursor');
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
      setFeed('🎯 360° AIM MODE — [W/A/S/D] Run · [SPACE] Jump · [LMB] Fire · [RMB] Scope · [ESC] Cursor');
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
    if (e.target.closest('button, .modal, .atop, .pc-keys')) return;

    if (document.pointerLockElement !== acv) {
      if (e.target === acv) {
        enterPcAimMode();
        if (e.button === 0) pcFiring = true;
      }
      return;
    }

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
    enterPcAimMode();
  }

  /* ===== MOBILE TOUCH CONTROLS (UNCHANGED FOR MOBILE) ===== */
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
        rp = remotePeers[m.pid] = {
          av,
          tx: m.battle.x || 0,
          ty: m.battle.y || 0,
          tz: m.battle.z || 26,
          try: m.battle.ry || 0,
          anim: m.battle.anim || 'Idle'
        };
      }
      rp.tx = m.battle.x || 0;
      rp.ty = m.battle.y || 0;
      rp.tz = m.battle.z || 26;
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
      if (!b.alive) return;
      const pt = toRadar(b.x, b.z);
      radarCtx.beginPath();
      radarCtx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      radarCtx.fill();
    });

    radarCtx.fillStyle = '#4ade80';
    Object.values(remotePeers).forEach(rp => {
      const pt = toRadar(rp.av.grp.position.x, rp.av.grp.position.z);
      radarCtx.beginPath();
      radarCtx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      radarCtx.fill();
    });

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

    // Movement Input (PC WASD / Arrows OR Mobile Touch Joystick)
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

    const rawMag = Math.hypot(moveF, moveR);
    const mag = Math.min(1, rawMag);
    if (rawMag > 1) { moveF /= rawMag; moveR /= rawMag; }

    const speed = (scoped ? 4.4 : 8.0) * sprint;
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

    const isFiringNow = (isPC && pcAimMode && pcFiring) || (!isPC && touchFiring);

    let targetCharYaw = yaw;
    if (mag > 0.08) {
      if (isFiringNow || scoped) {
        targetCharYaw = yaw + Math.atan2(-moveR * 0.45, Math.abs(moveF) + 0.55);
      } else {
        targetCharYaw = yaw + Math.atan2(-moveR, moveF);
      }
    }
    charYaw += shortestAngleDiff(charYaw, targetCharYaw) * Math.min(1, dt * 16);

    if (mag > 0.55) {
      curAnimState = 'Run';
      playerAv.setAnim('Run', Math.max(0.85, mag * sprint));
    } else if (mag > 0.08) {
      curAnimState = 'Walk';
      playerAv.setAnim('Walk', Math.max(0.8, mag * 1.4));
    } else {
      curAnimState = 'Idle';
      playerAv.setAnim('Idle', 1.0);
    }

    playerAv.grp.position.set(px, py, pz);
    playerAv.grp.rotation.y = charYaw;
    playerAv.setAimPitch(pitch);
    playerAv.update(dt);

    if (isFiringNow) {
      fireWeapon();
    }

    // Camera Positioning (Clean unobstructed view in Scope & FPP; over-shoulder in TPP)
    const targetFov = scoped ? weapons[wIdx].zoom : 62;
    camera.fov += (targetFov - camera.fov) * 0.25;
    camera.updateProjectionMatrix();

    if (fpp || scoped) {
      playerAv.grp.visible = false;
      camera.position.set(px, py + 1.62, pz);
      const lookTarget = new THREE.Vector3(
        px - Math.sin(yaw) * Math.cos(pitch) * 10,
        py + 1.62 + Math.sin(pitch) * 10,
        pz - Math.cos(yaw) * Math.cos(pitch) * 10
      );
      camera.lookAt(lookTarget);
    } else {
      playerAv.grp.visible = true;
      const camDist = 3.5;
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
      const stepD = Math.hypot(rp.tx - rp.av.grp.position.x, rp.tz - rp.av.grp.position.z);
      rp.av.grp.position.x += (rp.tx - rp.av.grp.position.x) * 0.22;
      rp.av.grp.position.y += (rp.ty - rp.av.grp.position.y) * 0.22;
      rp.av.grp.position.z += (rp.tz - rp.av.grp.position.z) * 0.22;
      rp.av.grp.rotation.y += shortestAngleDiff(rp.av.grp.rotation.y, rp.try) * 0.25;
      rp.av.setAnim(stepD > 0.04 ? 'Run' : (rp.anim || 'Idle'));
      rp.av.update(dt);
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
        ry: +charYaw.toFixed(3),
        anim: curAnimState,
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
