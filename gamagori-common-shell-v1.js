// BOAT COMMAND common venue shell v1
// Presentation-only adapter for GAMAGORI. Does not alter predictions, locks, results, or stakes.
(()=>{'use strict';
const VERSION='COMMON-VENUE-SHELL-V1';
const VENUE_CODE='07', VENUE_NAME='蒲郡';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=v=>Number.isFinite(Number(v))?`¥${Math.round(Number(v)).toLocaleString('ja-JP')}`:'—';
const pct=v=>Number.isFinite(Number(v))?`${(Number(v)*100).toFixed(1)}%`:'—';
const todayJst=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let shared=null,selection=null,timer=null;

function install(){
 const main=document.querySelector('.app>main');
 if(!main||document.getElementById('bcCommonVenueShell'))return;
 document.body.classList.add('bc-common-shell');
 main.insertAdjacentHTML('afterbegin',`
 <section id="bcCommonVenueShell" aria-label="蒲郡 共通運用ヘッダー">
  <div class="bc-shell-top">
   <a class="bc-shell-back" href="./portal.html">← 24場へ</a>
   <div class="bc-shell-brand">BOAT COMMAND<b>蒲郡</b></div>
  </div>
  <div class="bc-shell-hero">
   <div><div class="bc-shell-code">VENUE 07 · GAMAGORI</div><h1>蒲郡</h1><p>結果前固定の本線を継続運用。資金反映はAUTO TRYのみ。</p></div>
   <div class="bc-shell-status"><i></i><span>運用中 · 30日</span></div>
  </div>
  <div class="bc-shell-bank" id="bcCommonBank">
   <div class="bc-shell-kpi bank"><small>24場共通 仮資金</small><b id="bcCommonBankroll">同期中</b></div>
   <div class="bc-shell-kpi"><small>本日AUTO TRY</small><b id="bcCommonTodayTry">—</b></div>
   <div class="bc-shell-kpi profit" id="bcCommonProfitBox"><small>本日確定損益</small><b id="bcCommonTodayProfit">—</b></div>
   <div class="bc-shell-kpi"><small>本日回収率</small><b id="bcCommonTodayRoi">—</b></div>
   <div class="bc-shell-bank-note" id="bcCommonBankNote">共通10万円 · 実金なし · TRYのみ資金連動</div>
  </div>
  <div class="bc-shell-tabs" role="tablist">
   <button class="bc-shell-tab active" type="button" data-common-view="home">今日</button>
   <button class="bc-shell-tab" type="button" data-common-view="predict">12R</button>
   <button class="bc-shell-tab" type="button" data-common-view="results">結果</button>
   <button class="bc-shell-tab" type="button" data-common-view="history">履歴</button>
  </div>
  <details class="bc-shell-details"><summary>詳細・検証</summary><div class="bc-shell-detail-actions"><button type="button" data-common-advanced="analytics">分析</button><button type="button" data-common-advanced="data">REPLAY / 境界確認</button></div></details>
 </section>`);
 document.querySelectorAll('[data-common-view]').forEach(btn=>btn.addEventListener('click',()=>activate(btn.dataset.commonView)));
 document.querySelectorAll('[data-common-advanced]').forEach(btn=>btn.addEventListener('click',()=>activate(btn.dataset.commonAdvanced,true)));
 document.querySelectorAll('.nav[data-view]').forEach(btn=>btn.addEventListener('click',()=>syncTabs(btn.dataset.view)));
 syncTabs(document.querySelector('.nav.active')?.dataset.view||'home');
}

function syncTabs(view){
 document.querySelectorAll('[data-common-view]').forEach(x=>x.classList.toggle('active',x.dataset.commonView===view));
}
function activate(view,advanced=false){
 const btn=document.querySelector(`.nav[data-view="${CSS.escape(String(view))}"]`);
 if(btn){btn.click();syncTabs(view)}
 if(advanced)document.getElementById(view)?.scrollIntoView({behavior:'smooth',block:'start'});
 else window.scrollTo({top:0,behavior:'smooth'});
}

async function loadShared(){
 const date=todayJst();
 const [a,b]=await Promise.allSettled([
   fetch(`./shared-try-portfolio-v1.json?t=${Date.now()}`,{cache:'no-store'}).then(r=>r.ok?r.json():null),
   fetch(`./live/portfolio/${date}/try-selection-v1.json?t=${Date.now()}`,{cache:'no-store'}).then(r=>r.ok?r.json():null)
 ]);
 if(a.status==='fulfilled'&&a.value)shared=a.value;
 if(b.status==='fulfilled'&&b.value)selection=b.value;
 renderBank();renderTryStates();renderPresentationStates();
}

function todayLedger(){
 const d=todayJst();
 return Array.isArray(shared?.ledger)?shared.ledger.filter(x=>String(x.date)===d):[];
}
function renderBank(){
 if(!document.getElementById('bcCommonBank'))return;
 const rows=todayLedger(),settled=rows.filter(x=>x.settled===true);
 const committed=rows.reduce((s,x)=>s+(Number(x.stakeYen)||0),0);
 const settledStake=settled.reduce((s,x)=>s+(Number(x.stakeYen)||0),0);
 const returned=settled.reduce((s,x)=>s+(Number(x.returnYen)||0),0);
 const profit=returned-settledStake;
 const confirmed=Number(shared?.confirmedBankrollYen??(Number(shared?.startingBankrollYen||100000)+Number(shared?.profitYen||0)));
 const available=Number(shared?.availableBankrollYen??shared?.bankrollYen??confirmed);
 const roi=settledStake?returned/settledStake:null;
 const bank=document.getElementById('bcCommonBankroll');
 const tr=document.getElementById('bcCommonTodayTry');
 const pf=document.getElementById('bcCommonTodayProfit');
 const rr=document.getElementById('bcCommonTodayRoi');
 const box=document.getElementById('bcCommonProfitBox');
 const note=document.getElementById('bcCommonBankNote');
 if(bank)bank.textContent=Number.isFinite(confirmed)?yen(confirmed):'同期中';
 if(tr)tr.textContent=`${rows.length}R`;
 if(pf)pf.textContent=settled.length?(profit>0?'+':'')+yen(profit):'¥0';
 if(rr)rr.textContent=roi==null?'—':pct(roi);
 if(box){box.classList.toggle('positive',profit>0);box.classList.toggle('negative',profit<0)}
 const pending=rows.filter(x=>x.settled!==true).reduce((s,x)=>s+(Number(x.stakeYen)||0),0);
 if(note)note.textContent=`開始10万円 · 未精算TRY ${yen(pending)}予約 · 利用可能 ${yen(available)} · 24場共通 · 実金なし`;
}
function selectionReady(){return selection?.immutableAfterFirstWrite===true}
function liveSessionView(){try{return typeof window.session==='function'?window.session():null}catch{return null}}
function renderComparisonStates(){
 const s=liveSessionView();if(!s)return;
 document.querySelectorAll('#predictionList .race-card[data-race]').forEach(card=>{
   card.querySelector('.bc-gama-compare')?.remove();
   const race=Number(card.dataset.race),r=s.races?.find(x=>Number(x.race)===race),picks=r?.firstSuggestion?.shadow?.picks;
   if(!Array.isArray(picks)||!picks.length)return;
   const target=card.querySelector('.main-prediction-v0320');
   if(!target)return;
   const chips=picks.map(x=>`<i>${esc(x)}</i>`).join('');
   target.insertAdjacentHTML('afterend',`<div class="bc-gama-compare"><span>比較用SHADOW</span><div class="bc-gama-compare-picks">${chips}</div></div>`);
 });
}
function renderNoProgramDay(){
 const list=document.getElementById('predictionList'),s=liveSessionView();if(!list||!s)return;
 list.querySelector('.bc-no-program-banner')?.remove();
 const races=Array.isArray(s.races)?s.races:[];
 const noProgram=races.length===12&&races.every(r=>String(r?.programSnapshotReason||'').includes('HTTP_404'));
 list.classList.toggle('bc-no-program-day',noProgram);
 if(noProgram)list.insertAdjacentHTML('afterbegin','<div class="bc-no-program-banner"><b>本日の番組データなし</b><span>開催日でないか、公式番組が未公開です。12Rの予想生成は停止しています。</span></div>');
}
function renderPresentationStates(){renderComparisonStates();renderNoProgramDay()}

function raceTry(race){
 const d=todayJst();
 return todayLedger().find(x=>String(x.venueCode).padStart(2,'0')===VENUE_CODE&&Number(x.race)===Number(race))||null;
}
function tryMarkup(row){
 if(!selectionReady()&&!row)return '<div class="bc-common-try wait"><span>AUTO TRY</span><b>選抜待ち</b><small>共通10万円 · 実金なし</small></div>';
 if(!row)return '<div class="bc-common-try skip"><span>AUTO TRY</span><b>見送り</b><small>メイン予想は成績評価に保存</small></div>';
 const picks=Array.isArray(row.picks)?row.picks.length:0;
 const stake=Number(row.stakeYen)||0;
 if(row.settled===true){
   const ret=Number(row.returnYen)||0,profit=ret-stake;
   return `<div class="bc-common-try selected"><span>AUTO TRY</span><b>${picks}点 · ${yen(stake)}</b><small>${row.hit?'的中':'不的中'} · ${profit>0?'+':''}${yen(profit)}</small></div>`;
 }
 return `<div class="bc-common-try selected"><span>AUTO TRY</span><b>${picks}点 · ${yen(stake)}</b><small>共通10万円から仮投入 · 結果待ち</small></div>`;
}
function renderTryStates(){
 document.querySelectorAll('#predictionList .race-card[data-race]').forEach(card=>{
   card.querySelector('.bc-common-try')?.remove();
   const row=raceTry(Number(card.dataset.race));
   const grid=card.querySelector('.pick-grid');
   if(grid)grid.insertAdjacentHTML('afterend',tryMarkup(row));
 });
}
function wrapRender(){
 if(typeof window.renderAll!=='function'||window.renderAll.__commonShellWrapped)return;
 const prior=window.renderAll;
 const wrapped=function(){const out=prior.apply(this,arguments);setTimeout(()=>{renderTryStates();renderPresentationStates();syncTabs(document.querySelector('.nav.active')?.dataset.view||'home')},0);return out};
 wrapped.__commonShellWrapped=true;
 window.renderAll=wrapped;
}
function start(){
 install();wrapRender();loadShared();
 timer=setInterval(loadShared,60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadShared()});
 window.addEventListener('boatcommand:shared-portfolio',loadShared);
 setTimeout(()=>{renderTryStates();renderPresentationStates()},300);
 setTimeout(()=>{renderTryStates();renderPresentationStates()},1400);
}
window.BOAT_COMMAND_COMMON_SHELL_V1=Object.freeze({version:VERSION,refresh:loadShared,venueCode:VENUE_CODE,venueName:VENUE_NAME,presentationOnly:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();