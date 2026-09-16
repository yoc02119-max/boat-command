// BOAT COMMAND JARVIS RUNTIME v0.33.7
// LLM-first conversational runtime. Deterministic app actions remain guarded and protected LIVE writes stay blocked.
(()=>{
'use strict';
const VERSION='BOAT-JARVIS-RUNTIME-V0.33.7';
async function input(text){
  const q=String(text||'').normalize('NFKC').trim();
  if(!q)return Object.freeze({ok:false,type:'EMPTY'});
  const core=window.BOAT_JARVIS_CORE_V0336;
  if(!core?.plan)return Object.freeze({ok:false,type:'BOOT_ERROR',message:'JARVIS COREが未読込です。'});
  const plan=core.plan(q);
  let execution=null,message='',type=plan.type;
  // Only explicit navigation/refresh commands bypass the LLM. Everything else is a real conversation first.
  if(plan.type==='APP'){
    execution=await window.BOAT_JARVIS_APP_CONTROLLER_V0336?.fromIntent?.(q);
    message=execution?.message||await core.answer(q);
  }else{
    const bridge=window.BOAT_JARVIS_DEVELOPMENT_BRIDGE_V0336;
    const beforeDevelopmentId=plan.type==='DEVELOPMENT'?bridge?.latest?.()?.id||null:null;
    message=await core.answer(q);
    // Development intent is retained as metadata/handoff, but no longer replaces the conversational answer.
    if(plan.type==='DEVELOPMENT'){
      const llmQueued=bridge?.latest?.()||null;
      execution=llmQueued?.id&&llmQueued.id!==beforeDevelopmentId?llmQueued:bridge?.enqueue?.(q)||null;
    }
  }
  const response=Object.freeze({ok:true,type,message,state:core.snapshot?.()||null});
  const out=Object.freeze({ok:true,type,input:q,response,execution,at:new Date().toISOString()});
  try{window.dispatchEvent(new CustomEvent('boat-jarvis-runtime-result',{detail:out}))}catch{}
  return out;
}
function health(){const cloud=window.BOAT_JARVIS_CLOUD_V0337,llm=window.BOAT_JARVIS_LLM_CLIENT_V0336;return Object.freeze({version:VERSION,ready:Boolean(window.BOAT_COMMAND_AGENT_V0335&&window.BOAT_JARVIS_CONVERSATION_V0336&&window.BOAT_JARVIS_CORE_V0336&&window.BOAT_JARVIS_APP_CONTROLLER_V0336&&window.BOAT_JARVIS_DEVELOPMENT_BRIDGE_V0336&&window.BOAT_JARVIS_EXECUTOR_CONTRACT_V0336),conversation:Boolean(window.BOAT_JARVIS_CONVERSATION_V0336),core:Boolean(window.BOAT_JARVIS_CORE_V0336),appControl:Boolean(window.BOAT_JARVIS_APP_CONTROLLER_V0336),developmentBridge:Boolean(window.BOAT_JARVIS_DEVELOPMENT_BRIDGE_V0336),executorContract:Boolean(window.BOAT_JARVIS_EXECUTOR_CONTRACT_V0336),generativeAI:Boolean(llm&&cloud?.configured?.()),cloudConnected:Boolean(cloud?.connected?.()),llmFirst:true});}
window.BOAT_JARVIS_V0336=Object.freeze({version:VERSION,input,health,oneScreen:true,singleExecutionOwner:true,llmFirst:true});
})();
