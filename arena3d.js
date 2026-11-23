/* ===== 3D WEAPON BUILDER, SOLDIER CLONER, CUSTOM HUD & MULTIPLAYER 3D BATTLE ARENA ===== */
function build3DGun(gunId){
  const it=gunId>=0?ITEMS[gunId]:ITEMS[3];
  const r=it?it.r:'R',cat=it?it.cat:'ar';
  const rCol=RAR[r].c;
  const g=new THREE.Group();
  const bodyMat=new THREE.MeshStandardMaterial({color:r==='L'?0xd4af37:r==='M'?0x1f0a16:0x232834,metalness:.78,roughness:.26,emissive:r==='M'?0x660018:r==='L'?0x332200:0,emissiveIntensity:.55});
  const trimMat=new THREE.MeshStandardMaterial({color:rCol,metalness:.65,roughness:.22,emissive:rCol,emissiveIntensity:r==='M'?.9:r==='L'?.55:.3});
  const darkMat=new THREE.MeshStandardMaterial({color:0x101218,metalness:.85,roughness:.32});

  if(cat==='launcher'){
    const tube=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,1.55,14),bodyMat);
    tube.rotation.x=Math.PI/2;tube.position.set(0,.06,-.15);g.add(tube);
    const bell=new THREE.Mesh(new THREE.CylinderGeometry(.17,.14,.24,14),trimMat);
    bell.rotation.x=Math.PI/2;bell.position.set(0,.06,-.96);g.add(bell);
    const pod=new THREE.Mesh(new THREE.BoxGeometry(.18,.22,.36),darkMat);pod.position.set(.14,.14,-.1);g.add(pod);
    const optic=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.18,10),trimMat);optic.rotation.x=Math.PI/2;optic.position.set(.14,.14,-.32);g.add(optic);
    const grip=new THREE.Mesh(new THREE.BoxGeometry(.1,.26,.14),darkMat);grip.position.set(0,-.14,.1);g.add(grip);
  }else if(cat==='sniper'){
    const rec=new THREE.Mesh(new THREE.BoxGeometry(.14,.2,1.05),bodyMat);g.add(rec);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.024,.03,.95,10),darkMat);barrel.rotation.x=Math.PI/2;barrel.position.set(0,.04,-.95);g.add(barrel);
    const brake=new THREE.Mesh(new THREE.BoxGeometry(.09,.09,.2),trimMat);brake.position.set(0,.04,-1.44);g.add(brake);
    const scopeTube=new THREE.Mesh(new THREE.CylinderGeometry(.048,.044,.48,12),darkMat);scopeTube.rotation.x=Math.PI/2;scopeTube.position.set(0,.19,-.05);g.add(scopeTube);
    const scopeLens=new THREE.Mesh(new THREE.CylinderGeometry(.052,.052,.04,12),trimMat);scopeLens.rotation.x=Math.PI/2;scopeLens.position.set(0,.19,-.3);g.add(scopeLens);
    const stock=new THREE.Mesh(new THREE.BoxGeometry(.12,.24,.5),bodyMat);stock.position.set(0,-.03,.72);g.add(stock);
    const mag=new THREE.Mesh(new THREE.BoxGeometry(.1,.24,.22),trimMat);mag.position.set(0,-.18,-.08);g.add(mag);
    const grip=new THREE.Mesh(new THREE.BoxGeometry(.1,.24,.13),darkMat);grip.position.set(0,-.18,.3);grip.rotation.x=.25;g.add(grip);
  }else if(cat==='smg'){
    const rec=new THREE.Mesh(new THREE.BoxGeometry(.14,.2,.66),bodyMat);g.add(rec);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.026,.028,.34,10),darkMat);barrel.rotation.x=Math.PI/2;barrel.position.set(0,.04,-.48);g.add(barrel);
    const supp=new THREE.Mesh(new THREE.CylinderGeometry(.042,.042,.22,10),trimMat);supp.rotation.x=Math.PI/2;supp.position.set(0,.04,-.68);g.add(supp);
    const mag=new THREE.Mesh(new THREE.BoxGeometry(.09,.38,.12),trimMat);mag.position.set(0,-.24,-.06);mag.rotation.x=-.15;g.add(mag);
    const grip=new THREE.Mesh(new THREE.BoxGeometry(.1,.24,.13),darkMat);grip.position.set(0,-.18,.2);grip.rotation.x=.25;g.add(grip);
    const sight=new THREE.Mesh(new THREE.BoxGeometry(.09,.09,.13),darkMat);sight.position.set(0,.15,0);g.add(sight);
  }else{
    const rec=new THREE.Mesh(new THREE.BoxGeometry(.16,.22,.92),bodyMat);g.add(rec);
    const rail=new THREE.Mesh(new THREE.BoxGeometry(.09,.04,.86),darkMat);rail.position.set(0,.13,0);g.add(rail);
    const sideGlow=new THREE.Mesh(new THREE.BoxGeometry(.17,.04,.74),trimMat);sideGlow.position.set(0,.02,-.05);g.add(sideGlow);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.028,.032,.68,10),darkMat);barrel.rotation.x=Math.PI/2;barrel.position.set(0,.03,-.76);g.add(barrel);
    const muzzle=new THREE.Mesh(new THREE.CylinderGeometry(.044,.044,.16,10),trimMat);muzzle.rotation.x=Math.PI/2;muzzle.position.set(0,.03,-1.12);g.add(muzzle);
    const stock=new THREE.Mesh(new THREE.BoxGeometry(.13,.24,.44),bodyMat);stock.position.set(0,-.03,.64);g.add(stock);
    const pad=new THREE.Mesh(new THREE.BoxGeometry(.14,.26,.06),darkMat);pad.position.set(0,-.03,.86);g.add(pad);
    const grip=new THREE.Mesh(new THREE.BoxGeometry(.11,.26,.14),darkMat);grip.position.set(0,-.2,.26);grip.rotation.x=.28;g.add(grip);
    const fgrip=new THREE.Mesh(new THREE.BoxGeometry(.09,.2,.11),darkMat);fgrip.position.set(0,-.17,-.34);g.add(fgrip);
    const mag=new THREE.Mesh(new THREE.BoxGeometry(.11,.36,.18),trimMat);mag.position.set(0,-.25,-.06);mag.rotation.x=-.26;g.add(mag);
    const sightFrame=new THREE.Mesh(new THREE.BoxGeometry(.11,.11,.16),darkMat);sightFrame.position.set(0,.2,.05);g.add(sightFrame);
    const lens=new THREE.Mesh(new THREE.PlaneGeometry(.08,.07),new THREE.MeshBasicMaterial({color:r==='M'?0xff2a55:0x38bdf8,transparent:true,opacity:.8,side:THREE.DoubleSide}));
    lens.position.set(0,.21,.05);g.add(lens);
  }
  const flash=new THREE.Mesh(new THREE.OctahedronGeometry(.22,0),new THREE.MeshBasicMaterial({color:r==='M'?0xff2a55:0xf5d300,transparent:true,opacity:.95}));
  flash.position.set(0,.03,-1.32);flash.visible=false;g.userData.flash=flash;g.add(flash);
  g.userData.isGun=true;
  return g;
}

