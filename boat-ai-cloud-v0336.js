// BOAT COMMAND in-app generative conversation client v0.33.6
// Uses only the read-only agent snapshot. Protected actions remain local and allow-listed.
(()=>{
'use strict';
const VERSION='BOAT-COMMAND-CLOUD-AI-V0.33.7';
const HISTORY_KEY='boatCommand.cloudAi.history.v0336';
const TOKEN_KEY='boatCommand.cloudAi.access.v0336';
function config(){return window.BOAT_COMMAND_AI_RUNTIME_V0336||{}}
function history(){try{const rows=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');return Array.isArray(rows)?rows:[]}catch{return[]}}
function append(role,text){const rows=history();rows.push({role,text:String(text||'').slice(0,1800),at:new Date().toISOString()});try{localStorage.setItem(HISTORY_KEY,JSON.stringify(rows.slice(-16)))}catch{}}
function emit(phase,detail={}){try{window.dispatchEvent(new CustomEvent('boat-command-agent-event',{detail:{phase,...detail}}))}catch{}}
function token(){let value='';try{value=sessionStorage.getItem(TOKEN_KEY)||''}catch{}if(value)return value;value=String(window.prompt?.('BOAT COMMAND AIアクセスコードを入力してください')||'').trim();if(value)try{sessionStorage.setItem(TOKEN_KEY,value)}catch{}return value}
function isLocal(command){return command?.action||command?.intent!=='HANDOFF_SUGGESTION'}
async function cloud(question,accessToken){
  const agent=window.BOAT_COMMAND_AGENT_V0335,endpoint=String(config().endpoint||'').trim();
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${accessToken}`},cache:'no-store',body:JSON.stringify({question,snapshot:agent.snapshot(),history:history().slice(-8).map(({role,text})=>({role,text}))})});
  if(response.status===401){try{sessionStorage.removeItem(TOKEN_KEY)}catch{}throw new Error('AUTH_REQUIRED')}
  if(!response.ok)throw new Error(`AI_HTTP_${response.status}`);
  const data=await response.json(),text=String(data?.text||'').trim();if(!text)throw new Error('AI_EMPTY_RESPONSE');return text;
}
async function respond(question){
  const q=String(question||'').trim(),agent=window.BOAT_COMMAND_AGENT_V0335;if(!q)return'';
  const command=agent?.plan?.(q);if(!agent)return'AIコアの準備待ちです。';
  if(command?.action==='QUEUE_DEVELOPMENT'&&typeof window.BOAT_COMMAND_DEVELOPMENT_AGENT_V0337?.submit==='function')return window.BOAT_COMMAND_DEVELOPMENT_AGENT_V0337.submit(q);
  if(isLocal(command)||!config().endpoint)return agent.execute(q);
  const accessToken=token();if(!accessToken)return agent.execute(q);
  emit('heard',{role:'user',text:q});emit('thinking',{intent:'CLOUD_CONVERSATION'});
  try{const text=await cloud(q,accessToken);append('user',q);append('assistant',text);emit('answered',{role:'assistant',text,intent:'CLOUD_CONVERSATION',action:null});return text}
  catch(error){console.warn('[boat-cloud-ai]',error?.message||error);emit('error',{role:'assistant',text:error?.message==='AUTH_REQUIRED'?'アクセスコードを確認してください。':'クラウドAIへ接続できません。ローカルAIで回答します。'});return agent.execute(q)}
}
window.BOAT_COMMAND_CLOUD_AI_V0336=Object.freeze({version:VERSION,respond,history,configured:()=>!!config().endpoint,readOnlySnapshot:true,predictionMutation:false,hardLockMutation:false,resultMutation:false,payoutMutation:false,bankrollMutation:false});
})();
