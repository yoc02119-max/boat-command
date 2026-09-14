// BOAT COMMAND GAMAGORI RESULT-FREE PROGRAM LOADER v0.27.1
// Loads only same-origin program snapshots. No exhibition, payout or result endpoint is read here.
(()=>{
'use strict';
const VERSION='GAMAGORI-PROGRAM-V0.27.1';
const STATE={running:false,lastSyncAt:null,ready:0,wait:12};
const todayJst=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function currentLive(){let s=null;try{s=typeof session==='function'?session():null}catch{}return s&&s.runType==='LIVE'&&s.venue==='蒲郡'&&String(s.date||'')===todayJst()?s:null}
function validPack(x,date,race){
  if(!x||x.schema!=='boat-command-program-pack-v1')throw new Error('PROGRAM_SCHEMA_INVALID');
  if(x.venue!=='GAMAGORI'||String(x.date)!==String(date)||Number(x.race)!==Number(race))throw new Error('PROGRAM_TARGET_MISMATCH');
  if(x.resultEndpointsIncluded!==false||x.resultIncluded!==false||x.exhibitionIncluded!==false)throw new Error('PROGRAM_BOUNDARY_INVALID');
  const boats=Array.isArray(x.boats)?x.boats:[];
  if(boats.length!==6)throw new Error('PROGRAM_BOAT_COUNT_INVALID');
  const sorted=[...boats].sort((a,b)=>Number(a.lane)-Number(b.lane));
  if(sorted.some((b,i)=>Number(b.lane)!==i+1||!['A1','A2','B1','B2'].includes(String(b.class))))throw new Error('PROGRAM_MAPPING_INVALID');
  return sorted;
}
async function loadOne(date,race){
  const path=`./live/gamagori/${date}/program/race-${race}.json`;
  const res=await fetch(`${path}?v=${Date.now()}`,{cache:'no-store',credentials:'same-origin'});
  if(!res.ok)throw new Error(`HTTP_${res.status}`);
  const raw=await res.json();
  return {path,raw,boats:validPack(raw,date,race)};
}
async function syncGamagoriProgramSnapshot({render=true}={}){
  if(STATE.running)return STATE;
  const s=currentLive();if(!s)return STATE;
  STATE.running=true;
  try{
    let ready=0,changed=false;
    for(let race=1;race<=12;race++){
      const rec=s.races.find(x=>Number(x.race)===race);if(!rec)continue;
      try{
        const {raw,boats,path}=await loadOne(s.date,race);
        const profiles=boats.map(b=>({lane:Number(b.lane),cls:String(b.class),class:String(b.class),registration:b.registration||null,name:b.name||'',motor:b.motor??null,boat:b.boat??null}));
        const before=JSON.stringify([rec.programSnapshotStatus,rec.programSnapshotAt,rec.programSnapshotReason,rec.preRaceProfiles]);
        rec.preRaceProfiles=profiles;
        rec.programSnapshotStatus='READY';
        rec.programSnapshotAt=raw.fetchedAt||new Date().toISOString();
        rec.programSnapshotPath=path;
        rec.programDeadline=raw.deadline||null;
        rec.programSnapshotReason='';
        const after=JSON.stringify([rec.programSnapshotStatus,rec.programSnapshotAt,rec.programSnapshotReason,rec.preRaceProfiles]);
        if(before!==after)changed=true;
        ready++;
      }catch(e){
        const reason=String(e?.message||e);
        const before=JSON.stringify([rec.programSnapshotStatus,rec.programSnapshotReason,rec.preRaceProfiles,rec.programSnapshotAt,rec.programDeadline]);
        // Fail closed on the current sync attempt. A previously READY snapshot must not remain lock-eligible
        // when the public result-free program asset can no longer be verified.
        rec.programSnapshotStatus='WAIT';
        rec.programSnapshotReason=reason;
        rec.preRaceProfiles=null;
        rec.programSnapshotAt=null;
        rec.programDeadline=null;
        const after=JSON.stringify([rec.programSnapshotStatus,rec.programSnapshotReason,rec.preRaceProfiles,rec.programSnapshotAt,rec.programDeadline]);
        if(before!==after)changed=true;
      }
    }
    STATE.ready=ready;STATE.wait=12-ready;STATE.lastSyncAt=new Date().toISOString();
    if(changed&&typeof saveStore==='function')saveStore();
    if(render&&typeof renderAll==='function')renderAll();
    window.dispatchEvent(new CustomEvent('boatcommand:program-sync',{detail:{date:s.date,ready,wait:12-ready}}));
    return STATE;
  }catch(e){console.warn('[PROGRAM sync]',e);return STATE}
  finally{STATE.running=false}
}
window.syncGamagoriProgramSnapshot=syncGamagoriProgramSnapshot;
window.BOAT_COMMAND_PROGRAM_V0270=Object.freeze({version:VERSION,venue:'蒲郡',state:STATE,sync:syncGamagoriProgramSnapshot,resultLookahead:false,resultEndpointsIncluded:false,resultIncluded:false,exhibitionUsed:false,failClosedOnSyncError:true});
function boot(){syncGamagoriProgramSnapshot({render:true});setInterval(()=>{if(!document.hidden)syncGamagoriProgramSnapshot({render:true})},5*60*1000)}
window.addEventListener('boatcommand:today-live',()=>setTimeout(()=>syncGamagoriProgramSnapshot({render:true}),40));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncGamagoriProgramSnapshot({render:true})});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,20),{once:true});else setTimeout(boot,20);
})();