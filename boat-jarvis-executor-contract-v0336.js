// BOAT COMMAND JARVIS EXECUTOR CONTRACT v0.33.6
// Browser-side contract for an authorized GitHub/Codex executor.
(()=>{
'use strict';
const VERSION='BOAT-JARVIS-EXECUTOR-CONTRACT-V0.33.6';
const ISSUE=2;
const REPO='yoc02119-max/boat-command';
const BRANCH='jarvis-completion-v0336';
function envelope(job){if(!job?.id||!job?.request)return null;return Object.freeze({schema:'boat-command-jarvis-executor-v1',jobId:job.id,repository:REPO,branch:BRANCH,issue:ISSUE,request:job.request,guardrails:job.guardrails,requiredResult:['status','commitSha','tests','summary'],promotion:'NEVER_AUTO_MAIN'});}
function acceptResult(result){if(!result?.jobId)return false;const bridge=window.BOAT_JARVIS_DEVELOPMENT_BRIDGE_V0336;const status=result.status==='COMPLETED'?'COMPLETED':result.status==='FAILED'?'FAILED':'RUNNING';bridge?.mark?.(result.jobId,status,{commitSha:result.commitSha||null,tests:result.tests||null,summary:result.summary||''});try{window.dispatchEvent(new CustomEvent('boat-jarvis-development-result',{detail:result}))}catch{}return true;}
function pending(){const bridge=window.BOAT_JARVIS_DEVELOPMENT_BRIDGE_V0336;return (bridge?.pending?.()||[]).map(envelope).filter(Boolean)}
window.BOAT_JARVIS_EXECUTOR_CONTRACT_V0336=Object.freeze({version:VERSION,repository:REPO,branch:BRANCH,issue:ISSUE,pending,envelope,acceptResult});
})();
