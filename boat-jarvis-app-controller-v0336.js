// BOAT COMMAND JARVIS APP CONTROLLER v0.33.6
(()=>{
'use strict';
const VERSION='BOAT-JARVIS-APP-CONTROLLER-V0.33.6';
const ALLOWED=new Set(['OPEN_VIEW','OPEN_RACE','REFRESH_LIVE']);
function dispatch(action,payload={}){if(!ALLOWED.has(action))return Object.freeze({ok:false,error:'ACTION_BLOCKED',action});const agent=window.BOAT_COMMAND_AGENT_V0335;if(!agent?.execute)return Object.freeze({ok:false,error:'AGENT_CORE_MISSING'});let command='';if(action==='OPEN_VIEW')command=`${payload.view||'HOME'}を開いて`;if(action==='OPEN_RACE')command=`${Number(payload.race)||1}Rを開いて`;if(action==='REFRESH_LIVE')command='LIVEを更新して';return Promise.resolve(agent.execute(command)).then(message=>Object.freeze({ok:true,action,payload,message,state:agent.snapshot?.()||null}));}
function fromIntent(text){const q=String(text||'').normalize('NFKC');const race=q.match(/\b(1[0-2]|[1-9])\s*R\b/i);if(race)return dispatch('OPEN_RACE',{race:Number(race[1])});if(/更新|refresh/i.test(q))return dispatch('REFRESH_LIVE');const view=(q.match(/\b(HOME|LIVE|REPLAY|DATA|SETTINGS?)\b/i)||[])[1];if(view)return dispatch('OPEN_VIEW',{view:view.toUpperCase()==='DATA'?'REPLAY':view.toUpperCase()});return Promise.resolve(Object.freeze({ok:false,error:'NO_APP_INTENT'}));}
window.BOAT_JARVIS_APP_CONTROLLER_V0336=Object.freeze({version:VERSION,dispatch,fromIntent,allowed:[...ALLOWED],protectedActions:['PREDICTION_WRITE','HARD_LOCK_WRITE','RESULT_WRITE','PAYOUT_WRITE','BANKROLL_WRITE']});
})();
