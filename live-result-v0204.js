// BOAT COMMAND GAMAGORI LIVE RESULT LAYER v0.20.4
// Reads same-origin POST-RACE relay files only after a successful immutable LIVE lock snapshot exists.
// PRE-RACE evidence and POST-RACE results remain physically and logically separated.
// Settlement integrity hardening v0.21.3: stake must come only from the frozen lock snapshot.
const BC_LIVE_RESULT_V0204={version:'GAMAGORI-LIVE-RESULT-V0.20.4+INTEGRITY-V0.21.3',timer:null,running:false};

function bcLiveResultPathV0204(date,race){return `./live/gamagori/${date}/post/race-${race}-result.json`;}
function bcValidResultPickV0204(v){return /^[1-6]-[1-6]-[1-6]$/.test(String(v||''))&&new Set(String(v).split('-')).size===3;}
function bcValidateResultPayloadV0204(x,date,race){
  if(!x||x.schema!=='boat-command-live-result-v1')throw new Error('INVALID_RESULT_SCHEMA');
  if(x.venue!=='GAMAGORI'||x.date!==date||Number(x.race)!==Number(race))throw new Error('RESULT_TARGET_MISMATCH');
  if(x.preRaceDataIncluded!==false||x.resultEndpointsIncluded!==true)throw new Error('RESULT_LAYER_BOUNDARY_INVALID');
  if(!bcValidResultPickV0204(x.trifecta))throw new Error('TRIFECTA_INVALID');
  const p=Number(x.payout100);if(!Number.isFinite(p)||p<0)throw new Error('PAYOUT_INVALID');
  return true;
}
async function bcLoadResultV0204(date,race){
  const path=bcLiveResultPathV0204(date,race);
  try{
    const res=await fetch(`${path}?t=${Date.now()}`,{cache:'no-store'});
    if(!res.ok)return {ok:false,status:'WAIT',reason:`POST-RACE relay ${res.status}`,path};
    const x=await res.json();bcValidateResultPayloadV0204(x,date,race);
    return {ok:true,status:'READY',payload:x,path};
  }catch(e){return {ok:false,status:'WAIT',reason:e?.message||'RESULT_FETCH_FAILED',path};}
}
function bcCanSettleLiveV0204(r){
  if(!r?.locked)return {ok:false,reason:'未LOCK'};
  if(!r.liveLockSnapshot)return {ok:false,reason:'LOCK SNAPSHOTなし'};
  const a=typeof bcVerifyLiveLockSnapshotV0203==='function'?bcVerifyLiveLockSnapshotV0203(r):{ok:false,reason:'SNAPSHOT_VERIFIERなし'};
  if(!a.ok)return {ok:false,reason:a.reason};
  return {ok:true,reason:''};
}
function bcFrozenSettlementContractV0213(r){
  const frozen=r?.liveLockSnapshot;
  if(!frozen)return {ok:false,reason:'LOCK SNAPSHOTなし'};
  const picks=Array.isArray(frozen.picks)?frozen.picks.filter(Boolean):[];
  if(picks.length<1||picks.length>4)return {ok:false,reason:'FROZEN_PICKS_COUNT_INVALID'};
  if(picks.some(x=>!bcValidResultPickV0204(x)))return {ok:false,reason:'FROZEN_PICK_INVALID'};
  if(new Set(picks).size!==picks.length)return {ok:false,reason:'FROZEN_PICK_DUPLICATE'};
  const stakePerPick=500;
  const expectedStake=picks.length*stakePerPick;
  const frozenStake=Number(frozen.stake);
  if(!Number.isFinite(frozenStake)||!Number.isInteger(frozenStake)||frozenStake!==expectedStake){
    return {ok:false,reason:`FROZEN_STAKE_CONTRACT_INVALID:${String(frozen.stake)}!=${expectedStake}`};
  }
  return {ok:true,reason:'',picks,stake:frozenStake,stakePerPick};
}
function bcSettleLiveV0204(r,x,path){
  const contract=bcFrozenSettlementContractV0213(r);
  if(!contract.ok)return contract;
  const frozen=r.liveLockSnapshot;
  const result=String(x.trifecta),payout100=Number(x.payout100);
  if(!bcValidResultPickV0204(result)||!Number.isFinite(payout100)||payout100<0)return {ok:false,reason:'RESULT_CONTRACT_INVALID'};
  const picks=contract.picks;
  const hit=picks.includes(result);
  const stake=contract.stake;
  const returnAmount=hit?payout100*(contract.stakePerPick/100):0;
  r.result=result;r.officialPayout100=payout100;r.refundAmount=0;
  r.hit=hit;r.returnAmount=returnAmount;r.profit=returnAmount-stake;
  r.stake=stake;r.settled=true;r.settledAt=new Date().toISOString();
  r.note='LIVE / OFFICIAL POST-RACE RELAY';
  r.liveResultAudit={
    version:BC_LIVE_RESULT_V0204.version,status:'SETTLED_FROM_SEPARATED_POST_RACE_LAYER',
    sourcePath:path,sourceFetchedAt:x.fetchedAt||null,settledAt:r.settledAt,
    snapshotHash:r.liveLockSnapshotHash||frozen.snapshotHash||null,
    preRaceDataIncluded:false,resultEndpointsIncluded:true,
    frozenPredictionUsed:true,mutableStakeFallbackUsed:false,
    frozenStake:stake,stakePerPick:contract.stakePerPick,pickCount:picks.length,
    trifecta:result,payout100
  };
  return {ok:true,reason:''};
}
async function sweepLiveResultsV0204({render=true}={}){
  const s=session();
  if(BC_LIVE_RESULT_V0204.running||!s||s.runType!=='LIVE')return null;
  BC_LIVE_RESULT_V0204.running=true;
  let settled=0,waiting=0,blocked=0,changed=false;
  try{
    for(const r of s.races||[]){
      if(r.settled)continue;
      const gate=bcCanSettleLiveV0204(r);
      if(!gate.ok){if(r.locked)blocked++;continue;}
      const hashGate=typeof bcVerifyLiveLockSnapshotHashV0209==='function'?await bcVerifyLiveLockSnapshotHashV0209(r):{ok:false,reason:'SNAPSHOT_HASH_VERIFIERなし'};
      if(!hashGate.ok){r.liveResultStatus='BLOCKED';r.liveResultReason=hashGate.reason;blocked++;continue;}
      const contract=bcFrozenSettlementContractV0213(r);
      if(!contract.ok){r.liveResultStatus='BLOCKED';r.liveResultReason=contract.reason;blocked++;continue;}
      const out=await bcLoadResultV0204(s.date,r.race);
      if(!out.ok){r.liveResultStatus='WAIT';r.liveResultReason=out.reason;waiting++;continue;}
      const settlement=bcSettleLiveV0204(r,out.payload,out.path);
      if(!settlement?.ok){r.liveResultStatus='BLOCKED';r.liveResultReason=settlement?.reason||'SETTLEMENT_CONTRACT_INVALID';blocked++;continue;}
      r.liveResultStatus='SETTLED';r.liveResultReason='';settled++;changed=true;
    }
    if(changed)saveStore();
    if(render&&changed&&typeof renderAll==='function')renderAll();
    return {settled,waiting,blocked};
  }finally{BC_LIVE_RESULT_V0204.running=false;}
}
function startLiveResultPollV0204(){
  if(BC_LIVE_RESULT_V0204.timer)clearInterval(BC_LIVE_RESULT_V0204.timer);
  setTimeout(()=>sweepLiveResultsV0204({render:true}),1200);
  BC_LIVE_RESULT_V0204.timer=setInterval(()=>sweepLiveResultsV0204({render:true}),120000);
}
const _bcAnswerV0204=answer;
answer=function(q){
  const t=String(q||'').replace(/\s/g,'');const m=t.match(/(\d{1,2})R/);const race=m?Number(m[1]):Number($('#liveRace')?.value)||1;
  if(/自動精算|結果取得|結果待ち|精算状況|POST-RACE|ポストレース/.test(t)){
    const r=session().races.find(x=>Number(x.race)===race);
    if(r?.settled)return `${race}Rは<strong>自動精算済み</strong>です。結果 ${esc(r.result)}、払戻100円あたり ${Number(r.officialPayout100||0).toLocaleString()}円、損益 ${money(r.profit||0)}。予想時スナップショットとは分離保存しています。`;
    const g=bcCanSettleLiveV0204(r);if(!g.ok)return `${race}Rは結果取得を開始しません。理由は「${esc(g.reason)}」です。`;
    const c=bcFrozenSettlementContractV0213(r);if(!c.ok)return `${race}Rは結果取得を開始しません。理由は「${esc(c.reason)}」です。`;
    return `${race}RはPOST-RACE結果待ちです。LOCK時スナップショットは固定済みで、結果は別レイヤーからのみ取得します。`;
  }
  return _bcAnswerV0204(q);
};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sweepLiveResultsV0204({render:true});});
startLiveResultPollV0204();
