// BOAT COMMAND GAMAGORI LIVE CANDIDATE PREDICTOR v0.20.0
// Uses only verified PRE-RACE relay data. Generates suggestions only: no result fetch, no auto LOCK, no auto bet.
// DOM binding hardening: rendered cards are matched by explicit race number, never list position.
const BC_LIVE_PREDICTOR_V0200={version:'GAMAGORI-LIVE-V0.20.0+RACE-DOM-BIND-V0.22.8+ST-PARSE-V0.23.2'};

function bcStValue(raw){
  const s=String(raw||'').trim();
  if(!s)return null;
  // BOAT RACE start-exhibition values are normally ".03" / "F.11".
  // Also accept normalized "0.03" and legacy digit-only "03"; unknown forms fail closed.
  let v=null;
  if(/^F\.\d+$/i.test(s))v=Number(`0.${s.slice(2)}`);
  else if(/^\.\d+$/.test(s))v=Number(`0${s}`);
  else if(/^0\.\d+$/.test(s))v=Number(s);
  else if(/^\d+$/.test(s))v=Number(`0.${s}`);
  return Number.isFinite(v)?v:null;
}
function bcLiveScoreRows(r){
  const pre=r?.livePreRace;
  const ex=pre?.beforeinfo?.exhibition||[];
  const st=pre?.beforeinfo?.startExhibition||[];
  const boats=pre?.racelist?.boats||[];
  if(ex.length!==6||st.length!==6||boats.length!==6)return [];
  return ex.map((e,i)=>{
    const lane=Number(e.lane)||i+1;
    const exTime=Number(e.exhibitionTime);
    const stRow=st[i]||{};
    // Do not cross-wire ST to another lane/course after entry changes or malformed relay ordering.
    if(Number(stRow.course)!==lane)return null;
    const stRaw=String(stRow.st||'');
    const stVal=bcStValue(stRaw);
    if(!Number.isFinite(exTime)||stVal===null)return null;
    const laneBonus=[2.8,1.6,1.15,.82,.52,.32][lane-1]||0;
    const exScore=(6.95-exTime)*8;
    const stScore=stRaw.toUpperCase().startsWith('F.')?Math.max(0,.8-stVal*1.5):(.30-stVal)*4;
    const className=String(boats[i]?.class||'');
    const classScore=className==='A1'?1.0:className==='A2'?.55:0;
    return {lane,score:laneBonus+exScore+stScore+classScore,exTime,stRaw};
  }).filter(Boolean).sort((a,b)=>b.score-a.score);
}
function bcLiveCandidate(r){
  if(r?.liveDataStatus!=='READY'||!r?.livePreRace)return {status:'WAIT',reason:r?.liveDataReason||'verified LIVEデータ待ち'};
  const rows=bcLiveScoreRows(r);
  if(rows.length<4)return {status:'SKIP',reason:'6艇分の比較材料を安全に採点できないため見送り'};
  const [a,b,c,d]=rows.map(x=>x.lane);
  const candidates=[`${a}-${b}-${c}`,`${a}-${c}-${b}`,`${b}-${a}-${c}`,`${a}-${b}-${d}`];
  const picks=[...new Set(candidates)].slice(0,4);
  const top=rows[0],second=rows[1];
  const gap=top.score-second.score;
  if(!Number.isFinite(gap)||gap<0.18)return {status:'SKIP',reason:'上位評価差が小さく軸を固定できないため見送り',rank:rows.map(x=>x.lane)};
  return {
    status:'CANDIDATE',picks,rank:rows.map(x=>x.lane),
    rationale:`LIVE VERIFIED候補。評価順 ${rows.map(x=>x.lane).join('→')}。コース優位・展示タイム・展示ST・級別を固定ルールで採点。結果データ未使用。`,
    generatedAt:new Date().toISOString(),strategyVersion:BC_LIVE_PREDICTOR_V0200.version
  };
}
function refreshLiveCandidates(){
  const s=session();
  if(!s||s.runType!=='LIVE')return;
  let changed=false;
  for(const r of s.races||[]){
    if(r.locked)continue;
    const out=bcLiveCandidate(r);
    const before=JSON.stringify(r.liveSuggestion||null);
    r.liveSuggestion=out;
    const after=JSON.stringify(r.liveSuggestion);
    if(before!==after)changed=true;
  }
  if(changed)saveStore();
}
function liveSuggestionHtml(r){
  const x=r?.liveSuggestion;
  if(!x)return '';
  if(x.status==='WAIT')return `<div class="prediction-gate limited"><b>WAIT｜予想保留</b><span>${esc(x.reason)}</span></div>`;
  if(x.status==='SKIP')return `<div class="no-prediction-panel"><div class="no-prediction-head"><b>NO PREDICTION｜見送り</b><span>${esc(x.reason)}</span></div><div class="no-prediction-rule">無理に全レースを予想しません。</div></div>`;
  return `<div class="prediction-gate ready"><b>LIVE CANDIDATE｜最大4点</b><span>${x.picks.map(esc).join(' / ')}</span></div><div class="snapshot-note">${esc(x.rationale)}</div>`;
}
function renderLiveCandidates(){
  const s=session();
  if(!s||s.runType!=='LIVE')return;
  // PRE-RACE only: never decorate result/settlement cards with prediction-layer UI.
  // Bind by the rendered race number, not by card index, so filtered/reordered DOM cannot cross-wire suggestions.
  const cards=[...document.querySelectorAll('#predictionList .race-card')];
  cards.forEach(card=>{
    let box=card.querySelector('.live-candidate-v0200');
    if(!box){box=document.createElement('div');box.className='live-candidate-v0200';card.prepend(box);}
    const parsedRace=Number((card.querySelector('.race-no')?.textContent||'').replace(/\D/g,''));
    const r=Number.isInteger(parsedRace)&&parsedRace>=1&&parsedRace<=12
      ?s.races.find(x=>Number(x.race)===parsedRace)
      :null;
    box.innerHTML=r?liveSuggestionHtml(r):'<div class="prediction-gate limited"><b>WAIT｜予想保留</b><span>レース番号を安全に特定できないため表示を停止</span></div>';
  });
}

