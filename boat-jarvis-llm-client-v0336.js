// BOAT COMMAND JARVIS LLM CLIENT v0.33.6
// Calls a same-origin backend. NEVER stores or sends an OpenAI API key from the browser.
(()=>{
'use strict';
const VERSION='BOAT-JARVIS-LLM-CLIENT-V0.33.6';
const ENDPOINT='/api/jarvis/chat';
const RESPONSE_STORE='boatCommand.jarvis.previousResponseId.v0336';
function previous(){try{return sessionStorage.getItem(RESPONSE_STORE)||''}catch{return''}}
function remember(id){try{if(id)sessionStorage.setItem(RESPONSE_STORE,String(id));}catch{}}
function clear(){try{sessionStorage.removeItem(RESPONSE_STORE)}catch{}}
function capabilities(){
  const app=window.BOAT_JARVIS_APP_CONTROLLER_V0336;
  const github=window.BOAT_COMMAND_AGENT_V0335;
  return Object.freeze({
    appActions:Array.isArray(app?.allowed)?app.allowed:[],
    githubStatus:Boolean(github?.allowedActions?.includes?.('GITHUB_STATUS')),
    developmentBridge:Boolean(window.BOAT_JARVIS_DEVELOPMENT_BRIDGE_V0336),
    protectedActions:Array.isArray(app?.protectedActions)?app.protectedActions:[]
  });
}
async function chat(text,context={}){const q=String(text||'').normalize('NFKC').trim();if(!q)return'';
  const conversation=context?.conversation||context||{};
  const history=Array.isArray(conversation?.history)?conversation.history:[];
  const body={message:q,state:{...context,jarvisTools:capabilities()},history};
  const prev=previous();if(prev)body.previous_response_id=prev;
  const res=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify(body)});
  if(!res.ok){if(res.status===400||res.status===404)clear();throw new Error(`JARVIS_LLM_HTTP_${res.status}`);}
  const data=await res.json();
  const message=typeof data?.message==='string'?data.message:typeof data?.reply==='string'?data.reply:'';
  if(!message)throw new Error('JARVIS_LLM_BAD_RESPONSE');
  if(data.response_id)remember(data.response_id);
  return message;
}
window.BOAT_JARVIS_LLM_CLIENT_V0336=Object.freeze({version:VERSION,chat,clearConversationState:clear,previousResponseId:previous,capabilities,endpoint:ENDPOINT,clientApiKey:false,responseContinuity:true,toolAware:true});
})();