function makeNameSprite(text,isHost=false,speaking=false){
  const c=document.createElement('canvas');c.width=320;c.height=64;
  const x=c.getContext('2d');
  x.fillStyle='rgba(7,13,30,0.82)';x.fillRect(10,10,300,44);
  x.strokeStyle=isHost?'#f5d300':'#38bdf8';x.lineWidth=3;x.strokeRect(10,10,300,44);
  x.font='bold 22px sans-serif';x.textAlign='center';x.textBaseline='middle';
  x.fillStyle=isHost?'#f5d300':'#ffffff';
  x.fillText((speaking?'🗣️ ':'')+(isHost?'👑 ':'')+text,160,33);
  const tex=new THREE.CanvasTexture(c);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
  sp.scale.set(2.4,.48,1);
  return sp;
}

function makeMapTextures(mapObj){
  const mk=(w,h,fn)=>{const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t};
  const groundTex=mk(256,256,(x,w,h)=>{
    x.fillStyle='#'+mapObj.ground.toString(16).padStart(6,'0');x.fillRect(0,0,w,h);
    for(let i=0;i<900;i++){x.fillStyle=i%2?'rgba(255,255,255,.04)':'rgba(0,0,0,.07)';x.fillRect(Math.random()*w,Math.random()*h,3,3)}
  });
  groundTex.repeat.set(24,24);

  const roadTex=mk(256,256,(x,w,h)=>{
    x.fillStyle='#262b34';x.fillRect(0,0,w,h);
    x.fillStyle='#cbd5e1';x.fillRect(0,0,14,h);x.fillRect(w-14,0,14,h);
    x.fillStyle='#f5d300';x.fillRect(w/2-3,18,6,85);x.fillRect(w/2-3,146,6,85);
  });
  roadTex.repeat.set(1,16);

  const wallTex=mk(256,256,(x,w,h)=>{
    x.fillStyle='#64748b';x.fillRect(0,0,w,h);
    x.fillStyle='#475569';for(let y=0;y<h;y+=32)x.fillRect(0,y,w,3);
    [[34,42],[150,42],[34,148],[150,148]].forEach(([wx,wy])=>{
      x.fillStyle='#0f172a';x.fillRect(wx-4,wy-4,76,58);
      x.fillStyle='#38bdf8';x.fillRect(wx,wy,68,50);
      x.fillStyle='rgba(255,255,255,.25)';x.fillRect(wx+4,wy+4,24,42);
    });
  });

  const barrierTex=mk(256,64,(x,w,h)=>{
    for(let i=0;i<8;i++){x.fillStyle=i%2?'#dc2626':'#f8fafc';x.fillRect(i*32,0,32,h)}
  });
  barrierTex.repeat.set(14,1);
  return{groundTex,roadTex,wallTex,barrierTex};
}

function makeSoldierAvatar(opts={}){
  const grp=new THREE.Group();
  const armorCol=opts.armorCol||0x2e64b8;
  const gunId=opts.gunId>=0?opts.gunId:3;
  let mix=null,actIdle=null,actRun=null;

  if(GLTF_CACHE.soldier&&THREE.SkeletonUtils){
    const m=THREE.SkeletonUtils.clone(GLTF_CACHE.soldier.scene);
    const b=new THREE.Box3().setFromObject(m),sz=b.getSize(new THREE.Vector3());
    m.scale.setScalar(2.45/sz.y);
    m.traverse(o=>{
      if(o.isMesh){
        o.visible=true;o.frustumCulled=false;
        if(o.material){
          o.material=o.material.clone();
          o.material.transparent=false;o.material.opacity=1;o.material.side=THREE.DoubleSide;
          if(opts.tint&&o.material.color)o.material.color.lerp(new THREE.Color(opts.tint),.45);
        }
      }
    });
    grp.add(m);
    mix=new THREE.AnimationMixer(m);
    const clips=GLTF_CACHE.soldier.animations||[];
    if(clips[0])actIdle=mix.clipAction(clips[0]);
    if(clips[1])actRun=mix.clipAction(clips[1]);
    if(actIdle)actIdle.play();
  }else{
    const bm=new THREE.MeshStandardMaterial({color:armorCol,roughness:.5,metalness:.3});
    const dm=new THREE.MeshStandardMaterial({color:0x1e293b,roughness:.6});
    const torso=new THREE.Mesh(new THREE.BoxGeometry(.85,1.1,.5),bm);torso.position.y=1.45;
    const head=new THREE.Mesh(new THREE.BoxGeometry(.48,.48,.48),new THREE.MeshStandardMaterial({color:0xe0b696}));head.position.y=2.3;
    const helm=new THREE.Mesh(new THREE.SphereGeometry(.34,12,8,0,6.28,0,1.5),dm);helm.position.y=2.4;
    const legL=new THREE.Mesh(new THREE.BoxGeometry(.32,.9,.35),dm);legL.position.set(-.22,.45,0);
    const legR=legL.clone();legR.position.x=.22;
    grp.add(torso,head,helm,legL,legR);
  }

  const gunMount=new THREE.Group();
  gunMount.position.set(.26,1.46,-.32);
  const gunMesh=build3DGun(gunId);
  gunMesh.scale.setScalar(.82);
  gunMount.add(gunMesh);
  grp.add(gunMount);

  return{
    grp,gunMount,curGunId:gunId,
    getGun:()=>gunMount.children[0],
    setGun(newId){if(this.curGunId===newId)return;this.curGunId=newId;gunMount.clear();const ng=build3DGun(newId);ng.scale.setScalar(.82);gunMount.add(ng)},
    setRunning(run){if(!actRun||!actIdle)return;if(run&&!actRun.isRunning()){actIdle.stop();actRun.play()}else if(!run&&actRun.isRunning()){actRun.stop();actIdle.play()}},
    mix,actIdle,actRun
  };
}

