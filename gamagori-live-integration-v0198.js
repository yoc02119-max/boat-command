// BOAT COMMAND GAMAGORI LIVE INTEGRATION v0.19.8 COMPATIBILITY GUARD
// The active v0.19.8 implementation is embedded once in app.js for the current early-trial build.
// This asset stays free of duplicate LIVE globals, but also hardens the legacy embedded renderer:
// READY/WAIT badges are prediction-only and race identity is derived from the visible race number.
(()=>{
  'use strict';
  const required=[
    'loadVerifiedLiveRace',
    'applyVerifiedLiveToPrediction',
    'liveRelayReadyPayload',
    'liveRelayReason'
  ];
  const missing=required.filter(name=>typeof window[name]!=='function');

  function raceNoFromCard(card){
    const n=Number((card?.querySelector('.race-no')?.textContent||'').replace(/\D/g,''));
    return Number.isInteger(n)&&n>=1&&n<=12?n:null;
  }

  function syncPredictionOnlyLiveBadges(){
    // The embedded v0.19.8 renderer predates the index rewrite and used every .race-card.
    // Remove any badge it may have placed outside the prediction list first.
    document.querySelectorAll('.race-card .live-auto-snapshot').forEach(badge=>{
      if(!badge.closest('#predictionList'))badge.remove();
    });

    let s=null;
    try{s=typeof window.session==='function'?window.session():null;}catch(e){s=null;}
    if(!s||s.runType!=='LIVE'){
      document.querySelectorAll('#predictionList .live-auto-snapshot').forEach(x=>x.remove());
      return;
    }

    document.querySelectorAll('#predictionList .race-card').forEach(card=>{
      const race=raceNoFromCard(card);
      let badge=card.querySelector('.live-auto-snapshot');
      if(!badge){badge=document.createElement('div');badge.className='live-auto-snapshot';card.prepend(badge);}

      if(!race){
        badge.innerHTML='<div class="prediction-gate limited"><b>WAIT｜予想保留</b><span>レース番号を安全に確認できません</span></div>';
        return;
      }
      const r=(s.races||[]).find(x=>Number(x.race)===race);
      if(!r){
        badge.innerHTML='<div class="prediction-gate limited"><b>WAIT｜予想保留</b><span>レース情報を照合できません</span></div>';
        return;
      }
      if(r.liveDataStatus==='READY'){
        badge.innerHTML='<div class="prediction-gate ready"><b>PREDICTION READY｜LIVE VERIFIED</b><span>展示・ST・艇番・気象・締切を安全監査済み</span></div>';
      }else if(r.liveDataStatus==='WAIT'){
        const reason=typeof window.esc==='function'?window.esc(r.liveDataReason||'直前データ待ち'):String(r.liveDataReason||'直前データ待ち');
        badge.innerHTML=`<div class="prediction-gate limited"><b>WAIT｜予想保留</b><span>${reason}</span></div>`;
      }else{
        badge.innerHTML='<div class="prediction-gate limited"><b>WAIT｜予想保留</b><span>verified LIVEデータ待ち</span></div>';
      }
    });
  }

  const previousRender=typeof window.renderAll==='function'?window.renderAll:null;
  if(previousRender){
    window.renderAll=function(){
      const out=previousRender.apply(this,arguments);
      syncPredictionOnlyLiveBadges();
      return out;
    };
  }

  window.BOAT_COMMAND_LIVE_INTEGRATION_COMPAT_V0198=Object.freeze({
    version:'GAMAGORI-LIVE-INTEGRATION-COMPAT-V0.19.8+DOM-SCOPE-V0.23.1',
    implementation:'app.js',
    duplicateGlobalsDeclared:false,
    predictionDomScoped:true,
    raceIdentityFailClosed:true,
    ok:missing.length===0,
    missing,
    checkedAt:new Date().toISOString()
  });
  if(missing.length){
    console.error('GAMAGORI_LIVE_INTEGRATION_EMBEDDED_IMPLEMENTATION_MISSING',missing);
  }
  syncPredictionOnlyLiveBadges();
})();

