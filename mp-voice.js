/* ===== 5-MEMBER SQUAD ROOM, LIVE BATTLE SYNC & WEBRTC MIC/SPEAKER VOICE CHAT ===== */
let INBOX=[],OUTBOX=[],SQUAD_ID=null,SQUAD_DOCS={},SQUAD_META=null,MY_READY=1;
let unsubOutbox=null,unsubSquad=null,handledIds={},battleSyncBusy=0;

function isSquadHost(){
  if(!SQUAD_ID)return true;
  if(SQUAD_META)return SQUAD_META.hostPid===S.id;
  return SQUAD_ID==='SQ_'+S.id;
}

function squadMembers(){
  const me={
    pid:S.id,name:S.name,lvl:S.lvl,
    avatar:S.eq.char>=0?ITEMS[S.eq.char].ic:'🪖',
    eq:S.eq,ready:isSquadHost()?1:MY_READY,
    isHost:isSquadHost(),me:1,
    micOn:VOICE.micOn,speaking:VOICE.speaking,
    battle:AR?AR.getPacket():null
  };
  if(!SQUAD_ID)return[me];

  const list=[me];
  Object.values(SQUAD_DOCS).forEach(d=>{
    if(!d||d.pid===S.id)return;
    /* Filter out stale/disconnected peers (>15s in lobby, >5.5s in battle) */
    const age=Date.now()-(d.squadPing||0);
    if(age>15000)return;
    const isH=SQUAD_META?SQUAD_META.hostPid===d.pid:(SQUAD_ID==='SQ_'+d.pid);
    list.push({
      pid:d.pid,name:d.n||'Player',lvl:d.l||1,avatar:d.a||'🪖',
      eq:d.eq||{gun:3,skin:-1,char:-1},
      ready:isH?1:(d.squadReady?1:0),
      isHost:isH,me:0,
      micOn:!!d.micOn,speaking:!!d.speaking,
      battle:d.battle||null
    });
  });

  /* Sort: Host first, then local player, then alphabetically, capped at 5 members */
  return list.sort((a,b)=>(b.isHost-a.isHost)||(b.me-a.me)||a.name.localeCompare(b.name)).slice(0,5);
}

function pushMyPlayerDoc(extra={}){
  if(!DB||!USER)return Promise.resolve();
  const T=firebase.firestore.FieldValue.serverTimestamp();
  const targets=[...new Set(OUTBOX.map(o=>o.toPid))];
  const doc=Object.assign({
    pid:S.id,n:S.name,l:S.lvl,c:Object.keys(S.owned).length,s:S.streak,
    a:S.eq.char>=0?ITEMS[S.eq.char].ic:'🪖',
    eq:S.eq,map:S.map,
    outbox:OUTBOX.slice(-20),
    outboxTargets:targets,
    squadId:SQUAD_ID||null,
    squadReady:MY_READY?1:0,
    squadPing:Date.now(),
    micOn:VOICE.micOn?1:0,
    speaking:VOICE.speaking?1:0,
    rtcSignals:VOICE.signals.slice(-24),
    t:T
  },extra);
  if(SQUAD_ID&&isSquadHost()&&SQUAD_META){
    SQUAD_META.map=S.map;
    SQUAD_META.mode=S.mode;
    doc.squadMeta=SQUAD_META;
  }
  return DB.collection('players').doc(USER.uid).set(doc,{merge:true});
}