/* ===== CUSTOM HUD LAYOUT EDITOR ===== */
const HUD_META=[
  ['joy','JOYSTICK'],['fire','FIRE'],['scope','SCOPE'],['jump','JUMP'],
  ['reload','RELOAD'],['grenade','GRENADE'],['wswitch','GUN SWITCH'],['cam','EYE CAM'],['minimap','RADAR MAP']
];
let selHud='fire';
function openHudEditor(){
  if(document.getElementById('hud-ed'))return;
  const ed=document.createElement('div');ed.id='hud-ed';ed.className='hud-ed';
  const curH=S.cfg.hud[selHud]||{x:50,y:50,s:100,o:90};
  ed.innerHTML='<div class="hud-bar"><b style="color:var(--y)">🎛️ CUSTOM HUD</b>'+
    '<span class="s" id="hsel-lbl">Selected: '+selHud.toUpperCase()+'</span>'+
    '<label class="s">Size <input id="hs-rng" type="range" min="60" max="150" value="'+curH.s+'" style="width:5.5rem" oninput="updHudProp(\'s\',+this.value)"></label>'+
    '<label class="s">Opacity <input id="ho-rng" type="range" min="30" max="100" value="'+curH.o+'" style="width:5.5rem" oninput="updHudProp(\'o\',+this.value)"></label>'+
    '<button class="sm alt" onclick="S.cfg.hud=defHud();save();refreshHudEd();if(AR)AR.applyHud()">RESET</button>'+
    '<button class="sm" onclick="save();if(AR)AR.applyHud();document.getElementById(\'hud-ed\').remove();toast(\'Custom HUD layout saved!\')">SAVE & CLOSE</button></div>'+
    HUD_META.map(([k,lbl])=>{
      const c=S.cfg.hud[k]||defHud()[k],sz=k==='joy'?96:k==='fire'?72:k==='minimap'?82:56;
      return '<div class="hud-item'+(selHud===k?' sel':'')+'" id="hi-'+k+'" data-k="'+k+'" style="left:'+c.x+'%;top:'+c.y+'%;width:'+sz+'px;height:'+sz+'px;transform:scale('+(c.s/100)+');opacity:'+(c.o/100)+'">'+lbl+'</div>';
    }).join('');
  document.body.appendChild(ed);

  let dragK=null,ox=0,oy=0;
  ed.querySelectorAll('.hud-item').forEach(el=>{
    el.addEventListener('pointerdown',e=>{
      e.stopPropagation();dragK=el.dataset.k;selHud=dragK;
      el.setPointerCapture(e.pointerId);
      const p=normPt(e.clientX,e.clientY),r=el.getBoundingClientRect();
      ox=p.x-(isPortrait()?r.top:r.left);oy=p.y-(isPortrait()?window.innerWidth-r.right:r.top);
      refreshHudEd();
    });
    el.addEventListener('pointermove',e=>{
      if(dragK!==el.dataset.k)return;
      const p=normPt(e.clientX,e.clientY);
      const W=isPortrait()?window.innerHeight:window.innerWidth;
      const H=isPortrait()?window.innerWidth:window.innerHeight;
      const nx=Math.max(1,Math.min(90,Math.round(((p.x-ox)/W)*100)));
      const ny=Math.max(8,Math.min(86,Math.round(((p.y-oy)/H)*100)));
      S.cfg.hud[dragK].x=nx;S.cfg.hud[dragK].y=ny;
      el.style.left=nx+'%';el.style.top=ny+'%';
    });
    el.addEventListener('pointerup',()=>{dragK=null});
  });
}
function updHudProp(prop,val){
  if(!S.cfg.hud[selHud])return;
  S.cfg.hud[selHud][prop]=val;
  const el=document.getElementById('hi-'+selHud);
  if(el){el.style.transform='scale('+(S.cfg.hud[selHud].s/100)+')';el.style.opacity=S.cfg.hud[selHud].o/100}
  if(AR)AR.applyHud();
}
function refreshHudEd(){
  const ed=document.getElementById('hud-ed');if(!ed)return;
  ed.querySelectorAll('.hud-item').forEach(el=>el.classList.toggle('sel',el.dataset.k===selHud));
  const c=S.cfg.hud[selHud];
  const l=document.getElementById('hsel-lbl'),sr=document.getElementById('hs-rng'),or=document.getElementById('ho-rng');
  if(l)l.textContent='Selected: '+selHud.toUpperCase();
  if(sr)sr.value=c.s;if(or)or.value=c.o;
}

