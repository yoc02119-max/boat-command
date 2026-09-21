// BOAT COMMAND GAMAGORI prediction/result history v0.35.18
// Past-date read-only view. Never fetches today's POST-RACE data.
(()=>{'use strict';
const VERSION='GAMAGORI-PREDICTION-HISTORY-V0.35.19';
const VISIBLE_WINDOW_DAYS=30;
const cache=new Map();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=v=>{const n=Number(v)||0;return (n<0?'-':'')+'¥'+Math.abs(Math.round(n)).toLocaleString('ja-JP')};
const todayJst=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

function mainPicks(r){
 const evalPicks=Array.isArray(r?.mainEvaluationSnapshot?.picks)?r.mainEvaluationSnapshot.picks.filter(Boolean):[];
 if(evalPicks.length)return evalPicks;
 const frozen=Array.isArray(r?.liveLockSnapshot?.picks)?r.liveLockSnapshot.picks.filter(Boolean):[];
 if(frozen.length)return frozen;
 const x=r?.firstSuggestion;
 if(x?.stage==='MAIN'&&x?.status==='CANDIDATE'&&Array.isArray(x.picks))return x.picks.filter(Boolean);
 return [];
}
function sessionMap(){
 try{return store?.sessions||{}}catch{return {}}
}
function tryRows(){
 let data=null;try{data=window.BOAT_COMMAND_FORWARD_V0347?.state||null}catch{}
 const out=new Map();
 if(!data)return out;
 for(const m of Object.values(data.methods||{})){
   const rows=[...(m?.recentResults||[]),...(m?.todayResults||[])];
   for(const x of rows){
     if(!x?.date||!Number(x?.race))continue;
     const key=`${x.date}:${Number(x.race)}`;
     if(!out.has(key))out.set(key,[]);
     const sig=`${m.method}:${x.date}:${x.race}`;
     if(out.get(key).some(y=>y._sig===sig))continue;
     out.get(key).push({...x,method:m.method,_sig:sig});
   }
 }
 return out;
}
function pastDates(){
 const t=todayJst(),set=new Set();
 const today=new Date(`${t}T00:00:00+09:00`);
 const cutoff=new Date(today.getTime()-VISIBLE_WINDOW_DAYS*86400000);
 const cutoffDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(cutoff);
 for(const d of Object.keys(sessionMap()))if(/^\d{4}-\d{2}-\d{2}$/.test(d)&&d<t&&d>=cutoffDate)set.add(d);
 for(const key of tryRows().keys()){const d=key.split(':')[0];if(d<t&&d>=cutoffDate)set.add(d)}
 return [...set].sort().reverse();
}
async function result(date,race){
 const key=`${date}:${race}`;if(cache.has(key))return cache.get(key);
 try{
   const res=await fetch(`./live/gamagori/${date}/post/race-${race}-result.json?t=${Date.now()}`,{cache:'no-store',credentials:'same-origin'});
   if(!res.ok){cache.set(key,null);return null}
   const x=await res.json();
   if(x?.schema!=='boat-command-live-result-v1'||x?.venue!=='GAMAGORI'||String(x?.date)!==date||Number(x?.race)!==race){cache.set(key,null);return null}
   cache.set(key,x);return x;
 }catch{cache.set(key,null);return null}
}
function installStyle(){
 if(document.getElementById('bcPredictionHistoryStyle'))return;
 const s=document.createElement('style');s.id='bcPredictionHistoryStyle';
 s.textContent=`
.history-wrap{display:grid;gap:14px}
.history-note{font-size:10px;color:#718da2;line-height:1.55}
.history-day{border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(255,255,255,.02);overflow:hidden}
.history-day-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:13px 14px;border-bottom:1px solid rgba(255,255,255,.07)}
.history-day-head h3{margin:0;font-size:16px}.history-day-head span{font-size:9px;color:#7c98ab}
.history-day-kpis{display:flex;gap:7px;flex-wrap:wrap}.history-day-kpis b{font-size:9px;padding:5px 8px;border-radius:999px;background:rgba(255,255,255,.04);color:#b9cedb}
.history-list{display:grid}
.history-row{display:grid;grid-template-columns:48px minmax(200px,1.6fr) minmax(92px,.6fr) 72px minmax(150px,1fr);gap:10px;align-items:center;padding:11px 14px;border-top:1px solid rgba(255,255,255,.055)}
.history-row:first-child{border-top:0}.history-race{font-size:15px;font-weight:900}.history-main small,.history-result small,.history-try small{display:block;font-size:8px;color:#6f899d;margin-bottom:4px}.history-main b{font-size:11px;line-height:1.45}.history-result b{font-size:13px}
.history-eval{font-size:10px;font-weight:900;text-align:center;padding:5px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.1)}
.history-eval.hit{color:#79e7bb;border-color:rgba(65,222,164,.35)}.history-eval.miss{color:#ff8997;border-color:rgba(255,120,136,.28)}.history-eval.none{color:#788fa2}
.history-try{font-size:9px;color:#91aabb}.history-try b{display:block;font-size:10px;color:#d6e8f2;margin-top:2px}.history-try .up{color:#79e7bb}.history-try .down{color:#ff8997}
.history-empty{padding:22px;text-align:center;border:1px dashed rgba(255,255,255,.1);border-radius:12px;color:#728da1;font-size:11px}
#historyLoading{font-size:10px;color:#7893a7}
.history-30d{margin-bottom:14px;border:1px solid rgba(32,224,199,.22);border-radius:14px;padding:14px;background:rgba(32,224,199,.035)}
.history-30d-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.history-30d-head h3{margin:0;font-size:16px}.history-30d-head p{margin:4px 0 0;color:#718da2;font-size:9px;line-height:1.5}.history-30d-range{font-size:9px;color:#7893a7;text-align:right}
.history-30d-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-top:11px}.history-30d-kpi{padding:9px;border:1px solid rgba(255,255,255,.07);border-radius:10px;background:rgba(255,255,255,.025)}.history-30d-kpi small{display:block;font-size:7px;color:#6f899d;margin-bottom:3px}.history-30d-kpi b{font-size:13px}.history-30d-kpi.up b{color:#79e7bb}.history-30d-kpi.down b{color:#ff8997}
@media(max-width:760px){
 .sidebar nav{grid-template-columns:repeat(5,1fr)}
 .history-day-head{align-items:flex-start;flex-direction:column}
 .history-30d-head{flex-direction:column}.history-30d-range{text-align:left}.history-30d-kpis{grid-template-columns:1fr 1fr}.history-30d-kpi:last-child{grid-column:1/-1}
 .history-row{grid-template-columns:42px 1fr auto;gap:8px;padding:11px 10px}
 .history-main{grid-column:2/4}.history-result{grid-column:2}.history-eval{grid-column:3;grid-row:2}.history-try{grid-column:2/4;border-top:1px solid rgba(255,255,255,.045);padding-top:7px}
}
`;
 document.head.appendChild(s);
}
function tryHtml(rows){
 if(!rows?.length)return '<small>TRY</small><b>—</b>';
 return '<small>TRY</small>'+rows.map(x=>{
   const settled=!!x.settled,stake=Number(x.stakeYen)||0,ret=Number(x.returnYen)||0,profit=ret-stake;
   const state=!settled?'未精算':x.hit?'HIT':'MISS';
   const cls=settled?(profit>0?'up':profit<0?'down':''):'';
   return `<b>${esc(x.method||'')} ${state} · ${settled?`<span class="${cls}">${profit>0?'+':''}${yen(profit)}</span>`:`投入 ${yen(stake)}`}</b>`;
 }).join('');
}
async function renderDay(date,tmap){
 const s=sessionMap()[date]||null,races=Array.isArray(s?.races)?s.races:[];
 const rows=await Promise.all(Array.from({length:12},async(_,i)=>{
   const race=i+1,r=races.find(x=>Number(x.race)===race)||null;
   const picks=mainPicks(r),res=await result(date,race),hasResult=!!res?.trifecta;
   const evaluated=hasResult&&picks.length>0,hit=evaluated&&picks.includes(String(res.trifecta));
   const tr=tmap.get(`${date}:${race}`)||[];
   return {race,picks,res,evaluated,hit,tr};
 }));
 const evaluated=rows.filter(x=>x.evaluated),hits=evaluated.filter(x=>x.hit).length;
 const tries=rows.flatMap(x=>x.tr).filter(x=>x.settled);
 const tryProfit=tries.reduce((a,x)=>a+(Number(x.returnYen)||0)-(Number(x.stakeYen)||0),0);
 const body=rows.map(x=>{
   const main=x.picks.length?x.picks.map(esc).join(' / '):'記録なし';
   const resultText=x.res?.trifecta?esc(x.res.trifecta):'—';
   const evalClass=x.evaluated?(x.hit?'hit':'miss'):'none';
   const evalText=x.evaluated?(x.hit?'HIT':'MISS'):'—';
   return `<div class="history-row">
    <div class="history-race">${x.race}R</div>
    <div class="history-main"><small>メイン予想</small><b>${main}</b></div>
    <div class="history-result"><small>結果</small><b>${resultText}</b></div>
    <div class="history-eval ${evalClass}">${evalText}</div>
    <div class="history-try">${tryHtml(x.tr)}</div>
   </div>`;
 }).join('');
 return `<section class="history-day">
  <div class="history-day-head"><div><h3>${esc(date.replaceAll('-','/'))}</h3><span>メイン予想は評価専用・資金反映なし</span></div>
   <div class="history-day-kpis"><b>MAIN ${evaluated.length}R中 ${hits}的中</b><b>的中率 ${evaluated.length?(hits/evaluated.length*100).toFixed(1)+'%':'—'}</b><b>TRY損益 ${tryProfit>0?'+':''}${yen(tryProfit)}</b></div>
  </div><div class="history-list">${body}</div>
 </section>`;
}
async function rollingSummary(dates){
 let races=0,hits=0,stake=0,returns=0;
 for(const date of dates){
   const s=sessionMap()[date]||null,items=Array.isArray(s?.races)?s.races:[];
   for(let race=1;race<=12;race++){
     const row=items.find(x=>Number(x.race)===race)||null,picks=mainPicks(row);
     if(!picks.length)continue;
     const res=await result(date,race);
     if(!res?.trifecta)continue;
     const hit=picks.includes(String(res.trifecta));
     races++;stake+=picks.length*100;
     if(hit){hits++;returns+=Number(res.payout100)||0}
   }
 }
 return {races,hits,stake,returns,profit:returns-stake,hitRate:races?hits/races:null,roi:stake?returns/stake:null};
}
function rollingSummaryHtml(summary,dates){
 const start=dates.at(-1)||'',end=dates[0]||'',profitClass=summary.profit>0?'up':summary.profit<0?'down':'';
 const rate=summary.hitRate==null?'—':(summary.hitRate*100).toFixed(1)+'%';
 const roi=summary.roi==null?'—':(summary.roi*100).toFixed(1)+'%';
 return `<section class="history-30d">
  <div class="history-30d-head"><div><h3>直近30日戦績 · 蒲郡</h3><p>結果前に固定したメイン予想だけを100円/点換算で集計。古いデータは削除せず表示対象からだけ外します。</p></div><div class="history-30d-range">${esc(start)} 〜 ${esc(end)}<br>前日まで・日本時間</div></div>
  <div class="history-30d-kpis">
   <div class="history-30d-kpi"><small>評価レース</small><b>${summary.races}R</b></div>
   <div class="history-30d-kpi"><small>的中</small><b>${summary.hits}R</b></div>
   <div class="history-30d-kpi"><small>的中率</small><b>${rate}</b></div>
   <div class="history-30d-kpi"><small>回収率</small><b>${roi}</b></div>
   <div class="history-30d-kpi ${profitClass}"><small>100円/点換算 損益</small><b>${summary.profit>0?'+':''}${yen(summary.profit)}</b></div>
  </div>
 </section>`;
}
async function render(){
 installStyle();
 const root=document.getElementById('predictionHistory');if(!root)return;
 const dates=pastDates();
 if(!dates.length){root.innerHTML='<div class="history-empty">直近30日に表示できる履歴はありません。古いデータは削除せず保持しています。</div>';return}
 root.innerHTML='<div id="historyLoading">履歴を読み込み中…</div>';
 const tmap=tryRows();
 const html=[];
 for(const d of dates)html.push(await renderDay(d,tmap));
 const summary=await rollingSummary(dates);
 root.innerHTML=`${rollingSummaryHtml(summary,dates)}<div class="history-wrap">${html.join('')}</div>`;
}
function start(){
 installStyle();
 const nav=document.querySelector('.nav[data-view="history"]');
 nav?.addEventListener('click',()=>{setTimeout(()=>{const t=document.getElementById('pageTitle');if(t)t.textContent='履歴';render()},0)});
 window.addEventListener('boatcommand:forward-status',()=>{if(document.querySelector('#history.view.active'))render()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&document.querySelector('#history.view.active'))render()});
}
window.BOAT_COMMAND_PREDICTION_HISTORY_V03518=Object.freeze({version:VERSION,render,pastOnly:true,visibleWindowDays:VISIBLE_WINDOW_DAYS,dataRetention:'PRESERVE_ALL',mainCashNeutral:true,tryFundsOnly:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();