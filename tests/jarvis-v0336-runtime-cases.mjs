import fs from 'node:fs';
import vm from 'node:vm';
const listeners={};
const window={addEventListener:(n,f)=>(listeners[n]??=[]).push(f),dispatchEvent:()=>true};
const CustomEvent=function(type,init={}){this.type=type;this.detail=init.detail};
const context=vm.createContext({window,CustomEvent,console,Object,String,Set,Promise,Number,Math,Date});
let agentCalls=[];
window.BOAT_COMMAND_AGENT_V0335={version:'test',snapshot:()=>({view:'HOME'}),execute:async q=>{agentCalls.push(q);return `agent:${q}`}};
window.BOAT_JARVIS_CONVERSATION_V0336={context:()=>({history:[]})};
for(const f of ['boat-jarvis-core-v0336.js','boat-jarvis-app-controller-v0336.js','boat-jarvis-development-bridge-v0336.js','boat-jarvis-executor-contract-v0336.js','boat-jarvis-runtime-v0336.js'])vm.runInContext(fs.readFileSync(f,'utf8'),context,{filename:f});
const core=window.BOAT_JARVIS_CORE_V0336;
const cases=[['5Rを開いて','APP'],['REPLAYを開いて','APP'],['この表示を修正して','DEVELOPMENT'],['今日の状態を説明して','CONVERSATION']];
for(const [q,want] of cases){const got=core.classify(q);if(got!==want)throw new Error(`CLASSIFY:${q}:${got}!=${want}`)}
agentCalls=[];let out=await window.BOAT_JARVIS_V0336.input('5Rを開いて');if(out.type!=='APP'||agentCalls.length!==1)throw new Error(`APP_EXEC_COUNT:${agentCalls.length}`);
agentCalls=[];out=await window.BOAT_JARVIS_V0336.input('この表示を修正して');if(out.type!=='DEVELOPMENT'||agentCalls.length!==0||!out.execution?.id)throw new Error('DEV_DISPATCH_FAILED');
agentCalls=[];out=await window.BOAT_JARVIS_V0336.input('今日の状態を説明して');if(out.type!=='CONVERSATION'||agentCalls.length!==1)throw new Error(`CHAT_EXEC_COUNT:${agentCalls.length}`);
for(const action of ['PREDICTION_WRITE','HARD_LOCK_WRITE','RESULT_WRITE','PAYOUT_WRITE','BANKROLL_WRITE'])if(core.can(action)!==false)throw new Error(`PROTECTED_ACTION_ALLOWED:${action}`);
console.log('JARVIS_V0336_RUNTIME_CASES_OK');