function listenMultiplayer(){
  if(unsubOutbox)unsubOutbox();
  if(!DB||!USER)return;
  unsubOutbox=DB.collection('players').where('outboxTargets','array-contains',S.id).onSnapshot(sn=>{
    const nextInbox=[];
    sn.forEach(d=>{
      const sender=d.data();
      (sender.outbox||[]).forEach(msg=>{
        if(msg.toPid!==S.id)return;
        if(msg.type==='friend_ack'){
          if(!handledIds[msg.id]){
            handledIds[msg.id]=1;
            S.friends=S.friends.filter(f=>f.i!==msg.fromPid);
            S.friends.push({n:msg.fromName,i:msg.fromPid,l:msg.payload?.lvl||1,c:msg.payload?.owned||2,s:msg.payload?.streak||0,a:msg.fromAvatar||'🪖',eq:msg.payload?.eq||{gun:3,skin:-1,char:-1}});
            save();listenFriends();SFX.lvlup();
            toast('🤝 '+esc(msg.fromName)+' accepted your Friend Request!');
          }
          return;
        }
        if(handledIds[msg.id])return;
        nextInbox.push(Object.assign({senderUid:d.id},msg));
        if(!handledIds['toast_'+msg.id]){
          handledIds['toast_'+msg.id]=1;
          SFX.quest();
          if(msg.type==='match_invite')showMatchInviteModal(msg);
          else if(msg.type==='gift')toast('🎁 Gift from '+esc(msg.fromName)+': '+esc(msg.payload?.label||'')+'! Open Clan → Invitations');
          else toast('📩 Friend Request from '+esc(msg.fromName)+'! Open Clan → Invitations');
        }
      });
    });
    INBOX=nextInbox;
    if(!AR)render();
  },err=>console.warn('Inbox listener:',err));
}

function listenSquadRoom(){
  if(unsubSquad){unsubSquad();unsubSquad=null}
  SQUAD_DOCS={};
  if(!DB||!USER||!SQUAD_ID){updateLobbySquad();return}

  unsubSquad=DB.collection('players').where('squadId','==',SQUAD_ID).onSnapshot(sn=>{
    const nextDocs={};
    let hostDoc=null;
    sn.forEach(d=>{
      const x=d.data();
      nextDocs[x.pid]=x;
      if(SQUAD_ID==='SQ_'+x.pid||(x.squadMeta&&x.squadMeta.id===SQUAD_ID&&x.squadMeta.hostPid===x.pid))hostDoc=x;
    });
    SQUAD_DOCS=nextDocs;

    /* Check if Host disbanded squad or kicked this player */
    if(!isSquadHost()){
      if(hostDoc&&hostDoc.squadMeta){
        SQUAD_META=hostDoc.squadMeta;
        if((SQUAD_META.kicked||[]).includes(S.id)){
          toast('🚪 You were removed from the squad by the Host.');
          leaveSquad(true);return;
        }
        /* Sync Host's chosen Map & Mode */
        if(SQUAD_META.map&&S.map!==SQUAD_META.map){S.map=SQUAD_META.map}
        if(SQUAD_META.mode&&S.mode!==SQUAD_META.mode){S.mode=SQUAD_META.mode}
        /* Auto-deploy into 3D Battle World when Host presses START */
        if(SQUAD_META.status==='started'&&!AR&&!handledIds['start_'+SQUAD_META.startTs]){
          handledIds['start_'+SQUAD_META.startTs]=1;
          startMatch(SQUAD_ID);
        }
      }else if(Object.keys(nextDocs).length>0&&!hostDoc){
        toast('🚪 Host disbanded the squad.');
        leaveSquad(true);return;
      }
    }

    /* Process incoming WebRTC voice signals & update battle teammates */
    VOICE.syncPeers(Object.values(nextDocs));
    if(AR)AR.syncTeammates(squadMembers());
    updateLobbySquad();
    if(!AR&&(pg===''||pg==='clan'))render();
  },err=>console.warn('Squad listener:',err));
}

