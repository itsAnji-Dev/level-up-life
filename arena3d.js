window.Arena3D = (() => {
  let scene, camera, renderer, animId;
  let running = false;
  let localPlayer = null;
  let remoteMeshes = {};
  let botTargets = [];
  let bullets = [];

  const keys = {};
  let yaw = 0, pitch = 0;
  let pos = { x: 0, y: 1.7, z: 12 };
  let velY = 0, onGround = true;
  let hp = 100, kills = 0;
  let ammo = 30, reserve = 120, lastShot = 0;
  let onKillCallback = null;
  let joyVec = { x: 0, z: 0 };

  function startMatch({ container, mapId, localPlayer: lp, squadMembers, onKill }) {
    stopMatch();
    running = true;
    localPlayer = lp;
    onKillCallback = onKill;
    hp = 100;
    kills = 0;
    ammo = lp.weapon.mag;
    reserve = lp.weapon.reserve;
    pos = { x: (Math.random() - 0.5) * 8, y: 1.7, z: 14 };
    yaw = 0;
    pitch = 0;
    remoteMeshes = {};
    botTargets = [];
    bullets = [];

    scene = new THREE.Scene();
    scene.background = new THREE.Color(mapId === "nuketown" ? 0x1e293b : 0x0b1120);
    scene.fog = new THREE.FogExp2(scene.background.getHex(), 0.018);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Lighting
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.95);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(20, 35, 15);
    scene.add(dir);

    buildMapGeometry(mapId);
    spawnTrainingBots(6);
    renderHudSquad(squadMembers);
    updateCombatHud();
    bindInputs(renderer.domElement);

    let prevTime = performance.now();
    function loop(now) {
      if (!running) return;
      animId = requestAnimationFrame(loop);
      const dt = Math.min((now - prevTime) / 1000, 0.05);
      prevTime = now;

      updateMovement(dt);
      updateBullets(dt);
      updateBots(dt);
      interpolateRemotePlayers(dt);
      renderer.render(scene, camera);
    }
    animId = requestAnimationFrame(loop);
  }

  function buildMapGeometry(mapId) {
    const floorMat = new THREE.MeshStandardMaterial({
      color: mapId === "range" ? 0x1f2937 : mapId === "nuketown" ? 0x334155 : 0x172033,
      roughness: 0.85
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const grid = new THREE.GridHelper(120, 60, 0x38bdf8, 0x1e293b);
    grid.position.y = 0.01;
    scene.add(grid);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
    const accentMat = new THREE.MeshStandardMaterial({
      color: mapId === "nuketown" ? 0xf59e0b : 0x0284c7,
      roughness: 0.4
    });

    const blocks = [
      [-10, 1.5, 0, 4, 3, 2],
      [10, 1.5, 0, 4, 3, 2],
      [0, 1.5, -8, 6, 3, 2],
      [-14, 2, -16, 5, 4, 5],
      [14, 2, -16, 5, 4, 5],
      [0, 1.2, 6, 3, 2.4, 1.5]
    ];

    blocks.forEach(([x, y, z, w, h, d], idx) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        idx % 2 === 0 ? wallMat : accentMat
      );
      mesh.position.set(x, y, z);
      scene.add(mesh);
    });
  }

  function spawnTrainingBots(count) {
    const botGeo = new THREE.BoxGeometry(0.9, 1.8, 0.9);
    const botMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(botGeo, botMat.clone());
      mesh.position.set((Math.random() - 0.5) * 34, 0.9, -10 - Math.random() * 22);
      scene.add(mesh);
      botTargets.push({ mesh, hp: 100, dir: Math.random() > 0.5 ? 1 : -1 });
    }
  }

  function createNameSprite(text) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(9, 13, 22, 0.78)";
    ctx.fillRect(16, 12, 224, 40);
    ctx.font = "bold 24px sans-serif";
    ctx.fillStyle = "#38bdf8";
    ctx.textAlign = "center";
    ctx.fillText(text, 128, 39);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.4, 0.6, 1);
    sprite.position.y = 2.35;
    return sprite;
  }

  function updateRemotePlayer(pState) {
    if (!running || !scene) return;
    let entry = remoteMeshes[pState.playerId];
    if (!entry) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 1.75, 0.85),
        new THREE.MeshStandardMaterial({ color: 0x10b981 })
      );
      body.position.y = 0.88;
      group.add(body);
      group.add(createNameSprite(pState.name || "Squadmate"));
      group.position.set(pState.x || 0, 0, pState.z || 10);
      scene.add(group);
      entry = { group, targetPos: new THREE.Vector3(pState.x || 0, 0, pState.z || 10), targetYaw: pState.rotY || 0 };
      remoteMeshes[pState.playerId] = entry;
    }
    entry.targetPos.set(pState.x || 0, 0, pState.z || 0);
    entry.targetYaw = pState.rotY || 0;
  }

  function interpolateRemotePlayers(dt) {
    Object.values(remoteMeshes).forEach((entry) => {
      entry.group.position.lerp(entry.targetPos, Math.min(1, dt * 12));
      entry.group.rotation.y = entry.targetYaw;
    });
  }

  function updateMovement(dt) {
    const speed = keys["ShiftLeft"] ? 11 : 7;
    let forward = 0, strafe = 0;
    if (keys["KeyW"] || keys["ArrowUp"]) forward += 1;
    if (keys["KeyS"] || keys["ArrowDown"]) forward -= 1;
    if (keys["KeyA"] || keys["ArrowLeft"]) strafe -= 1;
    if (keys["KeyD"] || keys["ArrowRight"]) strafe += 1;

    forward += -joyVec.z;
    strafe += joyVec.x;

    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    pos.x += (strafe * cos - forward * sin) * speed * dt;
    pos.z += (-strafe * sin - forward * cos) * speed * dt;
    pos.x = Math.max(-55, Math.min(55, pos.x));
    pos.z = Math.max(-55, Math.min(55, pos.z));

    if (keys["Space"] && onGround) {
      velY = 7.2;
      onGround = false;
    }
    velY -= 18 * dt;
    pos.y += velY * dt;
    if (pos.y <= 1.7) {
      pos.y = 1.7;
      velY = 0;
      onGround = true;
    }

    camera.position.set(pos.x, pos.y, pos.z);
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
  }

  function fireWeapon() {
    if (!running || !localPlayer) return;
    const now = performance.now();
    if (now - lastShot < localPlayer.weapon.fireRate) return;
    if (ammo <= 0) {
      reloadWeapon();
      return;
    }
    lastShot = now;
    ammo--;
    updateCombatHud();

    const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
    const bulletMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 6, 6),
      new THREE.MeshBasicMaterial({ color: localPlayer.weapon.color || 0x38bdf8 })
    );
    bulletMesh.position.copy(camera.position).addScaledVector(dir, 0.8);
    scene.add(bulletMesh);
    bullets.push({ mesh: bulletMesh, dir, life: 1.2 });
  }

  function reloadWeapon() {
    if (!localPlayer || reserve <= 0) return;
    const needed = localPlayer.weapon.mag - ammo;
    const take = Math.min(needed, reserve);
    ammo += take;
    reserve -= take;
    updateCombatHud();
  }

  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.life -= dt;
      b.mesh.position.addScaledVector(b.dir, 65 * dt);

      // Hit check against bots
      for (const bot of botTargets) {
        if (b.mesh.position.distanceTo(bot.mesh.position) < 1.15) {
          bot.hp -= localPlayer.weapon.damage;
          b.life = 0;
          if (bot.hp <= 0) {
            kills++;
            bot.hp = 100;
            bot.mesh.position.set((Math.random() - 0.5) * 36, 0.9, -12 - Math.random() * 24);
            addKillFeed(`${localPlayer.name} eliminated Hostile Bot`);
            updateCombatHud();
            if (onKillCallback) onKillCallback();
          }
          break;
        }
      }

      if (b.life <= 0) {
        scene.remove(b.mesh);
        bullets.splice(i, 1);
      }
    }
  }

  function updateBots(dt) {
    botTargets.forEach((bot) => {
      bot.mesh.position.x += bot.dir * 3.2 * dt;
      if (Math.abs(bot.mesh.position.x) > 22) bot.dir *= -1;
    });
  }

  function addKillFeed(text) {
    const kf = document.getElementById("hud-killfeed");
    if (!kf) return;
    const item = document.createElement("div");
    item.textContent = text;
    kf.appendChild(item);
    setTimeout(() => item.remove(), 3500);
  }

  function renderHudSquad(members) {
    const box = document.getElementById("hud-squad-list");
    if (!box) return;
    box.innerHTML = Object.values(members || {})
      .map((m) => `<div>● <strong>${m.name}</strong> (LVL ${m.level || 1})</div>`)
      .join("");
  }

  function updateCombatHud() {
    document.getElementById("hud-hp-text").textContent = hp;
    document.getElementById("hud-health-fill").style.width = `${hp}%`;
    document.getElementById("hud-weapon-name").textContent = localPlayer?.weapon?.name?.toUpperCase() || "M4A1";
    document.getElementById("hud-ammo-text").textContent = `${ammo} / ${reserve}`;
    document.getElementById("hud-kills-text").textContent = kills;
  }

  function bindInputs(canvas) {
    window.onkeydown = (e) => {
      keys[e.code] = true;
      if (e.code === "KeyR") reloadWeapon();
    };
    window.onkeyup = (e) => { keys[e.code] = false; };

    canvas.onclick = () => {
      if (canvas.requestPointerLock) canvas.requestPointerLock();
      fireWeapon();
    };

    window.onmousemove = (e) => {
      if (document.pointerLockElement === canvas) {
        yaw -= e.movementX * 0.0024;
        pitch = Math.max(-1.3, Math.min(1.3, pitch - e.movementY * 0.0024));
      }
    };

    // Mobile touch joystick & buttons
    const joyZone = document.getElementById("joystick-zone");
    const joyStick = document.getElementById("joystick-stick");
    let touchId = null;

    joyZone.ontouchstart = (e) => {
      const t = e.changedTouches[0];
      touchId = t.identifier;
    };
    joyZone.ontouchmove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== touchId) continue;
        const rect = joyZone.getBoundingClientRect();
        const dx = Math.max(-35, Math.min(35, t.clientX - (rect.left + rect.width / 2)));
        const dy = Math.max(-35, Math.min(35, t.clientY - (rect.top + rect.height / 2)));
        joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
        joyVec = { x: dx / 35, z: dy / 35 };
      }
    };
    joyZone.ontouchend = () => {
      touchId = null;
      joyStick.style.transform = "translate(0, 0)";
      joyVec = { x: 0, z: 0 };
    };

    let lookTouchId = null, lastLookX = 0, lastLookY = 0;
    canvas.ontouchstart = (e) => {
      const t = e.changedTouches[0];
      lookTouchId = t.identifier;
      lastLookX = t.clientX;
      lastLookY = t.clientY;
    };
    canvas.ontouchmove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== lookTouchId) continue;
        yaw -= (t.clientX - lastLookX) * 0.006;
        pitch = Math.max(-1.3, Math.min(1.3, pitch - (t.clientY - lastLookY) * 0.006));
        lastLookX = t.clientX;
        lastLookY = t.clientY;
      }
    };

    document.getElementById("btn-touch-fire").ontouchstart = (e) => { e.preventDefault(); fireWeapon(); };
    document.getElementById("btn-touch-reload").onclick = reloadWeapon;
    document.getElementById("btn-touch-jump").ontouchstart = () => {
      if (onGround) { velY = 7.2; onGround = false; }
    };
  }

  function getLocalNetworkState() {
    if (!running) return null;
    return { x: Number(pos.x.toFixed(2)), y: Number(pos.y.toFixed(2)), z: Number(pos.z.toFixed(2)), rotY: Number(yaw.toFixed(3)), hp, kills };
  }

  function stopMatch() {
    running = false;
    if (animId) cancelAnimationFrame(animId);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  return { startMatch, stopMatch, updateRemotePlayer, getLocalNetworkState };
})();
