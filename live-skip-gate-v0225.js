// BOAT COMMAND GAMAGORI LIVE SKIP / RESULT GATE v0.22.5
// LIVE only. Treat explicit predictor SKIP as a non-bet race while WAIT stays fail-closed.
// No result fetches are added here; PRE-RACE / POST-RACE separation remains unchanged.
const BC_LIVE_SKIP_GATE_V0225=Object.freeze({
  version:'GAMAGORI-LIVE-SKIP-GATE-V0.22.5',
  venue:'蒲郡',
  waitFailClosed:true,
  resultLookahead:false
});

function bcLiveSkipV0225(r){return r?.liveSuggestion?.status==='SKIP'&&!r?.locked;}
function bcLiveWaitV0225(r){return !r?.locked&&!bcLiveSkipV0225(r)&&r?.liveSuggestion?.status!=='CANDIDATE';}
function bcLiveTargetsV0225(s){return (s?.races||[]).filter(r=>!bcLiveSkipV0225(r));}
function bcLiveSkipsV0225(s){return (s?.races||[]).filter(bcLiveSkipV0225);}
function bcLiveUnresolvedV0225(s){return (s?.races||[]).filter(bcLiveWaitV0225);}

const _bcEligibleReplayRacesV0225=eligibleReplayRaces;
eligibleReplayRaces=function(s=session()){
  if(s?.runType==='LIVE')return bcLiveTargetsV0225(s);
  return _bcEligibleReplayRacesV0225(s);
};

const _bcSkippedReplayRacesV0225=skippedReplayRaces;
skippedReplayRaces=function(s=session()){
  if(s?.runType==='LIVE')return bcLiveSkipsV0225(s);
  return _bcSkippedReplayRacesV0225(s);
};

const _bcRequiredReplayLocksV0225=requiredReplayLocks;
requiredReplayLocks=function(s=session()){
  if(s?.runType==='LIVE')return bcLiveTargetsV0225(s).length;
  return _bcRequiredReplayLocksV0225(s);
};

const _bcTargetLockedCountV0225=targetLockedCount;
targetLockedCount=function(s=session()){
  if(s?.runType==='LIVE'){
    const target=new Set(bcLiveTargetsV0225(s).map(r=>Number(r.race)));
    return (s.races||[]).filter(r=>r.locked&&target.has(Number(r.race))).length;
  }
  return _bcTargetLockedCountV0225(s);
};

const _bcIsResultModeV0225=isResultMode;
isResultMode=function(s=session()){
  if(s?.runType==='LIVE'){
    if(bcLiveUnresolvedV0225(s).length)return false;
    return targetLockedCount(s)===requiredReplayLocks(s);
  }
  return _bcIsResultModeV0225(s);
};

function bcApplyLivePredictionControlsV0225(s){
  if(!s||s.runType!=='LIVE')return;
  const cards=[...document.querySelectorAll('#predictionList .race-card')];
  for(const card of cards){
    const race=Number((card.querySelector('.race-no')?.textContent||'').replace(/\D/g,''));
    const r=(s.races||[]).find(x=>Number(x.race)===race);
    if(!r||r.locked)continue;
    const skip=bcLiveSkipV0225(r),wait=bcLiveWaitV0225(r);
    card.classList.toggle('live-skip-race',skip);
    card.classList.toggle('live-wait-race',wait);
    if(skip||wait){
      card.querySelectorAll('.pick,[data-reason],[data-lock]').forEach(el=>{el.disabled=true;});
    }
  }
}

function bcApplyLiveResultSkipCardsV0225(s){
  if(!s||s.runType!=='LIVE'||!isResultMode(s))return;
  const skips=bcLiveSkipsV0225(s);
  if(!skips.length)return;
  const byRace=new Map(skips.map(r=>[Number(r.race),r]));
  const cards=[...document.querySelectorAll('#resultList .race-card')];
  for(const card of cards){
    const race=Number((card.querySelector('.race-no')?.textContent||'').replace(/\D/g,''));
    const r=byRace.get(race);if(!r)continue;
    const reason=esc(r.liveSuggestion?.reason||r.liveDataReason||'安全条件により見送り');
    card.className='race-card no-prediction-race live-skip-result';
    card.innerHTML=`<div class="race-head"><div><div class="race-no">${race}R</div><div class="race-meta">LIVE監査記録</div></div><div class="stake">SKIPPED</div></div><div class="no-prediction-panel"><div class="no-prediction-head"><b>NO PREDICTION｜見送り</b><span>投資対象外</span></div><div class="no-prediction-reason">${reason}</div><div class="no-prediction-rule">結果取得・投資・的中率・ROI・MISS集計の対象外です。</div></div>`;
  }
}

function bcRenderLiveGateSummaryV0225(s){
  if(!s||s.runType!=='LIVE')return;
  const locked=targetLockedCount(s),target=requiredReplayLocks(s),skips=bcLiveSkipsV0225(s).length,wait=bcLiveUnresolvedV0225(s).length;
  const note=document.getElementById('guardNote');
  if(note){
    note.textContent=isResultMode(s)
      ?`予想対象 ${target}RをHARD LOCK済み。見送り ${skips}Rは成績対象外。POST-RACE解禁済み。`
      :`HARD LOCK ${locked}/${target} · 見送り ${skips}R · WAIT ${wait}R。WAITが残る間はPOST-RACEを開きません。`;
  }
  const sub=document.getElementById('summarySub');
  if(sub&&!settledRaces(s).length&&(locked||skips||wait))sub.textContent=`LOCK ${locked}/${target} · SKIP ${skips} · WAIT ${wait}`;
}

const _bcRenderAllV0225=renderAll;
renderAll=function(){
  _bcRenderAllV0225();
  const s=session();
  bcApplyLivePredictionControlsV0225(s);
  bcApplyLiveResultSkipCardsV0225(s);
  bcRenderLiveGateSummaryV0225(s);
};

const _bcAnswerV0225=answer;
answer=function(q){
  const t=String(q||'').replace(/\s/g,'');
  if(/見送り|SKIP|結果解禁|結果モード|POST-RACE|ロック状況|LOCK状況/.test(t)){
    const s=session();
    if(s?.runType==='LIVE'){
      const locked=targetLockedCount(s),target=requiredReplayLocks(s),skips=bcLiveSkipsV0225(s),wait=bcLiveUnresolvedV0225(s);
      if(isResultMode(s))return `LIVEは予想対象 <strong>${target}RをHARD LOCK済み</strong>。見送り ${skips.length}Rは投資・成績対象外として、POST-RACEを解禁できます。`;
      return `LIVEは HARD LOCK <strong>${locked}/${target}</strong>、見送り ${skips.length}R、WAIT ${wait.length}Rです。WAITが残る間はPOST-RACEを開きません。`;
    }
  }
  return _bcAnswerV0225(q);
};

renderAll();
