// BOAT COMMAND GAMAGORI POST-RACE CARD DISPLAY v0.35.17
// Display-only layer. Reads separated POST-RACE relay files and never mutates PRE-RACE prediction/session data.
(()=>{'use strict';
const VERSION='GAMAGORI-POST-RACE-CARD-V0.35.17';
let running=false,timer=null;
const cache=new Map();
const todayJst=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const escPost=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function liveSession(){let s=null;try{s=typeof session==='function'?session():null}catch{}return s&&s.runType==='LIVE'&&s.venue==='蒲郡'&&String(s.date||'')===todayJst()?s:null}
function validPick(v,n){const p=n===2?/^[1-6]-[1-6]$/:/^[1-6]-[1-6]-[1-6]$/;return p.test(String(v||''))}
function validate(x,date,race){
 if(!x||x.schema!=='boat-command-live-result-v1')throw new Error('RESULT_SCHEMA_INVALID');
 if(x.venue!=='GAMAGORI'||x.date!==date||Number(x.race)!==Number(race))throw new Error('RESULT_TARGET_INVALID');
 if(x.preRaceDataIncluded!==false||x.resultEndpointsIncluded!==true)throw new Error('RESULT_BOUNDARY_INVALID');
 if(!validPick(x.trifecta,3)||!Number.isFinite(Number(x.payout100)))throw new Error('TRIFECTA_INVALID');
 if(x.exacta!=null&&(!validPick(x.exacta,2)||!Number.isFinite(Number(x.exactaPayout100))))throw new Error('EXACTA_INVALID');
 return x
}
async function load(date,race){
 const key=`${date}:${race}`;if(cache.has(key))return cache.get(key);
 try{
  const r=await fetch(`./live/gamagori/${date}/post/race-${race}-result.json?t=${Date.now()}`,{cache:'no-store',credentials:'same-origin'});
  if(!r.ok)return null;
  const x=validate(await r.json(),date,race);cache.set(key,x);return x
 }catch{return null}
}
function odds(v){const n=Number(v);return Number.isFinite(n)&&n>=0?`${(n/100).toFixed(1)}倍`:'—'}
function yen(v){const n=Number(v);return Number.isFinite(n)?`¥${Math.round(n).toLocaleString('ja-JP')}`:'—'}
function mainPicks(r){
 const frozen=Array.isArray(r?.liveLockSnapshot?.picks)?r.liveLockSnapshot.picks.filter(Boolean):[];
 if(frozen.length)return frozen;
 const x=r?.firstSuggestion;
 return x?.stage==='MAIN'&&x?.status==='CANDIDATE'&&Array.isArray(x.picks)?x.picks.filter(Boolean):[];
}
function mainEval(r,x){
 const picks=mainPicks(r);
 if(!picks.length)return '';
 const hit=picks.includes(String(x.trifecta));
 return `<div class="post-main-eval ${hit?'hit':'miss'}"><div><strong>メイン予想 ${hit?'HIT':'MISS'}</strong><span>評価のみ・資金反映なし</span></div><b>${picks.map(escPost).join(' / ')}</b></div>`;
}
function html(r,x){
 const finish=Array.isArray(x.finishOrder)&&x.finishOrder.length?x.finishOrder.map((lane,i)=>`<span>${i+1}着 <b>${Number(lane)}号艇</b></span>`).join(''):'';
 const exacta=x.exacta&&Number.isFinite(Number(x.exactaPayout100))?`<div><small>2連単 ${escPost(x.exacta)}</small><b>${odds(x.exactaPayout100)}</b><em>${yen(x.exactaPayout100)}</em></div>`:'';
 return `<div class="post-race-card-result">
   ${mainEval(r,x)}
   <div class="post-result-head"><strong>RESULT</strong><b>${escPost(x.trifecta)}</b>${x.winningMethod?`<span>${escPost(x.winningMethod)}</span>`:''}</div>
   <div class="post-result-odds">
     <div><small>3連単 ${escPost(x.trifecta)}</small><b>${odds(x.payout100)}</b><em>${yen(x.payout100)}</em></div>
     ${exacta}
   </div>
   ${finish?`<div class="post-finish-order">${finish}</div>`:''}
 </div>`
}
function renderRace(r,x){
 const card=document.querySelector(`#predictionList .race-card[data-race="${Number(r.race)}"]`);if(!card)return;
 let box=card.querySelector('.post-race-card-result');if(box)box.remove();
 card.insertAdjacentHTML('beforeend',html(r,x));renderSummary()
}
function installEvalStyle(){
 if(document.getElementById('bcMainEvalStyle'))return;
 const s=document.createElement('style');s.id='bcMainEvalStyle';
 s.textContent='.post-main-eval{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;padding:10px 12px;margin:0 0 10px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025)}.post-main-eval>div{display:flex;flex-direction:column;gap:2px}.post-main-eval strong{font-size:10px}.post-main-eval span{font-size:8px;color:#7895aa}.post-main-eval>b{font-size:11px;text-align:right}.post-main-eval.hit{border-color:rgba(65,222,164,.35)}.post-main-eval.hit strong{color:#79e7bb}.post-main-eval.miss{border-color:rgba(255,120,136,.25)}.post-main-eval.miss strong{color:#ff8997}.main-eval-summary{margin:10px 0 12px;padding:10px 12px;border:1px solid rgba(83,226,255,.18);border-radius:11px;background:rgba(5,17,29,.7);font-size:10px;color:#a7c3d6}.main-eval-summary b{color:#eef9ff}.main-eval-summary em{font-style:normal;color:#6f8ba0;margin-left:8px}';
 document.head.appendChild(s);
}
function renderSummary(){
 installEvalStyle();
 const s=liveSession();if(!s)return;
 let evaluated=0,hits=0,available=0;
 for(const r of s.races||[]){
   const x=cache.get(`${s.date}:${Number(r.race)}`);
   const p=mainPicks(r);
   if(p.length)available++;
   if(x&&p.length){evaluated++;if(p.includes(String(x.trifecta)))hits++}
 }
 const panel=document.querySelector('#predict > .panel');if(!panel)return;
 let el=document.getElementById('mainEvalSummaryV03517');
 if(!el){el=document.createElement('div');el.id='mainEvalSummaryV03517';el.className='main-eval-summary';const list=panel.querySelector('#predictionList');list?.insertAdjacentElement('beforebegin',el)}
 if(el)el.innerHTML=`メイン予想評価　<b>${evaluated}R中 ${hits}的中</b>　的中率 <b>${evaluated?(hits/evaluated*100).toFixed(1)+'%':'—'}</b><em>保存済みメイン予想 ${available}R・資金反映なし</em>`;
}
function renderCached(){
 const s=liveSession();if(!s)return;
 for(const r of s.races||[]){const x=cache.get(`${s.date}:${Number(r.race)}`);if(x)renderRace(r,x)}
 renderSummary();
}
async function sync(){
 if(running)return;const s=liveSession();if(!s)return;running=true;
 try{
  const rows=await Promise.all((s.races||[]).map(async r=>({r,x:await load(s.date,Number(r.race))})));
  for(const {r,x} of rows)if(x)renderRace(r,x)
 }finally{running=false}
}
const priorRenderAll=typeof renderAll==='function'?renderAll:null;
if(priorRenderAll)renderAll=function(){
 const out=priorRenderAll.apply(this,arguments);
 setTimeout(renderCached,0);
 return out
};
function start(){installEvalStyle();setTimeout(sync,250);setTimeout(sync,1600);timer=setInterval(sync,60000)}
window.addEventListener('boatcommand:program-sync',()=>setTimeout(sync,120));
document.addEventListener('visibilitychange',()=>{if(!document.hidden){renderCached();sync()}});
window.BOAT_COMMAND_POST_RACE_CARD_V0358=Object.freeze({version:VERSION,sync,renderCached,displayOnly:true,mutatesPrediction:false,mainEvaluation:true,mainCashNeutral:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();