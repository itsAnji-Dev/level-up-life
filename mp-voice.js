/* ===== LIVE SQUAD INVITATIONS, 5-PLAYER LOBBY, 3D ARENA SYNC & WEBRTC VOICE CHAT ===== */
let INBOX=[],OUTBOX=[],SQUAD_ID=null,SQUAD_META=null,SQUAD_DOCS={},MY_READY=false;
let unsubInbox=null,unsubOutbox=null,unsubSquad=null,voiceTimer=null,battleSyncTimer=null;
const handledIds={};

function isSquadHost(){return !SQUAD_ID||(SQUAD_META&&SQUAD_META.hostPid===S.id)||(SQUAD_ID==='SQ_'+S.id)}
function squadMembers(){
  const me={pid:S.id,name:S.name,lvl:S.lvl,avatar:S.eq.char>=0?ITEMS[S.eq.char].ic:'🪖',eq:S.eq,ready:isSquadHost()?true:MY_READY,isHost:isSquadHost(),me:1,speaking:VOICE.speaking};
  if(!SQUAD_ID)return [me];
  const nowMs=Date.now(),list=[me];
  Object.values(SQUAD_DOCS).forEach(d=>{
    if(!d||d.pid===S.id||d.squadId!==SQUAD_ID)return;
    const ping=d.squadPing||0;
    if(ping&&(nowMs-ping)>15000)return;
    const isH=SQUAD_META?SQUAD_META.hostPid===d.pid:(SQUAD_ID==='SQ_'+d.pid);
    list.push({pid:d.pid,name:d.n||'Player',lvl:d.l||1,avatar:d.a||'🪖',eq:d.eq||{gun:3,skin:-1,char:-1},ready:isH?true:!!d.squadReady,isHost:isH,me:0,speaking:!!d.speaking,battle:d.battle||null});
  });
  return list.slice(0,5);
}

function safeRender(force=false){
  if(busy||inLogin)return;
  if(!force&&pg===''&&typeof patchHomeSquad==='function'&&document.getElementById('sq-dock-wrap')){
    patchHomeSquad();
  }else{
    render();
  }
}

async function pushMyPlayerDoc(extra={}){
  if(!DB||!USER)return;
  const doc=Object.assign({
    pid:S.id,n:S.name,l:S.lvl,c:Object.keys(S.owned).length,s:S.streak,
    a:S.eq.char>=0?ITEMS[S.eq.char].ic:'🪖',eq:S.eq,map:S.map,
    outbox:OUTBOX.slice(-25),outboxTargets:[...new Set(OUTBOX.map(o=>o.toPid))],
    squadId:SQUAD_ID||null,squadReady:MY_READY?1:0,squadPing:Date.now(),
    speaking:!!VOICE.speaking,
    t:firebase.firestore.FieldValue.serverTimestamp()
  },extra);
  if(SQUAD_ID&&isSquadHost()&&SQUAD_META){
    SQUAD_META.map=S.map;
    SQUAD_META.mode=S.mode;
    doc.squadMeta=SQUAD_META;
  }
  await DB.collection('players').doc(USER.uid).set(doc,{merge:true});
}

