// BOAT COMMAND GAMAGORI LIVE LOCK SNAPSHOT v0.20.3
// Freezes the exact pre-race evidence used at successful LIVE HARD LOCK.
// Snapshot is deep-cloned and never refreshed from later LIVE polling.
const BC_LIVE_LOCK_SNAPSHOT_V0203={version:'GAMAGORI-LIVE-LOCK-SNAPSHOT-V0.20.3'};

function bcDeepCloneV0203(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function bcBuildLiveLockSnapshotV0203(s,r){
  return {
    schema:'boat-command-live-lock-snapshot-v1',
    version:BC_LIVE_LOCK_SNAPSHOT_V0203.version,
    venue:'GAMAGORI',date:s.date,race:Number(r.race),
    lockedAt:r.lockedAt||new Date().toISOString(),
    lockHash:r.lockHash||null,
    strategyVersion:s.strategyVersion||null,
    picks:bcNormalizedPicks(r),stake:Number(r.stake)||0,rationale:String(r.rationale||''),
    predictionStatus:r.predictionStatus||null,
    predictionGateReason:r.predictionGateReason||'',
    liveSuggestion:bcDeepCloneV0203(r.liveSuggestion||null),
    livePreRace:bcDeepCloneV0203(r.livePreRace||null),
    liveVerifiedAt:r.liveVerifiedAt||null,
    finalLockAudit:bcDeepCloneV0203(r.liveLockAudit||null),
    sourcePolicy:{preRaceOnly:true,resultEndpointsIncluded:false,mutableAfterLock:false}
  };
}

const _bcLockRaceV0203=lockRace;
lockRace=async function(n){
  const sBefore=session(),rBefore=sBefore?.races?.find(x=>Number(x.race)===Number(n));
  if(sBefore?.runType==='LIVE'&&rBefore?.locked&&rBefore?.liveLockSnapshot)return false;
  const ok=await _bcLockRaceV0203(n);
  if(!ok)return false;
  const s=session(),r=s?.races?.find(x=>Number(x.race)===Number(n));
  if(s?.runType==='LIVE'&&r?.locked&&!r.liveLockSnapshot){
    r.liveLockSnapshot=bcBuildLiveLockSnapshotV0203(s,r);
    r.liveLockSnapshotHash=await digest(JSON.stringify(r.liveLockSnapshot));
    r.liveLockSnapshot.snapshotHash=r.liveLockSnapshotHash;
    saveStore();
    if(typeof renderAll==='function')renderAll();
  }
  return true;
};

function bcVerifyLiveLockSnapshotV0203(r){
  const x=r?.liveLockSnapshot;
  if(!r?.locked)return {ok:false,reason:'未LOCK'};
  if(!x)return {ok:false,reason:'LOCK SNAPSHOTなし'};
  if(x.sourcePolicy?.mutableAfterLock!==false)return {ok:false,reason:'immutable policy不一致'};
  if(x.sourcePolicy?.resultEndpointsIncluded!==false)return {ok:false,reason:'result source混入'};
  if(JSON.stringify(x.picks||[])!==JSON.stringify(bcNormalizedPicks(r)))return {ok:false,reason:'LOCK後の買い目差分'};
  if(String(x.rationale||'')!==String(r.rationale||''))return {ok:false,reason:'LOCK後の根拠差分'};
  return {ok:true,reason:'IMMUTABLE'};
}
function renderLiveLockSnapshotsV0203(){
  const s=session();if(!s||s.runType!=='LIVE')return;
  [...document.querySelectorAll('.race-card')].forEach((card,i)=>{
    const r=s.races.find(x=>Number(x.race)===i+1);if(!r?.locked)return;
    let box=card.querySelector('.live-lock-snapshot-v0203');
    if(!box){box=document.createElement('div');box.className='live-lock-snapshot-v0203';card.prepend(box);}
    const a=bcVerifyLiveLockSnapshotV0203(r);
    box.innerHTML=a.ok?`<div class="snapshot-note">🔒 LOCK SNAPSHOT IMMUTABLE · ${esc(r.liveLockSnapshotHash||'')}</div>`:`<div class="integrity-warning">⚠ LOCK SNAPSHOT AUDIT · ${esc(a.reason)}</div>`;
  });
}
const _bcRenderAllV0203=renderAll;
renderAll=function(){_bcRenderAllV0203();renderLiveLockSnapshotsV0203();};

const _bcAnswerV0203=answer;
answer=function(q){
  const t=String(q||'').replace(/\s/g,'');
  const m=t.match(/(\d{1,2})R/),race=m?Number(m[1]):Number($('#liveRace')?.value)||1;
  if(/スナップショット|SNAPSHOT|LOCK時|ロック時|何を見て/.test(t)){
    const r=session().races.find(x=>Number(x.race)===race),a=bcVerifyLiveLockSnapshotV0203(r);
    if(!a.ok)return `${race}RのLOCKスナップショットは「${esc(a.reason)}」です。`;
    const x=r.liveLockSnapshot;
    return `${race}RはLOCK時点を<strong>IMMUTABLE保存済み</strong>です。買い目 ${x.picks.join(' / ')}、LOCK ${esc(x.lockedAt)}、snapshot ${esc(x.snapshotHash||'')}。後続LIVE更新ではこの記録を変更しません。`;
  }
  return _bcAnswerV0203(q);
};
renderAll();
