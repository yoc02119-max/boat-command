// BOAT COMMAND JARVIS DEVELOPMENT BRIDGE v0.33.7
// Sends machine-readable development jobs only to the same-origin server executor.
(()=>{
'use strict';
const VERSION='BOAT-JARVIS-DEVELOPMENT-BRIDGE-V0.33.7';
const KEY='boatCommand.jarvis.development.jobs.v0336';
function read(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
function write(x){try{localStorage.setItem(KEY,JSON.stringify(x.slice(-40)))}catch{}return x}
function mark(id,status,meta={}){const jobs=read().map(x=>x.id===id?{...x,status,updatedAt:new Date().toISOString(),meta}:x);write(jobs);return jobs.find(x=>x.id===id)||null}
async function submit(job){try{const r=await fetch('/api/jarvis/development',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(job)});let data={};try{data=await r.json()}catch{}const status=data.status||(r.ok?'ACCEPTED':'FAILED');mark(job.id,status,{httpStatus:r.status,...data});window.dispatchEvent(new CustomEvent('boat-jarvis-development-result',{detail:{jobId:job.id,status:r.ok?'ACCEPTED':status,summary:data.message||data.error||'Development executor response received.'}}));return data}catch(e){mark(job.id,'FAILED',{error:String(e?.message||e)});window.dispatchEvent(new CustomEvent('boat-jarvis-development-result',{detail:{jobId:job.id,status:'FAILED',summary:`Executor connection failed: ${e?.message||e}`}}));return null}}
function enqueue(request){const q=String(request||'').normalize('NFKC').trim();if(!q)return null;const core=window.BOAT_JARVIS_CORE_V0336;const job={schema:'boat-command-jarvis-development-job-v1',id:`dev-${Date.now()}-${Math.random().toString(36).slice(2)}`,createdAt:new Date().toISOString(),status:'QUEUED',request:q,repository:'yoc02119-max/boat-command',target:'CODEX_GITHUB',context:core?.snapshot?.()||null,guardrails:{noResultLeakToPreRace:true,noDirectLivePredictionOverwrite:true,noHardLockRewrite:true,noResultRewrite:true,noPayoutRewrite:true,noBankrollRewrite:true,runTestsBeforePromotion:true}};const jobs=read();jobs.push(job);write(jobs);try{window.dispatchEvent(new CustomEvent('boat-jarvis-development-job',{detail:job}))}catch{}submit(job);return Object.freeze(job)}
function latest(){return read().at(-1)||null}
function pending(){return read().filter(x=>['QUEUED','ACCEPTED'].includes(x.status))}
window.BOAT_JARVIS_DEVELOPMENT_BRIDGE_V0336=Object.freeze({version:VERSION,enqueue,submit,latest,pending,mark,target:'CODEX_GITHUB',endpoint:'/api/jarvis/development',opensExternalPage:false});
})();
