// BOAT COMMAND JARVIS LLM CLIENT v0.33.7
// Conversation-first: app state is fetched only when JARVIS asks for it.
(()=>{
'use strict';
const VERSION='BOAT-JARVIS-LLM-CLIENT-V0.33.7';
const RESPONSE_STORE='boatCommand.jarvis.previousResponseId.v0336';
function previous(){try{return sessionStorage.getItem(RESPONSE_STORE)||''}catch{return''}}
function remember(id){try{if(id)sessionStorage.setItem(RESPONSE_STORE,String(id));}catch{}}
function clear(){try{sessionStorage.removeItem(RESPONSE_STORE)}catch{}}
function capabilities(){const app=window.BOAT_JARVIS_APP_CONTROLLER_V0336;const agent=window.BOAT_COMMAND_AGENT_V0335;return Object.freeze({appActions:Array.isArray(app?.allowed)?app.allowed:[],githubStatus:Boolean(agent?.allowedActions?.includes?.('GITHUB_STATUS')),developmentBridge:Boolean(window.BOAT_JARVIS_DEVELOPMENT_BRIDGE_V0336),protectedActions:Array.isArray(app?.protectedActions)?app.protectedActions:[]});}
function appStatus(){const agent=window.BOAT_COMMAND_AGENT_V0335;try{return agent?.snapshot?.()||{available:false};}catch{return {available:false};}}
async function executeTool(call){const name=String(call?.name||'');const a=call?.arguments||{};const app=window.BOAT_JARVIS_APP_CONTROLLER_V0336;const agent=window.BOAT_COMMAND_AGENT_V0335;const dev=window.BOAT_JARVIS_DEVELOPMENT_BRIDGE_V0336;
  if(name==='app_status')return {ok:true,name,state:appStatus()};
  if(name==='github_status'){if(!agent?.execute)throw new Error('AGENT_CORE_MISSING');const message=await agent.execute('GitHub接続状態を確認して');return {ok:true,name,message,state:agent.snapshot?.()||null};}
  if(name==='open_view'){if(!app?.dispatch)throw new Error('APP_CONTROLLER_MISSING');return await app.dispatch('OPEN_VIEW',{view:a.view});}
  if(name==='open_race'){if(!app?.dispatch)throw new Error('APP_CONTROLLER_MISSING');return await app.dispatch('OPEN_RACE',{race:Number(a.race)});}
  if(name==='refresh_live'){if(!app?.dispatch)throw new Error('APP_CONTROLLER_MISSING');return await app.dispatch('REFRESH_LIVE',{});}
  if(name==='queue_development'){if(!dev?.enqueue)throw new Error('DEVELOPMENT_BRIDGE_MISSING');const job=dev.enqueue(String(a.request||''));return {ok:Boolean(job?.id),name,job};}
  return {ok:false,error:'UNKNOWN_TOOL',name};
}
async function post(body){const cloud=window.BOAT_JARVIS_CLOUD_V0337;if(!cloud?.configured?.())throw new Error('JARVIS_CLOUD_NOT_CONFIGURED');const res=await cloud.request('/api/jarvis/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!res.ok){if(res.status===400||res.status===404)clear();let data={};try{data=await res.json()}catch{}if(res.status===429&&data?.error==='FREE_AI_LIMIT_REACHED')throw new Error('JARVIS_FREE_AI_LIMIT_REACHED');throw new Error(`JARVIS_LLM_HTTP_${res.status}`);}return await res.json();}
async function chat(text,context={}){const q=String(text||'').normalize('NFKC').trim();if(!q)return'';const conversation=context?.conversation||context||{};const history=Array.isArray(conversation?.history)?conversation.history:[];
  // Do not push live app state into every conversational turn. The model can call app_status when it needs it.
  const base={message:q,history,capabilities:capabilities()};const prev=previous();if(prev)base.previous_response_id=prev;
  let data=await post(base);if(data.response_id)remember(data.response_id);
  const calls=Array.isArray(data?.tool_calls)?data.tool_calls:[];
  if(calls.length){const outputs=[];for(const call of calls){let result;try{result=await executeTool(call)}catch(e){result={ok:false,error:String(e?.message||e)}}outputs.push({call_id:call.call_id,name:call.name,output:result});}
    data=await post({message:q,history:[],capabilities:capabilities(),previous_response_id:data.response_id||previous(),tool_outputs:outputs});if(data.response_id)remember(data.response_id);
  }
  const message=typeof data?.message==='string'?data.message:typeof data?.reply==='string'?data.reply:'';if(!message)throw new Error('JARVIS_LLM_BAD_RESPONSE');return message;
}
window.BOAT_JARVIS_LLM_CLIENT_V0336=Object.freeze({version:VERSION,chat,executeTool,clearConversationState:clear,previousResponseId:previous,capabilities,endpoint:()=>window.BOAT_JARVIS_CLOUD_V0337?.endpoint?.('/api/jarvis/chat')||'',configured:()=>!!window.BOAT_JARVIS_CLOUD_V0337?.configured?.(),clientApiKey:false,responseContinuity:true,toolAware:true,toolExecution:true,conversationFirst:true,onDemandAppState:true});
})();
