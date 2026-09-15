// BOAT COMMAND JARVIS RUNTIME v0.33.6
// One entry point for conversation, app control and development orchestration.
(()=>{
'use strict';
const VERSION='BOAT-JARVIS-RUNTIME-V0.33.6';
async function input(text){const q=String(text||'').normalize('NFKC').trim();if(!q)return{ok:false,type:'EMPTY'};const core=window.BOAT_JARVIS_CORE_V0336;if(!core)return{ok:false,type:'BOOT_ERROR',message:'JARVIS COREが未読込です。'};const type=core.classify(q);let execution=null;if(type==='APP')execution=await window.BOAT_JARVIS_APP_CONTROLLER_V0336?.fromIntent?.(q);if(type==='DEVELOPMENT')execution=window.BOAT_JARVIS_DEVELOPMENT_BRIDGE_V0336?.enqueue?.(q)||null;const response=await core.run(q);const out=Object.freeze({ok:true,type,response,execution,at:new Date().toISOString()});try{window.dispatchEvent(new CustomEvent('boat-jarvis-runtime-result',{detail:out}))}catch{}return out}
function health(){return Object.freeze({version:VERSION,ready:Boolean(window.BOAT_COMMAND_AGENT_V0335&&window.BOAT_JARVIS_CONVERSATION_V0336&&window.BOAT_JARVIS_CORE_V0336&&window.BOAT_JARVIS_APP_CONTROLLER_V0336&&window.BOAT_JARVIS_DEVELOPMENT_BRIDGE_V0336),conversation:Boolean(window.BOAT_JARVIS_CONVERSATION_V0336),core:Boolean(window.BOAT_JARVIS_CORE_V0336),appControl:Boolean(window.BOAT_JARVIS_APP_CONTROLLER_V0336),developmentBridge:Boolean(window.BOAT_JARVIS_DEVELOPMENT_BRIDGE_V0336)});}
window.BOAT_JARVIS_V0336=Object.freeze({version:VERSION,input,health,oneScreen:true});
})();
