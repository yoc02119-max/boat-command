// BOAT COMMAND GAMAGORI LIVE TRIAL READINESS v0.31.2
(()=>{
'use strict';
const VERSION='GAMAGORI-LIVE-TRIAL-READINESS-V0.31.2';
const REQUIRED_IDS=['sessionDate','modeBadge','runType','predictionList','resultGate','resultSummary','resultList','raceStrip'];
const REQUIRED_SCRIPTS=['app.js','virtual-bankroll-v0250.js','gamagori-live-integration-v0198.js','live-program-v0270.js','live-autopoll-v0199.js','live-predictor-v0200.js','live-two-stage-v0260.js','live-prediction-compact-v0261.js','live-skip-gate-v0225.js','live-autofill-v0201.js','live-lock-guard-v0202.js','live-lock-snapshot-v0203.js','live-result-v0204.js','live-learning-v0205.js','live-learning-dashboard-v0206.js','live-learning-guard-v0207.js','live-integrity-audit-v0208.js','live-snapshot-hash-guard-v0209.js','development-status-v0217.js','trial-readiness-v0218.js','live-session-today-v0263.js','live-manual-refresh-v0276.js','trial-readiness-v0272.js','boat-ai-core-v0290.js','boat-voice-agent-v0296.js','boat-chatgpt-voice-v0298.js','boat-ai-visual-v0310.js','boat-remote-control-v0284.js'];
const base=u=>{try{return new URL(u,location.href).pathname.split('/').pop()}catch{return''}};
const key=u=>{try{return new URL(u,location.href).searchParams.get('v')||''}catch{return''}};
function audit(){
 const scripts=[...document.scripts].filter(x=>x.src),bases=scripts.map(x=>base(x.getAttribute('src')));
 const idsMissing=REQUIRED_IDS.filter(x=>!document.getElementById(x));
 const scriptsMissing=REQUIRED_SCRIPTS.filter(x=>!bases.includes(x));
 const duplicates=[...new Set(bases.filter((x,i)=>bases.indexOf(x)!==i))];
 const positions=REQUIRED_SCRIPTS.map(x=>bases.indexOf(x));
 const orderOk=positions.every((p,i)=>p>=0&&(i===0||p>positions[i-1]));
 const keys=REQUIRED_SCRIPTS.map(x=>{const el=scripts.find(s=>base(s.getAttribute('src'))===x);return el?key(el.getAttribute('src')):''});
 const cacheOk=keys.every(Boolean)&&new Set(keys).size===1;
 const globals={session:typeof window.session==='function',renderAll:typeof window.renderAll==='function',programSync:typeof window.syncGamagoriProgramSnapshot==='function',relayLoader:typeof window.loadVerifiedLiveRace==='function',relaySweep:typeof window.sweepVerifiedLiveRelays==='function',predictor:!!window.BOAT_COMMAND_LIVE_PREDICTOR_V0200,twoStage:!!window.BOAT_COMMAND_TWO_STAGE_V0260,compact:!!window.BOAT_COMMAND_LIVE_COMPACT_V0261,lockAudit:typeof window.bcFinalLiveLockAudit==='function',snapshotVerifier:typeof window.bcVerifyLiveLockSnapshotV0203==='function',hashVerifier:typeof window.bcVerifyLiveLockSnapshotHashV0209==='function',resultSweep:typeof window.sweepLiveResultsV0204==='function',todayGuard:!!window.BOAT_COMMAND_TODAY_LIVE_V0263,manualRefresh:typeof window.BOAT_COMMAND_MANUAL_REFRESH_V0276?.refresh==='function',aiCore:typeof window.BOAT_COMMAND_AI_CORE?.respond==='function',voiceAgent:typeof window.BOAT_COMMAND_VOICE_AGENT?.handle==='function',visualAi:!!window.BOAT_COMMAND_VISUAL_AI_CORE};
 const functionsMissing=Object.entries(globals).filter(([,v])=>!v).map(([k])=>k);
 const program=window.BOAT_COMMAND_PROGRAM_V0270?.state||{};
 const s=(()=>{try{return window.session()}catch{return null}})();
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const currentLive=!!s&&s.runType==='LIVE'&&s.venue==='蒲郡'&&String(s.date||'')===today;
 const firstReady=currentLive?(s.races||[]).filter(r=>r?.firstSuggestion?.status==='CANDIDATE'&&r.firstSuggestion.sessionDate===today).length:null;
 const programReady=Number(program.ready||0),programWait=Number(program.wait??(12-programReady));
 const structuralOk=!idsMissing.length&&!scriptsMissing.length&&!duplicates.length&&orderOk&&cacheOk&&!functionsMissing.length;
 const operationOk=!currentLive||(programReady===12&&firstReady===12);
 const ok=structuralOk&&operationOk;
 const holdReasons=[];
 if(!structuralOk)holdReasons.push('画面/依存/キャッシュ契約未完了');
 if(currentLive&&programReady!==12)holdReasons.push(`当日番組 ${programReady}/12`);
 if(currentLive&&firstReady!==12)holdReasons.push(`第一候補 ${firstReady}/12`);
 return Object.freeze({version:VERSION,venue:'蒲郡',status:ok?'READY':'HOLD',ok,structuralOk,operationOk,idsMissing,scriptsMissing,duplicates,scriptOrderOk:orderOk,cacheContractOk:cacheOk,cacheKey:keys.find(Boolean)||null,functionsMissing,globals,currentLive,programReady,programWait,firstStageReady:firstReady,holdReasons,prePostSeparated:true,waitFailClosed:true,noResultLookahead:true,checkedAt:new Date().toISOString()});
}
function render(out){
 let box=document.getElementById('bcTrialReadinessV0272');
 const host=document.getElementById('bcDevelopmentStatusV0217')||document.querySelector('#data .panel.wide');
 if(!host)return;
 if(!box){box=document.createElement('div');box.id='bcTrialReadinessV0272';box.style.cssText='margin-top:10px;padding:10px 12px;border:1px solid rgba(255,255,255,.12);border-radius:10px;font-size:11px';host.appendChild(box)}
 const first=out.firstStageReady===null?'—':`${out.firstStageReady}/12`;
 const reason=out.ok?'運営条件OK':out.holdReasons.join(' / ')||'確認待ち';
 box.textContent=`${out.ok?'🟢':'🟡'} LIVE readiness ${out.status} · PROGRAM ${out.programReady}/12 · 第一候補 ${first} · ${reason} · cache v${out.cacheKey||'?'} · ${new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date())}`;
}
function run(){const out=audit();window.BOAT_COMMAND_TRIAL_READINESS_V0272=out;render(out);return out}
window.addEventListener('boatcommand:program-sync',()=>setTimeout(run,0));
window.addEventListener('boatcommand:today-live',()=>setTimeout(run,120));
window.addEventListener('load',()=>setTimeout(run,250));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(run,50)});
setInterval(run,5000);
setTimeout(run,400);
})();