async function sendFriendReqById(targetPid){
  const pid=(targetPid||document.getElementById('fid')?.value||'').trim().toUpperCase();
  if(!DB||!USER)return toast('Sign in with Google on all devices first!');
  if(!pid||pid===S.id)return toast('Enter your friend\'s Player ID');
  try{
    const q=await DB.collection('players').where('pid','==',pid).limit(1).get();
    if(q.empty)return toast('No player found with ID '+esc(pid)+'. Make sure your friend signed in with Google!');
    const x=q.docs[0].data();
    const msgId='MSG_'+Date.now()+'_'+Math.floor(Math.random()*9999);
    OUTBOX=OUTBOX.filter(o=>!(o.type==='friend_req'&&o.toPid===x.pid));
    OUTBOX.push({
      id:msgId,type:'friend_req',fromUid:USER.uid,fromPid:S.id,fromName:S.name,
      fromAvatar:S.eq.char>=0?ITEMS[S.eq.char].ic:'🪖',
      toPid:x.pid,
      payload:{lvl:S.lvl,owned:Object.keys(S.owned).length,streak:S.streak,eq:S.eq},
      ts:Date.now()
    });
    await pushMyPlayerDoc();
    SFX.coin();toast('✅ Friend Request sent to '+esc(x.n)+' ('+x.pid+')!');
  }catch(e){toast('Could not send invite: '+esc(e.message))}
}

async function acceptInvite(msgId){
  const inv=INBOX.find(i=>i.id===msgId);if(!inv||!DB)return;
  handledIds[msgId]=1;
  INBOX=INBOX.filter(i=>i.id!==msgId);
  if(inv.type==='friend_req'){
    S.friends=S.friends.filter(f=>f.i!==inv.fromPid);
    S.friends.push({n:inv.fromName,i:inv.fromPid,l:inv.payload?.lvl||1,c:inv.payload?.owned||2,s:inv.payload?.streak||0,a:inv.fromAvatar||'🪖',eq:inv.payload?.eq||{gun:3,skin:-1,char:-1}});
    OUTBOX.push({
      id:'ACK_'+Date.now(),type:'friend_ack',fromUid:USER.uid,fromPid:S.id,fromName:S.name,
      fromAvatar:S.eq.char>=0?ITEMS[S.eq.char].ic:'🪖',
      toPid:inv.fromPid,
      payload:{lvl:S.lvl,owned:Object.keys(S.owned).length,streak:S.streak,eq:S.eq},
      ts:Date.now()
    });
    save();listenFriends();await pushMyPlayerDoc();
    SFX.lvlup();toast('🤝 You and '+esc(inv.fromName)+' are now Friends!');
  }else if(inv.type==='gift'){
    const p=inv.payload||{};
    S.coins+=(p.coins||0);S.keys+=(p.keys||0);S.cp+=(p.cp||0);
    save();SFX.lvlup();toast('🎁 Claimed Gift from '+esc(inv.fromName)+': '+esc(p.label||'Reward')+'!');
  }else if(inv.type==='match_invite'){
    await joinSquadWithFriend(inv.fromPid,inv.fromName,inv.payload?.map||S.map);
  }
  render();
}
function declineInvite(msgId){handledIds[msgId]=1;INBOX=INBOX.filter(i=>i.id!==msgId);render()}

async function sendGift(toPid,toName,kind){
  if(!DB||!USER)return toast('Sign in with Google first');
  let costCur='coins',cost=50,payload={coins:50,label:'50 Basic Coins (🪙)'};
  if(kind==='key'){costCur='keys';cost=1;payload={keys:1,label:'1 Armory Key (🗝️)'}}
  if(kind==='cp'){costCur='cp';cost=15;payload={cp:15,label:'15 CP (💎)'}}
  if(S[costCur]<cost)return toast('Not enough '+costCur.toUpperCase()+' to send this gift');
  S[costCur]-=cost;save();
  OUTBOX.push({id:'GFT_'+Date.now(),type:'gift',fromUid:USER.uid,fromPid:S.id,fromName:S.name,fromAvatar:'🎁',toPid,payload,ts:Date.now()});
  await pushMyPlayerDoc();render();
  SFX.coin();toast('🎁 Sent '+payload.label+' to '+esc(toName)+'!');
}

