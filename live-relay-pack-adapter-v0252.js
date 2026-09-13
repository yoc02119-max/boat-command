// BOAT COMMAND GAMAGORI LIVE RELAY PACK ADAPTER v0.25.2
// PRE-RACE only. Bridges the verified auto-chain *-pack.json output to the app relay contract.
// Adds a receive-time deadline guard so stale PRE-RACE data can never become READY after the buying window.
(()=>{
  'use strict';
  const VERSION='GAMAGORI-LIVE-RELAY-PACK-ADAPTER-V0.25.2';
  const MIN_RECEIVE_MARGIN_MINUTES=2;
  const canonicalLoader=typeof window.loadVerifiedLiveRace==='function'?window.loadVerifiedLiveRace:null;

  function jstDeadline(date,hm){
    const m=String(hm||'').match(/^(\d{1,2}):(\d{2})$/);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||''))||!m)return null;
    const [y,mo,d]=String(date).split('-').map(Number),hh=Number(m[1]),mm=Number(m[2]);
    if(hh>23||mm>59)return null;
    // JST is fixed UTC+9.
    const t=Date.UTC(y,mo-1,d,hh-9,mm,0,0);
    return Number.isFinite(t)?t:null;
  }
  function receiveGate(date,deadline){
    const t=jstDeadline(date,deadline);
    if(t===null)return {ok:false,reason:'締切時刻を安全に確認できません'};
    const margin=(t-Date.now())/60000;
    if(margin<MIN_RECEIVE_MARGIN_MINUTES)return {ok:false,reason:`締切まで${MIN_RECEIVE_MARGIN_MINUTES}分未満のため予想保留`};
    return {ok:true,marginMinutes:margin};
  }
  function validPack(x,date,race){
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
    if(!receiveGate(date,x.deadline).ok)throw new Error(receiveGate(date,x.deadline).reason);
    return true;
  }
  function normalizePack(x){
    return {
      schema:'boat-command-pre-race-probe-v1',bridgeVersion:'0.25.2-pack-adapter',
      venue:'GAMAGORI',venueCode:String(x.venueCode||'07'),date:x.date,race:Number(x.race),
      fetchedAt:x.fetchedAt||new Date().toISOString(),fetchedAtJST:null,deadline:x.deadline,
      racelist:{ok:true,httpStatus:200,bytes:0,sourceUrl:'AUTO_CHAIN_VERIFIED_PACK',boats:x.boats.map(b=>({lane:Number(b.lane),class:String(b.class||''),motor:Number(b.motor),boat:Number(b.boat)}))},
      beforeinfo:{ok:true,httpStatus:200,bytes:0,sourceUrl:'AUTO_CHAIN_VERIFIED_PACK',exhibition:x.boats.map(b=>({lane:Number(b.lane),exhibitionTime:Number(b.exhibitionTime),tilt:Number(b.tilt)||0})),startExhibition:x.startExhibition.map(r=>({course:Number(r.course),st:String(r.st)})),weather:x.weather},
      verified:{timingStatus:x.timingStatus,boatMappingVerified:x.boatMappingVerified,weatherMappingVerified:x.weatherMappingVerified,readyForPrediction:x.readyForPrediction},
      safety:{resultEndpointsIncluded:false,predictionEnabled:false,hardLockEnabled:false}
    };
  }
  async function fetchJson(path){
    const res=await fetch(`${path}?v=${Date.now()}`,{cache:'no-store',credentials:'same-origin'});
    if(!res.ok)throw new Error(`HTTP_${res.status}`);
    return res.json();
  }

  window.loadVerifiedLiveRace=async function(date,race,{silent=false}={}){
    const checkedAt=new Date().toISOString();
    const canonicalPath=`./live/gamagori/${date}/pre/race-${race}.json`;
    if(canonicalLoader){
      try{
        const out=await canonicalLoader(date,race,{silent:true});
        if(out?.ready){
          const gate=receiveGate(date,out.payload?.deadline);
          if(gate.ok)return out;
          return {ready:false,path:out.path||canonicalPath,payload:null,reason:gate.reason,checkedAt};
        }
        // Only fall back to the verified pack when the canonical relay is physically absent.
        if(out&&out.reason&&!/HTTP_404/.test(String(out.reason)))return out;
      }catch(e){
        if(!/HTTP_404/.test(String(e?.message||e)))return {ready:false,path:canonicalPath,payload:null,reason:String(e?.message||e),checkedAt};
      }
    }
    const packPath=`./live/gamagori/${date}/pre/race-${race}-pack.json`;
    try{
      const pack=await fetchJson(packPath);
      validPack(pack,date,race);
      const payload=normalizePack(pack);
      if(typeof window.validateRelayPayload==='function')window.validateRelayPayload(payload,date,race);
      const ready=typeof window.liveRelayReadyPayload==='function'?window.liveRelayReadyPayload(payload,date,race):false;
      if(!ready)return {ready:false,path:packPath,payload:null,reason:typeof window.liveRelayReason==='function'?window.liveRelayReason(payload):'verified pack READY条件未達',checkedAt};
      return {ready:true,path:packPath,payload,reason:'',checkedAt};
    }catch(e){
      const reason=String(e?.message||e);
      if(!silent&&typeof console!=='undefined')console.info('GAMAGORI_LIVE_PACK_WAIT',date,race,reason);
      return {ready:false,path:packPath,payload:null,reason,checkedAt};
    }
  };

  window.BOAT_COMMAND_LIVE_RELAY_PACK_ADAPTER_V0252=Object.freeze({version:VERSION,venue:'蒲郡',preRaceOnly:true,resultLookahead:false,minReceiveMarginMinutes:MIN_RECEIVE_MARGIN_MINUTES,installed:true});
})();
