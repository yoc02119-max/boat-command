// BOAT COMMAND GAMAGORI LIVE RESULT LAYER v0.20.4
// Reads same-origin POST-RACE relay files only after a successful immutable LIVE lock snapshot exists.
// PRE-RACE evidence and POST-RACE results remain physically and logically separated.
// Settlement integrity hardening v0.21.4: stake comes only from frozen lock snapshot; official winning method is POST-RACE metadata only.
// Global reveal hardening v0.22.2: do not fetch any POST-RACE result until every prediction target is HARD LOCKed.
// Manual-settlement hardening v0.23.3: LIVE results are read-only and can settle only from the separated official POST-RACE relay.
// Status-visibility hardening v0.23.4: persist and render WAIT/BLOCKED transitions; display frozen LOCK picks only.
const BC_LIVE_RESULT_V0204={version:'GAMAGORI-LIVE-RESULT-V0.20.4+INTEGRITY-V0.21.4+GLOBAL-GATE-V0.22.2+NO-MANUAL-LIVE-SETTLEMENT-V0.23.3+STATUS-VISIBILITY-V0.23.4',timer:null,running:false};

function bcLiveResultPathV0204(date,race){return `./live/gamagori/${date}/post/race-${race}-result.json`;}
function bcValidResultPickV0204(v){return /^[1-6]-[1-6]-[1-6]$/.test(String(v||''))&&new Set(String(v).split('-')).size===3;}
function bcValidWinningMethodV0214(v){return v==null||['逃げ','差し','まくり','まくり差し','抜き','恵まれ'].includes(String(v));}
function bcValidateResultPayloadV0204(x,date,race){
  if(!x||x.schema!=='boat-command-live-result-v1')throw new Error('INVALID_RESULT_SCHEMA');
  if(x.venue!=='GAMAGORI'||x.date!==date||Number(x.race)!==Number(race))throw new Error('RESULT_TARGET_MISMATCH');
  if(x.preRaceDataIncluded!==false||x.resultEndpointsIncluded!==true)throw new Error('RESULT_LAYER_BOUNDARY_INVALID');
  if(!bcValidResultPickV0204(x.trifecta))throw new Error('TRIFECTA_INVALID');
  const p=Number(x.payout100);if(!Number.isFinite(p)||p<0)throw new Error('PAYOUT_INVALID');
  if(!bcValidWinningMethodV0214(x.winningMethod))throw new Error('WINNING_METHOD_INVALID');
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
function bcGlobalLiveResultGateV0222(s){
  if(!s||s.runType!=='LIVE')return {ok:false,reason:'LIVEセッションではありません'};
  if(typeof isResultMode!=='function')return {ok:false,reason:'GLOBAL_RESULT_GATE_UNAVAILABLE'};
  if(!isResultMode(s)){
    const target=typeof requiredReplayLocks==='function'?requiredReplayLocks(s):12;
    const locked=typeof targetLockedCount==='function'?targetLockedCount(s):(s.races||[]).filter(r=>r.locked).length;
    return {ok:false,reason:`全予想対象のHARD LOCK待ち ${locked}/${target}`};
  }
  return {ok:true,reason:''};
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
  const result=String(x.trifecta),payout100=Number(x.payout100),winningMethod=x.winningMethod==null?null:String(x.winningMethod);
  if(!bcValidResultPickV0204(result)||!Number.isFinite(payout100)||payout100<0||!bcValidWinningMethodV0214(winningMethod))return {ok:false,reason:'RESULT_CONTRACT_INVALID'};
  const picks=contract.picks;
  const hit=picks.includes(result);
  const stake=contract.stake;
  const returnAmount=hit?payout100*(contract.stakePerPick/100):0;
  r.result=result;r.officialPayout100=payout100;r.refundAmount=0;r.winningMethod=winningMethod;
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
    trifecta:result,payout100,winningMethod
  };
  return {ok:true,reason:''};
}
function bcSetLiveResultStateV0234(r,status,reason=''){
  const nextStatus=String(status||'');
  const nextReason=String(reason||'');
  const changed=r.liveResultStatus!==nextStatus||String(r.liveResultReason||'')!==nextReason;
  if(changed){r.liveResultStatus=nextStatus;r.liveResultReason=nextReason;}
  return changed;
}
async function sweepLiveResultsV0204({render=true}={}){
  const s=session();
  if(BC_LIVE_RESULT_V0204.running||!s||s.runType!=='LIVE')return null;
  const globalGate=bcGlobalLiveResultGateV0222(s);
  if(!globalGate.ok)return {settled:0,waiting:0,blocked:0,globalBlocked:true,reason:globalGate.reason};
  BC_LIVE_RESULT_V0204.running=true;
  let settled=0,waiting=0,blocked=0,changed=false;
  try{
    for(const r of s.races||[]){
      if(r.settled)continue;
      const gate=bcCanSettleLiveV0204(r);
      if(!gate.ok){if(r.locked){changed=bcSetLiveResultStateV0234(r,'BLOCKED',gate.reason)||changed;blocked++;}continue;}
      const hashGate=typeof bcVerifyLiveLockSnapshotHashV0209==='function'?await bcVerifyLiveLockSnapshotHashV0209(r):{ok:false,reason:'SNAPSHOT_HASH_VERIFIERなし'};
      if(!hashGate.ok){changed=bcSetLiveResultStateV0234(r,'BLOCKED',hashGate.reason)||changed;blocked++;continue;}
      const contract=bcFrozenSettlementContractV0213(r);
      if(!contract.ok){changed=bcSetLiveResultStateV0234(r,'BLOCKED',contract.reason)||changed;blocked++;continue;}
      const out=await bcLoadResultV0204(s.date,r.race);
      if(!out.ok){changed=bcSetLiveResultStateV0234(r,'WAIT',out.reason)||changed;waiting++;continue;}
      const settlement=bcSettleLiveV0204(r,out.payload,out.path);
      if(!settlement?.ok){changed=bcSetLiveResultStateV0234(r,'BLOCKED',settlement?.reason||'SETTLEMENT_CONTRACT_INVALID')||changed;blocked++;continue;}
      changed=bcSetLiveResultStateV0234(r,'SETTLED','')||changed;settled++;changed=true;
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

function bcGuardManualLiveSettlementV0233(){
  const s=typeof session==='function'?session():null;
  if(!s||s.runType!=='LIVE')return;
  const cards=[...document.querySelectorAll('#resultList .race-card')];
  for(const card of cards){
    if(!card.querySelector('.result-fields'))continue;
    const race=Number((card.querySelector('.race-no')?.textContent||'').replace(/\D/g,''));
    const r=Number.isInteger(race)?(s.races||[]).find(x=>Number(x.race)===race):null;
    if(!r||r.settled)continue;
    const status=r.liveResultStatus==='BLOCKED'?'BLOCKED':'WAIT';
    const reason=r.liveResultReason||'公式POST-RACE結果待ち';
    const frozenPicks=Array.isArray(r.liveLockSnapshot?.picks)?r.liveLockSnapshot.picks.filter(Boolean):[];
    card.innerHTML=`<div class="race-head"><div><div class="race-no">${race}R</div><div class="race-meta">LOCK買い目 ${frozenPicks.map(esc).join(' / ')||'—'}</div></div><div class="stake">${status}</div></div><div class="prediction-gate ${status==='BLOCKED'?'limited':'ready'}"><b>POST-RACE ${status}</b><span>${esc(reason)}</span></div><div class="refund-note">LIVEは手入力精算を禁止しています。HARD LOCK済みスナップショットと分離された公式POST-RACE relayだけで自動精算します。</div>`;
  }
}

const _bcManualSettleRaceV0233=settleRace;
settleRace=function(n){
  const s=typeof session==='function'?session():null;
  if(s?.runType==='LIVE'){
    alert(`${n}R LIVEは手入力精算できません。公式POST-RACE結果の自動精算を待ってください。`);
    return false;
  }
  return _bcManualSettleRaceV0233(n);
};

const _bcRenderAllV0233=renderAll;
renderAll=function(){
  const out=_bcRenderAllV0233();
  bcGuardManualLiveSettlementV0233();
  return out;
};

const _bcAnswerV0204=answer;
answer=function(q){
  const t=String(q||'').replace(/\s/g,'');const m=t.match(/(\d{1,2})R/);const race=m?Number(m[1]):Number($('#liveRace')?.value)||1;
  if(/自動精算|結果取得|結果待ち|精算状況|POST-RACE|ポストレース/.test(t)){
    const s=session();
    const globalGate=bcGlobalLiveResultGateV0222(s);
    if(!globalGate.ok)return `POST-RACE結果はまだ取得しません。理由は「${esc(globalGate.reason)}」です。結果先読み防止のため、全予想対象のHARD LOCK完了後にだけ解禁します。`;
    const r=s.races.find(x=>Number(x.race)===race);
    if(r?.settled){const method=r.winningMethod?`、決まり手 ${esc(r.winningMethod)}`:'';return `${race}Rは <strong>自動精算済み</strong>です。結果 ${esc(r.result)}${method}、払戻100円あたり ${Number(r.officialPayout100||0).toLocaleString()}円、損益 ${money(r.profit||0)}。予想時スナップショットとは分離保存しています。`;}
    const g=bcCanSettleLiveV0204(r);if(!g.ok)return `${race}Rは結果取得を開始しません。理由は「${esc(g.reason)}」です。`;
    const c=bcFrozenSettlementContractV0213(r);if(!c.ok)return `${race}Rは結果取得を開始しません。理由は「${esc(c.reason)}」です。`;
    return `${race}RはPOST-RACE結果待ちです。LOCK時スナップショットは固定済みで、結果は別レイヤーからのみ取得します。`;
  }
  return _bcAnswerV0204(q);
};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sweepLiveResultsV0204({render:true});});
startLiveResultPollV0204();
bcGuardManualLiveSettlementV0233();