/* ===== MULTIPLAYER 5-PLAYER 3D BATTLE ARENA ===== */
let AR=null;
function startMatch(squadId=null){
  if(typeof THREE==='undefined')return toast('3D Engine unavailable on this browser.');
  if(AR)exitMatch(false);
  SFX.deploy();
  const mapObj=activeMap();
  const wrap=document.createElement('div');wrap.id='arena';
  wrap.innerHTML='<canvas id="acv"></canvas><div class="scope-ov" id="scope-ov"></div><div class="ahud">'+
    '<div class="atop"><div style="display:flex;gap:8px;align-items:center"><div class="ammo">🔫 <span id="am-cnt">30</span>/30 <small id="am-gun" style="font-size:.6rem;color:var(--y)"></small></div><div class="hpbar">HP <span id="hp-txt">100</span> · KILLS <span id="kl-txt">0/6</span><div><i id="hp-bar" style="width:100%"></i></div></div></div>'+
    '<div class="aright">'+
      '<button class="abtn-top '+(VOICE.micOn?'on':'muted')+'" id="ar-mic" title="Toggle Mic" onclick="VOICE.toggleMic()">'+(VOICE.micOn?'🎙️':'🔇')+'</button>'+
      '<button class="abtn-top '+(VOICE.spkOn?'on':'muted')+'" id="ar-spk" title="Toggle Speaker" onclick="VOICE.toggleSpk()">'+(VOICE.spkOn?'🔊':'🔈')+'</button>'+
      '<button class="abtn-top" title="Battle Settings" onclick="AR.openSettings()">⚙️</button>'+
      '<button class="abtn-top exit" title="Exit Battle World" onclick="confirmExitMatch()">🚪 EXIT</button>'+
    '</div></div>'+
    '<div class="sq-bhud" id="sq-bhud"></div>'+
    '<div class="xhair" id="xhair"></div><div class="mfeed" id="mfeed">DEPLOYED TO '+esc(mapObj.name)+' · RIGHT-CLICK OR 🎯 TO SCOPE</div>'+
    '<div class="hctrl" id="hc-minimap"><canvas id="radar" width="84" height="84"></canvas></div>'+
    '<div class="hctrl" id="hc-cam"><button class="act" style="width:2.8rem;height:2.8rem;font-size:1.1rem" title="Toggle 1st/3rd Person" onclick="AR.toggleCam()">👁️</button></div>'+
    '<div class="hctrl" id="hc-joy"><div class="joy" id="joy"><div class="knob" id="knob"></div></div></div>'+
    '<div class="hctrl" id="hc-scope"><button class="act" id="btn-scope" title="Scope / ADS (Right Click)" onclick="AR.toggleScope()">🎯</button></div>'+
    '<div class="hctrl" id="hc-grenade"><button class="act" onclick="AR.grenade()">💣</button></div>'+
    '<div class="hctrl" id="hc-reload"><button class="act" onclick="AR.reload()">🔄</button></div>'+
    '<div class="hctrl" id="hc-jump"><button class="act" onclick="AR.jump()">⬆️</button></div>'+
    '<div class="hctrl" id="hc-wswitch"><button class="act" title="Switch Gun" onclick="AR.switchGun()">🔀</button></div>'+
    '<div class="hctrl" id="hc-fire"><button class="act fire" onpointerdown="AR.shoot()">🔫</button></div>'+
  '</div>';
  document.body.appendChild(wrap);

  const cv=document.getElementById('acv');
  const ren=new THREE.WebGLRenderer({canvas:cv,antialias:S.cfg.gfx!=='Low'});
  ren.setPixelRatio(Math.min(devicePixelRatio,S.cfg.gfx==='Low'?1:1.75));
  ren.setSize(isPortrait()?innerHeight:innerWidth,isPortrait()?innerWidth:innerHeight);
  const sc=new THREE.Scene();
  sc.background=new THREE.Color(mapObj.sky);
  sc.fog=new THREE.FogExp2(mapObj.sky,.009);
  const cam=new THREE.PerspectiveCamera(62,(isPortrait()?innerHeight:innerWidth)/(isPortrait()?innerWidth:innerHeight),.1,260);

  sc.add(new THREE.HemisphereLight(0xffffff,0x3b4d2b,1.2));
  const sun=new THREE.DirectionalLight(0xfff4d6,1.25);sun.position.set(40,65,30);sc.add(sun);

  const tex=makeMapTextures(mapObj);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(240,240),new THREE.MeshStandardMaterial({map:tex.groundTex,roughness:.9}));
  ground.rotation.x=-Math.PI/2;sc.add(ground);

  const roadNS=new THREE.Mesh(new THREE.PlaneGeometry(12,110),new THREE.MeshStandardMaterial({map:tex.roadTex,roughness:.85}));
  roadNS.rotation.x=-Math.PI/2;roadNS.position.set(0,.03,0);sc.add(roadNS);
  const roadEW=new THREE.Mesh(new THREE.PlaneGeometry(110,12),new THREE.MeshStandardMaterial({map:tex.roadTex,roughness:.85}));
  roadEW.rotation.x=-Math.PI/2;roadEW.position.set(0,.035,-12);sc.add(roadEW);

  const colliders=[];
  function boxObj(w,h,d,x,y,z,matOrCol,solid=true){
    const mat=typeof matOrCol==='number'?new THREE.MeshStandardMaterial({color:matOrCol,roughness:.75}):matOrCol;
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    m.position.set(x,y,z);sc.add(m);
    if(solid)colliders.push({x,z,hw:w/2+.75,hd:d/2+.75});
    return m;
  }

  const houseMat=new THREE.MeshStandardMaterial({map:tex.wallTex,roughness:.7});
  function buildHouse(x,z,w,d,h,roofCol){
    boxObj(w,h,d,x,h/2,z,houseMat,true);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*.76,2.8,4),new THREE.MeshStandardMaterial({color:roofCol,roughness:.8}));
    roof.position.set(x,h+1.4,z);roof.rotation.y=Math.PI/4;sc.add(roof);
    const door=new THREE.Mesh(new THREE.BoxGeometry(1.5,2.4,.2),new THREE.MeshStandardMaterial({color:0x1e293b}));
    door.position.set(x,1.2,z+d/2+.06);sc.add(door);
    const porch=new THREE.Mesh(new THREE.BoxGeometry(w+.8,.3,2.2),new THREE.MeshStandardMaterial({color:0x94a3b8}));
    porch.position.set(x,.15,z+d/2+1);sc.add(porch);
  }
  buildHouse(-16,-24,10,8,5.4,0xb85a32);
  buildHouse(17,-25,11,9,6.2,0x2b5c8f);
  buildHouse(-18,16,9,8,5.0,0x8b4513);
  buildHouse(18,18,10,8,5.6,0x7c2d12);

  [[11,1.8,-4,0xb84325],[11,1.8,-9,0x2b5c8f],[-11,1.8,-5,0xc97b28],[-11,5.4,-5,0x3f6b47],[12,1.8,7,0x9e3528],[-12,1.8,6,0x2f537a]].forEach(c=>boxObj(3.8,3.6,8.2,c[0],c[1],c[2],c[3],true));

  const barrierMat=new THREE.MeshStandardMaterial({map:tex.barrierTex,roughness:.6});
  const wallBorderMat=new THREE.MeshStandardMaterial({color:0x475569,roughness:.85});
  boxObj(98,2.2,1.4,0,1.1,-48,barrierMat,true);
  boxObj(98,2.2,1.4,0,1.1,48,barrierMat,true);
  boxObj(1.4,2.2,98,-48,1.1,0,barrierMat,true);
  boxObj(1.4,2.2,98,48,1.1,0,barrierMat,true);
  boxObj(102,4.5,1.2,0,2.25,-50,wallBorderMat,false);
  boxObj(102,4.5,1.2,0,2.25,50,wallBorderMat,false);
  boxObj(1.2,4.5,102,-50,2.25,0,wallBorderMat,false);
  boxObj(1.2,4.5,102,50,2.25,0,wallBorderMat,false);

  [[-46,-46],[46,-46],[-46,46],[46,46]].forEach(([tx,tz])=>{
    const tw=new THREE.Mesh(new THREE.BoxGeometry(4.5,14,4.5),wallBorderMat);tw.position.set(tx,7,tz);sc.add(tw);
    const cabin=new THREE.Mesh(new THREE.BoxGeometry(6,3,6),new THREE.MeshStandardMaterial({color:0x1e293b}));cabin.position.set(tx,15.5,tz);sc.add(cabin);
    const beacon=new THREE.Mesh(new THREE.SphereGeometry(.6,8,8),new THREE.MeshBasicMaterial({color:0xf5d300}));beacon.position.set(tx,17.5,tz);sc.add(beacon);
  });

  const tTrunk=new THREE.MeshStandardMaterial({color:0x5c3d24}),tLeaf=new THREE.MeshStandardMaterial({color:0x2f6b29});
  [[-26,-10],[-32,-32],[28,-10],[32,10],[-28,28],[28,30],[-36,6],[36,-34]].forEach(p=>{
    const tr=new THREE.Mesh(new THREE.CylinderGeometry(.35,.5,4.2,7),tTrunk);tr.position.set(p[0],2.1,p[1]);sc.add(tr);
    const lf=new THREE.Mesh(new THREE.DodecahedronGeometry(2.5,0),tLeaf);lf.position.set(p[0],5.2,p[1]);sc.add(lf);
  });

  const ownedGuns=ITEMS.filter(i=>i.type==='Gun'&&S.owned[i.id]);
  if(!ownedGuns.length)ownedGuns.push(ITEMS[3]);
  let gunIdx=Math.max(0,ownedGuns.findIndex(g=>g.id===S.eq.gun));

  const playerAv=makeSoldierAvatar({armorCol:S.eq.skin>=0?RAR[ITEMS[S.eq.skin].r].c:0x2e64b8,gunId:ownedGuns[gunIdx].id,tint:S.eq.skin>=0?RAR[ITEMS[S.eq.skin].r].c:null});
  const player=playerAv.grp;
  const spawnIdx=Math.max(0,squadMembers().findIndex(m=>m.pid===S.id));
  player.position.set((spawnIdx-1.5)*2.2,0,10);sc.add(player);

  let fpGun=build3DGun(ownedGuns[gunIdx].id);fpGun.scale.setScalar(.85);fpGun.position.set(.26,-.25,-.52);fpGun.visible=false;cam.add(fpGun);sc.add(cam);

  const enemies=[],crates=[],bullets=[],booms=[];
  [
    {pos:[-8,0,-10],gun:5,tint:0xdc2626},{pos:[9,0,-8],gun:6,tint:0xb91c1c},{pos:[0,0,-26],gun:1,tint:0x991b1b},
    {pos:[-22,0,-18],gun:8,tint:0xdc2626},{pos:[22,0,-16],gun:2,tint:0xb91c1c},{pos:[7,0,0],gun:3,tint:0x991b1b}
  ].forEach((ec,idx)=>{
    const botAv=makeSoldierAvatar({armorCol:0xdc2626,gunId:ec.gun,tint:ec.tint});
    const eg=botAv.grp;eg.position.set(ec.pos[0],0,ec.pos[2]);
    const hb=new THREE.Mesh(new THREE.BoxGeometry(1.15,.15,.15),new THREE.MeshBasicMaterial({color:0xff2a55}));hb.position.y=2.75;
    eg.add(hb);sc.add(eg);
    enemies.push({g:eg,hb,mix:botAv.mix,hp:100,dir:idx%2?1:-1,phase:idx*1.3,alive:1});
  });

  [[-4,0,-14],[14,0,-14],[-14,0,10],[16,0,10]].forEach(cp=>{
    const cr=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.1,1.1),new THREE.MeshStandardMaterial({color:0xf5d300,emissive:0xb45309,emissiveIntensity:.5}));
    cr.position.set(cp[0],.55,cp[2]);sc.add(cr);crates.push({m:cr,got:0});
  });

  /* Up to 4 Live Teammate Avatars Map (pid -> { av, sprite, lastShotSeq, lastGrenSeq, targetPos, yaw, hp, name, isHost, speaking }) */
  const teamAvatars={};
  const st={yaw:0,pitch:.06,jx:0,jy:0,vy:0,grounded:1,hp:100,ammo:30,kills:0,fp:0,scoped:0,keys:{},ended:0,paused:0,shotSeq:0,lastShotDir:[0,0,-1],grenSeq:0,lastGrenDir:[0,.38,-1]};
  const joy=document.getElementById('joy'),knob=document.getElementById('knob');
  let jId=null,lookId=null,lx=0,ly=0,lastSync=0;

  joy.addEventListener('pointerdown',e=>{e.stopPropagation();jId=e.pointerId;joy.setPointerCapture(e.pointerId);updJoy(e)});
  joy.addEventListener('pointermove',e=>{if(e.pointerId===jId)updJoy(e)});
  const endJoy=e=>{if(e.pointerId===jId){jId=null;st.jx=0;st.jy=0;knob.style.transform='translate(0,0)'}};
  joy.addEventListener('pointerup',endJoy);joy.addEventListener('pointercancel',endJoy);
  function updJoy(e){
    const p=normPt(e.clientX,e.clientY),r=joy.getBoundingClientRect();
    const cx=isPortrait()?(r.top+r.height/2):(r.left+r.width/2);
    const cy=isPortrait()?(window.innerWidth-(r.left+r.width/2)):(r.top+r.height/2);
    let dx=(p.x-cx)/36,dy=(p.y-cy)/36;
    const len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len}
    st.jx=dx;st.jy=dy;knob.style.transform='translate('+(dx*28)+'px,'+(dy*28)+'px)';
  }

  cv.addEventListener('pointerdown',e=>{
    if(e.button===2){e.preventDefault();AR.toggleScope();return}
    const p=normPt(e.clientX,e.clientY);lookId=e.pointerId;lx=p.x;ly=p.y;
  });
  cv.addEventListener('pointermove',e=>{
    if(e.pointerId!==lookId)return;
    const p=normPt(e.clientX,e.clientY);
    const sens=((S.cfg.sens||100)/100)*(st.scoped?.0032:.0065);
    st.yaw-=(p.x-lx)*sens;
    st.pitch=Math.max(-.38,Math.min(.62,st.pitch+(p.y-ly)*sens));
    lx=p.x;ly=p.y;
  });
  cv.addEventListener('pointerup',e=>{if(e.pointerId===lookId)lookId=null});

  const onKd=e=>{st.keys[e.code]=1;if(e.code==='Space')AR.jump();if(e.code==='KeyR')AR.reload();if(e.code==='KeyF')AR.shoot();if(e.code==='KeyQ')AR.switchGun();if(e.code==='KeyV')AR.toggleCam();if(e.code==='ShiftLeft')AR.toggleScope()};
  const onKu=e=>{st.keys[e.code]=0};
  addEventListener('keydown',onKd);addEventListener('keyup',onKu);

  function setFeed(txt){const f=document.getElementById('mfeed');if(f)f.textContent=txt}
  function updHud(){
    const a=document.getElementById('am-cnt'),ag=document.getElementById('am-gun'),h=document.getElementById('hp-txt'),hb=document.getElementById('hp-bar'),k=document.getElementById('kl-txt');
    if(a)a.textContent=String(st.ammo).padStart(2,'0');
    if(ag)ag.textContent=ownedGuns[gunIdx].name;
    if(h)h.textContent=Math.max(0,Math.round(st.hp));
    if(hb)hb.style.width=Math.max(0,st.hp)+'%';
    if(k)k.textContent=st.kills+'/6';
  }
  function renderTeamBhud(){
    const box=document.getElementById('sq-bhud');if(!box)return;
    const active=Object.values(teamAvatars);
    box.innerHTML=active.map(m=>'<div class="sq-bitem'+(m.isHost?' host':'')+'"><div><b>'+(m.speaking?'🗣️ ':'')+(m.isHost?'👑 ':'')+esc(m.name)+'</b><div class="bhp"><i style="width:'+Math.max(0,m.hp)+'%"></i></div></div><span>'+Math.round(m.hp)+' HP</span></div>').join('');
  }
  function spawnBoom(pos,col=0xffa500){
    const b=new THREE.Mesh(new THREE.SphereGeometry(.5,10,10),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.9}));
    b.position.copy(pos);sc.add(b);booms.push({m:b,t:0});
  }
  function spawnBulletVisual(origin,dirVec,col=0xf5d300,dmg=50,isGrenade=0){
    const mesh=isGrenade
      ?new THREE.Mesh(new THREE.DodecahedronGeometry(.25,0),new THREE.MeshStandardMaterial({color:0x22c55e}))
      :new THREE.Mesh(new THREE.SphereGeometry(.15,6,6),new THREE.MeshBasicMaterial({color:col}));
    mesh.position.copy(origin);
    sc.add(mesh);
    bullets.push({m:mesh,v:dirVec.clone().multiplyScalar(isGrenade?22:64),life:isGrenade?1.3:.95,isGrenade,dmg});
  }
  function drawRadar(){
    const rc=document.getElementById('radar');if(!rc)return;
    const x=rc.getContext('2d');x.clearRect(0,0,84,84);
    x.fillStyle='#061024cc';x.beginPath();x.arc(42,42,40,0,6.28);x.fill();
    x.strokeStyle='#4aa8ff55';x.beginPath();x.arc(42,42,22,0,6.28);x.stroke();
    enemies.forEach(en=>{if(!en.alive)return;const dx=(en.g.position.x-player.position.x)*.75,dz=(en.g.position.z-player.position.z)*.75;if(Math.hypot(dx,dz)<38){x.fillStyle='#ff2a55';x.beginPath();x.arc(42+dx,42+dz,3,0,6.28);x.fill()}});
    crates.forEach(cr=>{if(cr.got)return;const dx=(cr.m.position.x-player.position.x)*.75,dz=(cr.m.position.z-player.position.z)*.75;if(Math.hypot(dx,dz)<38){x.fillStyle='#f5d300';x.fillRect(40+dx,40+dz,4,4)}});
    Object.values(teamAvatars).forEach(tm=>{
      const dx=(tm.av.grp.position.x-player.position.x)*.75,dz=(tm.av.grp.position.z-player.position.z)*.75;
      if(Math.hypot(dx,dz)<38){x.fillStyle=tm.isHost?'#f5d300':'#38bdf8';x.beginPath();x.arc(42+dx,42+dz,3.6,0,6.28);x.fill()}
    });
    x.fillStyle='#5be58a';x.beginPath();x.arc(42,42,3.8,0,6.28);x.fill();
  }

  AR={
    paused:0,
    syncTeammates(mates){
      const seen=new Set();
      mates.forEach(m=>{
        if(m.pid===S.id)return;
        const b=m.battle;
        /* Only show teammates actively inside the battle world whose heartbeat is fresh (<5.5s) */
        if(!b||!b.inMatch||(Date.now()-(b.ts||0))>5500)return;
        seen.add(m.pid);
        let entry=teamAvatars[m.pid];
        if(!entry){
          const av=makeSoldierAvatar({armorCol:m.isHost?0xf5d300:0x38bdf8,gunId:b.gunId>=0?b.gunId:3,tint:m.isHost?0xf5d300:0x38bdf8});
          av.grp.position.set(b.x||0,b.y||0,b.z||10);
          const sp=makeNameSprite(m.name,m.isHost,m.speaking);
          sp.position.set(0,2.85,0);
          av.grp.add(sp);
          sc.add(av.grp);
          entry=teamAvatars[m.pid]={av,sprite:sp,lastShotSeq:b.shotSeq||0,lastGrenSeq:b.grenSeq||0,targetPos:new THREE.Vector3(b.x||0,b.y||0,b.z||10),yaw:b.yaw||0,moving:0,hp:100,name:m.name,isHost:m.isHost,speaking:!!m.speaking};
          setFeed('🪖 '+esc(m.name)+' DEPLOYED INTO BATTLE!');
        }
        entry.targetPos.set(b.x||0,b.y||0,b.z||10);
        entry.yaw=b.yaw||0;
        entry.moving=!!b.moving;
        entry.hp=b.hp??100;
        entry.av.setGun(b.gunId>=0?b.gunId:3);
        entry.av.setRunning(!!b.moving);
        if(entry.speaking!==!!m.speaking){
          entry.speaking=!!m.speaking;
          entry.av.grp.remove(entry.sprite);
          entry.sprite=makeNameSprite(m.name,m.isHost,entry.speaking);
          entry.sprite.position.set(0,2.85,0);
          entry.av.grp.add(entry.sprite);
        }
        /* Replicate Teammate Gunfire in 3D World! */
        if((b.shotSeq||0)>entry.lastShotSeq){
          entry.lastShotSeq=b.shotSeq;
          SFX.shot();
          const gMesh=entry.av.getGun();
          if(gMesh&&gMesh.userData.flash){gMesh.userData.flash.visible=true;setTimeout(()=>{if(gMesh.userData.flash)gMesh.userData.flash.visible=false},70)}
          const dArr=b.shotDir||[0,0,-1];
          const dir=new THREE.Vector3(dArr[0],dArr[1],dArr[2]).normalize();
          const orig=entry.av.grp.position.clone().add(new THREE.Vector3(0,1.45,0)).addScaledVector(dir,1.1);
          spawnBulletVisual(orig,dir,RAR[ITEMS[b.gunId>=0?b.gunId:3].r].c,35,0);
        }
        /* Replicate Teammate Frag Grenade in 3D World! */
        if((b.grenSeq||0)>entry.lastGrenSeq){
          entry.lastGrenSeq=b.grenSeq;
          const gArr=b.grenDir||[0,.38,-1];
          const dir=new THREE.Vector3(gArr[0],gArr[1],gArr[2]).normalize();
          const orig=entry.av.grp.position.clone().add(new THREE.Vector3(0,1.6,0));
          spawnBulletVisual(orig,dir,0x22c55e,80,1);
        }
      });

      /* Immediately remove any teammate who exited or disconnected! */
      Object.keys(teamAvatars).forEach(pid=>{
        if(!seen.has(pid)){
          const leftName=teamAvatars[pid].name;
          sc.remove(teamAvatars[pid].av.grp);
          delete teamAvatars[pid];
          setFeed('🚪 '+esc(leftName)+' LEFT THE BATTLEFIELD');
        }
      });
      renderTeamBhud();
    },
    applyHud(){
      HUD_META.forEach(([k])=>{
        const el=document.getElementById('hc-'+k),c=S.cfg.hud[k];
        if(el&&c){el.style.left=c.x+'%';el.style.top=c.y+'%';el.style.transform='scale('+(c.s/100)+')';el.style.opacity=c.o/100}
      });
    },
    toggleScope(){
      st.scoped=!st.scoped;SFX.click();
      const ov=document.getElementById('scope-ov'),bs=document.getElementById('btn-scope');
      if(ov)ov.classList.toggle('on',!!st.scoped);
      if(bs)bs.classList.toggle('scoped',!!st.scoped);
      fpGun.position.x=st.scoped?0:.26;fpGun.position.y=st.scoped?-.19:-.25;
      setFeed(st.scoped?'🎯 TACTICAL SCOPE ENGAGED (2.2x ZOOM)':'🎯 HIPFIRE MODE');
    },
    toggleCam(){
      st.fp=!st.fp;player.visible=!st.fp;fpGun.visible=!!st.fp;
      setFeed(st.fp?'👁️ 1ST-PERSON RIFLE VIEW':'👁️ 3RD-PERSON TACTICAL VIEW');
    },
    switchGun(){
      gunIdx=(gunIdx+1)%ownedGuns.length;
      const gid=ownedGuns[gunIdx].id;
      SFX.equip('gun',ownedGuns[gunIdx].r);
      playerAv.setGun(gid);
      cam.remove(fpGun);fpGun=build3DGun(gid);fpGun.scale.setScalar(.85);fpGun.position.set(st.scoped?0:.26,st.scoped?-.19:-.25,-.52);fpGun.visible=!!st.fp;cam.add(fpGun);
      updHud();setFeed('EQUIPPED: '+ownedGuns[gunIdx].name);
    },
    openSettings(){
      AR.paused=1;
      const m=document.createElement('div');m.className='modal';
      m.innerHTML='<div class="pop R" style="max-width:29rem"><div class="rR">⚙️ BATTLE SETTINGS</div><h2 style="margin:6px 0">TACTICAL & VOICE CONTROLS</h2>'+
        '<div class="fr"><div style="flex:1;text-align:left"><b>Aim Sensitivity ('+S.cfg.sens+'%)</b></div><input type="range" min="20" max="200" value="'+S.cfg.sens+'" style="width:8rem" onchange="S.cfg.sens=+this.value;save()"></div>'+
        '<div class="fr"><div style="flex:1;text-align:left"><b>SFX Volume ('+S.cfg.vol+'%)</b></div><input type="range" min="0" max="100" value="'+S.cfg.vol+'" style="width:8rem" onchange="S.cfg.vol=+this.value;save()"></div>'+
        '<div class="fr"><div style="flex:1;text-align:left"><b>Custom HUD Layout</b><div class="s">Move & resize Fire, Scope, Jump, Gun Switch & Joystick</div></div><button class="sm" onclick="this.closest(\'.modal\').remove();openHudEditor()">🎛️ CUSTOM HUD</button></div>'+
        '<div class="row" style="justify-content:center;margin-top:10px"><button class="sm alt" onclick="this.closest(\'.modal\').remove();if(AR)AR.paused=0">RESUME MATCH</button><button class="sm danger" onclick="this.closest(\'.modal\').remove();confirmExitMatch()">EXIT BATTLE</button></div></div>';
      document.body.appendChild(m);
    },
    jump(){if(st.grounded){st.vy=7.5;st.grounded=0}},
    reload(){if(st.ammo===30)return;SFX.reload();st.ammo=30;updHud();setFeed('MAGAZINE RELOADED (30/30)')},
    shoot(){
      if(st.ended||AR.paused)return;
      if(st.ammo<=0){setFeed('OUT OF AMMO! TAP 🔄 TO RELOAD');return}
      st.ammo--;updHud();SFX.shot();
      const activeG=st.fp?fpGun:playerAv.getGun();
      if(activeG&&activeG.userData.flash){activeG.userData.flash.visible=true;setTimeout(()=>{if(activeG.userData.flash)activeG.userData.flash.visible=false},65)}
      const dir=new THREE.Vector3(-Math.sin(st.yaw),0,-Math.cos(st.yaw)).normalize();
      const orig=new THREE.Vector3(player.position.x,player.position.y+1.45,player.position.z).addScaledVector(dir,1.1);
      spawnBulletVisual(orig,dir,RAR[ownedGuns[gunIdx].r].c,st.scoped?75:50,0);
      st.shotSeq++;st.lastShotDir=[+dir.x.toFixed(3),+dir.y.toFixed(3),+dir.z.toFixed(3)];
      if(st.fp)fpGun.position.z=-.40;
      if(SQUAD_ID)syncBattleState(true);
    },
    grenade(){
      if(st.ended||AR.paused)return;
      SFX.click();
      const dir=new THREE.Vector3(-Math.sin(st.yaw),.38,-Math.cos(st.yaw)).normalize();
      const orig=new THREE.Vector3(player.position.x,player.position.y+1.6,player.position.z);
      spawnBulletVisual(orig,dir,0x22c55e,100,1);
      st.grenSeq++;st.lastGrenDir=[+dir.x.toFixed(3),+dir.y.toFixed(3),+dir.z.toFixed(3)];
      setFeed('FRAG GRENADE OUT!');
      if(SQUAD_ID)syncBattleState(true);
    },
    getPacket(){
      return{
        inMatch:true,map:S.map,
        x:+player.position.x.toFixed(2),y:+player.position.y.toFixed(2),z:+player.position.z.toFixed(2),
        yaw:+player.rotation.y.toFixed(2),moving:!!(Math.hypot(st.jx,st.jy)>.12||st.keys.KeyW||st.keys.KeyS||st.keys.KeyA||st.keys.KeyD),
        gunId:ownedGuns[gunIdx].id,hp:Math.round(st.hp),kills:st.kills,
        shotSeq:st.shotSeq,shotDir:st.lastShotDir,grenSeq:st.grenSeq,grenDir:st.lastGrenDir,
        ts:Date.now()
      };
    },
    cleanup(){removeEventListener('keydown',onKd);removeEventListener('keyup',onKu);ren.dispose()}
  };
  AR.applyHud();updHud();
  if(SQUAD_ID)syncBattleState(true);

  const ck=new THREE.Clock();
  (function loop(){
    if(!AR)return;
    requestAnimationFrame(loop);
    if(AR.paused)return;
    const dt=Math.min(.05,ck.getDelta()),t=ck.elapsedTime;
    if(playerAv.mix)playerAv.mix.update(dt);
    enemies.forEach(en=>{if(en.alive&&en.mix)en.mix.update(dt)});
    Object.values(teamAvatars).forEach(tm=>{
      if(tm.av.mix)tm.av.mix.update(dt);
      tm.av.grp.position.lerp(tm.targetPos,.24);
      tm.av.grp.rotation.y=tm.yaw;
    });
    fpGun.position.z+=(-0.52-fpGun.position.z)*.2;

    const targetFov=st.scoped?28:62;
    if(Math.abs(cam.fov-targetFov)>.2){cam.fov+=(targetFov-cam.fov)*.22;cam.updateProjectionMatrix()}

    let mx=st.jx,mz=st.jy;
    if(st.keys.KeyW||st.keys.ArrowUp)mz=-1;
    if(st.keys.KeyS||st.keys.ArrowDown)mz=1;
    if(st.keys.KeyA||st.keys.ArrowLeft)mx=-1;
    if(st.keys.KeyD||st.keys.ArrowRight)mx=1;
    const moving=Math.hypot(mx,mz)>.12;
    if(moving){
      const sin=Math.sin(st.yaw),cos=Math.cos(st.yaw);
      const vx=(mx*cos+mz*sin)*9.5*dt,vz=(-mx*sin+mz*cos)*9.5*dt;
      const nx=Math.max(-45,Math.min(45,player.position.x+vx)),nz=Math.max(-45,Math.min(45,player.position.z+vz));
      if(!colliders.some(c=>Math.abs(nx-c.x)<c.hw&&Math.abs(nz-c.z)<c.hd)){player.position.x=nx;player.position.z=nz}
      player.rotation.y=st.scoped?(st.yaw+Math.PI):Math.atan2(vx,vz);
    }else if(st.fp||st.scoped){
      player.rotation.y=st.yaw+Math.PI;
    }
    playerAv.setRunning(moving);

    if(!st.grounded){
      player.position.y+=st.vy*dt;st.vy-=20*dt;
      if(player.position.y<=0){player.position.y=0;st.vy=0;st.grounded=1}
    }

    if(st.fp){
      cam.position.set(player.position.x,player.position.y+1.75,player.position.z);
      cam.rotation.order='YXZ';cam.rotation.y=st.yaw;cam.rotation.x=-st.pitch;
    }else{
      const dist=st.scoped?2.4:5.2,shoulderX=Math.cos(st.yaw)*(st.scoped?.45:.65),shoulderZ=-Math.sin(st.yaw)*(st.scoped?.45:.65);
      cam.position.set(player.position.x+Math.sin(st.yaw)*dist+shoulderX,player.position.y+(st.scoped?1.95:2.45)+st.pitch*2.4,player.position.z+Math.cos(st.yaw)*dist+shoulderZ);
      cam.lookAt(player.position.x+shoulderX,player.position.y+1.45,player.position.z+shoulderZ);
    }

    /* Fast 140ms Live Squad Battle Sync (Position, Gun, Shot & Grenade events) */
    if(SQUAD_ID&&DB&&USER&&t-lastSync>.14){
      lastSync=t;
      syncBattleState(false);
    }

    crates.forEach(cr=>{
      if(cr.got)return;
      cr.m.rotation.y+=dt*2;
      if(cr.m.position.distanceTo(player.position)<2){
        cr.got=1;cr.m.visible=false;SFX.coin();
        setFeed('SUPPLY CRATE LOOTED! (+10 💎 CP BONUS)');
      }
    });

    for(let i=bullets.length-1;i>=0;i--){
      const b=bullets[i];b.life-=dt;
      b.m.position.addScaledVector(b.v,dt);
      if(b.isGrenade)b.v.y-=18*dt;
      let hit=0;
      enemies.forEach(en=>{
        if(!en.alive)return;
        const d=b.m.position.distanceTo(new THREE.Vector3(en.g.position.x,1.15,en.g.position.z));
        if(d<(b.isGrenade?4.5:1.4)){
          hit=1;en.hp-=b.dmg;
          en.hb.scale.x=Math.max(.01,en.hp/100);
          spawnBoom(b.m.position,b.isGrenade?0xff5500:0xf5d300);
          if(en.hp<=0){
            en.alive=0;en.g.visible=false;st.kills++;updHud();
            setFeed('ENEMY ELIMINATED! ('+st.kills+'/6)');
            if(st.kills>=6&&!st.ended){st.ended=1;setTimeout(()=>exitMatch(true,true),700)}
          }
        }
      });
      if(hit||b.life<=0||(b.isGrenade&&b.m.position.y<=.2)){
        if(b.isGrenade){SFX.boom();spawnBoom(b.m.position,0xff3b5c)}
        sc.remove(b.m);bullets.splice(i,1);
      }
    }

    enemies.forEach(en=>{
      if(!en.alive)return;
      en.g.position.x+=Math.sin(t+en.phase)*dt*2.4*en.dir;
      en.g.rotation.y=Math.cos(t+en.phase)*en.dir>0?Math.PI/2:-Math.PI/2;
      if(en.g.position.distanceTo(player.position)<7&&Math.random()<dt*.6){
        st.hp=Math.max(15,st.hp-4);updHud();
      }
    });

    for(let i=booms.length-1;i>=0;i--){
      const bm=booms[i];bm.t+=dt;bm.m.scale.setScalar(1+bm.t*7);bm.m.material.opacity=Math.max(0,1-bm.t*3);
      if(bm.t>.35){sc.remove(bm.m);booms.splice(i,1)}
    }

    drawRadar();
    ren.render(sc,cam);
  })();
}