async function inviteFriendToPlay(toPid,toName){
  if(!DB||!USER)return toast('Sign in with Google first');
  if(squadMembers().length>=5)return toast('Squad is already full (5/5 members)!');
  if(!SQUAD_ID){
    SQUAD_ID='SQ_'+S.id;
    SQUAD_META={id:SQUAD_ID,hostPid:S.id,hostName:S.name,map:S.map,mode:S.mode,status:'lobby',kicked:[],startTs:0};
    listenSquadRoom();
  }
  if(!isSquadHost())return toast('Only the Squad Host (👑) can invite new members!');
  OUTBOX=OUTBOX.filter(o=>!(o.type==='match_invite'&&o.toPid===toPid));
  OUTBOX.push({
    id:'SQINV_'+Date.now()+'_'+toPid,type:'match_invite',fromUid:USER.uid,fromPid:S.id,fromName:S.name,fromAvatar:'👑',
    toPid,payload:{squadId:SQUAD_ID,map:S.map,mapName:activeMap().name},ts:Date.now()
  });
  await pushMyPlayerDoc();
  updateLobbySquad();render();
  toast('🎮 Squad Invite sent to '+esc(toName)+'! ('+squadMembers().length+'/5 in lobby)');
}

async function joinSquadWithFriend(hostPid,hostName,mapId){
  SQUAD_ID='SQ_'+hostPid;
  SQUAD_META={id:SQUAD_ID,hostPid,hostName,map:mapId||S.map,mode:S.mode,status:'lobby',kicked:[],startTs:0};
  MY_READY=1;
  S.map=SQUAD_META.map;
  listenSquadRoom();
  await pushMyPlayerDoc();
  updateLobbySquad();pg='';render();
  toast('🪖 Joined '+esc(hostName)+'\'s 5-Player Squad Lobby!');
}

async function toggleReady(){
  MY_READY=MY_READY?0:1;
  SFX.click();
  await pushMyPlayerDoc();
  render();
}

async function kickSquadMember(pid){
  if(!isSquadHost()||!SQUAD_META)return;
  SQUAD_META.kicked=[...(SQUAD_META.kicked||[]),pid];
  await pushMyPlayerDoc();
  toast('Removed player from squad.');
}

async function leaveSquad(silent=false){
  if(unsubSquad){unsubSquad();unsubSquad=null}
  SQUAD_ID=null;SQUAD_DOCS={};SQUAD_META=null;MY_READY=1;
  VOICE.closeAll();
  await pushMyPlayerDoc({squadId:null,squadMeta:null,battle:null});
  updateLobbySquad();
  if(!silent){toast('🚪 Left Squad Lobby');render()}
}

async function launchSquadMatch(){
  if(!SQUAD_ID||!isSquadHost())return toast('Waiting for Squad Host (👑) to start match...');
  SQUAD_META.status='started';
  SQUAD_META.startTs=Date.now();
  SQUAD_META.map=S.map;
  await pushMyPlayerDoc();
  startMatch(SQUAD_ID);
}

