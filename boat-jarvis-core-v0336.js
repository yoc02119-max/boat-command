// BOAT COMMAND JARVIS CORE v0.33.6
// Central orchestrator. Classification/reasoning is side-effect free; runtime owns execution.
(()=>{
'use strict';
const VERSION='BOAT-JARVIS-CORE-V0.33.6';
const PROTECTED=new Set(['PREDICTION_WRITE','HARD_LOCK_WRITE','RESULT_WRITE','PAYOUT_WRITE','BANKROLL_WRITE']);
const app=()=>window.BOAT_COMMAND_AGENT_V0335;
const convo=()=>window.BOAT_JARVIS_CONVERSATION_V0336;
function snapshot(){return Object.freeze({version:VERSION,agent:app()?.snapshot?.()||null,conversation:convo()?.context?.()||null,capabilities:['FREE_CONVERSATION','APP_NAVIGATION','OPEN_RACE','REFRESH_LIVE','DEVELOPMENT_HANDOFF'],protected:[...PROTECTED]})}
function classify(text){const q=String(text||'').normalize('NFKC').trim();if(/(コード|github|codex|実装|修正|追加|開発|作って|変更して)/i.test(q))return'DEVELOPMENT';if(/(ホーム|live|replay|data|設定|\d{1,2}\s*R|レース|更新|refresh|開いて|移動)/i.test(q))return'APP';return'CONVERSATION'}
function plan(text){const q=String(text||'').normalize('NFKC').trim();if(!q)return Object.freeze({ok:false,type:'EMPTY',text:''});return Object.freeze({ok:true,type:classify(q),text:q,state:snapshot()})}
async function answer(text){const q=String(text||'').normalize('NFKC').trim();if(!q)return'';const llm=window.BOAT_JARVIS_LLM_CLIENT_V0336;if(llm?.chat){try{return await llm.chat(q,snapshot())}catch(e){console.warn('JARVIS LLM error',e);const freeLimit=String(e?.message||e)==='JARVIS_FREE_AI_LIMIT_REACHED';if(llm.configured?.()&&!freeLimit)throw e}}const agent=app();if(!agent?.execute)return'無料生成AI枠は現在利用できません。JARVISのローカル会話バックエンドも未接続です。';return await agent.execute(q)}
function can(action){return !PROTECTED.has(String(action||''))}
window.BOAT_JARVIS_CORE_V0336=Object.freeze({version:VERSION,classify,plan,answer,snapshot,can,mode:'ORCHESTRATOR',appControl:true,developmentControl:true,conversation:true,llmBackend:true,protectedLiveMutation:true});
})();
