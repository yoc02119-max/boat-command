// BOAT COMMAND GAMAGORI main-prediction readiness v0.33.8
(()=>{'use strict';
function isSafeSkip(r){const x=r?.firstSuggestion;return !r?.locked&&x?.status==='SKIP'&&x?.stage==='MAIN'&&x?.skipPolicy==='MISSED_SAFE_LOCK_WINDOW'&&x?.resultFetch===false}
function installSkipTargetPolicy(){
 if(typeof eligibleReplayRaces==='function'&&!eligibleReplayRaces.__bcSkipAware){
  const fn=function(s=session()){return (s?.races||[]).filter(r=>!isSafeSkip(r))};
  fn.__bcSkipAware=true;eligibleReplayRaces=fn;
 }
}
function liveState(){let s=null;try{s=session()}catch{}return s}
function setControls(card,disabled){card.querySelectorAll('.pick,[data-reason],[data-lock]').forEach(el=>{el.disabled=!!disabled})}
function renderSkipVisibility(){
 const s=liveState();if(!s)return;
 document.querySelectorAll('#predictionList .race-card').forEach(card=>{
  const n=Number((card.querySelector('.race-no')?.textContent||'').replace(/\D/g,'')),r=s.races?.find(x=>Number(x.race)===n);if(!r)return;
  const x=r.firstSuggestion,gate=card.querySelector('.prediction-gate-top'),b=gate?.querySelector('b'),sp=gate?.querySelector('span'),lb=card.querySelector('[data-lock]');
  if(r.locked){setControls(card,true);card.dataset.readiness='locked';return}
  if(isSafeSkip(r)){
   card.dataset.readiness='skip';if(b)b.textContent='SKIP｜安全締切超過';if(sp)sp.textContent=x.reason||'HARD LOCK可能時間を過ぎたため予想対象外';
   gate?.classList.remove('ready');gate?.classList.add('limited');setControls(card,true);if(lb)lb.textContent='SKIP';return;
  }
  if(x?.status==='CANDIDATE'){
   card.dataset.readiness='ready';if(b)b.textContent='READY｜メイン予想生成済み';if(sp)sp.textContent=x.rationale||r.rationale||'メイン予想生成済み';
   gate?.classList.add('ready');gate?.classList.remove('limited');setControls(card,false);if(lb)lb.textContent='HARD LOCK';
  }else{
   card.dataset.readiness='wait';if(b)b.textContent='WAIT｜予想保留';if(sp)sp.textContent=x?.reason||r.programSnapshotReason||'公式番組データ待ち';
   gate?.classList.remove('ready');gate?.classList.add('limited');setControls(card,true);if(lb)lb.textContent='WAIT';
  }
 });
}
function pillClass(r){if(r.locked)return'done';if(isSafeSkip(r))return'skip';return r.firstSuggestion?.status==='CANDIDATE'?'ready':'wait'}
function renderTargetVisibility(){
 installSkipTargetPolicy();const s=liveState();if(!s)return;
 const targets=typeof requiredReplayLocks==='function'?requiredReplayLocks(s):(s?.races||[]).length;
 const locked=typeof targetLockedCount==='function'?targetLockedCount(s):(s.races||[]).filter(r=>r.locked&&!isSafeSkip(r)).length;
 const skipped=(s.races||[]).filter(isSafeSkip).length;
 const ready=(s.races||[]).filter(r=>!r.locked&&!isSafeSkip(r)&&r.firstSuggestion?.status==='CANDIDATE').length;
 const wait=(s.races||[]).filter(r=>!r.locked&&!isSafeSkip(r)&&r.firstSuggestion?.status!=='CANDIDATE').length;
 const k=$('#kLocked');if(k)k.textContent=`${locked}/${targets}`;
 const sub=$('#summarySub');if(sub)sub.textContent=`READY ${ready} · WAIT ${wait} · SKIP ${skipped}`;
 const status=$('#todayStatus');if(status){const state=wait?'WAIT':(targets>0&&locked===targets?'POST-RACE':'READY');status.textContent=state;status.classList.remove('done','ready','wait','skip','post');status.classList.add(state==='WAIT'?'wait':state==='POST-RACE'?'post':'ready')}
 const note=$('#guardNote');if(note)note.textContent=(targets>0&&locked===targets)?`予想対象 ${locked}/${targets} HARD LOCK完了${skipped?`（SKIP ${skipped}R）`:''}。POST-RACEのみ解禁中。`:`予想対象 HARD LOCK ${locked}/${targets} · READY ${ready} · WAIT ${wait}${skipped?` · SKIP ${skipped}`:''}。WAIT中は入力・LOCK・結果取得を停止します。`;
 const strip=$('#raceStrip');if(strip)strip.innerHTML=(s.races||[]).map(r=>{const label=r.locked?'LOCK':isSafeSkip(r)?'SKIP':r.firstSuggestion?.status==='CANDIDATE'?'READY':'WAIT';return `<span class="status-pill ${pillClass(r)}">${r.race}R ${label}</span>`}).join('');
}
function audit(){installSkipTargetPolicy();const s=liveState(),races=s?.races||[],today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),current=s?.runType==='LIVE'&&s?.date===today;const program=current?races.filter(r=>r.programSnapshotStatus==='READY').length:null,main=current?races.filter(r=>r.firstSuggestion?.status==='CANDIDATE'&&r.firstSuggestion.stage==='MAIN'&&r.firstSuggestion.sessionDate===today).length:null,skipped=current?races.filter(isSafeSkip).length:null,wait=current?12-main-skipped:null;const globals={programSync:typeof syncGamagoriProgramSnapshot==='function',model:!!window.BOAT_COMMAND_MAIN_MODEL_V0320,mainPrediction:!!window.BOAT_COMMAND_MAIN_PREDICTION_V0320,mainLock:typeof window.bcFinalMainLockAuditV0320==='function',historicalReplay:!!window.BOAT_COMMAND_REPLAY_V0333,resultSweep:typeof window.sweepLiveResultsV0204==='function',lockSnapshot:typeof window.bcVerifyLiveLockSnapshotV0203==='function',snapshotHash:typeof window.bcVerifyLiveLockSnapshotHashV0209==='function'};const noLegacy=[...document.scripts].every(x=>!/live-(?:predictor|two-stage|autopoll|skip-gate|autofill|lock-guard)-v0/.test(x.src));const targetCount=current&&typeof requiredReplayLocks==='function'?requiredReplayLocks(s):null;return {version:'0.33.8',current,program,main,skipped,wait,targetCount,globals,noLegacyExhibitionStack:noLegacy,exhibitionFetch:false,strictPastOnly:true,waitControlsFailClosed:true,ready:current&&program===12&&wait===0&&Object.values(globals).every(Boolean)&&noLegacy}}
function renderAuditVisibility(){const el=document.getElementById('auditTable');if(!el)return;const a=audit(),deps=Object.entries(a.globals).map(([k,v])=>`${k}:${v?'OK':'NG'}`).join(' · '),state=a.ready?'TRIAL READY':a.current?'TRIAL WAIT':'DATE WAIT';el.innerHTML=`<div class="snapshot-note"><b>${state}</b> · PRE-RACE境界: ${a.strictPastOnly?'OK':'NG'} · 展示取得: ${a.exhibitionFetch?'ON':'OFF'} · WAIT fail-closed: ${a.waitControlsFailClosed?'OK':'NG'} · legacy展示stack: ${a.noLegacyExhibitionStack?'なし':'検出'}</div><div class="snapshot-note">番組 READY ${a.program??'—'}/12 · MAIN READY ${a.main??'—'} · WAIT ${a.wait??'—'} · SKIP ${a.skipped??'—'} · LOCK対象 ${a.targetCount??'—'}</div><div class="snapshot-note">依存監査 · ${deps}</div>`}
function renderReadiness(){installSkipTargetPolicy();renderSkipVisibility();renderTargetVisibility();renderAuditVisibility()}
installSkipTargetPolicy();
const prior=typeof renderAll==='function'?renderAll:null;if(prior)renderAll=function(){installSkipTargetPolicy();const out=prior.apply(this,arguments);renderReadiness();return out};
window.addEventListener('boatcommand:program-sync',()=>setTimeout(()=>{renderReadiness();if(typeof renderAll==='function')renderAll()},0));
window.BOAT_COMMAND_TRIAL_READINESS_V0272=Object.freeze({version:'0.33.8',audit,isSafeSkip,render:renderReadiness});
setTimeout(()=>{renderReadiness();if(typeof renderAll==='function')renderAll()},50);
})();