function openInvitePicker(){
  if(!S.friends.length)return go('clan','Friends');
  const inSq=new Set(squadMembers().map(m=>m.pid));
  const avail=S.friends.filter(f=>!inSq.has(f.i));
  if(!avail.length)return go('clan','Friends');
  const m=document.createElement('div');m.className='modal';m.onclick=e=>{if(e.target===m)m.remove()};
  m.innerHTML='<div class="pop R" style="max-width:26rem"><div class="rR">➕ INVITE TO 5-PLAYER SQUAD</div><h2 style="margin:6px 0">SELECT FRIENDS ('+squadMembers().length+'/5)</h2>'+
    avail.map(f=>'<div class="fr R"><span style="font-size:1.5rem">'+esc(f.a||'🪖')+'</span><div style="flex:1;text-align:left"><b>'+esc(f.n)+'</b> <span class="s">Lv '+f.l+'</span></div><button class="sm" onclick="inviteFriendToPlay(\''+esc(f.i)+'\',\''+esc(f.n).replace(/'/g,'')+'\');this.disabled=true;this.textContent=\'SENT\'">INVITE</button></div>').join('')+
    '<div class="row" style="justify-content:center;margin-top:10px"><button class="sm alt" onclick="go(\'clan\',\'Friends\');this.closest(\'.modal\').remove()">ADD BY ID</button><button class="sm" onclick="this.closest(\'.modal\').remove()">DONE</button></div></div>';
  document.body.appendChild(m);
}

function showMatchInviteModal(inv){
  const m=document.createElement('div');m.className='modal';
  m.innerHTML='<div class="pop L"><div class="rL">👑 5-PLAYER SQUAD INVITE</div><div class="big">🪖</div><h2>'+esc(inv.fromName)+'</h2><p class="s" style="margin:6px 0 14px">Invited you to join their Squad Lobby on <b>'+esc(inv.payload?.mapName||'Firing Range')+'</b>!</p><div class="row" style="justify-content:center;gap:10px"><button class="sm" onclick="this.closest(\'.modal\').remove();acceptInvite(\''+inv.id+'\')">JOIN SQUAD</button><button class="sm alt" onclick="this.closest(\'.modal\').remove();declineInvite(\''+inv.id+'\')">DECLINE</button></div></div>';
  document.body.appendChild(m);
}

/* ===== REAL-TIME BATTLE PACKET SYNC & INSTANT DISCONNECT CLEANUP ===== */
async function syncBattleState(force=false){
  if(!DB||!USER||!SQUAD_ID||!AR)return;
  if(battleSyncBusy&&!force)return;
  battleSyncBusy=1;
  try{
    await pushMyPlayerDoc({battle:AR.getPacket()});
  }catch(e){}
  battleSyncBusy=0;
}

async function markExitedBattle(){
  if(!DB||!USER)return;
  try{
    await pushMyPlayerDoc({battle:{inMatch:false,ts:Date.now()}});
  }catch(e){}
}

/* Heartbeat every 4s while in Squad Lobby so offline members auto-clear */
setInterval(()=>{if(SQUAD_ID&&DB&&USER&&!AR)pushMyPlayerDoc()},4000);
window.addEventListener('beforeunload',()=>{
  if(DB&&USER&&SQUAD_ID){
    try{DB.collection('players').doc(USER.uid).set({squadId:null,battle:{inMatch:false,ts:0}},{merge:true})}catch(e){}
  }
});

/* ===== WORKING WEBRTC PEER-TO-PEER MIC & SPEAKER VOICE CHAT ===== */
const VOICE=(()=>{
  let micOn=false,spkOn=true,speaking=false,localStream=null,audioCtx=null,analyser=null,vadTimer=null;
  const peers={},audios={},signals=[],seenSigIds={};
  const RTC_CFG={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]};

  function updBtns(){
    const m1=document.getElementById('ar-mic'),s1=document.getElementById('ar-spk');
    if(m1){m1.className='abtn-top '+(micOn?'on':'muted');m1.textContent=micOn?'🎙️':'🔇'}
    if(s1){s1.className='abtn-top '+(spkOn?'on':'muted');s1.textContent=spkOn?'🔊':'🔈'}
  }

  function startVad(stream){
    try{
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      audioCtx=new AC();
      const src=audioCtx.createMediaStreamSource(stream);
      analyser=audioCtx.createAnalyser();analyser.fftSize=256;
      src.connect(analyser);
      const buf=new Uint8Array(analyser.frequencyBinCount);
      vadTimer=setInterval(()=>{
        if(!micOn||!analyser){speaking=false;return}
        analyser.getByteFrequencyData(buf);
        let sum=0;for(let i=0;i<buf.length;i++)sum+=buf[i];
        const nowSpk=(sum/buf.length)>18;
        if(nowSpk!==speaking){
          speaking=nowSpk;
          if(SQUAD_ID&&DB&&USER)pushMyPlayerDoc();
          if(!AR&&pg==='')render();
        }
      },250);
    }catch(e){}
  }

  async function toggleMic(){
    if(!micOn){
      try{
        if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)return toast('Microphone not supported on this browser.');
        localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
        micOn=true;
        startVad(localStream);
        Object.values(peers).forEach(pc=>{
          localStream.getTracks().forEach(tr=>{
            if(!pc.getSenders().some(s=>s.track&&s.track.kind==='audio'))pc.addTrack(tr,localStream);
          });
        });
        toast('🎙️ Squad Mic ON — Teammates can hear you!');
      }catch(e){
        micOn=false;
        toast('Mic permission denied. Allow microphone access in browser settings.');
      }
    }else{
      micOn=false;speaking=false;
      if(vadTimer){clearInterval(vadTimer);vadTimer=null}
      if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null}
      toast('🔇 Squad Mic Muted');
    }
    updBtns();
    if(SQUAD_ID)pushMyPlayerDoc();
    if(!AR)render();
  }

  function toggleSpk(){
    spkOn=!spkOn;
    Object.values(audios).forEach(a=>{a.muted=!spkOn});
    updBtns();
    toast(spkOn?'🔊 Squad Speaker ON':'🔈 Squad Speaker Muted');
    if(!AR)render();
  }

  function pushSig(toPid,kind,data){
    signals.push({id:'SIG_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),fromPid:S.id,toPid,kind,data,ts:Date.now()});
    if(signals.length>24)signals.splice(0,signals.length-24);
    pushMyPlayerDoc();
  }

  function ensurePeer(remotePid,initiator){
    if(peers[remotePid])return peers[remotePid];
    const pc=new RTCPeerConnection(RTC_CFG);
    peers[remotePid]=pc;

    if(localStream){
      localStream.getTracks().forEach(tr=>pc.addTrack(tr,localStream));
    }else{
      try{pc.addTransceiver('audio',{direction:'sendrecv'})}catch(e){}
    }

    pc.onicecandidate=e=>{
      if(e.candidate)pushSig(remotePid,'ice',JSON.stringify(e.candidate));
    };
    pc.ontrack=e=>{
      let el=audios[remotePid];
      if(!el){
        el=document.createElement('audio');
        el.autoplay=true;el.playsInline=true;
        document.body.appendChild(el);
        audios[remotePid]=el;
      }
      el.srcObject=e.streams[0];
      el.muted=!spkOn;
      el.play().catch(()=>{});
    };

    if(initiator){
      pc.createOffer().then(off=>pc.setLocalDescription(off)).then(()=>{
        pushSig(remotePid,'offer',JSON.stringify(pc.localDescription));
      }).catch(()=>{});
    }
    return pc;
  }

  function syncPeers(docs){
    if(!SQUAD_ID){closeAll();return}
    const activePids=new Set();
    docs.forEach(d=>{
      if(!d||d.pid===S.id)return;
      if(Date.now()-(d.squadPing||0)>15000)return;
      activePids.add(d.pid);
      /* Deterministic initiator: lower Player ID creates the WebRTC offer */
      const initiator=S.id<d.pid;
      const pc=ensurePeer(d.pid,initiator);

      (d.rtcSignals||[]).forEach(async sig=>{
        if(sig.toPid!==S.id||seenSigIds[sig.id])return;
        seenSigIds[sig.id]=1;
        try{
          if(sig.kind==='offer'){
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sig.data)));
            const ans=await pc.createAnswer();
            await pc.setLocalDescription(ans);
            pushSig(d.pid,'answer',JSON.stringify(pc.localDescription));
          }else if(sig.kind==='answer'){
            if(pc.signalingState==='have-local-offer'){
              await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sig.data)));
            }
          }else if(sig.kind==='ice'){
            await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(sig.data)));
          }
        }catch(e){}
      });
    });

    Object.keys(peers).forEach(pid=>{
      if(!activePids.has(pid)){
        try{peers[pid].close()}catch(e){}
        delete peers[pid];
        if(audios[pid]){audios[pid].remove();delete audios[pid]}
      }
    });
  }

  function closeAll(){
    Object.keys(peers).forEach(pid=>{try{peers[pid].close()}catch(e){}delete peers[pid]});
    Object.keys(audios).forEach(pid=>{audios[pid].remove();delete audios[pid]});
    signals.length=0;
  }

  return{
    get micOn(){return micOn},
    get spkOn(){return spkOn},
    get speaking(){return speaking},
    signals,toggleMic,toggleSpk,syncPeers,closeAll
  };
})();
