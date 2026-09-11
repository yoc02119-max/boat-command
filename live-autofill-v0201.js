// BOAT COMMAND GAMAGORI LIVE AUTO-FILL v0.20.1
// Auto-fills unlocked LIVE candidate picks/rationale only. Never auto-locks, auto-bets, or fetches results.
// DOM binding hardening v0.23.6: prediction badges bind by explicit race number, never global card order.
const BC_LIVE_AUTOFILL_V0201={version:'GAMAGORI-LIVE-AUTOFILL-V0.20.1+RACE-DOM-BIND-V0.23.6'};

function bcNormalizedPicks(r){
  return (r?.picks||[]).map(v=>String(v||'').trim()).filter(Boolean);
}
function bcAutoFillStillOwns(r){
  const a=r?.liveAutoFill;
  if(!a?.owned)return false;
  const current=bcNormalizedPicks(r);
  const expected=(a.picks||[]).map(v=>String(v||'').trim()).filter(Boolean);
  return JSON.stringify(current)===JSON.stringify(expected)&&String(r.rationale||'')===String(a.rationale||'');
}
function bcClearOwnedAutoFill(r,reason){
  if(!r||r.locked||!bcAutoFillStillOwns(r))return false;
  r.picks=['','','',''];
  r.rationale='';
  r.liveAutoFill={owned:false,status:'CLEARED',reason,clearedAt:new Date().toISOString(),version:BC_LIVE_AUTOFILL_V0201.version};
  return true;
}
function applyLiveCandidateAutoFill(){
  const s=session();
  if(!s||s.runType!=='LIVE')return {filled:0,cleared:0,preserved:0};
  let filled=0,cleared=0,preserved=0,changed=false;
  for(const r of s.races||[]){
    if(r.locked)continue;
    const x=r.liveSuggestion;
    if(x?.status!=='CANDIDATE'){
      if(bcClearOwnedAutoFill(r,x?.reason||r.liveDataReason||'LIVE候補がREADYではない')){cleared++;changed=true;}
      continue;
    }

    const current=bcNormalizedPicks(r);
    const hasRationale=!!String(r.rationale||'').trim();
    const own=bcAutoFillStillOwns(r);
    const empty=current.length===0&&!hasRationale;
    if(!empty&&!own){
      r.liveAutoFill={...(r.liveAutoFill||{}),owned:false,status:'MANUAL_PRESERVED',preservedAt:new Date().toISOString(),version:BC_LIVE_AUTOFILL_V0201.version};
      preserved++;
      continue;
    }

    const picks=[...(x.picks||[])].slice(0,4);
    while(picks.length<4)picks.push('');
    const rationale=`${x.rationale} 自動入力候補・未LOCK。`;
    const before=JSON.stringify([r.picks,r.rationale,r.liveAutoFill]);
    r.picks=picks;
    r.rationale=rationale;
    r.liveAutoFill={
      owned:true,status:'AUTO_FILLED',picks:picks.filter(Boolean),rationale,
      sourceGeneratedAt:x.generatedAt||null,filledAt:new Date().toISOString(),
      strategyVersion:x.strategyVersion||null,version:BC_LIVE_AUTOFILL_V0201.version,
      autoLock:false,autoBet:false,resultFetch:false
    };
    const after=JSON.stringify([r.picks,r.rationale,r.liveAutoFill]);
    if(before!==after){filled++;changed=true;}
  }
  if(changed)saveStore();
  return {filled,cleared,preserved};
}
function renderLiveAutoFillBadges(){
  const s=session();
  if(!s||s.runType!=='LIVE')return;
  // PRE-RACE only. Never decorate result/settlement cards, and never infer race from DOM position.
  const cards=[...document.querySelectorAll('#predictionList .race-card')];
  cards.forEach(card=>{
    let box=card.querySelector('.live-autofill-v0201');
    if(!box){box=document.createElement('div');box.className='live-autofill-v0201';card.prepend(box);}
    const race=Number((card.querySelector('.race-no')?.textContent||'').replace(/\D/g,''));
    const r=Number.isInteger(race)&&race>=1&&race<=12
      ?s.races.find(x=>Number(x.race)===race)
      :null;
    if(!r){
      box.innerHTML='<div class="prediction-gate limited"><b>WAIT｜AUTO FILL停止</b><span>レース番号を安全に特定できないため表示・入力連携を停止</span></div>';
      return;
    }
    const a=r.liveAutoFill;
    if(r.locked){box.innerHTML='<div class="snapshot-note">LOCK済み · 自動入力は停止</div>';return;}
    if(a?.status==='AUTO_FILLED'&&a.owned){
      box.innerHTML='<div class="prediction-gate ready"><b>AUTO FILL｜入力済み・未LOCK</b><span>候補を買い目欄へ反映済み。HARD LOCKは手動です。</span></div>';
    }else if(a?.status==='MANUAL_PRESERVED'){
      box.innerHTML='<div class="snapshot-note">MANUAL PRESERVED · 手入力を優先し、自動上書きしません。</div>';
    }else box.innerHTML='';
  });
}

// Any human edit takes ownership away from auto-fill. Subsequent refreshes must not overwrite it.
document.addEventListener('input',e=>{
  const el=e.target;
  if(!el?.matches?.('.pick-input[data-race], .rationale-input[data-race]'))return;
  const race=Number(el.dataset.race),r=session().races.find(x=>Number(x.race)===race);
  if(!r||r.locked)return;
  if(r.liveAutoFill?.owned){
    r.liveAutoFill={...r.liveAutoFill,owned:false,status:'MANUAL_OVERRIDE',manualAt:new Date().toISOString()};
    saveStore();
  }
},{capture:true});

const _bcRenderAllV0201=renderAll;
renderAll=function(){
  if(typeof refreshLiveCandidates==='function')refreshLiveCandidates();
  applyLiveCandidateAutoFill();
  _bcRenderAllV0201();
  renderLiveAutoFillBadges();
};

const _bcSweepV0201=typeof sweepVerifiedLiveRelays==='function'?sweepVerifiedLiveRelays:null;
if(_bcSweepV0201){
  sweepVerifiedLiveRelays=async function(opts={}){
    const out=await _bcSweepV0201(opts);
    if(typeof refreshLiveCandidates==='function')refreshLiveCandidates();
    applyLiveCandidateAutoFill();
    renderAll();
    return out;
  };
}

const _bcAnswerV0201=answer;
answer=function(q){
  const t=String(q||'').replace(/\s/g,'');
  const m=t.match(/(\d{1,2})R/),race=m?Number(m[1]):Number($('#liveRace')?.value)||1;
  if(/自動入力|入力済み|オートフィル|AUTOFILL|LOCKした/.test(t)){
    const r=session().races.find(x=>Number(x.race)===race),a=r?.liveAutoFill;
    if(r?.locked)return `${race}RはLOCK済みです。`;
    if(a?.status==='AUTO_FILLED'&&a.owned)return `${race}Rは候補を買い目欄へ<strong>自動入力済み</strong>です。ただしHARD LOCKはしていません。`;
    if(a?.status==='MANUAL_OVERRIDE'||a?.status==='MANUAL_PRESERVED')return `${race}Rは手入力を優先しています。自動候補では上書きしません。`;
    return `${race}Rはまだ自動入力していません。READYかつ予想候補が成立した時だけ入力します。`;
  }
  return _bcAnswerV0201(q);
};

applyLiveCandidateAutoFill();
renderAll();
