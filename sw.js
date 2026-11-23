/* ===== LEVEL UP LIFE OPS — CORE GAME STATE, MISSIONS, ARMORY, FIREBASE SQUAD & WEBRTC VOICE ===== */
const STORAGE_KEY = 'lul_ops_save_v3';

const RAR = {
  C: { n: 'Common',    c: 0x94a3b8, hex: '#94a3b8' },
  R: { n: 'Rare',      c: 0x38bdf8, hex: '#38bdf8' },
  E: { n: 'Epic',      c: 0xa855f7, hex: '#a855f7' },
  L: { n: 'Legendary', c: 0xf59e0b, hex: '#f59e0b' },
  M: { n: 'Mythic',    c: 0xff2a55, hex: '#ff2a55' }
};

const ITEMS = [
  { id: 0, name: 'VECTOR SMG',         cat: 'smg',      r: 'R', type: 'gun',  price: 180, desc: 'High fire-rate close-quarters SMG.' },
  { id: 1, name: 'M870 SHOTGUN',       cat: 'shotgun',  r: 'E', type: 'gun',  price: 320, desc: '7-pellet devastating close-range breach shotgun.' },
  { id: 2, name: 'RECON VEST',         cat: 'armor',    r: 'R', type: 'skin', price: 200, desc: 'Lightweight tactical blue combat armor.' },
  { id: 3, name: 'M4A1 TACTICAL',      cat: 'ar',       r: 'R', type: 'gun',  price: 0,   desc: 'Balanced standard-issue assault rifle.' },
  { id: 4, name: 'GHOST STEALTH SUIT', cat: 'armor',    r: 'E', type: 'skin', price: 380, desc: 'Stealth purple ops rig with reactive trim.' },
  { id: 5, name: 'L96A1 SNIPER',       cat: 'sniper',   r: 'L', type: 'gun',  price: 550, desc: 'Long-range bolt-action precision sniper.' },
  { id: 6, name: 'RPG-7 LAUNCHER',     cat: 'launcher', r: 'L', type: 'gun',  price: 620, desc: 'High-explosive anti-squad rocket launcher.' },
  { id: 7, name: 'AK-47 GOLD DRAGON',  cat: 'ar',       r: 'M', type: 'gun',  price: 900, desc: 'Mythic gold-plated heavy assault rifle.' },
  { id: 8, name: 'CYBER SPECTRE RIG',  cat: 'armor',    r: 'M', type: 'skin', price: 850, desc: 'Mythic crimson operator exo-armor.' }
];

const MAPS = {
  firing_range: { id: 'firing_range', name: 'FIRING RANGE',    sky: 0x6ea8dc },
  nuketown:     { id: 'nuketown',     name: 'NUKETOWN DESERT', sky: 0xd99b52 },
  shipment:     { id: 'shipment',     name: 'SHIPMENT DOCKS',  sky: 0x475569 }
};

const DEFAULT_MISSIONS = [
  { id: 'm1', title: 'Complete 25m Deep Work Sprint', xp: 45, coins: 60, cp: 5, done: false },
  { id: 'm2', title: 'Physical Conditioning / Workout (30m)', xp: 50, coins: 75, cp: 5, done: false },
  { id: 'm3', title: 'Zero Distractions Study / Code Block', xp: 60, coins: 90, cp: 10, done: false },
  { id: 'm4', title: 'Hydrate & Clear Daily Priority Tasks', xp: 35, coins: 45, cp: 5, done: false }
];

const GLTF_CACHE = { soldier: null };
let SQUAD_ID = null;
let CURRENT_TAB = 'ops';

