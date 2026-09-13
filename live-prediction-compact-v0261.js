// BOAT COMMAND GAMAGORI LIVE PREDICTION COMPACT UI v0.26.2
// UI-only + LIVE date safety layer. Does not alter prediction/result data rules.
(()=>{
  'use strict';
  const VERSION='GAMAGORI-LIVE-COMPACT-V0.26.2';
  const todayJst=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

  function forceTodayLiveSession(){
    let s=null;try{s=typeof session==='function'?session():null;}catch{return false;}
    if(!s||s.runType!=='LIVE'||s.replayPackId)return false;
    const today=todayJst();
    if(String(s.date||'')===today)return false;
    try{
      if(typeof currentDate!=='undefined')currentDate=today;
      localStorage.setItem('boatCommand.lastDate',today);
      const d=document.querySelector('#sessionDate');if(d)d.value=today;
      if(typeof session==='function')session(today);
      return true;
    }catch{return false;}
  }

  const style=document.createElement('style');
  style.id='bc-live-compact-v0261-style';
  style.textContent=`
#predictionList.bc-live-compact-v0261{display:grid;gap:12px}
#predictionList.bc-live-compact-v0261 .race-card{padding:14px;border-radius:16px}
#predictionList.bc-live-compact-v0261 .race-head{margin-bottom:10px;align-items:center}
#predictionList.bc-live-compact-v0261 .race-no{font-size:22px;font-weight:900;letter-spacing:.02em}
#predictionList.bc-live-compact-v0261 .race-meta{display:none}
#predictionList.bc-live-compact-v0261 .stake{font-size:12px;opacity:.72}
#predictionList.bc-live-compact-v0261 .two-stage-v0260{display:grid;gap:8px;margin:0}
#predictionList.bc-live-compact-v0261 .prediction-gate-top,
#predictionList.bc-live-compact-v0261 .program-score,
#predictionList.bc-live-compact-v0261 .snapshot-slot,
#predictionList.bc-live-compact-v0261 .live-candidate-v0200,
#predictionList.bc-live-compact-v0261 .live-autofill-v0201,
#predictionList.bc-live-compact-v0261 .pick-grid,
#predictionList.bc-live-compact-v0261 .reason-box{display:none!important}
#predictionList.bc-live-compact-v0261 .race-actions{margin-top:10px;display:none}
#predictionList.bc-live-compact-v0261 .race-card.compact-can-lock .race-actions,
#predictionList.bc-live-compact-v0261 .race-card.locked .race-actions{display:flex}
#predictionList.bc-live-compact-v0261 .compact-tools{display:flex;justify-content:flex-end;margin-top:8px}
#predictionList.bc-live-compact-v0261 .compact-details-btn{appearance:none;border:0;background:transparent;color:inherit;opacity:.65;font:inherit;font-size:12px;padding:6px 2px;cursor:pointer}
#predictionList.bc-live-compact-v0261 .race-card.compact-expanded .prediction-gate-top,
#predictionList.bc-live-compact-v0261 .race-card.compact-expanded .program-score,
#predictionList.bc-live-compact-v0261 .race-card.compact-expanded .snapshot-slot,
#predictionList.bc-live-compact-v0261 .race-card.compact-expanded .live-autofill-v0201,
#predictionList.bc-live-compact-v0261 .race-card.compact-expanded .pick-grid,
#predictionList.bc-live-compact-v0261 .race-card.compact-expanded .reason-box{display:revert!important}
#predictionList.bc-live-compact-v0261 .race-card.compact-expanded .race-meta{display:block}
#predictionList.bc-live-compact-v0261 .race-card.compact-expanded .race-actions{display:flex}
@media(max-width:720px){#predictionList.bc-live-compact-v0261 .race-card{padding:12px}}`;
  if(!document.getElementById(style.id))document.head.appendChild(style);

  function validPick(v){const s=String(v||'').trim();return /^[1-6]-[1-6]-[1-6]$/.test(s)&&new Set(s.split('-')).size===3;}
  function apply(){
    forceTodayLiveSession();
    let s=null;try{s=typeof session==='function'?session():null;}catch{return;}
    const host=document.querySelector('#predictionList');if(!host)return;
    const live=!!s&&s.runType==='LIVE'&&!s.replayPackId&&String(s.date||'')===todayJst();
    host.classList.toggle('bc-live-compact-v0261',live);
    if(!live)return;
    host.querySelectorAll('.race-card').forEach(card=>{
      const race=Number((card.querySelector('.race-no')?.textContent||'').replace(/\D/g,''));
      const r=s.races?.find(x=>Number(x.race)===race);if(!r)return;
      const picks=(r.picks||[]).filter(Boolean);
      const canLock=!r.locked&&picks.length>=1&&picks.length<=4&&picks.every(validPick)&&!!String(r.rationale||'').trim();
      card.classList.toggle('compact-can-lock',canLock);
      let tools=card.querySelector('.compact-tools-v0261');
      if(!tools){tools=document.createElement('div');tools.className='compact-tools compact-tools-v0261';tools.innerHTML='<button type="button" class="compact-details-btn">詳細を見る</button>';card.appendChild(tools);}
      const btn=tools.querySelector('.compact-details-btn');if(btn)btn.textContent=card.classList.contains('compact-expanded')?'詳細を閉じる':'詳細を見る';
    });
  }
  document.addEventListener('click',e=>{const btn=e.target?.closest?.('.compact-details-btn');if(!btn)return;const card=btn.closest('.race-card');if(!card)return;card.classList.toggle('compact-expanded');btn.textContent=card.classList.contains('compact-expanded')?'詳細を閉じる':'詳細を見る';});
  const priorRender=typeof renderAll==='function'?renderAll:null;
  if(priorRender){renderAll=function(){forceTodayLiveSession();const out=priorRender.apply(this,arguments);apply();return out;};}
  const priorSweep=typeof sweepVerifiedLiveRelays==='function'?sweepVerifiedLiveRelays:null;
  if(priorSweep){sweepVerifiedLiveRelays=async function(opts={}){forceTodayLiveSession();const out=await priorSweep(opts);apply();return out;};}
  window.BOAT_COMMAND_LIVE_COMPACT_V0261=Object.freeze({version:VERSION,venue:'蒲郡',currentLiveDateOnly:true,uiOnly:false,dateSafetyOnly:true});
  const switched=forceTodayLiveSession();
  if(switched&&typeof renderAll==='function')renderAll();else apply();
})();