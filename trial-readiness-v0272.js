// BOAT COMMAND GAMAGORI main-prediction readiness v0.32.1
(()=>{'use strict';
function isSafeSkip(r){return r?.firstSuggestion?.status==='SKIP'&&r.firstSuggestion.skipPolicy==='MISSED_SAFE_LOCK_WINDOW'&&!r.locked}
function installSkipTargetPolicy(){
 if(typeof eligibleReplayRaces==='function'&&!eligibleReplayRaces.__bcSkipAware){
  const fn=function(s=session()){return (s?.races||[]).filter(r=>!isSafeSkip(r))};
  fn.__bcSkipAware=true;eligibleReplayRaces=fn;
 }
}
function renderSkipVisibility(){
 let s=null;try{s=session()}catch{}if(!s)return;
 document.querySelectorAll('#predictionList .race-card').forEach(card=>{
  const n=Number((card.querySelector('.race-no')?.textContent||'').replace(/\D/g,'')),r=s.races?.find(x=>Number(x.race)===n);if(!isSafeSkip(r))return;
  const gate=card.querySelector('.prediction-gate-top');if(gate){const b=gate.querySelector('b'),sp=gate.querySelector('span');if(b)b.textContent='SKIP｜安全締切超過';if(sp)sp.textContent=r.firstSuggestion.reason||'HARD LOCK可能時間を過ぎたため予想対象外';gate.classList.remove('ready');gate.classList.add('limited')}
  card.querySelectorAll('.pick,[data-reason],[data-lock]').forEach(el=>{el.disabled=true});const lb=card.querySelector('[data-lock]');if(lb)lb.textContent='SKIP';
 });
}
function audit(){installSkipTargetPolicy();let s=null;try{s=session()}catch{}const races=s?.races||[],today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),current=s?.runType==='LIVE'&&s?.date===today;const program=current?races.filter(r=>r.programSnapshotStatus==='READY').length:null,main=current?races.filter(r=>r.firstSuggestion?.status==='CANDIDATE'&&r.firstSuggestion.stage==='MAIN'&&r.firstSuggestion.sessionDate===today).length:null,skipped=current?races.filter(isSafeSkip).length:null,wait=current?12-main-skipped:null;const globals={programSync:typeof syncGamagoriProgramSnapshot==='function',model:!!window.BOAT_COMMAND_MAIN_MODEL_V0320,mainPrediction:!!window.BOAT_COMMAND_MAIN_PREDICTION_V0320,mainLock:typeof window.bcFinalMainLockAuditV0320==='function',historicalReplay:!!window.BOAT_COMMAND_HISTORICAL_REPLAY_V0320,resultSweep:typeof window.sweepLiveResultsV0204==='function',lockSnapshot:typeof window.bcVerifyLiveLockSnapshotV0203==='function',snapshotHash:typeof window.bcVerifyLiveLockSnapshotHashV0209==='function'};const noLegacy=[...document.scripts].every(x=>!/live-(?:predictor|two-stage|autopoll|skip-gate|autofill|lock-guard)-v0/.test(x.src));const targetCount=current&&typeof requiredReplayLocks==='function'?requiredReplayLocks(s):null;return {version:'0.32.1',current,program,main,skipped,wait,targetCount,globals,noLegacyExhibitionStack:noLegacy,exhibitionFetch:false,strictPastOnly:true,ready:current&&program===12&&wait===0&&Object.values(globals).every(Boolean)&&noLegacy}}
installSkipTargetPolicy();
const prior=typeof renderAll==='function'?renderAll:null;if(prior)renderAll=function(){installSkipTargetPolicy();const out=prior.apply(this,arguments);renderSkipVisibility();return out};
window.addEventListener('boatcommand:program-sync',()=>setTimeout(()=>{installSkipTargetPolicy();renderSkipVisibility();if(typeof renderAll==='function')renderAll()},0));
window.BOAT_COMMAND_TRIAL_READINESS_V0272=Object.freeze({version:'0.32.1',audit,isSafeSkip});
setTimeout(()=>{installSkipTargetPolicy();renderSkipVisibility();if(typeof renderAll==='function')renderAll()},50);
})();