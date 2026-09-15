'use strict';
const crypto=require('crypto');
const ALLOWED_ORIGIN=process.env.BOAT_COMMAND_ALLOWED_ORIGIN||'https://yoc02119-max.github.io';
function sameSecret(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&x.length>0&&crypto.timingSafeEqual(x,y)}
function cors(req,res){res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Origin');const origin=String(req.headers?.origin||'');if(origin===ALLOWED_ORIGIN){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS')}return origin}
function safeSnapshot(input={}){return{venue:'蒲郡',date:String(input.date||'').slice(0,10),runType:String(input.runType||'').slice(0,16),ready:Number(input.ready)||0,wait:Number(input.wait)||0,skip:Number(input.skip)||0,locked:Number(input.locked)||0,settled:Number(input.settled)||0}}
function agentInput(requestId,question,snapshot){return[
  `Request ID: ${requestId}`,
  'Repository: yoc02119-max/boat-command',
  'Venue scope: 蒲郡 only',
  `Current PRE-RACE summary: ${JSON.stringify(snapshot)}`,
  `Development request: ${question}`,
  '',
  'Work only on a new SHADOW branch. Investigate, implement, run syntax/boundary/UI tests, and report changed files and results.',
  'Never merge or promote to LIVE automatically. Never overwrite the protected LIVE first-candidate logic.',
  'Never use exhibition, same-day result, payout, finish order, or future data in PRE-RACE prediction.',
  'Never rewrite HARD LOCK records or mutate bets, results, payouts, bankroll, or settlement data.',
  'Do not modify LINE or any venue other than Gamagori. Do not store secrets in the repository.'
].join('\n')}
module.exports=async function handler(req,res){
  const origin=cors(req,res);if(req.method==='OPTIONS')return origin===ALLOWED_ORIGIN?res.status(204).end():res.status(403).json({error:'ORIGIN_DENIED'});
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});if(origin!==ALLOWED_ORIGIN)return res.status(403).json({error:'ORIGIN_DENIED'});
  const bearer=String(req.headers?.authorization||'').replace(/^Bearer\s+/i,'');if(!sameSecret(bearer,process.env.BOAT_COMMAND_ACCESS_TOKEN))return res.status(401).json({error:'AUTH_REQUIRED'});
  const triggerId=String(process.env.WORKSPACE_AGENT_TRIGGER_ID||'').trim(),agentToken=String(process.env.WORKSPACE_AGENT_ACCESS_TOKEN||'').trim();if(!/^agtch_[A-Za-z0-9_-]+$/.test(triggerId)||!agentToken)return res.status(503).json({error:'WORKSPACE_AGENT_NOT_CONFIGURED'});
  const body=req.body&&typeof req.body==='object'?req.body:{},requestId=String(body.requestId||'').trim().slice(0,100),question=String(body.question||'').trim().slice(0,1200);if(!/^bcdev-[A-Za-z0-9-]+$/.test(requestId)||!question)return res.status(400).json({error:'INVALID_REQUEST'});
  const payload={conversation_key:`boat-command-${requestId}`,input:agentInput(requestId,question,safeSnapshot(body.snapshot))};
  try{
    const response=await fetch(`https://api.chatgpt.com/v1/workspace_agents/${triggerId}/trigger`,{method:'POST',headers:{Authorization:`Bearer ${agentToken}`,'Content-Type':'application/json','Idempotency-Key':requestId,'OpenAI-Beta':'workspace_agent_runs=v1'},body:JSON.stringify(payload)}),data=await response.json().catch(()=>({}));
    if(response.status!==202)return res.status(502).json({error:'WORKSPACE_AGENT_TRIGGER_FAILED',upstreamStatus:response.status});
    return res.status(202).json({requestId,runId:data.agent_trigger_run_id||null,conversationUrl:data.conversation_url||null,status:'queued'});
  }catch{return res.status(502).json({error:'WORKSPACE_AGENT_CONNECTION_ERROR'})}
};
module.exports._test=Object.freeze({sameSecret,safeSnapshot,agentInput});
