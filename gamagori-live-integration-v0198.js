// BOAT COMMAND GAMAGORI LIVE INTEGRATION v0.19.8 COMPATIBILITY GUARD
// The active v0.19.8 implementation is embedded once in app.js for the current early-trial build.
// index.html still loads this legacy asset for cache/public-contract compatibility, so this file MUST
// remain side-effect free. Re-declaring BC_LIVE_V0198 / loadVerifiedLiveRace here would throw a
// global lexical redeclaration error and can stop later LIVE safety modules from initializing.
(()=>{
  'use strict';
  const required=[
    'loadVerifiedLiveRace',
    'applyVerifiedLiveToPrediction',
    'liveRelayReadyPayload',
    'liveRelayReason'
  ];
  const missing=required.filter(name=>typeof window[name]!=='function');
  window.BOAT_COMMAND_LIVE_INTEGRATION_COMPAT_V0198=Object.freeze({
    version:'GAMAGORI-LIVE-INTEGRATION-COMPAT-V0.19.8',
    implementation:'app.js',
    duplicateGlobalsDeclared:false,
    ok:missing.length===0,
    missing,
    checkedAt:new Date().toISOString()
  });
  if(missing.length){
    console.error('GAMAGORI_LIVE_INTEGRATION_EMBEDDED_IMPLEMENTATION_MISSING',missing);
  }
})();
