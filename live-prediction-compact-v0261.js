// BOAT COMMAND GAMAGORI LIVE PREDICTION COMPACT UI v0.26.4
// LIVE prediction screen: user sees race + first/second prediction only.
(()=>{
'use strict';
const VERSION='GAMAGORI-LIVE-COMPACT-V0.26.4';
const todayJst=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function forceTodayLiveSession(){let s=null;try{s=typeof session==='function'?session():null}catch{return false}if(!s||s.runType!=='LIVE'||s.replayPackId)return false;const today=todayJst();if(String(s.date||'')===today)return false;try{if(typeof currentDate!=='undefined')currentDate=today;localStorage.setItem('boatCommand.lastDate',today);const d=document.querySelector('#sessionDate');if(d)d.value=today;if(typeof session==='function')session(today);return true}catch{return false}}
const style=document.createElement('style');style.id='bc-live-compact-v0261-style';style.textContent=`
#predict.bc-live-clean>.panel>.panel-head #lockAllBtn,#predict.bc-live-clean .session-controls,#predict.bc-live-clean #replayPanel{display:none!important}
#predict.bc-live-clean>.panel>.panel-head p{display:none!important}
#predictionList.bc-live-compact-v0261{display:grid;gap:12px}
#predictionList.bc-live-compact-v0261 .race-card{padding:14px;border-radius:16px}
#predictionList.bc-live-compact-v0261 .race-head{margin-bottom:10px;align-items:center}
#predictionList.bc-live-compact-v0261 .race-no{font-size:22px;font-weight:900}
#predictionList.bc-live-compact-v0261 .race-meta,#predictionList.bc-live-compact-v0261 .stake,#predictionList.bc-live-compact-v0261 .prediction-gate-top,#predictionList.bc-live-compact-v0261 .program-score,#predictionList.bc-live-compact-v0261 .snapshot-slot,#predictionList.bc-live-compact-v0261 .live-candidate-v0200,#predictionList.bc-live-compact-v0261 .live-autofill-v0201,#predictionList.bc-live-compact-v0261 .pick-grid,#predictionList.bc-live-compact-v0261 .reason-box,#predictionList.bc-live-compact-v0261 .race-actions,#predictionList.bc-live-compact-v0261 .compact-tools{display:none!important}
#predictionList.bc-live-compact-v0261 .two-stage-v0260{display:grid!important;gap:8px;margin:0!important}
@media(max-width:720px){#predictionList.bc-live-compact-v0261 .race-card{padding:12px}}
`;if(!document.getElementById(style.id))document.head.appendChild(style);
function apply(){forceTodayLiveSession();let s=null;try{s=typeof session==='function'?session():null}catch{return}const host=document.querySelector('#predictionList'),view=document.querySelector('#predict');if(!host||!view)return;const live=!!s&&s.runType==='LIVE'&&!s.replayPackId&&String(s.date||'')===todayJst();host.classList.toggle('bc-live-compact-v0261',live);view.classList.toggle('bc-live-clean',live);if(!live)return;host.querySelectorAll('.compact-tools-v0261').forEach(x=>x.remove())}
const priorRender=typeof renderAll==='function'?renderAll:null;if(priorRender)renderAll=function(){forceTodayLiveSession();const out=priorRender.apply(this,arguments);apply();return out};const priorSweep=typeof sweepVerifiedLiveRelays==='function'?sweepVerifiedLiveRelays:null;if(priorSweep)sweepVerifiedLiveRelays=async function(opts={}){forceTodayLiveSession();const out=await priorSweep(opts);apply();return out};window.BOAT_COMMAND_LIVE_COMPACT_V0261=Object.freeze({version:VERSION,venue:'蒲郡',currentLiveDateOnly:true,displayOnly:true});const switched=forceTodayLiveSession();if(switched&&typeof renderAll==='function')renderAll();else apply();
})();