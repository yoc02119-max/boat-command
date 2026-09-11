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

// GAMAGORI local AI schedule helper.
// Schedule is venue-only and independent of PRE-RACE/POST-RACE data paths.
(()=>{
  'use strict';
  const SERIES=Object.freeze([
    {start:'2026-09-13',end:'2026-09-18',name:'ルーキーシリーズ第17戦スカパー！・JLC杯'},
    {start:'2026-09-29',end:'2026-10-04',name:'G3「いい風吹け」キリンビール晴れ風賞'},
    {start:'2026-10-07',end:'2026-10-10',name:'幸田町長杯争奪秋の美味筆柿レース'},
    {start:'2026-10-27',end:'2026-11-01',name:'日刊スポーツ杯争奪第56回蒲郡大賞典'},
    {start:'2026-11-09',end:'2026-11-14',name:'DMM.com杯争奪「ボートガマ一代」カップ'},
    {start:'2026-11-21',end:'2026-11-24',name:'三遠ネオフェニックス杯'},
    {start:'2026-11-27',end:'2026-12-02',name:'マクール杯争奪男女ハーフバトル'},
    {start:'2026-12-06',end:'2026-12-11',name:'G1オールジャパン竹島特別 開設71周年記念競走'},
    {start:'2026-12-25',end:'2026-12-29',name:'BOATRACE振興会会長賞'}
  ]);
  const jpDate=iso=>{
    const [y,m,d]=iso.split('-').map(Number);
    const w=['日','月','火','水','木','金','土'][new Date(Date.UTC(y,m-1,d)).getUTCDay()];
    return `${m}/${d}（${w}）`;
  };
  const todayJst=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const scheduleAnswer=()=>{
    const today=todayJst();
    const active=SERIES.find(x=>x.start<=today&&today<=x.end);
    if(active){
      const next=SERIES.find(x=>x.start>active.end);
      return `蒲郡は <strong>今日開催日</strong> です。${active.name}（${jpDate(active.start)}〜${jpDate(active.end)}）。${next?`次節は <strong>${jpDate(next.start)}</strong> から、${next.name}です。`:''}`;
    }
    const next=SERIES.find(x=>x.start>today);
    if(next)return `蒲郡の次の開催日は <strong>${jpDate(next.start)}</strong> です。${next.name}（${jpDate(next.start)}〜${jpDate(next.end)}）。`;
    return '蒲郡の登録済み開催日程はここまでです。次期日程は未確認なので、推測では答えません。';
  };
  const install=()=>{
    if(typeof window.answer!=='function'||window.answer.__gamagoriScheduleWrapped)return;
    const previous=window.answer;
    const wrapped=function(q){
      const t=String(q||'').replace(/\s/g,'');
      if(/次の開催日|次回開催|次節|開催いつ|いつ開催/.test(t))return scheduleAnswer();
      return previous(q);
    };
    wrapped.__gamagoriScheduleWrapped=true;
    window.answer=wrapped;
  };
  install();
  window.BOAT_COMMAND_GAMAGORI_SCHEDULE=Object.freeze({series:SERIES,nextAnswer:scheduleAnswer,sourceCheckedAt:'2026-09-12'});
})();