function listenMultiplayer(){
  if(!DB||!USER)return;
  if(unsubInbox)unsubInbox();
  if(unsubOutbox)unsubOutbox();
  unsubInbox=DB.collection('players').where('outboxTargets','array-contains',S.id).onSnapshot(sn=>{
    const next=[];
    sn.forEach(d=>{
      const x=d.data(),box=Array.isArray(x.outbox)?x.outbox:[];
      box.forEach(m=>{
        if(m&&m.toPid===S.id){
          next.push(Object.assign({},m,{fromUid:d.id,fromName:m.fromName||x.n||'Player',fromAvatar:m.fromAvatar||x.a||'🪖'}));
        }
      });
    });
    next.sort((a,b)=>(b.ts||0)-(a.ts||0));
    next.forEach(m=>{
      if(!handledIds[m.id]&&m.type!=='friend_ack'&&m.type!=='gift_ack'){
        handledIds[m.id]=1;
        if(m.type==='friend_req')toast('👋 Friend request from '+esc(m.fromName)+'!');
        else if(m.type==='match_invite')toast('🎮 Squad invite from '+esc(m.fromName)+' ('+esc(m.payload?.mapName||'Firing Range')+')!');
        else if(m.type==='gift')toast('🎁 Gift from '+esc(m.fromName)+': '+esc(m.payload?.label||''));
      }
    });
    INBOX=next;
    safeRender();
  },err=>console.warn('inbox listener',err));

  unsubOutbox=DB.collection('players').doc(USER.uid).onSnapshot(d=>{
    if(!d.exists)return;
    const x=d.data(),box=Array.isArray(x.outbox)?x.outbox:[];
    let changed=false;
    box.forEach(m=>{
      if(!m||!m.acked||handledIds['ack_'+m.id])return;
      handledIds['ack_'+m.id]=1;
      if(m.type==='friend_req'){
        const p=m.ackPayload||{};
        S.friends=S.friends.filter(f=>f.i!==m.toPid);
        S.friends.push({n:p.name||m.toName||'Player',i:m.toPid,l:p.lvl||1,c:p.owned||2,s:p.streak||0,a:p.avatar||'🪖',eq:p.eq||{gun:3,skin:-1,char:-1}});
        save();listenFriends();changed=true;
        toast('✅ '+(p.name||m.toName||'Friend')+' accepted your friend request!');
      }else if(m.type==='gift'){
        toast('🎁 '+(m.toName||'Friend')+' claimed your gift!');
      }
    });
    OUTBOX=box.filter(m=>!m.acked);
    if(changed){safeRender(true)}
  },err=>console.warn('outbox listener',err));

  if(SQUAD_ID)listenSquadRoom();
  startBattleSyncLoop();
}

function listenSquadRoom(){
  if(unsubSquad)unsubSquad();
  SQUAD_DOCS={};
  if(!DB||!USER||!SQUAD_ID){safeRender();return}
  unsubSquad=DB.collection('players').where('squadId','==',SQUAD_ID).onSnapshot(sn=>{
    const nextDocs={};let hostDoc=null;
    sn.forEach(d=>{
      const x=d.data();
      nextDocs[x.pid]=Object.assign({uid:d.id},x);
      if(SQUAD_ID==='SQ_'+x.pid||(x.squadMeta&&x.squadMeta.id===SQUAD_ID&&x.squadMeta.hostPid===x.pid))hostDoc=x;
    });
    SQUAD_DOCS=nextDocs;
    if(hostDoc&&hostDoc.squadMeta){
      SQUAD_META=hostDoc.squadMeta;
      if(!isSquadHost()&&SQUAD_META.map&&S.map!==SQUAD_META.map){
        S.map=SQUAD_META.map;lsave();
        if(!AR&&typeof drawMapRadar==='function'&&pg==='maps')setTimeout(drawMapRadar,20);
      }
      if(!isSquadHost()&&SQUAD_META.status==='started'&&!AR&&!AR_LOADING&&!handledIds['start_'+SQUAD_META.startTs]){
        handledIds['start_'+SQUAD_META.startTs]=1;
        startMatch(SQUAD_ID);
      }
    }
    if(typeof updateLobbySquad==='function')updateLobbySquad();
    safeRender();
    if(AR&&AR.syncTeammates)AR.syncTeammates(squadMembers());
  },err=>console.warn('squad listener',err));
}

async function ensureSquadRoom(){
  if(!USER||!DB)return toast('Sign in with Google first to use live Squads!');
  if(!SQUAD_ID){
    SQUAD_ID='SQ_'+S.id;
    SQUAD_META={id:SQUAD_ID,hostPid:S.id,hostName:S.name,map:S.map,mode:S.mode,status:'lobby',startTs:0};
    MY_READY=true;
    await pushMyPlayerDoc();
    listenSquadRoom();
    if(typeof updateLobbySquad==='function')updateLobbySquad();
    VOICE.joinRoom(SQUAD_ID);
  }
}

