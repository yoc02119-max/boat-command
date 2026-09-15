#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
async function clientContract(){
  const source=fs.readFileSync('boat-ai-cloud-v0336.js','utf8'),events=[],memory=new Map(),calls=[];let localCalls=0;
  const context={window:null,console,Date,JSON,Object,Array,String,Number,Promise,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail}},localStorage:{getItem:k=>memory.get(`l:${k}`)||null,setItem:(k,v)=>memory.set(`l:${k}`,v)},sessionStorage:{getItem:k=>memory.get(`s:${k}`)||'private-access',setItem:(k,v)=>memory.set(`s:${k}`,v),removeItem:k=>memory.delete(`s:${k}`)},fetch:async(url,options)=>{calls.push({url,options});return{ok:true,status:200,json:async()=>({text:'アプリ内で自然に回答します。'})}}};
  context.window=context;context.window.prompt=()=>'';context.window.dispatchEvent=e=>events.push(e);context.BOAT_COMMAND_AI_RUNTIME_V0336={endpoint:'https://agent.example/api/boat-agent'};context.BOAT_COMMAND_AGENT_V0335={plan:q=>/変更/.test(q)?{intent:'DENY_PROTECTED_MUTATION'}:{intent:'HANDOFF_SUGGESTION'},execute:async()=>{localCalls++;return'保護操作はローカルで拒否しました。'},snapshot:()=>({venue:'蒲郡',date:'2026-09-15',races:[{race:1,firstCandidate:['1-2-3'],locked:true}]})};
  vm.createContext(context);vm.runInContext(source,context);const api=context.BOAT_COMMAND_CLOUD_AI_V0336;
  assert.equal(await api.respond('調子はどう？'),'アプリ内で自然に回答します。');assert.equal(calls.length,1);const sent=JSON.parse(calls[0].options.body);assert.equal(sent.question,'調子はどう？');assert(!/(result|payout|exhibition)/i.test(JSON.stringify(sent.snapshot)));assert(events.some(e=>e.detail.phase==='answered'));assert.equal(api.history().length,2);
  assert.equal(await api.respond('第一候補を変更して'),'保護操作はローカルで拒否しました。');assert.equal(calls.length,1);assert.equal(localCalls,1);
  assert.equal(api.predictionMutation,false);assert.equal(api.resultMutation,false);assert.equal(api.payoutMutation,false);
}
function response(){return{statusCode:0,headers:{},body:null,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(v){this.body=v;return this},end(){return this}}}
async function serverContract(){
  process.env.BOAT_COMMAND_ACCESS_TOKEN='private-access';process.env.OPENAI_API_KEY='server-only-key';process.env.OPENAI_MODEL='test-model';
  const handler=require('../api/boat-agent.js'),original=global.fetch;let upstream;
  global.fetch=async(url,options)=>{upstream={url,options};return{ok:true,json:async()=>({id:'resp_test',output:[{content:[{type:'output_text',text:'安全な自由会話です。'}]}]})}};
  try{
    let res=response();await handler({method:'POST',headers:{origin:'https://yoc02119-max.github.io',authorization:'Bearer wrong'},body:{question:'test'}},res);assert.equal(res.statusCode,401);assert(!upstream);
    res=response();await handler({method:'POST',headers:{origin:'https://evil.example',authorization:'Bearer private-access'},body:{question:'test'}},res);assert.equal(res.statusCode,403);
    res=response();await handler({method:'POST',headers:{origin:'https://yoc02119-max.github.io',authorization:'Bearer private-access'},body:{question:'今日どう？',snapshot:{venue:'蒲郡',result:'1-2-3',payout:9999,exhibition:{time:1},races:[{race:1,firstCandidate:['1-2-3'],result:'1-2-3'}]},history:[{role:'user',text:'前の話'}]}},res);assert.equal(res.statusCode,200);assert.equal(res.body.text,'安全な自由会話です。');assert.equal(upstream.url,'https://api.openai.com/v1/responses');assert.equal(upstream.options.headers.Authorization,'Bearer server-only-key');const body=JSON.parse(upstream.options.body),context=body.input[0].content;assert.equal(body.store,false);assert(!/"(?:result|payout|exhibition)"/i.test(context));assert(context.includes('1-2-3'));assert(handler._test.SYSTEM.includes('変更、確定してはいけません'));
  }finally{global.fetch=original;delete require.cache[require.resolve('../api/boat-agent.js')]}
}
(async()=>{await clientContract();await serverContract();console.log(JSON.stringify({status:'PASS',inAppConversation:true,serverSideKey:true,originGate:true,accessTokenGate:true,prePostBoundary:true,protectedActionsLocal:true,predictionMutation:false,resultMutation:false,payoutMutation:false}))})().catch(error=>{console.error(error);process.exit(1)});