function defHud() {
  return {
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
}

function defaultState() {
  return {
    name: 'Operator_' + Math.floor(100 + Math.random() * 900),
    lvl: 1,
    xp: 0,
    coins: 250,
    cp: 25,
    wins: 0,
    map: 'firing_range',
    inv: [3],
    eq: { gun: 3, skin: -1 },
    missions: JSON.parse(JSON.stringify(DEFAULT_MISSIONS)),
    cfg: {
      gfx: 'High',
      sens: 100,
      vol: 85,
      vib: 1,
      hud: defHud(),
      gunsmith: {}
    }
  };
}

let S = (() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const base = defaultState();
      return Object.assign(base, parsed, {
        eq: Object.assign(base.eq, parsed.eq || {}),
        cfg: Object.assign(base.cfg, parsed.cfg || {})
      });
    }
  } catch (e) {}
  return defaultState();
})();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
  } catch (e) {}
  if (typeof AUTH !== 'undefined' && AUTH.user && AUTH.db) {
    try {
      AUTH.db.ref('users/' + AUTH.user.uid).update({
        name: S.name,
        lvl: S.lvl,
        xp: S.xp,
        coins: S.coins,
        cp: S.cp,
        wins: S.wins,
        inv: S.inv,
        eq: S.eq
      });
    } catch (e) {}
  }
}

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(msg) {
  const box = document.getElementById('toast-box');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast-msg';
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.25s ease';
    setTimeout(() => el.remove(), 260);
  }, 2400);
}

function isPortrait() {
  return document.body.classList.contains('is-mobile') && window.innerHeight > window.innerWidth;
}

function normPt(clientX, clientY) {
  if (isPortrait()) {
    return { x: clientY, y: window.innerWidth - clientX };
  }
  return { x: clientX, y: clientY };
}

function activeMap() {
  return MAPS[S.map] || MAPS.firing_range;
}

function selectMap(mapId) {
  if (!MAPS[mapId]) return;
  S.map = mapId;
  save();
  if (SQUAD_ID && SQUAD.isHost && AUTH.db) {
    AUTH.db.ref('squads/' + SQUAD_ID + '/map').set(mapId);
  }
  toast('🗺️ Map selected: ' + MAPS[mapId].name);
}

function addXP(amount) {
  S.xp = (S.xp || 0) + amount;
  let need = S.lvl * 100;
  let leveled = false;
  while (S.xp >= need) {
    S.xp -= need;
    S.lvl += 1;
    S.coins += 50;
    need = S.lvl * 100;
    leveled = true;
  }
  if (leveled) {
    SFX.lvlup();
    toast(`⭐ RANK UP! You reached Level ${S.lvl} (+50 🪙)`);
  }
  save();
}

/* ===== LOBBY UI SOUND EFFECTS ===== */
const SFX = (() => {
  let ctx = null;
  function ac() {
    if ((S.cfg && S.cfg.vol === 0)) return null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!ctx) ctx = new Ctx();
    if (ctx.state === 'suspended') {
      try { ctx.resume(); } catch (e) {}
    }
    return ctx;
  }
  function tone(f1, f2, dur = 0.08, type = 'triangle', gain = 0.14) {
    const a = ac();
    if (!a) return;
    const volMul = ((S.cfg && typeof S.cfg.vol === 'number') ? S.cfg.vol : 85) / 100;
    const now = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), now + dur);
    g.gain.setValueAtTime(gain * volMul, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.connect(g).connect(a.destination);
    o.start(now);
    o.stop(now + dur + 0.02);
  }
  return {
    muted: false,
    click: () => tone(620, 420, 0.05),
    back: () => tone(420, 240, 0.07),
    coin: () => { tone(880, 1320, 0.09, 'sine', 0.16); },
    equip: () => { tone(520, 780, 0.1, 'triangle', 0.16); },
    deploy: () => { tone(220, 660, 0.25, 'sawtooth', 0.18); },
    lvlup: () => {
      tone(523, 659, 0.12, 'triangle', 0.18);
      setTimeout(() => tone(659, 1046, 0.22, 'triangle', 0.2), 110);
    }
  };
})();

