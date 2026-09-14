// BOAT COMMAND GAMAGORI LEGACY LIVE PREDICTOR COMPAT v0.32.9
// Second/exhibition candidate generation is retired from the formal 蒲郡 LIVE stack.
// Compatibility facade only: never fetches exhibition/results and never mutates firstSuggestion/liveSuggestion.
(()=>{
'use strict';
const API=Object.freeze({
 version:'GAMAGORI-LIVE-PREDICTOR-COMPAT-V0.32.9',
 venue:'蒲郡',
 compatibilityOnly:true,
 formalPredictionOwner:'BOAT_COMMAND_MAIN_PREDICTION_V0320',
 secondCandidateEnabled:false,
 exhibitionFetch:false,
 resultFetch:false,
 payoutFetch:false
});
window.BOAT_COMMAND_LIVE_PREDICTOR_V0200=API;
window.refreshLiveCandidates=()=>false;
window.renderLiveCandidates=()=>false;
})();