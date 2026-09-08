// BOAT COMMAND GAMAGORI LIVE INTEGRITY AUDIT v0.20.8
// Cross-checks immutable PRE-RACE lock snapshots, separated POST-RACE settlement, and learning records.
// Audit only: never changes predictor weights, picks, locks, or results.
const BC_LIVE_INTEGRITY_V0208={version:'GAMAGORI-LIVE-INTEGRITY-V0.20.8',productionMutation:false};

function bcAuditRaceV0208(s,r){
  const errors=[],warnings=[];
  if(!r)return {ok:false,errors:['RACE_MISSING'],warnings};
  if(s?.runType!=='LIVE')return {ok:true,errors,warnings,status:'NOT_LIVE'};

  const snap=r.liveLockSnapshot||null;
  const learning=r.liveLearningRecord||null;
  const resultAudit=r.liveResultAudit||null;

  if(r.locked){
    if(!snap)errors.push('LOCKED_WITHOUT_SNAPSHOT');
    else {
      if(snap.sourcePolicy?.preRaceOnly!==true)errors.push('SNAPSHOT_PRE_RACE_POLICY');
      if(snap.sourcePolicy?.resultEndpointsIncluded!==false)errors.push('SNAPSHOT_RESULT_ENDPOINT_LEAK');
      if(snap.sourcePolicy?.mutableAfterLock!==false)errors.push('SNAPSHOT_MUTABLE_POLICY');
      if(Number(snap.race)!==Number(r.race)||snap.date!==s.date||snap.venue!=='GAMAGORI')errors.push('SNAPSHOT_TARGET_MISMATCH');
      const current=(r.picks||[]).map(v=>String(v||'').trim()).filter(Boolean);
      const frozen=(snap.picks||[]).map(v=>String(v||'').trim()).filter(Boolean);
      if(JSON.stringify(current)!==JSON.stringify(frozen))errors.push('LOCKED_PICKS_CHANGED');
      if(String(r.rationale||'')!==String(snap.rationale||''))errors.push('LOCKED_RATIONALE_CHANGED');
    }
  }else if(snap){errors.push('SNAPSHOT_WITHOUT_LOCK');}

  if(r.settled){
    if(!r.locked)errors.push('SETTLED_WITHOUT_LOCK');
    if(!snap)errors.push('SETTLED_WITHOUT_SNAPSHOT');
    if(!resultAudit)errors.push('SETTLED_WITHOUT_RESULT_AUDIT');
    if(!/^([1-6])-([1-6])-([1-6])$/.test(String(r.result||''))||new Set(String(r.result||'').split('-')).size!==3)errors.push('RESULT_INVALID');
    if(!Number.isFinite(Number(r.officialPayout100))||Number(r.officialPayout100)<0)errors.push('PAYOUT_INVALID');
    const expectedHit=(snap?.picks||[]).includes(String(r.result||''));
    if(!!r.hit!==!!expectedHit)errors.push('HIT_FLAG_MISMATCH');
    const expectedReturn=expectedHit?Number(r.officialPayout100||0)*5:0;
    if(Number(r.returnAmount||0)!==expectedReturn)errors.push('RETURN_AMOUNT_MISMATCH');
    if(Number(r.profit||0)!==expectedReturn-Number(r.stake||0))errors.push('PROFIT_MISMATCH');
  }else if(resultAudit){warnings.push('RESULT_AUDIT_PRESENT_NOT_SETTLED');}

  if(learning){
    if(!r.settled)errors.push('LEARNING_BEFORE_SETTLEMENT');
    if(learning.boundaries?.preRaceImmutable!==true)errors.push('LEARNING_PRE_RACE_BOUNDARY');
    if(learning.boundaries?.postRaceSeparated!==true)errors.push('LEARNING_POST_RACE_BOUNDARY');
    if(learning.boundaries?.resultUsedForPrediction!==false)errors.push('LEARNING_RESULT_LEAK');
    if(learning.boundaries?.autoModelUpdate!==false)errors.push('LEARNING_AUTO_MODEL_UPDATE');
    if(learning.snapshotHash!==(r.liveLockSnapshotHash||snap?.snapshotHash||null))errors.push('LEARNING_SNAPSHOT_HASH_MISMATCH');
    if(String(learning.outcome?.trifecta||'')!==String(r.result||''))errors.push('LEARNING_RESULT_MISMATCH');
    if(Number(learning.outcome?.profit||0)!==Number(r.profit||0))errors.push('LEARNING_PROFIT_MISMATCH');
  }else if(r.settled)warnings.push('LEARNING_RECORD_PENDING');

  return {ok:errors.length===0,errors,warnings,status:errors.length?'FAIL':warnings.length?'WARN':'PASS'};
}
function bcLiveIntegrityAuditV0208(){
  const s=session();
  if(!s||s.runType!=='LIVE')return {status:'NOT_LIVE',ok:true,races:[],errors:0,warnings:0};
  const races=(s.races||[]).map(r=>({race:Number(r.race),...bcAuditRaceV0208(s,r)}));
  const errors=races.reduce((a,x)=>a+x.errors.length,0),warnings=races.reduce((a,x)=>a+x.warnings.length,0);
  const status=errors?'INTEGRITY_FAIL':warnings?'INTEGRITY_WARN':'INTEGRITY_PASS';
  const out={version:BC_LIVE_INTEGRITY_V0208.version,status,ok:errors===0,errors,warnings,races,checkedAt:new Date().toISOString(),productionMutation:false};
  s.liveIntegrityAudit={...out,races:races.map(x=>({race:x.race,status:x.status,errors:x.errors,warnings:x.warnings}))};
  saveStore();
  return out;
}
function renderLiveIntegrityV0208(){
  const host=document.querySelector('#data .data-grid');if(!host)return;
  let panel=document.querySelector('#bcLiveIntegrityV0208');
  if(!panel){panel=document.createElement('section');panel.id='bcLiveIntegrityV0208';panel.className='panel wide';host.appendChild(panel);}
  const a=bcLiveIntegrityAuditV0208();
  const bad=(a.races||[]).filter(x=>x.status==='FAIL'),warn=(a.races||[]).filter(x=>x.status==='WARN');
  panel.innerHTML=`<div class="panel-head"><div><h2>LIVE CHAIN INTEGRITY v0.20.8</h2><p>LOCK snapshot → POST-RACE → learning record</p></div><span class="badge ${a.ok?'ready':'blind'}">${esc(a.status)}</span></div><div class="snapshot-note">ERROR ${a.errors||0} · WARN ${a.warnings||0} · productionMutation=false</div>${bad.length?`<div class="integrity-warning">FAIL: ${esc(bad.map(x=>`${x.race}R ${x.errors.join(',')}`).join(' / '))}</div>`:''}${warn.length?`<div class="snapshot-note">WARN: ${esc(warn.map(x=>`${x.race}R ${x.warnings.join(',')}`).join(' / '))}</div>`:''}<div class="fineprint">結果データがPRE-RACE予想層へ逆流していないこと、LOCK後の予想が改変されていないこと、精算と学習記録が一致することを監査します。</div>`;
}

const _bcRenderAllV0208=renderAll;
renderAll=function(){_bcRenderAllV0208();renderLiveIntegrityV0208();};
const _bcAnswerV0208=answer;
answer=function(q){
  const t=String(q||'').replace(/\s/g,'');
  if(/整合性|監査異常|データ混入|結果混入|改ざん|改変|INTEGRITY/.test(t)){
    const a=bcLiveIntegrityAuditV0208();
    if(a.ok)return `LIVE整合性監査は <strong>${a.status}</strong>。ERROR ${a.errors}、WARN ${a.warnings}。LOCK/PRE-RACE/POST-RACE/学習の境界に重大な矛盾はありません。`;
    const bad=a.races.filter(x=>x.status==='FAIL');return `LIVE整合性監査は <strong>INTEGRITY FAIL</strong>。${esc(bad.map(x=>`${x.race}R: ${x.errors.join('/')}`).join(' / '))}`;
  }
  return _bcAnswerV0208(q);
};
renderLiveIntegrityV0208();