// v0.25.2: the PRE-RACE auto-chain writes race-N-pack.json. The legacy loader consumes race-N.json.
// Bridge the verified pack to the legacy relay contract, and fail closed when the receive-time buying
// margin is under two minutes. No POST-RACE/result endpoint is referenced here.
(()=>{
  'use strict';
  const VERSION='GAMAGORI-LIVE-PACK-BRIDGE-V0.25.2';
  const MIN_RECEIVE_MARGIN_MINUTES=2;
  const canonicalLoader=typeof window.loadVerifiedLiveRace==='function'?window.loadVerifiedLiveRace:null;

  function jstDeadline(date,hm){
    const m=String(hm||'').match(/^(\d{1,2}):(\d{2})$/);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||''))||!m)return null;
    const [y,mo,d]=String(date).split('-').map(Number),hh=Number(m[1]),mm=Number(m[2]);
    if(hh>23||mm>59)return null;
    return Date.UTC(y,mo-1,d,hh-9,mm,0,0);
  }
  function receiveGate(date,deadline){
    const t=jstDeadline(date,deadline);
    if(!Number.isFinite(t))return {ok:false,reason:'締切時刻を安全に確認できません'};
    const margin=(t-Date.now())/60000;
    if(margin<MIN_RECEIVE_MARGIN_MINUTES)return {ok:false,reason:`締切まで${MIN_RECEIVE_MARGIN_MINUTES}分未満のため予想保留`};
    return {ok:true,marginMinutes:margin};
  }
  function validatePack(x,date,race){
    if(!x||x.schema!=='boat-command-live-pre-race-pack-v1')throw new Error('INVALID_PACK_SCHEMA');
    if(x.venue!=='GAMAGORI'||x.date!==date||Number(x.race)!==Number(race))throw new Error('PACK_TARGET_MISMATCH');
    if(x.resultEndpointsIncluded!==false||x.predictionEnabled!==false||x.hardLockEnabled!==false)throw new Error('PACK_SAFETY_FLAGS_INVALID');
    if(x.timingStatus!=='VERIFIED'||x.boatMappingVerified!==true||x.weatherMappingVerified!==true||x.readyForPrediction!==true)throw new Error('PACK_NOT_VERIFIED');
    const boats=Array.isArray(x.boats)?x.boats:[],st=Array.isArray(x.startExhibition)?x.startExhibition:[];
    if(boats.length!==6||st.length!==6)throw new Error('PACK_SIX_BOAT_COMPLETENESS_INVALID');
    const lanes=new Set(),courses=new Set();
    for(const b of boats){
      const lane=Number(b?.lane);
      if(!Number.isInteger(lane)||lane<1||lane>6||lanes.has(lane))throw new Error('PACK_LANE_IDENTITY_INVALID');
      lanes.add(lane);
      if(!Number.isFinite(Number(b?.exhibitionTime))||!Number.isFinite(Number(b?.motor))||!Number.isFinite(Number(b?.boat)))throw new Error('PACK_BOAT_FIELDS_INVALID');
    }
    for(const row of st){
      const course=Number(row?.course);
      if(!Number.isInteger(course)||course<1||course>6||courses.has(course)||!String(row?.st||'').trim())throw new Error('PACK_START_EXHIBITION_INVALID');
      courses.add(course);
    }
    const w=x.weather||{};
    if(!Number.isFinite(Number(w.airTempC))||!Number.isFinite(Number(w.windSpeedMps))||!Number.isFinite(Number(w.waterTempC))||!Number.isFinite(Number(w.waveHeightCm)))throw new Error('PACK_WEATHER_INVALID');
    const gate=receiveGate(date,x.deadline);
    if(!gate.ok)throw new Error(gate.reason);
  }
  function normalizePack(x){
    return {
      schema:'boat-command-pre-race-probe-v1',bridgeVersion:'0.25.2-pack-bridge',venue:'GAMAGORI',venueCode:String(x.venueCode||'07'),date:x.date,race:Number(x.race),
      fetchedAt:x.fetchedAt||new Date().toISOString(),fetchedAtJST:null,deadline:x.deadline,
      racelist:{ok:true,httpStatus:200,bytes:0,sourceUrl:'AUTO_CHAIN_VERIFIED_PACK',boats:x.boats.map(b=>({lane:Number(b.lane),class:String(b.class||''),motor:Number(b.motor),boat:Number(b.boat)}))},
      beforeinfo:{ok:true,httpStatus:200,bytes:0,sourceUrl:'AUTO_CHAIN_VERIFIED_PACK',exhibition:x.boats.map(b=>({lane:Number(b.lane),exhibitionTime:Number(b.exhibitionTime),tilt:Number(b.tilt)||0})),startExhibition:x.startExhibition.map(r=>({course:Number(r.course),st:String(r.st)})),weather:x.weather},
      verified:{timingStatus:x.timingStatus,boatMappingVerified:x.boatMappingVerified,weatherMappingVerified:x.weatherMappingVerified,readyForPrediction:x.readyForPrediction},
      safety:{resultEndpointsIncluded:false,predictionEnabled:false,hardLockEnabled:false}
    };
  }
  async function fetchPack(path){
    const res=await fetch(`${path}?v=${Date.now()}`,{cache:'no-store',credentials:'same-origin'});
    if(!res.ok)throw new Error(`HTTP_${res.status}`);
    return res.json();
  }

  window.loadVerifiedLiveRace=async function(date,race,{silent=false}={}){
    const checkedAt=new Date().toISOString(),canonicalPath=`./live/gamagori/${date}/pre/race-${race}.json`;
    if(canonicalLoader){
      const out=await canonicalLoader(date,race,{silent:true});
      if(out?.ready){
        const gate=receiveGate(date,out.payload?.deadline);
        return gate.ok?out:{ready:false,path:out.path||canonicalPath,payload:null,reason:gate.reason,checkedAt};
      }
      if(out&&out.reason&&!/HTTP_404/.test(String(out.reason)))return out;
    }
    const packPath=`./live/gamagori/${date}/pre/race-${race}-pack.json`;
    try{
      const pack=await fetchPack(packPath);
      validatePack(pack,date,race);
      const payload=normalizePack(pack);
      if(typeof window.validateRelayPayload==='function')window.validateRelayPayload(payload,date,race);
      const ready=typeof window.liveRelayReadyPayload==='function'&&window.liveRelayReadyPayload(payload,date,race);
      if(!ready)return {ready:false,path:packPath,payload:null,reason:typeof window.liveRelayReason==='function'?window.liveRelayReason(payload):'verified pack READY条件未達',checkedAt};
      return {ready:true,path:packPath,payload,reason:'',checkedAt};
    }catch(e){
      const reason=String(e?.message||e);
      if(!silent&&typeof console!=='undefined')console.info('GAMAGORI_LIVE_PACK_WAIT',date,race,reason);
      return {ready:false,path:packPath,payload:null,reason,checkedAt};
    }
  };

  window.BOAT_COMMAND_LIVE_PACK_BRIDGE_V0252=Object.freeze({version:VERSION,venue:'蒲郡',preRaceOnly:true,resultLookahead:false,minReceiveMarginMinutes:MIN_RECEIVE_MARGIN_MINUTES,installed:true});
})();
