// BOAT COMMAND JARVIS development gateway v0.33.7
// Server-only boundary. Never expose GitHub credentials to the browser.
const REPO='yoc02119-max/boat-command';
const ALLOWED_GUARDS=['noResultLeakToPreRace','noDirectLivePredictionOverwrite','noHardLockRewrite','noResultRewrite','noPayoutRewrite','noBankrollRewrite','runTestsBeforePromotion'];
function reply(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));}
function validJob(job){return Boolean(job&&job.schema==='boat-command-jarvis-development-job-v1'&&job.repository===REPO&&job.target==='CODEX_GITHUB'&&typeof job.request==='string'&&job.request.trim()&&job.guardrails&&ALLOWED_GUARDS.every(k=>job.guardrails[k]===true));}
export default async function handler(req,res){
  if(req.method!=='POST')return reply(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
  let job=req.body; if(typeof job==='string'){try{job=JSON.parse(job)}catch{return reply(res,400,{ok:false,error:'INVALID_JSON'})}}
  if(!validJob(job))return reply(res,400,{ok:false,error:'INVALID_DEVELOPMENT_JOB'});
  // Credential/executor wiring is intentionally server-side only. Until configured,
  // return an explicit state instead of pretending the code change was executed.
  if(!process.env.JARVIS_GITHUB_EXECUTOR_TOKEN)return reply(res,503,{ok:false,status:'WAITING_FOR_EXECUTOR_AUTH',jobId:job.id,repository:REPO,message:'JARVIS GitHub executor authorization is not configured yet.'});
  return reply(res,202,{ok:true,status:'ACCEPTED',jobId:job.id,repository:REPO,message:'Development job accepted by the server-side JARVIS boundary.'});
}
