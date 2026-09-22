import crypto from 'node:crypto';
// BOAT COMMAND JARVIS -> GitHub executor bridge.
// Token stays server-side in Vercel. Reads are allowed; development dispatch is constrained to a dedicated branch/issue.
const REPO='yoc02119-max/boat-command';
const API='https://api.github.com';
const DEV_BRANCH='jarvis-completion-v0336';
const DEV_ISSUE=2;
const DEV_COOKIE='boat_command_dev';
function devSecret(){return String(process.env.BOAT_COMMAND_DEVELOPER_PASSWORD||'');}
function devCookie(req){
 const raw=String(req.headers?.cookie||'');
 for(const part of raw.split(';')){const i=part.indexOf('=');if(i<0)continue;if(part.slice(0,i).trim()===DEV_COOKIE)return decodeURIComponent(part.slice(i+1).trim());}
 return '';
}
function safeEq(a,b){const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);}
function devSessionValid(req){
 const key=devSecret(),token=devCookie(req);if(!key||!token)return false;
 const p=String(token).split('.');if(p.length!==2)return false;
 const sig=crypto.createHmac('sha256',key).update(p[0]).digest('base64url');
 if(!safeEq(p[1],sig))return false;
 try{const x=JSON.parse(Buffer.from(p[0],'base64url').toString('utf8'));return x?.v===1&&Number(x.exp)>Date.now();}catch{return false;}
}
function headers(token){return {'accept':'application/vnd.github+json','authorization':`Bearer ${token}`,'x-github-api-version':'2022-11-28','user-agent':'boat-command-jarvis'};}
async function gh(token,path,options={}){const r=await fetch(`${API}${path}`,{...options,headers:{...headers(token),...(options.headers||{})}});let data=null;try{data=await r.json()}catch{}return {r,data};}
function resultFromComments(comments,jobId){const rows=(Array.isArray(comments)?comments:[]).slice().reverse();for(const c of rows){const body=String(c?.body||'');if(!body.includes(jobId))continue;const status=(body.match(/status\s*[:=]\s*(COMPLETED|FAILED|RUNNING)/i)||[])[1]?.toUpperCase();if(!status)continue;const sha=(body.match(/(?:commit\s*sha|commit|sha)\s*[:=]\s*([0-9a-f]{7,40})/i)||[])[1]||null;const tests=(body.match(/tests?\s*[:=]\s*([^\n]+)/i)||[])[1]?.trim()||null;const summary=(body.match(/summary\s*[:=]\s*([^\n]+)/i)||[])[1]?.trim()||'';return {status,commitSha:sha,tests,summary,commentId:c.id||null,commentUrl:c.html_url||null,updatedAt:c.updated_at||c.created_at||null};}return null;}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 const token=process.env.JARVIS_GITHUB_EXECUTOR_TOKEN;if(!token)return res.status(503).json({error:'JARVIS_GITHUB_EXECUTOR_NOT_CONFIGURED'});
 const action=String(req.body?.action||'status');
 const protectedActions=new Set(['dispatch_development','venue_expansion_decision','development_result']);
 if(protectedActions.has(action)&&!devSessionValid(req))return res.status(401).json({error:'DEVELOPER_AUTH_REQUIRED'});
 try{
  if(action==='status'){
   const [repoX,branchX]=await Promise.all([gh(token,`/repos/${REPO}`),gh(token,`/repos/${REPO}/branches/main`)]);if(!repoX.r.ok||!branchX.r.ok)return res.status(502).json({error:'GITHUB_UPSTREAM_ERROR',repoStatus:repoX.r.status,branchStatus:branchX.r.status});
   return res.status(200).json({ok:true,executor:'GITHUB',repository:REPO,branch:'main',sha:branchX.data?.commit?.sha||null,defaultBranch:repoX.data?.default_branch||null,private:Boolean(repoX.data?.private),checkedAt:new Date().toISOString(),mode:'READ_ONLY_STATUS'});
  }
  if(action==='dispatch_development'){
   const job=req.body?.job||{};const request=String(job.request||'').trim().slice(0,6000);if(!job.id||!request)return res.status(400).json({error:'INVALID_DEVELOPMENT_JOB'});
   const forbidden=/(HARD\s*LOCK|払戻|精算|仮想資金|bankroll).*(書き換|変更|削除|解除|増や|減ら)|(当日結果|same.day.result).*(予想|PRE.?RACE)/i;if(forbidden.test(request))return res.status(403).json({error:'PROTECTED_DEVELOPMENT_REQUEST'});
   const body=[`[JARVIS DEVELOPMENT JOB] ${job.id}`,'',request,'','Guardrails:','- No same-day result/payout leak into PRE-RACE','- No direct LIVE prediction overwrite','- No HARD LOCK rewrite','- No result/payout/bankroll rewrite',`- Target branch: ${DEV_BRANCH}`,'- Never auto-promote to main','','Return status, commit SHA, tests, and summary to JARVIS.'].join('\n');
   const x=await gh(token,`/repos/${REPO}/issues/${DEV_ISSUE}/comments`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({body})});if(!x.r.ok)return res.status(502).json({error:'GITHUB_EXECUTOR_DISPATCH_FAILED',status:x.r.status});
   return res.status(202).json({ok:true,status:'QUEUED',jobId:job.id,repository:REPO,branch:DEV_BRANCH,issue:DEV_ISSUE,commentId:x.data?.id||null,commentUrl:x.data?.html_url||null,dispatchedAt:new Date().toISOString(),promotion:'NEVER_AUTO_MAIN'});
  }
  if(action==='venue_expansion_decision'){
   const decision=String(req.body?.decision||'').toLowerCase(),venue=String(req.body?.venue||''),variant=String(req.body?.variant||'');
   if(!['approve','reject'].includes(decision)||!venue||!variant)return res.status(400).json({error:'INVALID_VENUE_EXPANSION_DECISION'});
   const p=await gh(token,`/repos/${REPO}/contents/daily-lab/venue-expansion-policy-v1.json?ref=main`);
   if(!p.r.ok||!p.data?.content)return res.status(502).json({error:'EXPANSION_POLICY_READ_FAILED',status:p.r.status});
   const policy=JSON.parse(Buffer.from(String(p.data.content),'base64').toString('utf8'));
   const row=(policy.venues||[]).find(v=>v.code===venue||v.slug===venue);
   if(!row||row.decision!=='AWAITING_HUMAN_REVIEW'||row.humanReviewPending!==true||row.candidateVariant!==variant)return res.status(409).json({error:'EXPANSION_DECISION_NOT_CURRENT'});
   const x=await gh(token,`/repos/${REPO}/actions/workflows/venue-expansion-decision-v1.yml/dispatches`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ref:'main',inputs:{action:decision,venue:row.slug,variant:row.candidateVariant}})});
   if(!x.r.ok)return res.status(502).json({error:'EXPANSION_DECISION_DISPATCH_FAILED',status:x.r.status});
   return res.status(202).json({ok:true,status:'QUEUED',decision,venue:row.slug,variant:row.candidateVariant,effectivePolicy:decision==='approve'?'NEXT_JST_DAY':'KEEP_BASE4',dispatchedAt:new Date().toISOString()});
  }
  if(action==='development_result'){
   const jobId=String(req.body?.jobId||'').trim();if(!/^dev-[A-Za-z0-9.-]+$/.test(jobId))return res.status(400).json({error:'INVALID_JOB_ID'});
   const x=await gh(token,`/repos/${REPO}/issues/${DEV_ISSUE}/comments?per_page=100`);if(!x.r.ok)return res.status(502).json({error:'GITHUB_EXECUTOR_RESULT_READ_FAILED',status:x.r.status});
   const result=resultFromComments(x.data,jobId);return res.status(200).json({ok:true,jobId,result:result?{jobId,...result}:null,checkedAt:new Date().toISOString()});
  }
  return res.status(403).json({error:'ACTION_NOT_ALLOWED'});
 }catch{return res.status(502).json({error:'GITHUB_REQUEST_FAILED'});}
}
