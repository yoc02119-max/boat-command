// BOAT COMMAND GAMAGORI MAIN PREDICTION v0.31.3
// MAIN: result-free official program snapshot + historical database only.
// Exhibition/live data is not used for the formal prediction. Same-day results are never read here.
(()=>{
'use strict';
const VERSION='GAMAGORI-MAIN-PREDICTION-V0.31.3';
const HISTORY_URL='./gamagori-2026-base-v131.json';
const todayJst=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const isCurrentLive=s=>!!s&&s.runType==='LIVE'&&s.venue==='蒲郡'&&String(s.date||'')===todayJst();
const safeEsc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let historyRows=[];
let historyState='LOADING';
let historyPromise=null;
function installSimpleUi(){let style=document.getElementById('bc-two-stage-simple-style');if(!style){style=document.createElement('style');style.id='bc-two-stage-simple-style';document.head.appendChild(style)}style.textContent=`#predictionList .race-card{padding:12px 14px!important}#predictionList .race-head{margin-bottom:9px!important}#predictionList .race-no{font-size:24px!important}#predictionList .two-stage-v0260{display:block!important;margin:0!important}.bc-stage-row{border:1px solid #2b607d;background:#071a29;border-radius:12px;padding:11px 12px;min-height:82px}.bc-stage-top{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:7px}.bc-stage-tag{font-size:9px;color:#8db2cf;border:1px solid #31516e;border-radius:999px;padding:3px 7px}.bc-stage-picks{font-size:20px;font-weight:900;line-height:1.35;color:#eef9ff}.bc-stage-status{font-size:12px;color:#8ca8bd;line-height:1.45;padding-top:6px}.bc-stage-detail{margin-top:7px}.bc-stage-detail summary{font-size:10px;color:#7796ae;cursor:pointer}@media(max-width:760px){.bc-stage-picks{font-size:19px}}`}
function validResult(v){const x=String(v||'').trim();return /^[1-6]-[1-6]-[1-6]$/.test(x)&&new Set(x.split('-')).size===3?x:null}
function programInfo(r){
  const program=Array.isArray(r?.preRaceProfiles)?[...r.preRaceProfiles].sort((a,b)=>Number(a.lane)-Number(b.lane)):null;
  if(program?.length===6&&program.every((x,i)=>Number(x?.lane)===i+1&&['A1','A2','B1','B2'].includes(String(x?.cls||x?.class||'')))){
    const classes=program.map(x=>String(x.cls||x.class));
    const fingerprint=program.map(x=>[Number(x.lane),String(x.registration||''),String(x.cls||x.class||''),String(x.motor??''),String(x.boat??'')].join(':')).join('|');
    return {available:true,classes,type:classes.join('-'),fingerprint,profiles:program,source:'official-program'};
  }
  return null;
}
function fallbackProgramClasses(r){const x=programInfo(r);return x?.available?x.classes:null}
function currentComposition(s,r){let comp=null;try{comp=typeof analyzeProgram==='function'?analyzeProgram(s,r):null}catch{}const p=programInfo(r);if(p)return p;if(comp?.available&&Array.isArray(comp.classes)&&comp.classes.length===6)return {...comp,fingerprint:String(comp.fingerprint||comp.classes.join('|'))};return null}
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
    }catch(e){historyState='ERROR';console.warn('[MAIN history]',e)}
    historyPromise=null;
    setTimeout(sync,0);
    return historyRows;
  })();
  return historyRows;
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
  const a=lanes.slice(0,4),combos=[];
  for(const x of a)for(const y of a)for(const z of lanes){if(x!==y&&x!==z&&y!==z){const p=`${x}-${y}-${z}`;if(!combos.includes(p))combos.push(p);if(combos.length===4)return combos}}
  return ['1-2-3','1-3-2','2-1-3','3-1-2'];
}
function firstCandidate(s,r){
  const comp=currentComposition(s,r);if(!comp)return{status:'WAIT',reason:'当日12R公式番組データ同期中',sessionDate:s.date};
  const programFingerprint=String(comp.fingerprint||comp.classes.join('|'));
  const existing=r?.firstSuggestion;
  if(existing?.status==='CANDIDATE'&&existing.sessionDate===s.date&&existing.programFingerprint===programFingerprint){
    if(r.locked||existing.historyState==='READY'||historyState!=='READY')return existing;
  }
  const rows=historyState==='READY'?weightedHistory(s):[],scores=new Map();let samples=0;
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
  const source=historyState==='READY'?`公式番組6艇の級別構成と過去${samples}レースを照合`:'公式番組6艇の級別・枠順フォールバック';
  return{status:'CANDIDATE',stage:'MAIN',picks,samples,sessionDate:s.date,programFingerprint,generatedAt:now,lockedAt:now,strategyVersion:VERSION,historyState,rationale:`当日結果・展示・払戻を不使用。${source}した正式メイン予想。`};
}
function refresh(){let s;try{s=session()}catch{return}if(!isCurrentLive(s))return;let changed=false;for(const r of s.races||[]){if(r.firstSuggestion?.sessionDate&&r.firstSuggestion.sessionDate!==s.date){delete r.firstSuggestion;changed=true}const x=firstCandidate(s,r);if(JSON.stringify(r.firstSuggestion||null)!==JSON.stringify(x)){if(!r.locked||r.firstSuggestion?.status!=='CANDIDATE'){r.firstSuggestion=x;changed=true}}}if(changed&&typeof saveStore==='function')saveStore()}
const mainHtml=r=>{const x=r?.firstSuggestion;if(x?.status!=='CANDIDATE')return `<div class="bc-stage-row bc-first bc-main-prediction"><div class="bc-stage-top"><b>メイン予想</b><span class="bc-stage-tag">番組×過去DB</span></div><div class="bc-stage-status">${safeEsc(x?.reason||'準備中')}</div></div>`;return `<div class="bc-stage-row bc-first bc-main-prediction"><div class="bc-stage-top"><b>メイン予想</b><span class="bc-stage-tag">展示不使用 🔒</span></div><div class="bc-stage-picks">${x.picks.map(safeEsc).join(' / ')}</div><details class="bc-stage-detail"><summary>理由を見る</summary>${safeEsc(x.rationale)}</details></div>`};
function render(){installSimpleUi();let s;try{s=session()}catch{return}if(!isCurrentLive(s))return;document.querySelectorAll('#predictionList .race-card').forEach(card=>{const race=Number((card.querySelector('.race-no')?.textContent||'').replace(/\D/g,'')),r=s.races.find(x=>Number(x.race)===race);if(!r)return;let box=card.querySelector('.two-stage-v0260');if(!box){box=document.createElement('div');box.className='two-stage-v0260';card.appendChild(box)}box.innerHTML=mainHtml(r)})}
function sync(){refresh();render()}
const priorRender=typeof renderAll==='function'?renderAll:null;if(priorRender)renderAll=function(){const out=priorRender.apply(this,arguments);sync();return out};
window.addEventListener('boatcommand:program-sync',()=>setTimeout(sync,0));
window.addEventListener('boatcommand:today-live',()=>{setTimeout(sync,0);setTimeout(()=>{if(typeof syncGamagoriProgramSnapshot==='function')syncGamagoriProgramSnapshot({render:true})},80)});
window.BOAT_COMMAND_TWO_STAGE_V0260=Object.freeze({version:VERSION,venue:'蒲郡',sync,ensureHistory,ensureFirstSuggestion:async({render:doRender=true}={})=>{refresh();if(doRender)render();return true},ensureLiveSuggestion:async({render:doRender=true}={})=>{if(doRender)render();return true},exhibitionUsed:false});installSimpleUi();ensureHistory();sync();
})();