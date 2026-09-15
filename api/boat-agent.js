'use strict';
const crypto=require('crypto');
const ALLOWED_ORIGIN=process.env.BOAT_COMMAND_ALLOWED_ORIGIN||'https://yoc02119-max.github.io';
const SYSTEM=`あなたはBOAT COMMAND蒲郡専用AIコアです。自然で簡潔な日本語で会話してください。与えられるsnapshotは参照専用です。既存のメイン予想とPRE-RACE理由は説明できますが、新しい予想・買い目・HARD LOCK・結果・払戻・精算・仮想資金を生成、変更、確定してはいけません。当日結果、展示、払戻、未来情報をPRE-RACE判断へ混ぜてはいけません。操作を実行したと偽らず、画面操作は端末内の許可リストが担当すると説明してください。出目は1-2-3の形式で表記してください。`;
function sameSecret(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&x.length>0&&crypto.timingSafeEqual(x,y)}
function safeSnapshot(input={}){return{schema:'boat-command-agent-snapshot-v1',venue:'蒲郡',date:String(input.date||'').slice(0,10),runType:String(input.runType||'').slice(0,16),bankroll:String(input.bankroll||'—').slice(0,32),ready:Number(input.ready)||0,wait:Number(input.wait)||0,skip:Number(input.skip)||0,locked:Number(input.locked)||0,settled:Number(input.settled)||0,races:(Array.isArray(input.races)?input.races:[]).slice(0,12).map(r=>({race:Number(r.race)||0,mainStatus:String(r.mainStatus||'WAIT').slice(0,20),firstCandidate:(Array.isArray(r.firstCandidate)?r.firstCandidate:[]).slice(0,6).map(v=>String(v).slice(0,12)),reason:String(r.reason||'').slice(0,600),locked:!!r.locked,settled:!!r.settled}))}}
function history(input){return(Array.isArray(input)?input:[]).slice(-8).filter(x=>x&&['user','assistant'].includes(x.role)).map(x=>({role:x.role,content:String(x.text||'').slice(0,1800)}))}
function outputText(data){for(const item of data?.output||[])for(const part of item?.content||[])if(part?.type==='output_text'&&part.text)return String(part.text).trim();return''}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Origin');
  const origin=String(req.headers?.origin||'');if(origin===ALLOWED_ORIGIN){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS')}
  if(req.method==='OPTIONS')return origin===ALLOWED_ORIGIN?res.status(204).end():res.status(403).json({error:'ORIGIN_DENIED'});
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  if(origin!==ALLOWED_ORIGIN)return res.status(403).json({error:'ORIGIN_DENIED'});
  const bearer=String(req.headers?.authorization||'').replace(/^Bearer\s+/i,'');if(!sameSecret(bearer,process.env.BOAT_COMMAND_ACCESS_TOKEN))return res.status(401).json({error:'AUTH_REQUIRED'});
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'AI_NOT_CONFIGURED'});
  const body=req.body&&typeof req.body==='object'?req.body:{};const question=String(body.question||'').trim().slice(0,1200);if(!question)return res.status(400).json({error:'QUESTION_REQUIRED'});
  const snapshot=safeSnapshot(body.snapshot),input=[{role:'developer',content:`${SYSTEM}\n現在状態:${JSON.stringify(snapshot)}`},...history(body.history),{role:'user',content:question}];
  try{
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.6-luna',input,max_output_tokens:600,store:false})});
    const data=await response.json();if(!response.ok)return res.status(502).json({error:'AI_UPSTREAM_ERROR'});const text=outputText(data);if(!text)return res.status(502).json({error:'AI_EMPTY_RESPONSE'});return res.status(200).json({text,requestId:data.id||null});
  }catch{return res.status(502).json({error:'AI_CONNECTION_ERROR'})}
};
module.exports._test=Object.freeze({safeSnapshot,history,outputText,sameSecret,SYSTEM});