const _bcRenderAllV0200=renderAll;
renderAll=function(){
  _bcRenderAllV0200();
  refreshLiveCandidates();
  renderLiveCandidates();
};

const _bcSweepV0200=typeof sweepVerifiedLiveRelays==='function'?sweepVerifiedLiveRelays:null;
if(_bcSweepV0200){
  sweepVerifiedLiveRelays=async function(opts={}){
    const out=await _bcSweepV0200(opts);
    refreshLiveCandidates();
    renderLiveCandidates();
    return out;
  };
}

const _bcAnswerV0200=answer;
answer=function(q){
  const t=String(q||'').replace(/\s/g,'');
  const m=t.match(/(\d{1,2})R/);
  const race=m?Number(m[1]):Number($("#liveRace")?.value)||1;
  if(/買い目|候補|予想候補|なぜ見送り|見送り理由/.test(t)){
    const r=session().races.find(x=>Number(x.race)===race),x=r?.liveSuggestion;
    if(x?.status==='CANDIDATE')return `${race}RのLIVE候補は <strong>${x.picks.join(' / ')}</strong>。${esc(x.rationale)}`;
    if(x?.status==='SKIP')return `${race}Rは <strong>NO PREDICTION</strong>。理由は「${esc(x.reason)}」です。`;
    return `${race}Rは <strong>WAIT</strong>。理由は「${esc(x?.reason||r?.liveDataReason||'verified LIVEデータ待ち')}」です。`;
  }
  return _bcAnswerV0200(q);
};

refreshLiveCandidates();
renderLiveCandidates();
