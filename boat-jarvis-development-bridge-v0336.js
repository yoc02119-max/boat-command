// BOAT COMMAND JARVIS DEVELOPMENT BRIDGE v0.33.6
// Produces a machine-readable development job for the authorized GitHub/Codex execution layer.
(()=>{
'use strict';
const VERSION='BOAT-JARVIS-DEVELOPMENT-BRIDGE-V0.33.6';
const KEY='boatCommand.jarvis.development.jobs.v0336';
function read(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
function write(x){try{localStorage.setItem(KEY,JSON.stringify(x.slice(-40)))}catch{}return x}
function enqueue(request){const q=String(request||'').normalize('NFKC').trim();if(!q)return null;const core=window.BOAT_JARVIS_CORE_V0336;const job=Object.freeze({schema:'boat-command-jarvis-development-job-v1',id:`dev-${Date.now()}-${Math.random().toString(36).slice(2)}`,createdAt:new Date().toISOString(),status:'QUEUED',request:q,repository:'yoc02119-max/boat-command',target:'CODEX_GITHUB',context:core?.snapshot?.()||null,guardrails:{noResultLeakToPreRace:true,noDirectLivePredictionOverwrite:true,noHardLockRewrite:true,noResultRewrite:true,noPayoutRewrite:true,noBankrollRewrite:true,runTestsBeforePromotion:true}});const jobs=read();jobs.push(job);write(jobs);try{window.dispatchEvent(new CustomEvent('boat-jarvis-development-job',{detail:job}))}catch{}return job}
function latest(){return read().at(-1)||null}
function pending(){return read().filter(x=>x.status==='QUEUED')}
function mark(id,status,meta={}){const jobs=read().map(x=>x.id===id?{...x,status,updatedAt:new Date().toISOString(),meta}:x);write(jobs);return jobs.find(x=>x.id===id)||null}
window.BOAT_JARVIS_DEVELOPMENT_BRIDGE_V0336=Object.freeze({version:VERSION,enqueue,latest,pending,mark,target:'CODEX_GITHUB',opensExternalPage:false});
})();
