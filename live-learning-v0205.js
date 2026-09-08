// BOAT COMMAND GAMAGORI LIVE LEARNING RECORDS v0.20.5
// Builds post-settlement learning records from immutable PRE-RACE lock snapshots + separated POST-RACE results.
// SHADOW/RECORD ONLY: never rewrites the predictor and never leaks results back into PRE-RACE state.
const BC_LIVE_LEARNING_V0205={version:'GAMAGORI-LIVE-LEARNING-V0.20.5',autoModelUpdate:false};

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
async function bcBuildLearningRecordV0205(s,r){
  if(!s||s.runType!=='LIVE'||!r?.settled||!r?.liveLockSnapshot||!r?.liveResultAudit)return null;
  const frozen=r.liveLockSnapshot;
  const snapAudit=typeof bcVerifyLiveLockSnapshotV0203==='function'?bcVerifyLiveLockSnapshotV0203(r):{ok:false,reason:'SNAPSHOT_VERIFIERなし'};
  if(!snapAudit.ok)return null;
  const picks=(frozen.picks||[]).filter(Boolean),result=String(r.result||'');
  const record={
    schema:'boat-command-live-learning-record-v1',version:BC_LIVE_LEARNING_V0205.version,
    venue:'GAMAGORI',date:s.date,race:Number(r.race),
    snapshotHash:r.liveLockSnapshotHash||frozen.snapshotHash||null,
    lockedAt:frozen.lockedAt||r.lockedAt||null,settledAt:r.settledAt||null,
    strategyVersion:frozen.strategyVersion||s.strategyVersion||null,
    prediction:{picks,rationale:String(frozen.rationale||''),status:frozen.predictionStatus||null},
    features:bcLearningFeatureSnapshotV0205(frozen),
    outcome:{trifecta:result,payout100:Number(r.officialPayout100)||0,hit:!!r.hit,stake:Number(r.stake)||0,returnAmount:Number(r.returnAmount)||0,profit:Number(r.profit)||0},
    diagnosis:{class:bcLearningMissClassV0205(picks,result)},
    boundaries:{preRaceImmutable:true,postRaceSeparated:true,resultUsedForPrediction:false,autoModelUpdate:false}
  };
  record.recordHash=await digest(JSON.stringify(record));
  return record;
}
async function refreshLiveLearningRecordsV0205(){
  const s=session();if(!s||s.runType!=='LIVE')return {created:0,total:0};
  let created=0,changed=false;
  for(const r of s.races||[]){
    if(!r.settled||r.liveLearningRecord)continue;
    const rec=await bcBuildLearningRecordV0205(s,r);if(!rec)continue;
    r.liveLearningRecord=rec;created++;changed=true;
  }
  const records=(s.races||[]).map(r=>r.liveLearningRecord).filter(Boolean);
  const hits=records.filter(x=>x.outcome?.hit).length,investment=records.reduce((a,x)=>a+Number(x.outcome?.stake||0),0),returns=records.reduce((a,x)=>a+Number(x.outcome?.returnAmount||0),0);
  s.liveLearningSummary={
    version:BC_LIVE_LEARNING_V0205.version,records:records.length,hits,
    hitRate:records.length?hits/records.length*100:null,investment,returns,profit:returns-investment,
    roi:investment?returns/investment*100:null,
    missClasses:records.reduce((a,x)=>{const k=x.diagnosis?.class||'UNKNOWN';a[k]=(a[k]||0)+1;return a;},{}),
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
    if(!rec)return `${race}Rはまだ学習記録が確定していません。LOCK済み予想とPOST-RACE精算が揃った後に作成します。`;
    return `${race}Rの診断は <strong>${esc(rec.diagnosis.class)}</strong>。結果 ${esc(rec.outcome.trifecta)}、損益 ${money(rec.outcome.profit)}。結果は次回予想へ自動混入せず、改善材料として分離保存しています。`;
  }
  return _bcAnswerV0205(q);
};

refreshLiveLearningRecordsV0205();
