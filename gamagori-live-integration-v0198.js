// BOAT COMMAND GAMAGORI LIVE INTEGRATION v0.19.8 COMPATIBILITY GUARD
// The active v0.19.8 implementation is embedded once in app.js for the current early-trial build.
// This asset stays free of duplicate LIVE globals, but also hardens the legacy embedded renderer:
// READY/WAIT badges are prediction-only and race identity is derived from the visible race number.
(()=>{
  'use strict';
  const required=[
    'loadVerifiedLiveRace',
    'applyVerifiedLiveToPrediction',
    'liveRelayReadyPayload',
    'liveRelayReason'
  ];
  const missing=required.filter(name=>typeof window[name]!=='function');

  function raceNoFromCard(card){
    const n=Number((card?.querySelector('.race-no')?.textContent||'').replace(/\D/g,''));
    return Number.isInteger(n)&&n>=1&&n<=12?n:null;
  }

  function syncPredictionOnlyLiveBadges(){
    // The embedded v0.19.8 renderer predates the index rewrite and used every .race-card.
    // Remove any badge it may have placed outside the prediction list first.
    document.querySelectorAll('.race-card .live-auto-snapshot').forEach(badge=>{
      if(!badge.closest('#predictionList'))badge.remove();
    });

    let s=null;
    try{s=typeof window.session==='function'?window.session():null;}catch(e){s=null;}
    if(!s||s.runType!=='LIVE'){
      document.querySelectorAll('#predictionList .live-auto-snapshot').forEach(x=>x.remove());
      return;
    }

    document.querySelectorAll('#predictionList .race-card').forEach(card=>{
      const race=raceNoFromCard(card);
      let badge=card.querySelector('.live-auto-snapshot');
      if(!badge){badge=document.createElement('div');badge.className='live-auto-snapshot';card.prepend(badge);}

      if(!race){
        badge.innerHTML='<div class="prediction-gate limited"><b>WAIT｜予想保留</b><span>レース番号を安全に確認できません</span></div>';
        return;
      }
      const r=(s.races||[]).find(x=>Number(x.race)===race);
      if(!r){
        badge.innerHTML='<div class="prediction-gate limited"><b>WAIT｜予想保留</b><span>レース情報を照合できません</span></div>';
        return;
      }
      if(r.liveDataStatus==='READY'){
        badge.innerHTML='<div class="prediction-gate ready"><b>PREDICTION READY｜LIVE VERIFIED</b><span>展示・ST・艇番・気象・締切を安全監査済み</span></div>';
      }else if(r.liveDataStatus==='WAIT'){
        const reason=typeof window.esc==='function'?window.esc(r.liveDataReason||'直前データ待ち'):String(r.liveDataReason||'直前データ待ち');
        badge.innerHTML=`<div class="prediction-gate limited"><b>WAIT｜予想保留</b><span>${reason}</span></div>`;
      }else{
        badge.innerHTML='<div class="prediction-gate limited"><b>WAIT｜予想保留</b><span>verified LIVEデータ待ち</span></div>';
      }
    });
  }

  const previousRender=typeof window.renderAll==='function'?window.renderAll:null;
  if(previousRender){
    window.renderAll=function(){
      const out=previousRender.apply(this,arguments);
      syncPredictionOnlyLiveBadges();
      return out;
    };
  }

  window.BOAT_COMMAND_LIVE_INTEGRATION_COMPAT_V0198=Object.freeze({
    version:'GAMAGORI-LIVE-INTEGRATION-COMPAT-V0.19.8+DOM-SCOPE-V0.23.1',
    implementation:'app.js',
    duplicateGlobalsDeclared:false,
    predictionDomScoped:true,
    raceIdentityFailClosed:true,
    ok:missing.length===0,
    missing,
    checkedAt:new Date().toISOString()
  });
  if(missing.length){
    console.error('GAMAGORI_LIVE_INTEGRATION_EMBEDDED_IMPLEMENTATION_MISSING',missing);
  }
  syncPredictionOnlyLiveBadges();
})();
