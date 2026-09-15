'use strict';
const crypto=require('crypto');
const ALLOWED_ORIGIN=process.env.BOAT_COMMAND_ALLOWED_ORIGIN||'https://yoc02119-max.github.io';
function sameSecret(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&x.length>0&&crypto.timingSafeEqual(x,y)}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Origin');const origin=String(req.headers?.origin||'');if(origin===ALLOWED_ORIGIN){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Headers','Authorization');res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS')}
  if(req.method==='OPTIONS')return origin===ALLOWED_ORIGIN?res.status(204).end():res.status(403).json({error:'ORIGIN_DENIED'});if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});if(origin!==ALLOWED_ORIGIN)return res.status(403).json({error:'ORIGIN_DENIED'});
  const bearer=String(req.headers?.authorization||'').replace(/^Bearer\s+/i,'');if(!sameSecret(bearer,process.env.BOAT_COMMAND_ACCESS_TOKEN))return res.status(401).json({error:'AUTH_REQUIRED'});
  const triggerId=String(process.env.WORKSPACE_AGENT_TRIGGER_ID||'').trim(),agentToken=String(process.env.WORKSPACE_AGENT_ACCESS_TOKEN||'').trim(),runId=String(req.query?.runId||'').trim();if(!/^agtch_[A-Za-z0-9_-]+$/.test(triggerId)||!agentToken)return res.status(503).json({error:'WORKSPACE_AGENT_NOT_CONFIGURED'});if(!/^apirun_[A-Za-z0-9_-]+$/.test(runId))return res.status(400).json({error:'INVALID_RUN_ID'});
  try{const response=await fetch(`https://api.chatgpt.com/v1/workspace_agents/${triggerId}/runs/${runId}`,{headers:{Authorization:`Bearer ${agentToken}`}}),data=await response.json().catch(()=>({}));if(!response.ok)return res.status(502).json({error:'WORKSPACE_AGENT_STATUS_FAILED',upstreamStatus:response.status});return res.status(200).json({runId,status:String(data.status||'unknown'),conversationUrl:data.conversation_url||null,errorCode:data.error?.code||null})}catch{return res.status(502).json({error:'WORKSPACE_AGENT_CONNECTION_ERROR'})}
};
module.exports._test=Object.freeze({sameSecret});
