// BOAT COMMAND JARVIS -> GitHub executor bridge.
// Token stays server-side in Vercel. This endpoint is read-only by default.
const REPO='yoc02119-max/boat-command';
const API='https://api.github.com';

function headers(token){return {'accept':'application/vnd.github+json','authorization':`Bearer ${token}`,'x-github-api-version':'2022-11-28','user-agent':'boat-command-jarvis'};}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  const token=process.env.JARVIS_GITHUB_EXECUTOR_TOKEN;
  if(!token)return res.status(503).json({error:'JARVIS_GITHUB_EXECUTOR_NOT_CONFIGURED'});
  const action=String(req.body?.action||'status');
  if(action!=='status')return res.status(403).json({error:'ACTION_NOT_ALLOWED'});
  try{
    const [repoR,branchR]=await Promise.all([
      fetch(`${API}/repos/${REPO}`,{headers:headers(token)}),
      fetch(`${API}/repos/${REPO}/branches/main`,{headers:headers(token)})
    ]);
    const repo=await repoR.json();const branch=await branchR.json();
    if(!repoR.ok||!branchR.ok)return res.status(502).json({error:'GITHUB_UPSTREAM_ERROR',repoStatus:repoR.status,branchStatus:branchR.status});
    return res.status(200).json({ok:true,executor:'GITHUB',repository:REPO,branch:'main',sha:branch?.commit?.sha||null,defaultBranch:repo?.default_branch||null,private:Boolean(repo?.private),checkedAt:new Date().toISOString(),mode:'READ_ONLY_STATUS'});
  }catch{return res.status(502).json({error:'GITHUB_REQUEST_FAILED'});}
}
