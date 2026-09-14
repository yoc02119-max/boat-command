// BOAT COMMAND GAMAGORI LEGACY TWO-STAGE COMPAT v0.32.9
// Compatibility facade only. The formal LIVE prediction is owned exclusively by live-main-prediction-v0320.js.
// Exhibition/second-candidate prediction is intentionally disabled; this module must never rewrite firstSuggestion.
(()=>{
'use strict';
const VERSION='GAMAGORI-TWO-STAGE-COMPAT-V0.32.9';
function main(){return window.BOAT_COMMAND_MAIN_PREDICTION_V0320||null}
async function ensureHistory(){const api=main();return typeof api?.ensureHistory==='function'?api.ensureHistory():[]}
function sync(){const api=main();if(typeof api?.sync==='function')api.sync();return true}
async function ensureFirstSuggestion({render=true}={}){sync();if(render&&typeof window.renderAll==='function')window.renderAll();return true}
async function ensureLiveSuggestion(){return true}
window.BOAT_COMMAND_TWO_STAGE_V0260=Object.freeze({
 version:VERSION,
 venue:'蒲郡',
 compatibilityOnly:true,
 formalOwner:'BOAT_COMMAND_MAIN_PREDICTION_V0320',
 secondCandidateEnabled:false,
 exhibitionUsed:false,
 resultFetch:false,
 ensureHistory,
 ensureFirstSuggestion,
 ensureLiveSuggestion,
 sync
});
})();