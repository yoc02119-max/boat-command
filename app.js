const APP_KEY="boatCommand.v05";
const MIRROR_KEY="boatCommand.v05.mirror";
const SESSION_MIRROR_KEY="boatCommand.v05.sessionMirror";
const START_BANKROLL=100000;
const PICK_PRICE=500;
const MAX_PICKS=6;
const STARTUP_FORCE_TODAY_LIVE=true;

function $(sel){if(!sel)return null;return String(sel).startsWith('#')?document.querySelector(sel):document.getElementById(sel)||document.querySelector(sel)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function dateISOInTokyo(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const g=t=>p.find(x=>x.type===t)?.value;return `${g('year')}-${g('month')}-${g('day')}`}
const todayISO=()=>dateISOInTokyo();
const money=n=>(Number(n||0)<0?'-':'')+'¥'+Math.abs(Math.round(Number(n)||0)).toLocaleString('ja-JP');
const pct=n=>Number.isFinite(Number(n))?Number(n).toFixed(1)+'%':'—';
async function digest(text){const bytes=new TextEncoder().encode(String(text??''));const hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')}

function baseStore(){return {schema:5,venue:'蒲郡',startBankroll:START_BANKROLL,sessions:{},retestArchive:[],liveMonitor:{last:null,history:[]}}}
function baseRace(n){return {race:n,picks:['','','','','',''],locked:false,lockedAt:null,lockHash:null,stake:0,result:'',officialPayout100:0,refundAmount:0,settled:false,settledAt:null,returnAmount:0,profit:0,hit:false,rationale:'',missClass:'',programComposition:null}}
function baseSession(date){return {date,venue:'蒲郡',mode:'STRICT',runType:'LIVE',strategyVersion:'GAMAGORI-V1.0',createdAt:new Date().toISOString(),races:Array.from({length:12},(_,i)=>baseRace(i+1))}}
function parseStored(raw){try{const x=JSON.parse(raw);if(x&&x.schema===5&&x.sessions)return x}catch{}return null}
function storeRank(x){return (Number(x?._meta?.revision)||0)*10000000000000+(Date.parse(x?._meta?.updatedAt||'')||0)}
function loadStore(){const c=[];for(const [kind,key] of [['l',APP_KEY],['l',MIRROR_KEY],['s',SESSION_MIRROR_KEY]]){try{const raw=kind==='s'?sessionStorage.getItem(key):localStorage.getItem(key);const x=parseStored(raw);if(x)c.push(x)}catch{}}if(!c.length)return baseStore();c.sort((a,b)=>storeRank(b)-storeRank(a));const x=c[0],raw=JSON.stringify(x);try{localStorage.setItem(APP_KEY,raw);localStorage.setItem(MIRROR_KEY,raw);sessionStorage.setItem(SESSION_MIRROR_KEY,raw)}catch{}return x}
function saveStore(){store._meta=store._meta||{};store._meta.revision=(Number(store._meta.revision)||0)+1;store._meta.updatedAt=new Date().toISOString();const raw=JSON.stringify(store);let ok=0;for(const [kind,key] of [['l',APP_KEY],['l',MIRROR_KEY],['s',SESSION_MIRROR_KEY]])try{(kind==='s'?sessionStorage:localStorage).setItem(key,raw);ok++}catch{}return ok>0}
function ensureSessionShape(s){if(!s||typeof s!=='object')return s;if(!Array.isArray(s.races))s.races=[];for(let n=1;n<=12;n++){let r=s.races.find(x=>Number(x.race)===n);if(!r){r=baseRace(n);s.races.push(r)}for(const [k,v] of Object.entries(baseRace(n)))if(r[k]===undefined)r[k]=Array.isArray(v)?[...v]:v}if(!s.runType)s.runType='LIVE';s.venue='蒲郡';if(!s.strategyVersion)s.strategyVersion='GAMAGORI-V1.0';s.races.sort((a,b)=>a.race-b.race);return s}
let store=loadStore();if(!Array.isArray(store.retestArchive))store.retestArchive=[];if(!store.liveMonitor)store.liveMonitor={last:null,history:[]};
if(Number(store.startBankroll)!==START_BANKROLL){
  store.startBankroll=START_BANKROLL;
  store._meta={...(store._meta||{}),revision:(Number(store?._meta?.revision)||0)+1,updatedAt:new Date().toISOString(),bankrollPolicy:'SHARED_24_VENUES_100K_PERSISTENT'};
  saveStore();
}
let currentDate=todayISO();
function session(date=currentDate){if(STARTUP_FORCE_TODAY_LIVE)date=todayISO();currentDate=date;if(!store.sessions[date])store.sessions[date]=baseSession(date);const s=ensureSessionShape(store.sessions[date]);s.runType='LIVE';s.venue='蒲郡';return s}
function save(){return saveStore()}
function activeReplayPack(){return null}
function programProfiles(s,r){return Array.isArray(r?.preRaceProfiles)&&r.preRaceProfiles.length===6?r.preRaceProfiles:null}

function validPick(v){const s=String(v||'').trim();return /^[1-6]-[1-6]-[1-6]$/.test(s)&&new Set(s.split('-')).size===3}
function normalizedPicks(r){return (r?.picks||[]).map(x=>String(x||'').trim()).filter(Boolean)}
function isSafeSkippedRace(r){return !r?.locked&&r?.firstSuggestion?.status==='SKIP'&&r?.firstSuggestion?.stage==='MAIN'&&r?.firstSuggestion?.skipPolicy==='MISSED_SAFE_LOCK_WINDOW'&&r?.firstSuggestion?.resultFetch===false}
function skippedReplayRaces(s=session()){return (s?.races||[]).filter(isSafeSkippedRace)}
function eligibleReplayRaces(s=session()){return (s?.races||[]).filter(r=>r&&!isSafeSkippedRace(r))}
function requiredReplayLocks(s=session()){return eligibleReplayRaces(s).length}
function targetLockedCount(s=session()){const targets=new Set(eligibleReplayRaces(s).map(r=>Number(r.race)));return (s?.races||[]).filter(r=>r.locked&&targets.has(Number(r.race))).length}
function isResultMode(s=session()){const target=requiredReplayLocks(s);return target>0&&targetLockedCount(s)===target}

async function lockRace(n){const s=session(),r=s.races.find(x=>Number(x.race)===Number(n));if(!r||r.locked||isSafeSkippedRace(r))return false;const picks=normalizedPicks(r);if(picks.length<1||picks.length>MAX_PICKS||picks.some(x=>!validPick(x)))return false;if(!String(r.rationale||'').trim())r.rationale='メイン予想に基づく事前予想';r.picks=[...picks];while(r.picks.length<MAX_PICKS)r.picks.push('');r.stake=picks.length*PICK_PRICE;r.lockedAt=new Date().toISOString();r.lockHash=await digest(JSON.stringify({date:s.date,race:r.race,picks,rationale:r.rationale,stake:r.stake,lockedAt:r.lockedAt}));r.locked=true;saveStore();renderAll();return true}
async function lockAllEligible(){
 const s=session(),targets=eligibleReplayRaces(s).filter(r=>!r.locked);
 if(!targets.length)return true;
 const preflight=[];
 for(const r of targets){
   const picks=normalizedPicks(r);
   if(r.firstSuggestion?.status!=='CANDIDATE'||picks.length<1||picks.length>MAX_PICKS||picks.some(x=>!validPick(x))){
     preflight.push({race:r.race,reason:r.firstSuggestion?.reason||'予想未準備'});
     continue;
   }
   if(typeof bcFinalMainLockAuditV0320==='function'){
     const g=bcFinalMainLockAuditV0320(s,r);
     if(!g?.ok)preflight.push({race:r.race,reason:g?.reason||'LOCK監査NG'});
   }
 }
 if(preflight.length){
   const first=preflight[0];
   alert(`予想確定はまだできません\n${first.race}R：${first.reason}`);
   return false;
 }
 for(const r of targets){const ok=await lockRace(r.race);if(!ok)return false}
 return true
}
function settleRace(){return false}

function sessionStats(s=session()){const targets=(s.races||[]).filter(r=>r.locked),settled=targets.filter(r=>r.settled),invested=settled.reduce((a,r)=>a+Number(r.stake||0),0),returned=settled.reduce((a,r)=>a+Number(r.returnAmount||0),0),hits=settled.filter(r=>r.hit).length;return {locked:targets.length,settled:settled.length,invested,returned,hits,profit:returned-invested,roi:invested?returned/invested*100:null,hitRate:settled.length?hits/settled.length*100:null}}
function allStats(){const settled=Object.values(store.sessions||{}).flatMap(s=>s.races||[]).filter(r=>r.settled),invested=settled.reduce((a,r)=>a+Number(r.stake||0),0),returned=settled.reduce((a,r)=>a+Number(r.returnAmount||0),0),hits=settled.filter(r=>r.hit).length;return {races:settled.length,hits,invested,returned,profit:returned-invested,roi:invested?returned/invested*100:null,hitRate:settled.length?hits/settled.length*100:null}}
function cleanRacerName(v){
 return String(v||'').replace(/\s+(北海道|青森|岩手|宮城|秋田|山形|福島|茨城|栃木|群馬|埼玉|千葉|東京|神奈川|新潟|富山|石川|福井|山梨|長野|岐阜|静岡|愛知|三重|滋賀|京都|大阪|兵庫|奈良|和歌山|鳥取|島根|岡山|広島|山口|徳島|香川|愛媛|高知|福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄)$/,'').trim()
}
function relativeRankMap(r,ps){
 try{
  const model=window.BOAT_COMMAND_MAIN_MODEL_V0320;
  if(!model?.relativeBoatScores||ps.length!==6)return new Map();
  const scores=model.relativeBoatScores({classes:ps.map(p=>String(p.class||p.cls||'')),profiles:ps,race:Number(r.race),raceType:r.programRaceType||''});
  if(!Array.isArray(scores)||scores.length!==6||scores.some(x=>!Number.isFinite(Number(x))))return new Map();
  const order=scores.map((score,i)=>({lane:i+1,score:Number(score)})).sort((x,y)=>y.score-x.score);
  return new Map(order.map((x,i)=>[x.lane,i+1]))
 }catch{return new Map()}
}
function programSummary(r){
 const ps=Array.isArray(r?.preRaceProfiles)?[...r.preRaceProfiles].sort((a,b)=>Number(a.lane)-Number(b.lane)):[];
 const counts={A1:0,A2:0,B1:0,B2:0};for(const p of ps){const c=String(p?.class||p?.cls||'');if(counts[c]!=null)counts[c]++}
 const countText=['A1','A2','B1','B2'].filter(k=>counts[k]).map(k=>`${k}×${counts[k]}`).join('・')||'構成待ち';
 const ranks=relativeRankMap(r,ps);
 const racers=ps.length===6?ps.map(p=>{const lane=Number(p.lane),rank=ranks.get(lane),name=cleanRacerName(p.name);return `<div class="racer-brief lane-${lane}"><div class="racer-main"><i>${lane}</i><strong>${esc(name||'—')}</strong></div><div class="racer-meta"><b>${esc(p.class||p.cls||'—')}</b>${rank?`<span>総合${rank}位</span>`:''}</div></div>`}).join(''):'';
 const time=r?.programDeadline?`${esc(r.programDeadline)}`:'時刻待ち';
 const type=String(r?.programRaceType||'').trim()||'種別待ち';
 return `<div class="program-brief"><div class="program-brief-main"><strong>${time}</strong><span>${esc(type)}</span><em>${esc(countText)}</em></div>${racers?`<div class="racer-brief-grid">${racers}</div>`:''}</div>`;
}
function predictionCard(r){const activePicks=(r?.picks||[]).map(x=>String(x||'').trim()).filter(Boolean),plannedStake=r?.locked?Number(r.stake||0):activePicks.length*PICK_PRICE;const picks=[...r.picks];while(picks.length<MAX_PICKS)picks.push('');const main=r.firstSuggestion,skip=isSafeSkippedRace(r),disabled=(r.locked||skip)?'disabled':'',status=r.locked?'HARD LOCK':skip?'SKIP':main?.status==='CANDIDATE'?'READY':'WAIT';const gateReady=main?.status==='CANDIDATE'&&!skip;const gateTitle=r.locked?'HARD LOCK':skip?'SKIP｜安全締切超過':gateReady?'MAIN PREDICTION READY':'WAIT｜予想保留';return `<article class="race-card" data-race="${r.race}"><div class="race-head"><div class="race-no">${r.race}R</div><span>${esc(status)}</span></div>${programSummary(r)}${activePicks.length?`<div class="snapshot-note virtual-stake-note">メイン予想・評価用 · 資金反映なし</div>`:'' }<div class="prediction-gate prediction-gate-top ${gateReady?'ready':'limited'}"><b>${gateTitle}</b><span>${esc(main?.rationale||main?.reason||r.programSnapshotReason||'公式番組データ待ち')}</span></div><div class="pick-grid">${picks.slice(0,MAX_PICKS).map((p,i)=>`<input class="pick" data-r="${r.race}" data-i="${i}" value="${esc(p)}" placeholder="—" readonly tabindex="-1" ${disabled}>`).join('')}</div><textarea class="rationale-input" data-reason="${r.race}" placeholder="予想根拠" ${disabled}>${esc(r.rationale||'')}</textarea><div class="race-actions"><button class="lock-btn" data-lock="${r.race}" ${disabled}>${r.locked?'LOCK済み':skip?'予想対象外':'HARD LOCK'}</button></div></article>`}
function resultCard(r){if(r.settled)return `<article class="race-card" data-race="${r.race}"><div class="race-head"><div class="race-no">${r.race}R</div><div class="stake">${r.hit?'HIT':'MISS'}</div></div><div class="snapshot-note">結果 ${esc(r.result)} · メイン評価 ${r.hit?'HIT':'MISS'} · 資金反映なし</div></article>`;return `<article class="race-card" data-race="${r.race}"><div class="race-head"><div class="race-no">${r.race}R</div><div class="stake">${r.locked?'POST-RACE WAIT':'LOCK待ち'}</div></div><div class="result-fields"><div class="snapshot-note">公式POST-RACE relayのみで自動精算します。</div></div></article>`}
function renderAll(){const s=session();const stats=sessionStats(s),all=allStats(),skips=skippedReplayRaces(s),targets=eligibleReplayRaces(s);const date=$('#sessionDate');if(date){date.value=s.date;date.min=s.date;date.max=s.date}const type=$('#runType');if(type){type.value='LIVE';type.disabled=true}const strategy=$('#strategyVersion');if(strategy)strategy.value=s.strategyVersion;const list=$('#predictionList');if(list)list.innerHTML=s.races.map(predictionCard).join('');const rlist=$('#resultList'),gate=$('#resultGate'),sum=$('#resultSummary'),badge=$('#resultGateBadge');const resultMode=isResultMode(s);if(gate){gate.classList.toggle('hidden',resultMode);gate.innerHTML=resultMode?'':`<h3>RESULT MODEはまだ開いていません</h3><p>予想対象 ${targetLockedCount(s)}/${requiredReplayLocks(s)} HARD LOCK。WAITは結果取得を止め、SKIP ${skips.length}Rは予想対象外です。</p>`}if(rlist){rlist.classList.toggle('hidden',!resultMode);if(resultMode)rlist.innerHTML=targets.map(resultCard).join('')}if(sum){sum.classList.toggle('hidden',!resultMode);if(resultMode)sum.innerHTML=`<div class="snapshot-note">精算 ${stats.settled}/${requiredReplayLocks(s)} · SKIP ${skips.length}R · 的中 ${stats.hits} · 回収率 ${stats.roi==null?'—':pct(stats.roi)} · 損益 ${money(stats.profit)}</div>`}if(badge){badge.textContent=resultMode?'POST-RACE OPEN':'LOCK待ち';badge.className=`badge ${resultMode?'ready':'blind'}`}const kLocked=$('#kLocked');if(kLocked)kLocked.textContent=`${targetLockedCount(s)}/${requiredReplayLocks(s)}${skips.length?` · S${skips.length}`:''}`;const kHits=$('#kHits');if(kHits)kHits.textContent=stats.settled?`${stats.hits}/${stats.settled}`:'—';const kHitRate=$('#kHitRate');if(kHitRate)kHitRate.textContent=stats.hitRate==null?'—':pct(stats.hitRate);const kRoi=$('#kRoi');if(kRoi)kRoi.textContent=stats.roi==null?'—':pct(stats.roi);const kProfit=$('#kProfit');if(kProfit)kProfit.textContent=money(stats.profit);const virtualNow=typeof bcVirtualBankrollNow==='function'?bcVirtualBankrollNow():Number(store.startBankroll||START_BANKROLL)+all.profit;const bankroll=$('#bankrollNow');if(bankroll){bankroll.textContent=money(virtualNow);bankroll.title='仮想資金（未精算LOCKの仮掛け金を差引済み）'};const allRecord=$('#allRecord');if(allRecord)allRecord.textContent=`${all.races}戦 ${all.hits}的中`;const allHitRate=$('#allHitRate');if(allHitRate)allHitRate.textContent=all.hitRate==null?'—':pct(all.hitRate);const allRoi=$('#allRoi');if(allRoi)allRoi.textContent=all.roi==null?'—':pct(all.roi);const strip=$('#raceStrip');if(strip)strip.innerHTML=s.races.map(r=>`<span class="status-pill ${r.locked?'done':''}">${r.race}R ${r.locked?'LOCK':isSafeSkippedRace(r)?'SKIP':r.firstSuggestion?.status||'WAIT'}</span>`).join('');const note=$('#guardNote');if(note)note.textContent=resultMode?'結果を自動反映中。':'現在は30日SHADOW検証中。TRY買い目は結果前に自動固定されます。';const title=$('#pageTitle');if(title){if(document.querySelector('#predict.view.active'))title.textContent='12R';else if(document.querySelector('#results.view.active'))title.textContent='結果';else title.textContent='蒲郡'}}
function answer(q){const t=String(q||'').replace(/\s/g,''),s=session(),st=sessionStats(s),skips=skippedReplayRaces(s);if(/今日|状況|進捗/.test(t))return `蒲郡LIVEは HARD LOCK <strong>${targetLockedCount(s)}/${requiredReplayLocks(s)}</strong>、SKIP ${skips.length}R、精算 ${st.settled}Rです。`;if(/回収率|成績|損益/.test(t))return `今日の精算済み成績は、回収率 <strong>${st.roi==null?'—':pct(st.roi)}</strong>、損益 ${money(st.profit)}です。`;return '蒲郡LIVE担当です。READY/WAIT/SKIP、予想、LOCK、精算状況を確認できます。'}

function bindCoreUi(){document.querySelectorAll('.nav').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));document.getElementById(btn.dataset.view)?.classList.add('active');renderAll()}));document.querySelectorAll('[data-jump]').forEach(btn=>btn.addEventListener('click',()=>document.querySelector(`.nav[data-view="${btn.dataset.jump}"]`)?.click()));document.addEventListener('input',e=>{const el=e.target,s=session();if(el.matches?.('.pick[data-r]')){const r=s.races.find(x=>Number(x.race)===Number(el.dataset.r));if(r&&!r.locked&&!isSafeSkippedRace(r)){r.picks[Number(el.dataset.i)||0]=el.value;saveStore()}}else if(el.matches?.('[data-reason]')){const r=s.races.find(x=>Number(x.race)===Number(el.dataset.reason));if(r&&!r.locked&&!isSafeSkippedRace(r)){r.rationale=el.value;saveStore()}}});document.addEventListener('click',async e=>{const b=e.target.closest?.('[data-lock]');if(b){b.disabled=true;await lockRace(Number(b.dataset.lock));renderAll()}});const all=$('#lockAllBtn');if(all)all.addEventListener('click',async()=>{all.disabled=true;try{await lockAllEligible()}finally{all.disabled=false;renderAll()}});const date=$('#sessionDate');if(date)date.addEventListener('change',()=>{if(date.value!==todayISO())date.value=todayISO();currentDate=todayISO();renderAll()});const send=$('#send'),prompt=$('#prompt');if(send&&prompt)send.addEventListener('click',()=>{const q=prompt.value.trim();if(!q)return;const chat=$('#chat');if(chat)chat.insertAdjacentHTML('beforeend',`<div class="bubble user">${esc(q)}</div><div class="bubble ai">${answer(q)}</div>`);prompt.value=''})}

try{localStorage.setItem('boatCommand.lastDate',todayISO())}catch{}
session();bindCoreUi();renderAll();