async function sendFriendReqById(){
  if(!USER||!DB)return toast('Sign in with Google first to send live requests!');
  const inp=document.getElementById('fid');const targetPid=(inp?inp.value:'').trim().toUpperCase();
  if(!targetPid)return toast('Enter a Friend Player ID');
  if(targetPid===S.id)return toast('That is your own Player ID');
  const snap=await DB.collection('players').where('pid','==',targetPid).limit(1).get();
  if(snap.empty)return toast('Player ID not found online. Ask your friend to sign in with Google first!');
  const targetDoc=snap.docs[0].data();
  const msg={id:'m_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),type:'friend_req',toPid:targetPid,toName:targetDoc.n||'Player',fromPid:S.id,fromName:S.name,fromAvatar:S.eq.char>=0?ITEMS[S.eq.char].ic:'🪖',payload:{lvl:S.lvl,owned:Object.keys(S.owned).length,streak:S.streak,eq:S.eq},ts:Date.now()};
  OUTBOX.push(msg);
  await pushMyPlayerDoc();
  if(inp)inp.value='';
  toast('📨 Friend request sent to '+(targetDoc.n||targetPid)+'!');
}

async function inviteFriendToPlay(friendPid,friendName){
  if(!USER||!DB)return toast('Sign in with Google first to invite friends!');
  await ensureSquadRoom();
  if(squadMembers().length>=5)return toast('Squad is full (5/5 max players)');
  const mapObj=activeMap();
  const msg={id:'m_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),type:'match_invite',toPid:friendPid,toName:friendName,fromPid:S.id,fromName:S.name,fromAvatar:S.eq.char>=0?ITEMS[S.eq.char].ic:'🪖',payload:{squadId:SQUAD_ID,mapId:mapObj.id,mapName:mapObj.name,mode:S.mode},ts:Date.now()};
  OUTBOX.push(msg);
  await pushMyPlayerDoc();
  toast('🎮 Squad invite sent to '+friendName+' ('+mapObj.name+')!');
}

async function sendGift(friendPid,friendName,kind){
  if(!USER||!DB)return toast('Sign in with Google first to send gifts!');
  const amt=kind==='cp'?15:50,lbl=kind==='cp'?'15 💎 CP':'50 🪙 Coins';
  if(kind==='cp'){if(S.cp<amt)return toast('Need 15 💎 CP');S.cp-=amt}
  else{if(S.coins<amt)return toast('Need 50 🪙 Coins');S.coins-=amt}
  const msg={id:'m_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),type:'gift',toPid:friendPid,toName:friendName,fromPid:S.id,fromName:S.name,fromAvatar:S.eq.char>=0?ITEMS[S.eq.char].ic:'🪖',payload:{kind,amount:amt,label:lbl},ts:Date.now()};
  OUTBOX.push(msg);
  save();await pushMyPlayerDoc();render();
  toast('🎁 Sent '+lbl+' to '+friendName+'!');
}

async function ackSenderMessage(fromUid,msgId,ackPayload=null){
  if(!DB||!fromUid||!msgId)return;
  const ref=DB.collection('players').doc(fromUid);
  await DB.runTransaction(async tx=>{
    const d=await tx.get(ref);if(!d.exists)return;
    const box=Array.isArray(d.data().outbox)?d.data().outbox:[];
    const upd=box.map(m=>m&&m.id===msgId?Object.assign({},m,{acked:1,ackPayload}):m);
    tx.update(ref,{outbox:upd});
  });
}

async function acceptInvite(msgId){
  const inv=INBOX.find(x=>x.id===msgId);if(!inv)return;
  INBOX=INBOX.filter(x=>x.id!==msgId);
  if(inv.type==='friend_req'){
    S.friends=S.friends.filter(f=>f.i!==inv.fromPid);
    S.friends.push({n:inv.fromName,i:inv.fromPid,l:inv.payload?.lvl||1,c:inv.payload?.owned||2,s:inv.payload?.streak||0,a:inv.fromAvatar||'🪖',eq:inv.payload?.eq||{gun:3,skin:-1,char:-1}});
    save();listenFriends();
    await ackSenderMessage(inv.fromUid,inv.id,{name:S.name,lvl:S.lvl,owned:Object.keys(S.owned).length,streak:S.streak,avatar:S.eq.char>=0?ITEMS[S.eq.char].ic:'🪖',eq:S.eq});
    await pushMyPlayerDoc();
    toast('🤝 You and '+inv.fromName+' are now friends!');
  }else if(inv.type==='gift'){
    const k=inv.payload?.kind,amt=inv.payload?.amount||0;
    if(k==='cp')S.cp+=amt;else S.coins+=amt;
    SFX.quest();save();
    await ackSenderMessage(inv.fromUid,inv.id,{claimed:1});
    await pushMyPlayerDoc();
    toast('🎉 Claimed '+(inv.payload?.label||'gift')+' from '+inv.fromName+'!');
  }else if(inv.type==='match_invite'){
    await ackSenderMessage(inv.fromUid,inv.id,{joined:1});
    await joinSquadWithFriend(inv.fromPid,inv.fromName,inv.payload?.mapId);
  }
  safeRender(true);
}

async function declineInvite(msgId){
  const inv=INBOX.find(x=>x.id===msgId);if(!inv)return;
  INBOX=INBOX.filter(x=>x.id!==msgId);
  await ackSenderMessage(inv.fromUid,inv.id,{declined:1});
  toast('Declined invitation from '+inv.fromName);
  safeRender(true);
}

async function joinSquadWithFriend(hostPid,hostName,mapId){
  SQUAD_ID='SQ_'+hostPid;
  SQUAD_META={id:SQUAD_ID,hostPid,hostName:hostName||'Squad Host',map:mapId||S.map,mode:'5-Player Squad Battle',status:'lobby',startTs:0};
  MY_READY=true;
  if(mapId){S.map=mapId;lsave()}
  await pushMyPlayerDoc();
  listenSquadRoom();
  if(typeof updateLobbySquad==='function')updateLobbySquad();
  VOICE.joinRoom(SQUAD_ID);
  go('');
  toast('👥 Joined '+(hostName||'Host')+'\'s 5-Player Squad! Voice chat connected.');
}

async function toggleReady(){
  if(!SQUAD_ID||isSquadHost())return;
  MY_READY=!MY_READY;
  await pushMyPlayerDoc();
  safeRender();
}

async function kickSquadMember(targetPid){
  if(!SQUAD_ID||!isSquadHost())return;
  const msg={id:'kick_'+Date.now(),type:'squad_kick',toPid:targetPid,fromPid:S.id,fromName:S.name,ts:Date.now()};
  OUTBOX.push(msg);
  await pushMyPlayerDoc();
  toast('Removed member from squad');
}

async function leaveSquad(silent=false){
  VOICE.leaveRoom();
  if(unsubSquad){unsubSquad();unsubSquad=null}
  SQUAD_ID=null;SQUAD_META=null;SQUAD_DOCS={};MY_READY=false;
  await pushMyPlayerDoc({squadId:null,squadReady:0});
  if(typeof updateLobbySquad==='function')updateLobbySquad();
  if(!silent){safeRender();toast('Left squad')}
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
  if(!USER||!DB)return toast('Sign in with Google first to invite friends to your squad!');
  const m=document.createElement('div');m.className='modal';m.onclick=e=>{if(e.target===m)m.remove()};
  const rows=S.friends.length
    ?S.friends.map(f=>'<div class="fr R"><span style="font-size:1.6rem">'+esc(f.a||'🪖')+'</span><div style="flex:1"><b>'+esc(f.n)+'</b> <span class="s">('+esc(f.i)+')</span><div class="s">Lv '+f.l+'</div></div><button class="sm" onclick="inviteFriendToPlay(\''+esc(f.i)+'\',\''+esc(f.n).replace(/'/g,'')+'\');this.closest(\'.modal\').remove()">INVITE</button></div>').join('')
    :'<p class="s" style="margin:10px 0">Add friends in Clan → Friends using their Player ID first.</p>';
  m.innerHTML='<div class="pop L" style="max-width:26rem;width:92%;text-align:left"><div class="rL" style="text-align:center">INVITE TO 5-PLAYER SQUAD</div><h2 style="margin:6px 0">Select Friend</h2><div style="max-height:14rem;overflow:auto">'+rows+'</div><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="sm alt" onclick="this.closest(\'.modal\').remove()">CLOSE</button></div></div>';
  document.body.appendChild(m);
}

function startBattleSyncLoop(){
  if(battleSyncTimer)clearInterval(battleSyncTimer);
  battleSyncTimer=setInterval(async()=>{
    if(!USER||!DB)return;
    const pkt=AR&&AR.getPacket?AR.getPacket():null;
    const nowMs=Date.now();
    const extra={squadPing:nowMs,speaking:!!VOICE.speaking};
    if(pkt)extra.battle=pkt;
    else if(SQUAD_DOCS[S.id]&&SQUAD_DOCS[S.id].battle)extra.battle=Object.assign({},SQUAD_DOCS[S.id].battle,{inMatch:false});
    try{await DB.collection('players').doc(USER.uid).set(extra,{merge:true})}catch(e){}
    if(SQUAD_ID&&SQUAD_DOCS[S.id]&&!isSquadHost()){
      const myBox=Array.isArray(SQUAD_DOCS[S.id].outbox)?SQUAD_DOCS[S.id].outbox:[];
      if(myBox.some(x=>x&&x.type==='squad_kick')){
        toast('You were removed from the squad');
        leaveSquad(true);
      }
    }
    if(AR&&AR.syncTeammates)AR.syncTeammates(squadMembers());
  },450);
}

/* ===== WEBRTC LIVE VOICE CHAT OVER FIRESTORE SIGNALING ===== */
const VOICE=(()=>{
  let micOn=false,spkOn=true,speaking=false,roomId=null,localStream=null,analyser=null,vadTimer=null;
  const peers={},unsubs=[],iceQueue={};
  const RTC_CFG={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]};

  async function ensureLocalAudio(){
    if(localStream)return localStream;
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error('Microphone not supported in this browser');
    localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    localStream.getAudioTracks().forEach(t=>t.enabled=micOn);
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      const ac=new AC(),src=ac.createMediaStreamSource(localStream);
      analyser=ac.createAnalyser();analyser.fftSize=256;src.connect(analyser);
      const buf=new Uint8Array(analyser.frequencyBinCount);
      vadTimer=setInterval(()=>{
        if(!micOn||!analyser){speaking=false;return}
        analyser.getByteFrequencyData(buf);
        let sum=0;for(let i=0;i<buf.length;i++)sum+=buf[i];
        const avg=sum/buf.length;
        const was=speaking;speaking=avg>18;
        if(was!==speaking&&typeof patchHomeSquad==='function'&&pg===''&&!AR)patchHomeSquad();
      },180);
    }catch(e){}
    return localStream;
  }

  function sigCol(){return DB.collection('squad_voice').doc(roomId).collection('signals')}

  async function createPeer(remotePid,initiator){
    if(peers[remotePid])return peers[remotePid];
    const pc=new RTCPeerConnection(RTC_CFG);
    peers[remotePid]=pc;iceQueue[remotePid]=[];
    if(localStream){localStream.getTracks().forEach(tr=>pc.addTrack(tr,localStream))}
    pc.onicecandidate=ev=>{
      if(ev.candidate&&roomId&&DB){
        sigCol().add({from:S.id,to:remotePid,type:'ice',cand:ev.candidate.toJSON(),t:Date.now()}).catch(()=>{});
      }
    };
    pc.ontrack=ev=>{
      let aud=document.getElementById('vaud_'+remotePid);
      if(!aud){aud=document.createElement('audio');aud.id='vaud_'+remotePid;aud.autoplay=true;aud.playsInline=true;document.body.appendChild(aud)}
      aud.srcObject=ev.streams[0];aud.muted=!spkOn;
    };
    if(initiator){
      const offer=await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sigCol().add({from:S.id,to:remotePid,type:'offer',sdp:offer.sdp,t:Date.now()});
    }
    return pc;
  }

  async function handleSignal(s){
    if(!s||s.to!==S.id||s.from===S.id)return;
    if(s.type==='offer'){
      if(micOn)await ensureLocalAudio().catch(()=>{});
      const pc=await createPeer(s.from,false);
      await pc.setRemoteDescription(new RTCSessionDescription({type:'offer',sdp:s.sdp}));
      for(const c of iceQueue[s.from]||[])await pc.addIceCandidate(new RTCIceCandidate(c)).catch(()=>{});
      iceQueue[s.from]=[];
      const ans=await pc.createAnswer();
      await pc.setLocalDescription(ans);
      await sigCol().add({from:S.id,to:s.from,type:'answer',sdp:ans.sdp,t:Date.now()});
    }else if(s.type==='answer'){
      const pc=peers[s.from];
      if(pc&&pc.signalingState==='have-local-offer'){
        await pc.setRemoteDescription(new RTCSessionDescription({type:'answer',sdp:s.sdp}));
        for(const c of iceQueue[s.from]||[])await pc.addIceCandidate(new RTCIceCandidate(c)).catch(()=>{});
        iceQueue[s.from]=[];
      }
    }else if(s.type==='ice'&&s.cand){
      const pc=peers[s.from];
      if(pc&&pc.remoteDescription)await pc.addIceCandidate(new RTCIceCandidate(s.cand)).catch(()=>{});
      else{iceQueue[s.from]=iceQueue[s.from]||[];iceQueue[s.from].push(s.cand)}
    }
  }

  function joinRoom(newRoomId){
    if(!DB||!USER||!newRoomId)return;
    if(roomId===newRoomId)return;
    leaveRoom();
    roomId=newRoomId;
    const u1=sigCol().where('to','==',S.id).onSnapshot(sn=>{
      sn.docChanges().forEach(ch=>{if(ch.type==='added')handleSignal(ch.doc.data())});
    });
    unsubs.push(u1);
    clearInterval(voiceTimer);
    voiceTimer=setInterval(async()=>{
      if(!roomId||!micOn)return;
      for(const m of squadMembers()){
        if(!m.me&&!peers[m.pid]&&S.id<m.pid){
          await ensureLocalAudio().catch(()=>{});
          await createPeer(m.pid,true);
        }
      }
    },1800);
  }

  function leaveRoom(){
    clearInterval(voiceTimer);
    unsubs.forEach(fn=>{try{fn()}catch(e){}});unsubs.length=0;
    Object.keys(peers).forEach(k=>{try{peers[k].close()}catch(e){};delete peers[k];const a=document.getElementById('vaud_'+k);if(a)a.remove()});
    roomId=null;speaking=false;
  }

  async function toggleMic(){
    if(!USER||!DB)return toast('Sign in with Google for squad voice chat!');
    if(!SQUAD_ID)await ensureSquadRoom();
    if(!micOn){
      try{
        await ensureLocalAudio();
        micOn=true;
        localStream.getAudioTracks().forEach(t=>t.enabled=true);
        toast('🎙️ Squad Mic ON');
      }catch(e){toast('Mic permission denied or unavailable');micOn=false}
    }else{
      micOn=false;speaking=false;
      if(localStream)localStream.getAudioTracks().forEach(t=>t.enabled=false);
      toast('🔇 Squad Mic MUTED');
    }
    updateVoiceButtons();
    safeRender();
  }

  function toggleSpk(){
    spkOn=!spkOn;
    document.querySelectorAll('audio[id^="vaud_"]').forEach(a=>{a.muted=!spkOn});
    toast(spkOn?'🔊 Squad Speaker ON':'🔈 Squad Speaker MUTED');
    updateVoiceButtons();
    safeRender();
  }

  function updateVoiceButtons(){
    const m=document.getElementById('ar-mic'),sp=document.getElementById('ar-spk');
    if(m){m.textContent=micOn?'🎙️':'🔇';m.className='abtn-top '+(micOn?'on':'muted')}
    if(sp){sp.textContent=spkOn?'🔊':'🔈';sp.className='abtn-top '+(spkOn?'on':'muted')}
  }

  return{get micOn(){return micOn},get spkOn(){return spkOn},get speaking(){return speaking},joinRoom,leaveRoom,toggleMic,toggleSpk};
})();
