// BOAT COMMAND GAMAGORI forward strategy dashboard v0.34.7
// Display-only. Reads separated SHADOW status and never writes LIVE predictions, locks, stakes, or results.
(()=>{'use strict';
const VERSION='GAMAGORI-FORWARD-DASHBOARD-V0.34.7';
const URL='./live/gamagori/forward-status-v0347.json';
let last=null,timer=null;

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=v=>Number.isFinite(Number(v))?(Number(v)*100).toFixed(1)+'%':'—';
const yen=v=>Number.isFinite(Number(v))?(Number(v)<0?'-':'')+'¥'+Math.abs(Math.round(Number(v))).toLocaleString('ja-JP'):'—';
const stateOf=m=>m?.current?.decision==='FORWARD_SHADOW_TRY'?'TRY':m?.current?.decision==='FORWARD_SHADOW_TRACK'?'TRY':m?.current?.decision==='FORWARD_SHADOW_SKIP'?'SKIP':'WAIT';
const stateLabel=s=>s==='TRY'?'TRY｜検証対象':s==='SKIP'?'SKIP｜条件外':'WAIT｜判定待ち';
function picksText(m){
  const p=m?.current?.picks||[];
  if(stateOf(m)!=='TRY')return '—';
  return p.length?p.join(' / '):'固定買い目なし';
}
function progress(m){
  const day=Math.max(0,Number(m?.cycleDay)||0),total=Math.max(1,Number(m?.cycleDays)||30);
  return Math.min(100,Math.max(0,day/total*100));
}
function methodCard(m){
  const s=stateOf(m),settled=Number(m?.settledMatchedRaces)||0,matched=Number(m?.matchedRaces)||0;
  const roi=Number.isFinite(Number(m?.roi))?pct(m.roi):'—';
  const hit=Number.isFinite(Number(m?.hitRate))?pct(m.hitRate):'—';
  const tries=Array.isArray(m?.currentTry)?m.currentTry:[];
  const reason=s==='TRY'
    ?tries.map(x=>`${Number(x.race)}R：${(x.picks||[]).join(' / ')}`).join('<br>')
    :s==='SKIP'?'本日は条件該当なし。':'本日のSHADOW判定待ち';
  return `<article class="forward-method ${s.toLowerCase()}">
    <div class="forward-method-head">
      <div><small>${esc(m?.method||'')}</small><b>${esc(m?.label||'')}</b></div>
      <span class="forward-state ${s.toLowerCase()}">${stateLabel(s)}</span>
    </div>
    <div class="forward-pick">${reason}</div>
    <div class="forward-progress-line"><span style="width:${progress(m)}%"></span></div>
    <div class="forward-cycle"><b>${Number(m?.cycleDay)||0}/${Number(m?.cycleDays)||30}日</b><span>残り ${Number(m?.daysRemaining)||0}日</span></div>
    <div class="forward-metrics">
      <div><small>TRY累計</small><b>${matched}</b></div>
      <div><small>精算済</small><b>${settled}</b></div>
      <div><small>的中率</small><b>${hit}</b></div>
      <div><small>ROI</small><b>${roi}</b></div>
      <div><small>損益</small><b>${settled?yen(m?.profitYen):'—'}</b></div>
    </div>
  </article>`;
}
function body(data,compact=false){
  const ready=data?.program?.allProgramReady===true?'12/12 READY':'同期中';
  return `<div class="forward-title-row">
    <div><small>FORWARD SHADOW · 30 DAY CYCLE</small><h2>勝ちパターン LIVE検証</h2></div>
    <div class="forward-ready">${esc(ready)}</div>
  </div>
  <div class="forward-methods ${compact?'compact':''}">
    ${methodCard(data?.methods?.exacta)}
    ${methodCard(data?.methods?.trifecta)}
  </div>
  <div class="forward-foot">SHADOW TRY専用｜1〜12Rを走査し条件一致レースを記録。30日終了時に「継続採用 / 練り直し / データ不足で延長」を判定。LIVE買い目・賭け金・HARD LOCKは変更しません。</div>`;
}
function ensure(){
  const homeGrid=document.querySelector('#home .dashboard-grid');
  if(homeGrid&&!document.getElementById('forwardDashboardV0347')){
    const el=document.createElement('section');el.id='forwardDashboardV0347';el.className='panel wide forward-dashboard';
    const racePanel=document.querySelector('#raceStrip')?.closest('.panel');
    homeGrid.insertBefore(el,racePanel||null);
  }
  const predictPanel=document.querySelector('#predict > .panel');
  if(predictPanel&&!document.getElementById('forwardPredictV0347')){
    const el=document.createElement('div');el.id='forwardPredictV0347';el.className='forward-dashboard forward-dashboard-compact';
    const controls=predictPanel.querySelector('.session-controls');
    controls?.insertAdjacentElement('afterend',el);
    if(!controls)predictPanel.prepend(el);
  }
}
function render(data){
  ensure();
  const a=document.getElementById('forwardDashboardV0347'),b=document.getElementById('forwardPredictV0347');
  if(a)a.innerHTML=body(data,false);
  if(b)b.innerHTML=body(data,true);
}
function renderWait(msg='SHADOWステータス同期中'){
  ensure();
  const html=`<div class="forward-title-row"><div><small>FORWARD SHADOW · 30 DAY CYCLE</small><h2>勝ちパターン LIVE検証</h2></div><div class="forward-ready wait">${esc(msg)}</div></div>`;
  const a=document.getElementById('forwardDashboardV0347'),b=document.getElementById('forwardPredictV0347');
  if(a)a.innerHTML=html;if(b)b.innerHTML=html;
}
async function load(){
  try{
    const r=await fetch(`${URL}?t=${Date.now()}`,{cache:'no-store',credentials:'same-origin'});
    if(!r.ok)throw new Error(`HTTP_${r.status}`);
    const x=await r.json();
    if(x?.schema!=='boat-command-gamagori-forward-status-v0347'||x?.shadowOnly!==true||x?.liveBettingEnabled!==false)throw new Error('STATUS_CONTRACT_INVALID');
    last=x;render(x);
  }catch(e){
    if(last)render(last);else renderWait('ステータス待ち');
    console.warn('[FORWARD v0.34.7]',e);
  }
}
function start(){
  ensure();renderWait();load();
  if(timer)clearInterval(timer);
  timer=setInterval(load,60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
}
window.BOAT_COMMAND_FORWARD_V0347=Object.freeze({version:VERSION,load,get state(){return last}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();