// BOAT COMMAND GAMAGORI LIVE LEARNING RECORDS v0.20.5
// Builds post-settlement learning records from immutable PRE-RACE lock snapshots + separated POST-RACE results.
// SHADOW/RECORD ONLY: never rewrites the predictor and never leaks results back into PRE-RACE state.
// Integrity hardening v0.21.6: learning outcomes are reconstructed only from the frozen lock snapshot + liveResultAudit.
const BC_LIVE_LEARNING_V0205={version:'GAMAGORI-LIVE-LEARNING-V0.20.5+INTEGRITY-V0.21.6',autoModelUpdate:false};

function bcLearningMissClassV0205(picks,result){
  if((picks||[]).includes(result))return 'EXACT_HIT';
  const [a,b,c]=String(result||'').split('-').map(Number);
  if(!a||!b||!c)return 'RESULT_INVALID';
  const ps=(picks||[]).map(x=>String(x).split('-').map(Number));
  if(!ps.some(x=>x[0]===a))return 'FIRST_LEG_MISS';
  if(!ps.some(x=>x[0]===a&&x[1]===b))return 'SECOND_LEG_MISS';
  return 'THIRD_LEG_OR_ORDER_MISS';
}
function bcLearningFeatureSnapshotV0205(frozen){
  const pre=frozen?.livePreRace||{};
  const before=pre.beforeinfo||{};
  const boats=pre.racelist?.boats||[];
  const exhibition=(before.exhibition||[]).map(x=>({lane:Number(x.lane),exhibitionTime:Number(x.exhibitionTime)}));
  const startExhibition=(before.startExhibition||[]).map(x=>({course:Number(x.course),lane:Number(x.lane),st:String(x.st||'')}));
  return {
    boats:boats.map(x=>({lane:Number(x.lane),class:String(x.class||''),motor:x.motor??null,boat:x.boat??null})),
    exhibition,startExhibition,weather:bcDeepCloneV0203(before.weather||null),
    verified:bcDeepCloneV0203(pre.verified||null),
    candidateRank:bcDeepCloneV0203(frozen?.liveSuggestion?.rank||[])
  };
}
function bcLearningImmutableOutcomeV0216(r,frozen){
  const audit=r?.liveResultAudit||{};
  const picks=Array.isArray(frozen?.picks)?frozen.picks.filter(Boolean):[];
  const result=String(audit.trifecta||'');
  const payout100=Number(audit.payout100);
  const stake=Number(audit.frozenStake);
  const stakePerPick=Number(audit.stakePerPick);
  const snapshotHash=r?.liveLockSnapshotHash||frozen?.snapshotHash||null;
  const winningMethod=audit.winningMethod==null?null:String(audit.winningMethod);
  if(audit.status!=='SETTLED_FROM_SEPARATED_POST_RACE_LAYER')return {ok:false,reason:'RESULT_AUDIT_STATUS_INVALID'};
  if(audit.preRaceDataIncluded!==false||audit.resultEndpointsIncluded!==true)return {ok:false,reason:'RESULT_AUDIT_BOUNDARY_INVALID'};
  if(audit.frozenPredictionUsed!==true||audit.mutableStakeFallbackUsed!==false)return {ok:false,reason:'RESULT_AUDIT_FROZEN_CONTRACT_INVALID'};
  if(!snapshotHash||audit.snapshotHash!==snapshotHash)return {ok:false,reason:'RESULT_AUDIT_SNAPSHOT_HASH_MISMATCH'};
  if(!/^[1-6]-[1-6]-[1-6]$/.test(result)||new Set(result.split('-')).size!==3)return {ok:false,reason:'RESULT_AUDIT_TRIFECTA_INVALID'};
  if(!Number.isFinite(payout100)||payout100<0)return {ok:false,reason:'RESULT_AUDIT_PAYOUT_INVALID'};
  if(!Number.isFinite(stake)||!Number.isInteger(stake)||stake<500||stake>2000)return {ok:false,reason:'RESULT_AUDIT_STAKE_INVALID'};
  if(stakePerPick!==500||stake!==picks.length*stakePerPick)return {ok:false,reason:'RESULT_AUDIT_STAKE_CONTRACT_INVALID'};
  if(winningMethod!=null&&!['逃げ','差し','まくり','まくり差し','抜き','恵まれ'].includes(winningMethod))return {ok:false,reason:'RESULT_AUDIT_METHOD_INVALID'};
  const hit=picks.includes(result);
  const returnAmount=hit?payout100*(stakePerPick/100):0;
  return {ok:true,result,payout100,winningMethod,hit,stake,returnAmount,profit:returnAmount-stake,settledAt:audit.settledAt||r?.settledAt||null};
}
async function bcBuildLearningRecordV0205(s,r){
  if(!s||s.runType!=='LIVE'||!r?.settled||!r?.liveLockSnapshot||!r?.liveResultAudit)return null;
  const frozen=r.liveLockSnapshot;
  const snapAudit=typeof bcVerifyLiveLockSnapshotV0203==='function'?bcVerifyLiveLockSnapshotV0203(r):{ok:false,reason:'SNAPSHOT_VERIFIERなし'};
  if(!snapAudit.ok)return null;
  const hashAudit=typeof bcVerifyLiveLockSnapshotHashV0209==='function'?await bcVerifyLiveLockSnapshotHashV0209(r):{ok:false,reason:'SNAPSHOT_HASH_VERIFIERなし'};
  if(!hashAudit.ok)return null;
  const outcome=bcLearningImmutableOutcomeV0216(r,frozen);
  if(!outcome.ok){r.liveLearningStatus='BLOCKED';r.liveLearningReason=outcome.reason;return null;}
  const picks=(frozen.picks||[]).filter(Boolean);
  const record={
    schema:'boat-command-live-learning-record-v1',version:BC_LIVE_LEARNING_V0205.version,
    venue:'GAMAGORI',date:s.date,race:Number(r.race),
    snapshotHash:r.liveLockSnapshotHash||frozen.snapshotHash||null,
    lockedAt:frozen.lockedAt||r.lockedAt||null,settledAt:outcome.settledAt,
    strategyVersion:frozen.strategyVersion||s.strategyVersion||null,
    prediction:{picks,rationale:String(frozen.rationale||''),status:frozen.predictionStatus||null},
    features:bcLearningFeatureSnapshotV0205(frozen),
    outcome:{trifecta:outcome.result,payout100:outcome.payout100,winningMethod:outcome.winningMethod,hit:outcome.hit,stake:outcome.stake,returnAmount:outcome.returnAmount,profit:outcome.profit},
    diagnosis:{class:bcLearningMissClassV0205(picks,outcome.result)},
    evidence:{source:'liveResultAudit',frozenStake:true,mutableSettlementFieldsUsed:false},
    boundaries:{preRaceImmutable:true,postRaceSeparated:true,resultUsedForPrediction:false,autoModelUpdate:false}
  };
  record.recordHash=await digest(JSON.stringify(record));
  r.liveLearningStatus='RECORDED';r.liveLearningReason='';
  return record;
}
async function refreshLiveLearningRecordsV0205(){
  const s=session();if(!s||s.runType!=='LIVE')return {created:0,total:0};
  let created=0,changed=false;
  for(const r of s.races||[]){
    if(!r.settled||r.liveLearningRecord)continue;
    const beforeStatus=r.liveLearningStatus,beforeReason=r.liveLearningReason;
    const rec=await bcBuildLearningRecordV0205(s,r);
    if(rec){r.liveLearningRecord=rec;created++;changed=true;}
    if(r.liveLearningStatus!==beforeStatus||r.liveLearningReason!==beforeReason)changed=true;
  }
  const records=(s.races||[]).map(r=>r.liveLearningRecord).filter(Boolean);
  const hits=records.filter(x=>x.outcome?.hit).length,investment=records.reduce((a,x)=>a+Number(x.outcome?.stake||0),0),returns=records.reduce((a,x)=>a+Number(x.outcome?.returnAmount||0),0);
  s.liveLearningSummary={
    version:BC_LIVE_LEARNING_V0205.version,records:records.length,hits,
    hitRate:records.length?hits/records.length*100:null,investment,returns,profit:returns-investment,
    roi:investment?returns/investment*100:null,
    missClasses:records.reduce((a,x)=>{const k=x.diagnosis?.class||'UNKNOWN';a[k]=(a[k]||0)+1;return a;},{}),
    winningMethods:records.reduce((a,x)=>{const k=x.outcome?.winningMethod||'UNKNOWN';a[k]=(a[k]||0)+1;return a;},{}),
    autoModelUpdate:false,updatedAt:new Date().toISOString()
  };
  if(changed)saveStore();
  return {created,total:records.length,summary:s.liveLearningSummary};
}

