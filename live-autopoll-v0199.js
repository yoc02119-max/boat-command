// BOAT COMMAND GAMAGORI LIVE AUTO-POLL v0.19.11
// Reads same-origin verified PRE-RACE packs only. No result endpoints.
const BC_LIVE_AUTOPOLL_V0199={timer:null,running:false,lastSweepAt:null};
function liveAutoPollEligible(){
  try{
    const s=session();
    if(!s||s.runType!=='LIVE'||document.hidden)return false;
    if(typeof isResultMode==='function'&&isResultMode(s))return false;
    return true;
  }catch{return false}
}
function liveAutoStatusSummary(s){
  let ready=0,wait=0,unknown=0;
  for(const r of s.races||[]){if(r.liveDataStatus==='READY')ready++;else if(r.liveDataStatus==='WAIT')wait++;else unknown++}
  return {ready,wait,unknown};
}
function mapVerifiedPack(pack,date,race,path){
  if(!pack||pack.venue!=='GAMAGORI'||String(pack.date)!==String(date)||Number(pack.race)!==Number(race))return {ready:false,reason:'PRE-RACEパック照合失敗',path};
  if(pack.resultEndpointsIncluded!==false)return {ready:false,reason:'結果系を含むパックはPRE-RACEで使用不可',path};
  const boats=Array.isArray(pack.boats)?pack.boats:[];
  const start=Array.isArray(pack.startExhibition)?pack.startExhibition:[];
  if(boats.length!==6)return {ready:false,reason:'6艇番組データ待ち',path};
  const laneSet=new Set(boats.map(x=>Number(x.lane)));
  if(laneSet.size!==6||[1,2,3,4,5,6].some(n=>!laneSet.has(n)))return {ready:false,reason:'艇番対応を安全に確認できません',path};
  const exhibition=boats.map(b=>({lane:Number(b.lane),exhibitionTime:Number(b.exhibitionTime),tilt:b.tilt,motor:b.motor,boat:b.boat}));
  const racelistBoats=boats.map(b=>({lane:Number(b.lane),class:String(b.class||''),motor:b.motor,boat:b.boat}));
  const timingVerified=pack.timingStatus==='VERIFIED';
  const ready=timingVerified&&pack.readyForPrediction===true&&pack.boatMappingVerified===true&&pack.weatherMappingVerified===true&&!!pack.weather&&start.length===6;
  const payload={
    fetchedAt:pack.fetchedAt,deadline:pack.deadline,
    beforeinfo:{exhibition,startExhibition:start,weather:pack.weather},
    racelist:{boats:racelistBoats},
    verified:{timingStatus:pack.timingStatus,boatMappingVerified:pack.boatMappingVerified,weatherMappingVerified:pack.weatherMappingVerified,readyForPrediction:pack.readyForPrediction}
  };
  return {ready,reason:ready?'':(!timingVerified?'時刻監査待ち':'安全監査READY待ち'),path,payload,checkedAt:new Date().toISOString()};
}
async function loadVerifiedLiveRaceCompat(date,race){
  const paths=[`./live/gamagori/${date}/pre/race-${race}-pack.json`,`./live/gamagori/${date}/pre/race-${race}.json`];
  let last='HTTP_404';
  for(const path of paths){
    try{
      const res=await fetch(`${path}?v=${Date.now()}`,{cache:'no-store',credentials:'same-origin'});
      if(!res.ok){last=`HTTP_${res.status}`;continue}
      const raw=await res.json();
      if(String(raw?.schema||'').includes('live-pre-race-pack'))return mapVerifiedPack(raw,date,race,path);
      if(typeof window.validateRelayPayload==='function'){
        try{const p=window.validateRelayPayload(raw,date,race);return {ready:true,reason:'',path,payload:p,checkedAt:new Date().toISOString()}}catch(e){last=String(e?.message||e)}
      }else last='旧relay形式の検証器なし';
    }catch(e){last=String(e?.message||e)}
  }
  return {ready:false,reason:last,path:paths[0],checkedAt:new Date().toISOString()};
}
async function sweepVerifiedLiveRelays({render=true}={}){
  if(BC_LIVE_AUTOPOLL_V0199.running||!liveAutoPollEligible())return null;
  BC_LIVE_AUTOPOLL_V0199.running=true;
  try{
    const s=session(),date=s.date||todayISO();let changed=false;
    for(let race=1;race<=12;race++){
      const rec=s.races.find(x=>Number(x.race)===race);if(!rec||rec.locked||rec.settled)continue;
      const before=JSON.stringify([rec.liveDataStatus,rec.liveDataReason,rec.liveVerifiedAt]);
      const x=typeof window.loadVerifiedLiveRace==='function'?await window.loadVerifiedLiveRace(date,race,{silent:true}):await loadVerifiedLiveRaceCompat(date,race);
      rec.liveDataStatus=x.ready?'READY':'WAIT';rec.liveDataReason=x.reason||'';rec.liveVerifiedAt=x.ready?(x.payload?.fetchedAt||x.checkedAt):null;rec.liveRelayPath=x.path;
      rec.livePreRace=x.ready?{deadline:x.payload.deadline,beforeinfo:x.payload.beforeinfo,racelist:x.payload.racelist,verified:x.payload.verified}:null;
      const after=JSON.stringify([rec.liveDataStatus,rec.liveDataReason,rec.liveVerifiedAt]);if(before!==after)changed=true;
    }
    BC_LIVE_AUTOPOLL_V0199.lastSweepAt=new Date().toISOString();if(changed&&typeof saveStore==='function')saveStore();
    if(render&&typeof renderAll==='function')renderAll();
    const st=document.querySelector('#relayGateStatus'),sum=liveAutoStatusSummary(s);if(st){st.className=`live-gate-status ${sum.ready?'ok':'warn'}`;st.textContent=`AUTO LIVE · READY ${sum.ready}/12 · WAIT ${sum.wait}/12 · 未確認 ${sum.unknown}/12`}
    return sum;
  }catch(e){console.error('LIVE_AUTO_POLL_FAILED',e);return null}finally{BC_LIVE_AUTOPOLL_V0199.running=false}
}
function startVerifiedLiveAutoPoll(){if(BC_LIVE_AUTOPOLL_V0199.timer)clearInterval(BC_LIVE_AUTOPOLL_V0199.timer);setTimeout(()=>sweepVerifiedLiveRelays({render:true}),350);BC_LIVE_AUTOPOLL_V0199.timer=setInterval(()=>sweepVerifiedLiveRelays({render:true}),60000)}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sweepVerifiedLiveRelays({render:true})});
const sd=document.querySelector('#sessionDate');if(sd)sd.addEventListener('change',()=>setTimeout(()=>sweepVerifiedLiveRelays({render:true}),100));
const rt=document.querySelector('#runType');if(rt)rt.addEventListener('change',()=>{if(session().runType==='LIVE')setTimeout(()=>sweepVerifiedLiveRelays({render:true}),100)});
window.BOAT_COMMAND_LIVE_AUTOPOLL_V0199=BC_LIVE_AUTOPOLL_V0199;
startVerifiedLiveAutoPoll();