/* ===== FIREBASE AUTH & CLOUD SYNC ===== */
const AUTH = {
  app: null,
  auth: null,
  db: null,
  user: null,
  pid: 'p_' + Math.random().toString(36).slice(2, 10),
  init() {
    try {
      const cfg = window.FIREBASE_CONFIG;
      if (!cfg || !cfg.apiKey || cfg.apiKey === 'YOUR_FIREBASE_API_KEY') return;
      this.app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
      this.auth = firebase.auth();
      this.db = firebase.database();
      this.auth.onAuthStateChanged(u => {
        this.user = u;
        if (u) {
          this.pid = u.uid;
          if (u.displayName) S.name = u.displayName;
          this.db.ref('users/' + u.uid).once('value').then(snap => {
            const val = snap.val();
            if (val) {
              Object.assign(S, val);
              save();
            } else {
              save();
            }
            render();
          }).catch(() => render());
        }
        render();
      });
    } catch (e) {
      console.warn('Firebase running in offline/local mode:', e);
    }
  },
  toggleSignIn() {
    if (!this.auth) {
      toast('ℹ️ Paste your Firebase API key in index.html to enable Google Cloud Sign-In');
      return;
    }
    if (this.user) {
      this.auth.signOut().then(() => {
        this.user = null;
        toast('Signed out');
        render();
      });
    } else {
      const provider = new firebase.auth.GoogleAuthProvider();
      this.auth.signInWithPopup(provider).catch(err => {
        toast('⚠️ Sign-in error: ' + err.message);
      });
    }
  }
};

/* ===== 5-PLAYER REALTIME SQUAD & VOICE ENGINE ===== */
const SQUAD = {
  membersMap: {},
  isHost: false,
  roomRef: null,
  create() {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    this.join(code, true);
  },
  join(code, asHost = false) {
    const clean = (code || '').trim().toUpperCase();
    if (!clean) return toast('Enter a valid Squad Room Code');
    SQUAD_ID = clean;
    this.isHost = asHost;
    this.membersMap = {
      [AUTH.pid]: {
        pid: AUTH.pid,
        name: S.name,
        isHost: asHost,
        speaking: false,
        battle: { inMatch: false, hp: 100, gunId: S.eq.gun }
      }
    };

    if (AUTH.db) {
      if (this.roomRef) this.roomRef.off();
      this.roomRef = AUTH.db.ref('squads/' + SQUAD_ID);
      if (asHost) {
        this.roomRef.child('map').set(S.map);
      }
      const meRef = this.roomRef.child('members/' + AUTH.pid);
      meRef.set(this.membersMap[AUTH.pid]);
      meRef.onDisconnect().remove();

      this.roomRef.on('value', snap => {
        const data = snap.val();
        if (!data) return;
        if (data.map && MAPS[data.map] && S.map !== data.map) {
          S.map = data.map;
          const sel = document.getElementById('ui-map-sel');
          if (sel) sel.value = S.map;
        }
        this.membersMap = data.members || {};
        if (AR && typeof AR.syncTeammates === 'function') {
          AR.syncTeammates(squadMembers());
        }
        if (CURRENT_TAB === 'squad') render();
      });
    }

    toast(`👥 Joined 5P Squad Room: ${SQUAD_ID}`);
    render();
  },
  leave() {
    if (this.roomRef && AUTH.db) {
      this.roomRef.child('members/' + AUTH.pid).remove();
      this.roomRef.off();
      this.roomRef = null;
    }
    SQUAD_ID = null;
    this.isHost = false;
    this.membersMap = {};
    toast('Left Squad Room');
    render();
  }
};

function squadMembers() {
  const list = Object.values(SQUAD.membersMap || {});
  if (!list.length) {
    return [{
      pid: AUTH.pid,
      name: S.name,
      me: true,
      isHost: true,
      speaking: VOICE.micOn,
      battle: AR ? AR.getPacket() : { inMatch: false, hp: 100, gunId: S.eq.gun }
    }];
  }
  return list.slice(0, 5).map(m => Object.assign({}, m, {
    me: m.pid === AUTH.pid,
    speaking: m.pid === AUTH.pid ? VOICE.micOn : !!m.speaking
  }));
}

