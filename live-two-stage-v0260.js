// BOAT COMMAND GAMAGORI TWO-STAGE PREDICTION v0.27.1
// FIRST: result-free official program snapshot + historical database only.
// SECOND: verified exhibition/live predictor only. Same-day results are never read here.
(()=>{
'use strict';
const VERSION='GAMAGORI-TWO-STAGE-V0.27.1';
const HISTORY_URL='./gamagori-2026-base-v131.json';
const todayJst=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const isCurrentLive=s=>!!s&&s.runType==='LIVE'&&s.venue==='蒲郡'&&String(s.date||'')===todayJst();
const safeEsc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let historyRows=[];
let historyState='LOADING';
let historyPromise=null;
function installSimpleUi(){let style=document.getElementById('bc-two-stage-simple-style');if(!style){style=document.createElement('style');style.id='bc-two-stage-simple-style';document.head.appendChild(style)}style.textContent=`#predictionList .race-card{padding:12px 14px!important}#predictionList .race-head{margin-bottom:9px!important}#predictionList .race-no{font-size:24px!important}#predictionList .two-stage-v0260{display:grid!important;grid-template-columns:1fr 1fr;gap:8px;margin:0!important}.bc-stage-row{border:1px solid #24475f;background:#081a2a;border-radius:12px;padding:11px 12px;min-height:82px}.bc-stage-row.bc-first{border-color:#2b607d;background:#071a29}.bc-stage-row.bc-second.ready{border-color:#277b5d;background:#09241c}.bc-stage-row.bc-second.wait{opacity:.72}.bc-stage-top{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:7px}.bc-stage-tag{font-size:9px;color:#8db2cf;border:1px solid #31516e;border-radius:999px;padding:3px 7px}.bc-stage-picks{font-size:20px;font-weight:900;line-height:1.35;color:#eef9ff}.bc-stage-row.bc-second.ready .bc-stage-picks{color:#9dffd0}.bc-stage-status{font-size:12px;color:#8ca8bd;line-height:1.45;padding-top:6px}.bc-stage-detail{margin-top:7px}.bc-stage-detail summary{font-size:10px;color:#7796ae;cursor:pointer}@media(max-width:760px){#predictionList .two-stage-v0260{grid-template-columns:1fr}.bc-stage-picks{font-size:19px}}`}
function validResult(v){const x=String(v||'').trim();return /^[1-6]-[1-6]-[1-6]$/.test(x)&&new Set(x.split('-')).size===3?x:null}
function fallbackProgramClasses(r){
  const program=r?.preRaceProfiles;
  if(Array.isArray(program)&&program.length===6)return program.map(x=>String(x?.cls||x?.class||'B1'));
  const boats=r?.livePreRace?.racelist?.boats;
  if(Array.isArray(boats)&&boats.length===6){const sorted=[...boats].sort((a,b)=>Number(a.lane)-Number(b.lane));if(sorted.every((b,i)=>Number(b.lane)===i+1))return sorted.map(b=>String(b.class||'B1'))}
  return null;
}
function currentComposition(s,r){let comp=null;try{comp=typeof analyzeProgram==='function'?analyzeProgram(s,r):null}catch{}if(comp?.available&&Array.isArray(comp.classes)&&comp.classes.length===6)return comp;const classes=fallbackProgramClasses(r);return classes?{available:true,classes,type:classes.join('-'),fingerprint:classes.join('|')}:null}
async function ensureHistory(){
  if(historyState==='READY')return historyRows;
  if(historyPromise)return historyPromise;
  historyPromise=(async()=>{
    try{
      const res=await fetch(`${HISTORY_URL}?v=${Date.now()}`,{cache:'no-store',credentials:'same-origin'});
      if(!res.ok)throw new Error(`HTTP_${res.status}`);
      const db=await res.json();
      const rows=Array.isArray(db?.races)?db.races:[];
      historyRows=rows.filter(x=>Array.isArray(x?.c)&&x.c.length===6&&validResult(x?.o));
      if(!historyRows.length)throw new Error('EMPTY_HISTORY');
      historyState='READY';
    }catch(e){historyState='ERROR';console.warn('[FIRST history]',e)}
    historyPromise=null;
    setTimeout(sync,0);
    return historyRows;
  })();
  return historyPromise;
}
function localSettledHistory(s){
  const out=[];
  try{
    for(const hs of Object.values(typeof store!=='undefined'&&store?.sessions?store.sessions:{})){
      if(!hs?.date||String(hs.date)>=String(s.date))continue;
      for(const hr of hs.races||[]){
        if(!hr?.settled)continue;const o=validResult(hr.result);const c=fallbackProgramClasses(hr);if(o&&c)out.push({d:hs.date,r:Number(hr.race)||0,c,o,local:true});
      }
    }
  }catch{}
  return out;
}
function weightedHistory(s){return [...historyRows.filter(x=>!x.d||String(x.d)<String(s.date)),...localSettledHistory(s)]}
function baselinePicks(classes){
  const strength={A1:4,A2:3,B1:2,B2:1};
  const lanes=[1,2,3,4,5,6].sort((a,b)=>((strength[classes[b-1]]||1)+(b===1?1.3:0))-((strength[classes[a-1]]||1)+(a===1?1.3:0)));
  const a=lanes.slice(0,4), combos=[];
  for(const x of a)for(const y of a)for(const z of lanes){if(x!==y&&x!==z&&y!==z){const p=`${x}-${y}-${z}`;if(!combos.includes(p))combos.push(p);if(combos.length===4)return combos}}
  return ['1-2-3','1-3-2','2-1-3','3-1-2'];
}
function firstCandidate(s,r){
  if(r?.firstSuggestion?.status==='CANDIDATE'&&r.firstSuggestion.lockedAt&&r.firstSuggestion.sessionDate===s.date)return r.firstSuggestion;
  const comp=currentComposition(s,r);if(!comp)return{status:'WAIT',reason:'当日12R番組データ同期中',sessionDate:s.date};
  if(historyState==='LOADING')return{status:'WAIT',reason:'過去DB読込中',sessionDate:s.date};
  const rows=weightedHistory(s),scores=new Map();let samples=0;
  for(const h of rows){
    const res=validResult(h.o);if(!res||!Array.isArray(h.c)||h.c.length!==6)continue;
    let sim=.06;
    if(Number(h.r)===Number(r.race))sim+=.18;
    const ht=h.c.join('-');if(ht===comp.type)sim+=1.25;
    let same=0;for(let i=0;i<6;i++)if(h.c[i]===comp.classes[i])same++;
    sim+=same*.34;if(same===6)sim+=2.5;
    scores.set(res,(scores.get(res)||0)+sim);samples++;
  }
  const picks=scores.size?[...scores].sort((a,b)=>b[1]-a[1]).slice(0,4).map(x=>x[0]):baselinePicks(comp.classes);
  const now=new Date().toISOString();
  const source=historyState==='READY'?`公式番組6艇の級別構成と過去${samples}レースを照合`:'過去DB取得失敗時の級別・枠順フォールバック';
  return{status:'CANDIDATE',stage:'FIRST',picks,samples,sessionDate:s.date,generatedAt:now,lockedAt:now,strategyVersion:VERSION,historyState,rationale:`当日結果・展示・払戻を不使用。${source}した第一候補。`};
}
function refresh(){let s;try{s=session()}catch{return}if(!isCurrentLive(s))return;let changed=false;for(const r of s.races||[]){if(r.firstSuggestion?.sessionDate&&r.firstSuggestion.sessionDate!==s.date){delete r.firstSuggestion;changed=true}const x=firstCandidate(s,r);if(JSON.stringify(r.firstSuggestion||null)!==JSON.stringify(x)){r.firstSuggestion=x;changed=true}}if(changed&&typeof saveStore==='function')saveStore()}
const firstHtml=r=>{const x=r?.firstSuggestion;if(x?.status!=='CANDIDATE')return `<div class="bc-stage-row bc-first"><div class="bc-stage-top"><b>第一候補</b><span class="bc-stage-tag">番組×過去DB</span></div><div class="bc-stage-status">${safeEsc(x?.reason||'準備中')}</div></div>`;return `<div class="bc-stage-row bc-first"><div class="bc-stage-top"><b>第一候補</b><span class="bc-stage-tag">事前情報のみ 🔒</span></div><div class="bc-stage-picks">${x.picks.map(safeEsc).join(' / ')}</div><details class="bc-stage-detail"><summary>理由を見る</summary>${safeEsc(x.rationale)}</details></div>`};
const secondHtml=(s,r)=>{const x=r?.liveSuggestion;if(!x||x.status==='WAIT')return `<div class="bc-stage-row bc-second wait"><div class="bc-stage-top"><b>第二候補</b><span class="bc-stage-tag">展示後</span></div><div class="bc-stage-status">${safeEsc(x?.reason||'展示待ち')}</div></div>`;if(x.status==='SKIP')return `<div class="bc-stage-row bc-second wait"><div class="bc-stage-top"><b>第二候補</b><span class="bc-stage-tag">なし</span></div><div class="bc-stage-status">${safeEsc(x.reason||'直前情報不足')}</div></div>`;return `<div class="bc-stage-row bc-second ready"><div class="bc-stage-top"><b>第二候補</b><span class="bc-stage-tag">展示反映 🔒</span></div><div class="bc-stage-picks">${(x.picks||[]).map(safeEsc).join(' / ')}</div><details class="bc-stage-detail"><summary>理由を見る</summary>${safeEsc(x.rationale||'verified展示データを反映')}</details></div>`};
function render(){installSimpleUi();let s;try{s=session()}catch{return}if(!isCurrentLive(s))return;document.querySelectorAll('#predictionList .race-card').forEach(card=>{const race=Number((card.querySelector('.race-no')?.textContent||'').replace(/\D/g,'')),r=s.races.find(x=>Number(x.race)===race);if(!r)return;let box=card.querySelector('.two-stage-v0260');if(!box){box=document.createElement('div');box.className='two-stage-v0260';card.appendChild(box)}box.innerHTML=firstHtml(r)+secondHtml(s,r)})}
function sync(){refresh();render()}
const priorRender=typeof renderAll==='function'?renderAll:null;if(priorRender)renderAll=function(){const out=priorRender.apply(this,arguments);sync();return out};
window.addEventListener('boatcommand:today-live',()=>{setTimeout(sync,0);setTimeout(()=>{if(typeof syncGamagoriProgramSnapshot==='function')syncGamagoriProgramSnapshot({render:true});if(typeof sweepVerifiedLiveRelays==='function')sweepVerifiedLiveRelays({render:true})},80)});
window.BOAT_COMMAND_TWO_STAGE_V0260=Object.freeze({version:VERSION,venue:'蒲郡',sync,ensureHistory});installSimpleUi();ensureHistory();sync();
})();