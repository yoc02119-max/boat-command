// Vercel serverless endpoint for BOAT COMMAND JARVIS.
// OPENAI_API_KEY must exist only in server environment variables.
const SYSTEM=`You are JARVIS, the high-quality conversational core inside BOAT COMMAND. Speak natural, context-aware Japanese unless the user uses another language. Behave like a capable ongoing assistant, not a command parser: understand short follow-ups such as「続けて」「それで」「違う」「さっきのやつ」from conversation context, explain reasoning when useful, and do not repeat canned status text. Use supplied BOAT COMMAND state as live context. Distinguish discussion from execution: never claim an app action, GitHub change, commit, deployment, prediction update, result update, payout update, or bankroll update happened unless runtime/tool evidence explicitly reports it. Never use same-day result or payout information to influence PRE-RACE predictions. Never rewrite HARD LOCK predictions. Never mutate results, payouts, or bankroll. If a protected action is requested, explain the protected boundary while still helping with the non-mutating part of the request. Keep routine answers concise but allow detail when the user asks or the task needs it.`;
function textFromResponse(data){if(typeof data?.output_text==='string')return data.output_text.trim();const out=Array.isArray(data?.output)?data.output:[];return out.flatMap(x=>Array.isArray(x?.content)?x.content:[]).map(x=>x?.text||'').join('').trim();}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'JARVIS_LLM_NOT_CONFIGURED'});
  const message=String(req.body?.message||'').trim().slice(0,8000);if(!message)return res.status(400).json({error:'EMPTY_MESSAGE'});
  const state=req.body?.state??req.body?.context??null;
  const history=Array.isArray(req.body?.history)?req.body.history.slice(-30):[];
  const previousResponseId=String(req.body?.previous_response_id||'').trim();
  const input=previousResponseId
    ? [{role:'user',content:`Current BOAT COMMAND state:\n${JSON.stringify(state).slice(0,12000)}\n\nUser:\n${message}`}]
    : [...history.map(x=>({role:x?.role==='assistant'?'assistant':'user',content:String(x?.text||'').slice(0,5000)})),{role:'user',content:`Current BOAT COMMAND state:\n${JSON.stringify(state).slice(0,12000)}\n\nUser:\n${message}`}];
  try{
    const body={model:process.env.JARVIS_OPENAI_MODEL||'gpt-5.6-sol',instructions:SYSTEM,input,max_output_tokens:1400,reasoning:{effort:'medium'},text:{verbosity:'medium'},store:true};
    if(previousResponseId)body.previous_response_id=previousResponseId;
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify(body)});
    const data=await r.json();if(!r.ok)return res.status(502).json({error:'LLM_UPSTREAM_ERROR',status:r.status,detail:data?.error?.code||null});
    const reply=textFromResponse(data);if(!reply)return res.status(502).json({error:'EMPTY_LLM_RESPONSE'});
    return res.status(200).json({reply,message:reply,response_id:data.id||null,model:data.model||process.env.JARVIS_OPENAI_MODEL||'configured'});
  }catch{return res.status(502).json({error:'LLM_REQUEST_FAILED'});}
}
