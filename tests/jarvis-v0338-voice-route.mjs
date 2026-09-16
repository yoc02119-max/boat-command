import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const bubbles=[],status={textContent:'',dataset:{}};
const chat={appendChild:node=>bubbles.push(node),scrollTop:0,scrollHeight:0};
const document={readyState:'loading',addEventListener(){},querySelector(selector){if(selector==='#chat')return chat;if(selector==='#bcVoiceStatus')return status;return null},createElement(){return{className:'',textContent:''}}};
let runtimeCalls=0,agentCalls=0;
const window={document,addEventListener(){},BOAT_JARVIS_V0336:{input:async q=>{runtimeCalls++;return{input:q,response:{message:'JARVIS生成回答'}}}},BOAT_COMMAND_AGENT_V0335:{execute:async()=>{agentCalls++;return'旧固定回答'}}};
const context=vm.createContext({window,document,console,Object,String,Promise,Date,Math,setTimeout,clearTimeout});
vm.runInContext(fs.readFileSync('boat-voice-agent-v0296.js','utf8'),context,{filename:'boat-voice-agent-v0296.js'});
const answer=await window.BOAT_COMMAND_VOICE_AGENT.handle('こんにちは',{spoken:false});
assert.equal(answer,'JARVIS生成回答');
assert.equal(runtimeCalls,1);
assert.equal(agentCalls,0);
assert.equal(bubbles.at(-1)?.textContent,'JARVIS生成回答');
assert.equal(window.BOAT_COMMAND_VOICE_AGENT.runtimeFirst,true);
console.log('JARVIS_V0338_VOICE_ROUTE_OK');