function syncBattleState() {
  if (!SQUAD_ID || !AR || !AUTH.db) return;
  AUTH.db.ref(`squads/${SQUAD_ID}/members/${AUTH.pid}/battle`).set(AR.getPacket());
}

function markExitedBattle() {
  if (!SQUAD_ID || !AUTH.db) return;
  AUTH.db.ref(`squads/${SQUAD_ID}/members/${AUTH.pid}/battle`).set({ inMatch: false, hp: 100, gunId: S.eq.gun });
}

const VOICE = {
  micOn: false,
  spkOn: true,
  stream: null,
  async toggleMic() {
    if (!this.micOn) {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        this.micOn = true;
        toast('🎙️ Squad Mic ON');
      } catch (e) {
        this.micOn = false;
        toast('⚠️ Microphone permission denied');
      }
    } else {
      this.micOn = false;
      if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
        this.stream = null;
      }
      toast('🔇 Squad Mic MUTED');
    }
    if (SQUAD_ID && AUTH.db) {
      AUTH.db.ref(`squads/${SQUAD_ID}/members/${AUTH.pid}/speaking`).set(this.micOn);
    }
    const arMic = document.getElementById('ar-mic');
    if (arMic) {
      arMic.className = 'abtn-top ' + (this.micOn ? 'on' : 'muted');
      arMic.textContent = this.micOn ? '🎙️' : '🔇';
    }
    if (!AR) render();
  },
  toggleSpk() {
    this.spkOn = !this.spkOn;
    const arSpk = document.getElementById('ar-spk');
    if (arSpk) {
      arSpk.className = 'abtn-top ' + (this.spkOn ? 'on' : 'muted');
      arSpk.textContent = this.spkOn ? '🔊' : '🔈';
    }
    toast(this.spkOn ? '🔊 Squad Speaker ON' : '🔈 Squad Speaker MUTED');
    if (!AR) render();
  }
};

/* ===== MISSIONS, ARMORY & CRATES ===== */
function completeMission(idx) {
  const m = S.missions[idx];
  if (!m || m.done) return;
  m.done = true;
  S.coins += m.coins;
  S.cp += m.cp;
  addXP(m.xp);
  SFX.coin();
  toast(`✅ Mission Complete! +${m.xp} XP · +${m.coins} 🪙 · +${m.cp} 💎`);
  render();
}

function resetDailyMissions() {
  S.missions = JSON.parse(JSON.stringify(DEFAULT_MISSIONS));
  save();
  SFX.click();
  toast('🔄 Daily Ops Missions refreshed!');
  render();
}

function addCustomMission() {
  const inp = document.getElementById('new-mission-inp');
  if (!inp) return;
  const title = inp.value.trim();
  if (!title) return;
  S.missions.unshift({
    id: 'm_' + Date.now(),
    title,
    xp: 40,
    coins: 50,
    cp: 5,
    done: false
  });
  inp.value = '';
  save();
  SFX.click();
  toast('➕ Custom Ops Mission added!');
  render();
}

function buyOrEquipItem(id) {
  const it = ITEMS.find(x => x.id === id);
  if (!it) return;
  const owned = S.inv.includes(id);
  if (!owned) {
    if (S.coins < it.price) return toast(`⚠️ Need ${it.price} 🪙 Coins`);
    S.coins -= it.price;
    S.inv.push(id);
    SFX.coin();
    toast(`🎉 Unlocked ${it.name}!`);
  }
  if (it.type === 'gun') S.eq.gun = id;
  if (it.type === 'skin') S.eq.skin = id;
  SFX.equip();
  save();
  updateLobbyShowcase();
  render();
}

function openSupplyCrate() {
  if (S.cp < 15) return toast('⚠️ Need 15 💎 CP to open a Tactical Supply Crate');
  S.cp -= 15;
  const pool = ITEMS.filter(x => x.id !== 3);
  const won = pool[Math.floor(Math.random() * pool.length)];
  const already = S.inv.includes(won.id);
  if (already) {
    S.coins += 120;
    SFX.coin();
    toast(`📦 Duplicate ${won.name} converted to +120 🪙 Coins!`);
  } else {
    S.inv.push(won.id);
    SFX.lvlup();
    toast(`🎁 CRATE DROP: ${won.name} (${RAR[won.r].n})!`);
  }
  save();
  render();
}

