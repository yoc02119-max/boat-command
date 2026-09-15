// BOAT COMMAND JARVIS CONVERSATION RUNTIME v0.33.6
// In-app conversation continuity layer. Keeps protected LIVE mutations outside Jarvis.
(()=>{
'use strict';
const VERSION='BOAT-JARVIS-CONVERSATION-V0.33.6';
const STORE='boatCommand.jarvis.conversation.v0336';
const MAX=80;
function clone(v){try{return JSON.parse(JSON.stringify(v))}catch{return null}}
function rows(){try{const v=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
function save(v){try{localStorage.setItem(STORE,JSON.stringify(v.slice(-MAX)))}catch{}return v}
function push(role,text,meta={}){const v=rows();const item=Object.freeze({id:`jarvis-${Date.now()}-${Math.random().toString(36).slice(2)}`,at:new Date().toISOString(),role,text:String(text||''),meta:clone(meta)||{}});v.push(item);save(v);try{window.dispatchEvent(new CustomEvent('boat-jarvis-message',{detail:item}))}catch{}return item}
function context(){const agent=window.BOAT_COMMAND_AGENT_V0335;return Object.freeze({version:VERSION,agentVersion:agent?.version||null,state:agent?.snapshot?.()||null,history:rows().slice(-12)})}
async function ask(text){const q=String(text||'').normalize('NFKC').trim();if(!q)return'';push('user',q);const agent=window.BOAT_COMMAND_AGENT_V0335;if(!agent?.execute){const msg='ジャービスの安全コアを読み込めませんでした。画面を再読み込みしてください。';push('assistant',msg,{error:'AGENT_CORE_MISSING'});return msg}
  const answer=await agent.execute(q);push('assistant',answer,{agentVersion:agent.version});return answer
}
function developmentRequest(){const agent=window.BOAT_COMMAND_AGENT_V0335;const request=agent?.pending?.()||'';if(!request)return null;return Object.freeze({schema:'boat-command-development-handoff-v1',request,context:context(),safety:Object.freeze({livePredictionMutation:false,hardLockMutation:false,resultMutation:false,payoutMutation:false,bankrollMutation:false,preRaceResultLeak:false})})}
function acknowledgeDevelopmentHandoff(){window.BOAT_COMMAND_AGENT_V0335?.clearPending?.();}
function clearConversation(){save([]);try{window.dispatchEvent(new CustomEvent('boat-jarvis-conversation-cleared'))}catch{}}
window.BOAT_JARVIS_CONVERSATION_V0336=Object.freeze({version:VERSION,ask,context,history:rows,developmentRequest,acknowledgeDevelopmentHandoff,clearConversation,inAppConversation:true,opensExternalPage:false,protectedLiveMutation:false});
})();
