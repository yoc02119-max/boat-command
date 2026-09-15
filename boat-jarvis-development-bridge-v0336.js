// BOAT COMMAND JARVIS DEVELOPMENT BRIDGE v0.33.6
// Produces, dispatches, and receives machine-readable development jobs/results.
(()=>{
'use strict';
const VERSION='BOAT-JARVIS-DEVELOPMENT-BRIDGE-V0.33.6';
const KEY='boatCommand.jarvis.development.jobs.v0336';
let timer=null;
function read(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
function write(x){try{localStorage.setItem(KEY,JSON.stringify(x.slice(-40)))}catch{}return x}
function mark(id,status,meta={}){const jobs=read().map(x=>x.id===id?{...x,status,updatedAt:new Date().toISOString(),meta:{...(x.meta||{}),...meta}}:x);write(jobs);return jobs.find(x=>x.id===id)||null}
async function dispatch(job){if(!job)return null;try{mark(job.id,'DISPATCHING');const r=await fetch('/api/jarvis/github',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({action:'dispatch_development',job})});const data=await r.json();if(!r.ok){mark(job.id,'FAILED',{error:data?.error||`HTTP_${r.status}`});return {ok:false,error:data?.error||`HTTP_${r.status}`,jobId:job.id};}mark(job.id,'QUEUED_REMOTE',data);try{window.dispatchEvent(new CustomEvent('boat-jarvis-development-dispatched',{detail:data}))}catch{}startPolling();return data;}catch(e){mark(job.id,'FAILED',{error:String(e?.message||e)});return {ok:false,error:'DISPATCH_FAILED',jobId:job.id};}}
async function check(job){try{const r=await fetch('/api/jarvis/github',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({action:'development_result',jobId:job.id})});const data=await r.json();if(!r.ok||!data?.result)return null;const result=data.result;const status=result.status==='COMPLETED'?'COMPLETED':result.status==='FAILED'?'FAILED':'RUNNING';mark(job.id,status,result);try{window.BOAT_JARVIS_EXECUTOR_CONTRACT_V0336?.acceptResult?.(result)}catch{}try{window.dispatchEvent(new CustomEvent('boat-jarvis-development-result',{detail:result}))}catch{}return result;}catch{return null}}
async function poll(){const jobs=pending();if(!jobs.length){stopPolling();return[]}return Promise.all(jobs.map(check))}
function startPolling(){if(timer)return;poll();timer=setInterval(poll,30000)}
function stopPolling(){if(timer){clearInterval(timer);timer=null}}
function enqueue(request){const q=String(request||'').normalize('NFKC').trim();if(!q)return null;const core=window.BOAT_JARVIS_CORE_V0336;const job=Object.freeze({schema:'boat-command-jarvis-development-job-v1',id:`dev-${Date.now()}-${Math.random().toString(36).slice(2)}`,createdAt:new Date().toISOString(),status:'QUEUED',request:q,repository:'yoc02119-max/boat-command',target:'CODEX_GITHUB',context:core?.snapshot?.()||null,guardrails:{noResultLeakToPreRace:true,noDirectLivePredictionOverwrite:true,noHardLockRewrite:true,noResultRewrite:true,noPayoutRewrite:true,noBankrollRewrite:true,runTestsBeforePromotion:true}});const jobs=read();jobs.push(job);write(jobs);try{window.dispatchEvent(new CustomEvent('boat-jarvis-development-job',{detail:job}))}catch{}dispatch(job);return job}
function latest(){return read().at(-1)||null}
function pending(){return read().filter(x=>['QUEUED','DISPATCHING','QUEUED_REMOTE','RUNNING'].includes(x.status))}
window.addEventListener('load',()=>{if(pending().length)startPolling()},{once:true});
window.BOAT_JARVIS_DEVELOPMENT_BRIDGE_V0336=Object.freeze({version:VERSION,enqueue,dispatch,check,poll,startPolling,latest,pending,mark,target:'CODEX_GITHUB',opensExternalPage:false,remoteDispatch:true,resultPolling:true});
})();
