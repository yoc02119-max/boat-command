(()=>{
  'use strict';

  const VERSION='GAMAGORI-EARLY-TRIAL-READINESS-V0.21.8+SKIP-GATE-V0.22.5+ASSET-GATE-V0.23.5';
  const REQUIRED_IDS=[
    'sessionDate','modeBadge','runType','strategyVersion','predictionList','lockAllBtn',
    'resultGate','resultGateBadge','resultSummary','resultList','raceStrip',
    'chat','prompt','send','liveDate','liveRace'
  ];
  const REQUIRED_SCRIPTS=[
    'app.js','gamagori-live-integration-v0198.js','live-autopoll-v0199.js','live-predictor-v0200.js','live-skip-gate-v0225.js','live-autofill-v0201.js',
    'live-lock-guard-v0202.js','live-lock-snapshot-v0203.js','live-result-v0204.js',
    'live-learning-v0205.js','live-learning-dashboard-v0206.js','live-learning-guard-v0207.js',
    'live-integrity-audit-v0208.js','live-snapshot-hash-guard-v0209.js','development-status-v0217.js',
    'trial-readiness-v0218.js'
  ];
  const REQUIRED_ASSETS=['styles.css','manifest.webmanifest'];

  function localPath(url){
    try{return new URL(url,location.href).pathname.split('/').pop()||'';}catch{return '';}
  }
  function cacheKey(url){
    try{return new URL(url,location.href).searchParams.get('v')||'';}catch{return '';}
  }
  function scriptElements(){return [...document.scripts].filter(s=>s.getAttribute('src'));}
  function scriptBases(){return scriptElements().map(s=>localPath(s.getAttribute('src'))).filter(Boolean);}
  function assetElements(){
    const style=document.querySelector('link[rel="stylesheet"][href]');
    const manifest=document.querySelector('link[rel="manifest"][href]');
    return [style,manifest].filter(Boolean);
  }

  function audit(){
    const idsMissing=REQUIRED_IDS.filter(id=>!document.getElementById(id));
    const scripts=scriptElements();
    const bases=scriptBases();
    const scriptsMissing=REQUIRED_SCRIPTS.filter(x=>!bases.includes(x));
    const duplicateScripts=[...new Set(bases.filter((x,i)=>bases.indexOf(x)!==i))];
    const assets=assetElements();
    const assetBases=assets.map(x=>localPath(x.getAttribute('href'))).filter(Boolean);
    const assetsMissing=REQUIRED_ASSETS.filter(x=>!assetBases.includes(x));
    const cacheKeys=[
      ...scripts.filter(x=>REQUIRED_SCRIPTS.includes(localPath(x.getAttribute('src')))).map(x=>cacheKey(x.getAttribute('src'))),
      ...assets.filter(x=>REQUIRED_ASSETS.includes(localPath(x.getAttribute('href')))).map(x=>cacheKey(x.getAttribute('href')))
    ];
    const cacheKeyMissing=cacheKeys.some(x=>!x);
    const cacheKeyMismatch=new Set(cacheKeys.filter(Boolean)).size>1;
    const cacheContractOk=!cacheKeyMissing&&!cacheKeyMismatch&&cacheKeys.length===REQUIRED_SCRIPTS.length+REQUIRED_ASSETS.length;
    const compat=window.BOAT_COMMAND_LIVE_INTEGRATION_COMPAT_V0198||{};
    const safetyFunctions={
      liveRelayLoader:typeof window.loadVerifiedLiveRace==='function',
      liveIntegrationCompat:compat.ok===true&&compat.duplicateGlobalsDeclared===false,
      liveSkipGate:typeof window.bcLiveUnresolvedV0225==='function'&&typeof window.bcLiveSkipsV0225==='function',
      lockRace:typeof window.lockRace==='function',
      finalLiveLockAudit:typeof window.bcFinalLiveLockAudit==='function',
      lockSnapshotVerifier:typeof window.bcVerifyLiveLockSnapshotV0203==='function',
      snapshotHashVerifier:typeof window.bcVerifyLiveLockSnapshotHashV0209==='function',
      liveResultSweep:typeof window.sweepLiveResultsV0204==='function'
    };
    const functionsMissing=Object.entries(safetyFunctions).filter(([,ok])=>!ok).map(([name])=>name);
    const orderNames=['app.js','gamagori-live-integration-v0198.js','live-autopoll-v0199.js','live-predictor-v0200.js','live-skip-gate-v0225.js','live-autofill-v0201.js','live-lock-guard-v0202.js','live-lock-snapshot-v0203.js','live-result-v0204.js','live-learning-v0205.js','live-learning-dashboard-v0206.js','live-learning-guard-v0207.js','live-integrity-audit-v0208.js','live-snapshot-hash-guard-v0209.js','development-status-v0217.js','trial-readiness-v0218.js'];
    const orderPositions=orderNames.map(x=>bases.indexOf(x));
    const orderOk=orderPositions.every((p,i)=>p>=0&&(i===0||p>orderPositions[i-1]));
    const ok=idsMissing.length===0&&scriptsMissing.length===0&&duplicateScripts.length===0&&assetsMissing.length===0&&functionsMissing.length===0&&orderOk&&cacheContractOk;
    return Object.freeze({
      version:VERSION,
      venue:'蒲郡',
      status:ok?'READY_FOR_EARLY_TRIAL':'HOLD',
      ok,
      idsMissing,
      scriptsMissing,
      duplicateScripts,
      assetsMissing,
      functionsMissing,
      scriptOrderOk:orderOk,
      cacheContractOk,
      cacheKeys:[...new Set(cacheKeys.filter(Boolean))],
      safetyFunctions,
      waitFailClosed:true,
      skipExcludedFromLockTarget:true,
      productionMutation:false,
      predictionQualityCertified:false,
      note:ok?'画面・LIVE依存・WAIT/SKIP・HARD LOCK・POST-RACE・配信キャッシュの技術的試用条件を満たしています。予想精度の収益性保証ではありません。':'試用導線または配信整合性に不足があります。HOLDのまま使用してください。',
      checkedAt:new Date().toISOString()
    });
  }

  function render(out){
    const card=document.getElementById('bcDevelopmentStatusV0217');
    if(!card)return;
    let box=document.getElementById('bcTrialReadinessV0218');
    if(!box){
      box=document.createElement('div');
      box.id='bcTrialReadinessV0218';
      box.style.cssText='margin-top:12px;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.03);display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap';
      card.appendChild(box);
    }
    const label=out.ok?'🟢 試用導線 READY':'🟡 試用導線 HOLD';
    const missing=out.idsMissing.length+out.scriptsMissing.length+out.functionsMissing.length+out.duplicateScripts.length+out.assetsMissing.length+(out.cacheContractOk?0:1);
    const detail=out.ok?'LIVE依存・WAIT/SKIP・HARD LOCK・POST-RACE・CACHE契約 OK':`不足 ${missing}件`;
    box.innerHTML=`<div><b>${label}</b><div style="font-size:11px;opacity:.65;margin-top:3px">${detail}</div></div><small style="opacity:.7">v0.21.8+0.23.5 · READ ONLY</small>`;
  }

  function run(){
    const out=audit();
    window.BOAT_COMMAND_TRIAL_READINESS_V0218=out;
    render(out);
    return out;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,0),{once:true});
  else setTimeout(run,0);
})();
