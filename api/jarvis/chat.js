// Vercel serverless endpoint for BOAT COMMAND JARVIS.
// OPENAI_API_KEY must exist only in server environment variables.
const SYSTEM=`You are JARVIS, the conversational core inside BOAT COMMAND. Reply naturally in Japanese unless the user uses another language. Use supplied BOAT COMMAND state only as context. Never claim an app action or GitHub/code change happened unless the runtime reports it. Never use same-day result or payout information to influence PRE-RACE predictions. Never rewrite HARD LOCK predictions. Never mutate results, payouts, or bankroll. Keep answers concise and operational.`;
function textFromResponse(data){if(typeof data?.output_text==='string')return data.output_text.trim();const out=Array.isArray(data?.output)?data.output:[];return out.flatMap(x=>Array.isArray(x?.content)?x.content:[]).map(x=>x?.text||'').join('').trim();}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'JARVIS_LLM_NOT_CONFIGURED'});
  const message=String(req.body?.message||'').trim().slice(0,8000);
  if(!message)return res.status(400).json({error:'EMPTY_MESSAGE'});
  const state=req.body?.state??null;const history=Array.isArray(req.body?.history)?req.body.history.slice(-12):[];
  const input=[...history.map(x=>({role:x?.role==='assistant'?'assistant':'user',content:String(x?.text||'').slice(0,4000)})),{role:'user',content:`BOAT COMMAND state:\n${JSON.stringify(state).slice(0,12000)}\n\nUser:\n${message}`}];
  try{
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:process.env.JARVIS_OPENAI_MODEL||'gpt-5-mini',instructions:SYSTEM,input,max_output_tokens:900})});
    const data=await r.json();if(!r.ok)return res.status(502).json({error:'LLM_UPSTREAM_ERROR',status:r.status});
    const reply=textFromResponse(data);if(!reply)return res.status(502).json({error:'EMPTY_LLM_RESPONSE'});
    return res.status(200).json({reply,model:data.model||process.env.JARVIS_OPENAI_MODEL||'configured'});
  }catch{return res.status(502).json({error:'LLM_REQUEST_FAILED'});}
}