function exitMatch(claim=true,victory=false){
  const el=document.getElementById('arena');
  let earnedKills=0;
  const kTxt=document.getElementById('kl-txt');
  if(kTxt)earnedKills=parseInt(kTxt.textContent)||0;
  if(AR){AR.cleanup();AR=null}
  if(el)el.remove();
  /* Immediately mark inMatch:false so other squadmates see this avatar vanish right away */
  if(SQUAD_ID)markExitedBattle();
  if(!claim)return;

  const won=victory||earnedKills>=6;
  const mapBonus=S.map==='shipment'&&won?10:0;
  const co=25+earnedKills*15+(won?50:0);
  const cp=5+earnedKills*5+(won?25:0)+mapBonus;
  const xp=30+earnedKills*20+(won?60:0);
  S.coins+=co;S.cp+=cp;if(won){S.wins=(S.wins||0)+1;S.keys+=1}
  SFX.lvlup();addXP(xp);save();render();

  const m=document.createElement('div');m.className='modal';m.onclick=()=>{m.remove();render()};
  m.innerHTML='<div class="pop '+(won?'L':'R')+'"><div class="'+(won?'rL':'rR')+'">'+(won?'🏆 VICTORY ROYALE':'🏁 MATCH EXTRACTED')+'</div><div class="big">🎖️</div><h2>'+esc(activeMap().name)+'</h2><p class="s" style="margin:6px 0">Eliminations: '+earnedKills+'/6</p><div style="background:#0007;padding:10px;margin:10px 0;font-weight:700">+'+xp+' XP · +'+co+' 🪙 · +'+cp+' 💎 CP'+(won?' · +1 🗝️ KEY':'')+'</div><p class="s">Rewards added to your profile · Tap to continue</p></div>';
  document.body.appendChild(m);
}