const _bcSweepResultsV0205=typeof sweepLiveResultsV0204==='function'?sweepLiveResultsV0204:null;
if(_bcSweepResultsV0205){
  sweepLiveResultsV0204=async function(opts={}){
    const out=await _bcSweepResultsV0205(opts);
    await refreshLiveLearningRecordsV0205();
    return out;
  };
}

const _bcAnswerV0205=answer;
answer=function(q){
  const t=String(q||'').replace(/\s/g,'');
  const m=t.match(/(\d{1,2})R/),race=m?Number(m[1]):Number($('#liveRace')?.value)||1;
  if(/学習記録|学習状況|外した理由|外れ理由|ミス分類|改善材料/.test(t)){
    const s=session(),r=s.races.find(x=>Number(x.race)===race),rec=r?.liveLearningRecord;
    if(/学習状況/.test(t)){
      const z=s.liveLearningSummary||{};return `蒲郡LIVE学習記録は <strong>${z.records||0}R</strong>。的中 ${z.hits||0}R、回収率 ${Number.isFinite(z.roi)?z.roi.toFixed(1)+'%':'—'}。現在は記録専用で、自動モデル更新はOFFです。`;
    }
    if(!rec){const why=r?.liveLearningReason?` 理由は「${esc(r.liveLearningReason)}」です。`:'';return `${race}Rはまだ学習記録が確定していません。LOCK済み予想とPOST-RACE精算が揃った後に作成します。${why}`;}
    const method=rec.outcome?.winningMethod?`、決まり手 ${esc(rec.outcome.winningMethod)}`:'';
    return `${race}Rの診断は <strong>${esc(rec.diagnosis.class)}</strong>。結果 ${esc(rec.outcome.trifecta)}${method}、損益 ${money(rec.outcome.profit)}。結果は次回予想へ自動混入せず、固定LOCK証跡＋POST-RACE監査証跡から学習記録を作っています。`;
  }
  return _bcAnswerV0205(q);
};

refreshLiveLearningRecordsV0205();
