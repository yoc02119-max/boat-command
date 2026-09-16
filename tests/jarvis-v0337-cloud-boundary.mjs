import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import chatHandler from '../api/jarvis/chat.js';
import githubHandler from '../api/jarvis/github.js';

function response(){return{statusCode:0,headers:{},body:null,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(v){this.body=v;return this},end(){return this}}}

async function browserContract(){
  const memory=new Map(),calls=[];
  const context={window:null,console,Date,Math,JSON,Object,Array,String,Number,Promise,URL,sessionStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},fetch:async(url,options)=>{calls.push({url,options});return{ok:true,status:200,json:async()=>({message:'本物の生成AIで回答しました。',response_id:'resp_test',tool_calls:[]})}}};
  context.window=context;context.prompt=()=>'';context.BOAT_JARVIS_API_BASE='https://boat-command-ai.vercel.app';memory.set('boatCommand.jarvis.access.v0337','private-access');vm.createContext(context);for(const file of['boat-jarvis-cloud-v0337.js','boat-jarvis-llm-client-v0336.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  const cloud=context.BOAT_JARVIS_CLOUD_V0337,llm=context.BOAT_JARVIS_LLM_CLIENT_V0336;assert.equal(cloud.configured(),true);assert.equal(await llm.chat('普通に会話して',{history:[]}), '本物の生成AIで回答しました。');assert.equal(calls[0].url,'https://boat-command-ai.vercel.app/api/jarvis/chat');assert.equal(calls[0].options.headers.Authorization,'Bearer private-access');assert.equal(cloud.clientApiKey,false);assert.equal(cloud.serverSecretsOnly,true);
}

async function serverContract(){
  process.env.BOAT_COMMAND_ALLOWED_ORIGIN='https://yoc02119-max.github.io';process.env.BOAT_COMMAND_ACCESS_TOKEN='private-access';process.env.OPENAI_API_KEY='server-only-openai';process.env.JARVIS_GITHUB_EXECUTOR_TOKEN='server-only-github';
  const original=global.fetch,calls=[];global.fetch=async(url,options={})=>{calls.push({url,options});if(url==='https://api.openai.com/v1/responses')return{ok:true,status:200,json:async()=>({id:'resp_server',model:'test-model',output_text:'自然な回答です。',output:[]})};if(url.endsWith('/repos/yoc02119-max/boat-command'))return{ok:true,status:200,json:async()=>({default_branch:'main',private:false})};if(url.endsWith('/branches/main'))return{ok:true,status:200,json:async()=>({commit:{sha:'abc123'}})};return{ok:true,status:200,json:async()=>({})}};
  try{
    let res=response();await chatHandler({method:'POST',headers:{origin:'https://evil.example',authorization:'Bearer private-access'},body:{message:'test'}},res);assert.equal(res.statusCode,403);
    res=response();await chatHandler({method:'POST',headers:{origin:'https://yoc02119-max.github.io'},body:{message:'test'}},res);assert.equal(res.statusCode,401);
    res=response();await chatHandler({method:'POST',headers:{origin:'https://yoc02119-max.github.io',authorization:'Bearer private-access'},body:{message:'今日どう？',tool_outputs:[{call_id:'call_1',output:{ready:12,result:'1-2-3',payout:9999,exhibition:{time:6.7}}}],previous_response_id:'resp_previous'}},res);assert.equal(res.statusCode,200);assert.equal(res.body.message,'自然な回答です。');const upstream=calls.find(x=>x.url==='https://api.openai.com/v1/responses'),body=JSON.parse(upstream.options.body);assert.equal(upstream.options.headers.authorization,'Bearer server-only-openai');assert.equal(body.store,true);assert.equal(body.previous_response_id,'resp_previous');assert.equal(body.input[0].type,'function_call_output');const toolOutput=JSON.parse(body.input[0].output);assert.equal(toolOutput.ready,12);assert.equal('result' in toolOutput,false);assert.equal('payout' in toolOutput,false);assert.equal('exhibition' in toolOutput,false);
    const before=calls.length;res=response();await githubHandler({method:'POST',headers:{origin:'https://yoc02119-max.github.io',authorization:'Bearer private-access'},body:{action:'dispatch_development',job:{id:'dev-test',request:'HARD LOCKを解除して'}}},res);assert.equal(res.statusCode,403);assert.equal(calls.length,before);
    res=response();await githubHandler({method:'POST',headers:{origin:'https://yoc02119-max.github.io',authorization:'Bearer private-access'},body:{action:'status'}},res);assert.equal(res.statusCode,200);assert.equal(res.body.sha,'abc123');
  }finally{global.fetch=original;for(const key of['BOAT_COMMAND_ALLOWED_ORIGIN','BOAT_COMMAND_ACCESS_TOKEN','OPENAI_API_KEY','JARVIS_GITHUB_EXECUTOR_TOKEN'])delete process.env[key]}
}

await browserContract();await serverContract();
console.log(JSON.stringify({status:'PASS',realGenerativeClient:true,serverSideSecrets:true,originGate:true,accessGate:true,toolBoundary:true,postRaceScrub:true,githubGuard:true,autoMainPromotion:false}));