function confirmExitMatch() {
  if (!AR) return;
  AR.paused = 1;
  if (document.pointerLockElement) {
    try { document.exitPointerLock(); } catch (e) {}
  }
  const st = AR.stats();
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="pop L" style="max-width:25rem;width:90%;text-align:center">
      <div class="rL">🚁 TACTICAL EXTRACTION</div>
      <p class="s" style="margin:8px 0 14px">Map: <b>${esc(st.mapName)}</b> · Confirmed Kills: <b style="color:#5be58a">${st.kills}</b></p>
      <div class="row" style="justify-content:center;gap:8px">
        <button class="sm" id="ex-claim">EXTRACT & CLAIM REWARDS</button>
        <button class="sm danger" id="ex-abort">ABORT</button>
        <button class="sm alt" id="ex-resume">RESUME</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('ex-claim').onclick = () => { modal.remove(); exitMatch(true); };
  document.getElementById('ex-abort').onclick = () => { modal.remove(); exitMatch(false); };
  document.getElementById('ex-resume').onclick = () => {
    modal.remove();
    if (AR) AR.paused = 0;
  };
}

/* ===== LOBBY RENDERING ===== */
function setTab(tab) {
  CURRENT_TAB = tab;
  SFX.click();
  render();
}

function render() {
  const lvlEl = document.getElementById('ui-lvl');
  const xpBar = document.getElementById('ui-xp-bar');
  const xpTxt = document.getElementById('ui-xp-txt');
  const coinsEl = document.getElementById('ui-coins');
  const cpEl = document.getElementById('ui-cp');
  const winsEl = document.getElementById('ui-wins');
  const needXp = S.lvl * 100;

  if (lvlEl) lvlEl.textContent = 'LVL ' + S.lvl;
  if (xpBar) xpBar.style.width = Math.min(100, Math.round((S.xp / needXp) * 100)) + '%';
  if (xpTxt) xpTxt.textContent = `${S.xp} / ${needXp} XP`;
  if (coinsEl) coinsEl.textContent = S.coins;
  if (cpEl) cpEl.textContent = S.cp;
  if (winsEl) winsEl.textContent = S.wins || 0;

  const authBtn = document.getElementById('btn-auth');
  if (authBtn) {
    authBtn.textContent = AUTH.user ? `👤 ${S.name} (SIGN OUT)` : '🔑 GOOGLE SIGN IN';
  }

  const eqGun = ITEMS.find(x => x.id === S.eq.gun) || ITEMS[3];
  const eqSkin = ITEMS.find(x => x.id === S.eq.skin);
  const eqRarEl = document.getElementById('ui-eq-rarity');
  const eqGunEl = document.getElementById('ui-eq-gun');
  const eqSkinEl = document.getElementById('ui-eq-skin');
  if (eqRarEl) {
    eqRarEl.textContent = RAR[eqGun.r].n.toUpperCase() + ' LOADOUT';
    eqRarEl.style.color = RAR[eqGun.r].hex;
  }
  if (eqGunEl) eqGunEl.textContent = eqGun.name;
  if (eqSkinEl) eqSkinEl.textContent = 'ARMOR: ' + (eqSkin ? eqSkin.name : 'STANDARD ISSUE');

  const mapSel = document.getElementById('ui-map-sel');
  if (mapSel) mapSel.value = S.map;

  document.querySelectorAll('#ui-tabs .tab').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.tab === CURRENT_TAB);
  });

  const body = document.getElementById('tab-content');
  if (!body) return;

  if (CURRENT_TAB === 'ops') {
    body.innerHTML = `
      <div class="row" style="justify-content:space-between">
        <div class="row" style="flex:1">
          <input id="new-mission-inp" placeholder="Add a real-life daily mission (e.g., Read 20 pages)..." style="flex:1;min-width:180px" />
          <button class="sm" onclick="addCustomMission()">+ ADD</button>
        </div>
        <button class="sm alt" onclick="resetDailyMissions()">🔄 RESET DAILY</button>
      </div>
      ${S.missions.map((m, i) => `
        <div class="card${m.done ? ' done' : ''}">
          <div>
            <b>${esc(m.title)}</b>
            <div class="s">+${m.xp} XP · +${m.coins} 🪙 · +${m.cp} 💎</div>
          </div>
          <button class="sm${m.done ? ' alt' : ''}" onclick="completeMission(${i})" ${m.done ? 'disabled' : ''}>
            ${m.done ? '✓ DONE' : 'COMPLETE'}
          </button>
        </div>
      `).join('')}
    `;
  } else if (CURRENT_TAB === 'armory') {
    body.innerHTML = `
      <div class="card" style="border-color:rgba(245,211,0,0.45)">
        <div>
          <b>🎁 TACTICAL SUPPLY CRATE</b>
          <div class="s">Guaranteed Rare, Epic, Legendary, or Mythic weapon/armor drop</div>
        </div>
        <button class="sm" onclick="openSupplyCrate()">OPEN (15 💎 CP)</button>
      </div>
      <div class="item-grid">
        ${ITEMS.map(it => {
          const owned = S.inv.includes(it.id);
          const equipped = (it.type === 'gun' && S.eq.gun === it.id) || (it.type === 'skin' && S.eq.skin === it.id);
          return `
            <div class="item-card${equipped ? ' eq' : ''}">
              <div>
                <div style="font-size:0.65rem;font-weight:800;color:${RAR[it.r].hex}">${RAR[it.r].n.toUpperCase()} · ${it.cat.toUpperCase()}</div>
                <b style="font-size:0.85rem">${esc(it.name)}</b>
                <div class="s" style="margin-top:3px">${esc(it.desc)}</div>
              </div>
              <button class="sm${owned && !equipped ? ' alt' : ''}" onclick="buyOrEquipItem(${it.id})">
                ${equipped ? '✓ EQUIPPED' : owned ? 'EQUIP' : `BUY (${it.price} 🪙)`}
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } else if (CURRENT_TAB === 'squad') {
    const members = squadMembers();
    body.innerHTML = `
      <div class="card">
        <div>
          <b>👥 5-PLAYER TACTICAL SQUAD LOBBY</b>
          <div class="s">${SQUAD_ID ? `Active Room Code: <b style="color:var(--y)">${SQUAD_ID}</b> (${members.length}/5)` : 'Create a squad room or enter a teammate code'}</div>
        </div>
        <div class="row">
          <button class="sm alt" onclick="VOICE.toggleMic()">${VOICE.micOn ? '🎙️ MIC ON' : '🔇 MIC OFF'}</button>
          <button class="sm alt" onclick="VOICE.toggleSpk()">${VOICE.spkOn ? '🔊 SPK ON' : '🔈 SPK OFF'}</button>
        </div>
      </div>
      ${!SQUAD_ID ? `
        <div class="row">
          <button class="sm" onclick="SQUAD.create()">+ CREATE SQUAD ROOM</button>
          <input id="sq-code-inp" placeholder="ROOM CODE" style="width:120px;text-transform:uppercase" />
          <button class="sm alt" onclick="SQUAD.join(document.getElementById('sq-code-inp').value, false)">JOIN</button>
        </div>
      ` : `
        <div class="row" style="justify-content:space-between">
          <span class="s">Share code <b>${SQUAD_ID}</b> so up to 4 friends can deploy with you!</span>
          <button class="sm danger" onclick="SQUAD.leave()">LEAVE SQUAD</button>
        </div>
      `}
      ${members.map(m => `
        <div class="card">
          <div>
            <b>${m.speaking ? '🗣️ ' : '🪖 '}${esc(m.name)} ${m.me ? '(YOU)' : ''}</b>
            <div class="s">${m.isHost ? 'Squad Leader' : 'Operator'} · ${m.battle && m.battle.inMatch ? 'In 3D Arena' : 'In Lobby'}</div>
          </div>
          <span class="pill" style="color:#4ade80">READY</span>
        </div>
      `).join('')}
    `;
  } else if (CURRENT_TAB === 'settings') {
    const g = S.cfg;
    body.innerHTML = `
      <div class="fr">
        <div><b>Operator Callsign</b><div class="s">Displayed in squad & battle HUD</div></div>
        <input value="${esc(S.name)}" onchange="S.name=this.value.trim()||S.name;save();render()" style="width:11rem" />
      </div>
      <div class="fr">
        <div><b>Aim Sensitivity (${g.sens}%)</b><div class="s">3D camera & scope turn speed</div></div>
        <input type="range" min="20" max="200" value="${g.sens}" oninput="S.cfg.sens=+this.value;save();render()" style="width:9rem" />
      </div>
      <div class="fr">
        <div><b>Graphics Quality</b><div class="s">WebGL pixel ratio & anti-aliasing</div></div>
        <select onchange="S.cfg.gfx=this.value;save();render()">
          ${['Low', 'Medium', 'High', 'Ultra'].map(v => `<option${g.gfx === v ? ' selected' : ''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="fr">
        <div><b>SFX Volume (${g.vol}%)</b><div class="s">Gunfire, reloads & UI sound effects</div></div>
        <input type="range" min="0" max="100" value="${g.vol}" oninput="S.cfg.vol=+this.value;save();render()" style="width:9rem" />
      </div>
      <div class="fr">
        <div><b>Custom Battle HUD Layout</b><div class="s">Drag & resize all battle controls</div></div>
        <button class="sm" onclick="openHudEditor()">🎛️ OPEN HUD EDITOR</button>
      </div>
    `;
  }
}

/* ===== 3D LOBBY BACKGROUND SHOWCASE ===== */
let LOBBY_3D = null;
function initLobbyShowcase() {
  const cv = document.getElementById('gl');
  if (!cv || typeof THREE === 'undefined') return;
  try {
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 50);
    camera.position.set(1.6, 1.5, 4.4);
    camera.lookAt(0.5, 1.0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dir = new THREE.DirectionalLight(0xfef08a, 1.0);
    dir.position.set(3, 5, 4);
    scene.add(dir);

    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.25, 0.14, 24),
      new THREE.MeshLambertMaterial({ color: 0x1e293b })
    );
    ped.position.set(1.15, 0, 0);
    scene.add(ped);

    let avatar = null;
    function rebuild() {
      if (avatar) scene.remove(avatar.grp);
      if (typeof makeSoldierAvatar === 'function') {
        const sk = ITEMS.find(x => x.id === S.eq.skin);
        avatar = makeSoldierAvatar({
          armorCol: sk ? RAR[sk.r].c : 0x2563eb,
          gunId: S.eq.gun
        });
        avatar.grp.position.set(1.15, 0.07, 0);
        scene.add(avatar.grp);
      }
    }

    function onResize() {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
    onResize();
    window.addEventListener('resize', onResize);

    let prev = performance.now();
    function tick(now) {
      requestAnimationFrame(tick);
      if (AR) return;
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (avatar) {
        avatar.grp.rotation.y += dt * 0.45;
        avatar.update(dt);
      }
      renderer.render(scene, camera);
    }
    LOBBY_3D = { rebuild };
    rebuild();
    requestAnimationFrame(tick);
  } catch (e) {}
}

function updateLobbyShowcase() {
  if (LOBBY_3D && LOBBY_3D.rebuild) LOBBY_3D.rebuild();
}

window.addEventListener('DOMContentLoaded', () => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
  if (isMobile) document.body.classList.add('is-mobile');
  AUTH.init();
  render();
  initLobbyShowcase();
});
