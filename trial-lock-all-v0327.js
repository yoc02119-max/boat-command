// BOAT COMMAND GAMAGORI selective bulk HARD LOCK v0.32.7
// Safety/usability: a WAIT race must not stop later READY races from being safely HARD LOCKed.
// This module never weakens per-race lock guards; every attempted lock still passes the existing final LIVE audit.
(()=>{'use strict';
const VERSION='GAMAGORI-SELECTIVE-BULK-LOCK-V0.32.7';
function valid(v){const s=String(v||'').trim();return /^[1-6]-[1-6]-[1-6]$/.test(s)&&new Set(s.split('-')).size===3}
function picks(r){return (r?.picks||[]).map(x=>String(x||'').trim()).filter(Boolean)}
function candidateReady(r){return !r?.locked&&!isSafeSkippedRace(r)&&r?.firstSuggestion?.status==='CANDIDATE'&&r?.firstSuggestion?.stage==='MAIN'}
function installStatus(){const btn=document.getElementById('lockAllBtn');if(!btn||document.getElementById('bcBulkLockStatus'))return;const s=document.createElement('small');s.id='bcBulkLockStatus';s.style.cssText='margin-left:8px;color:#8fa8bb;font-size:10px;white-space:nowrap';s.textContent='READYのみ安全LOCK';btn.insertAdjacentElement('afterend',s)}
function setStatus(text){const el=document.getElementById('bcBulkLockStatus');if(el)el.textContent=text}
async function selectiveBulkLock(){
 const s=session();const rows=(typeof eligibleReplayRaces==='function'?eligibleReplayRaces(s):(s?.races||[])).filter(r=>!r.locked);
 let locked=0,wait=0,invalid=0,blocked=0;
 for(const r of rows){
  if(!candidateReady(r)){wait++;continue}
  const ps=picks(r);if(ps.length<1||ps.length>6||ps.some(x=>!valid(x))){invalid++;continue}
  try{const ok=await lockRace(r.race);if(ok)locked++;else blocked++}catch(e){console.warn('[bulk-lock]',r.race,e);blocked++}
 }
 setStatus(`LOCK ${locked} · WAIT ${wait} · 入力NG ${invalid} · BLOCK ${blocked}`);
 if(typeof renderAll==='function')renderAll();
 return {version:VERSION,locked,wait,invalid,blocked};
}
lockAllEligible=selectiveBulkLock;
window.BOAT_COMMAND_SELECTIVE_BULK_LOCK_V0327=Object.freeze({version:VERSION,run:selectiveBulkLock,perRaceGuardPreserved:true,waitFailClosed:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installStatus,{once:true});else installStatus();
})();