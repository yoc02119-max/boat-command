// BOAT COMMAND in-app development task bridge v0.33.7
// Append-only SHADOW requests. No direct LIVE promotion and no protected state mutations.
(()=>{
'use strict';
const VERSION='BOAT-COMMAND-DEVELOPMENT-AGENT-V0.33.7';
const STORE='boatCommand.development.history.v0337';
const TOKEN_KEY='boatCommand.cloudAi.access.v0336';
const TERMINAL=new Set(['completed','failed']);
const timers=new Map();
function config(){return window.BOAT_COMMAND_AI_RUNTIME_V0336||{}}
function clone(v){try{return JSON.parse(JSON.stringify(v))}catch{return null}}
function rows(){try{const value=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(value)?value:[]}catch{return[]}}
function save(entry){const all=rows();all.push(Object.freeze(clone(entry)));try{localStorage.setItem(STORE,JSON.stringify(all.slice(-60)))}catch{}return entry}
function emit(phase,detail={}){try{window.dispatchEvent(new CustomEvent('boat-command-agent-event',{detail:{phase,...detail}}))}catch{}}
function requestId(){return`bcdev-${Date.now()}-${Math.random().toString(36).slice(2,10)}`}
function accessToken(){try{return sessionStorage.getItem(TOKEN_KEY)||''}catch{return''}}
function endpoint(name){return String(config()[name]||'').trim()}
function latest(id){return rows().filter(x=>x.id===id).at(-1)||null}
function record(id,status,extra={}){return save({id,status,at:new Date().toISOString(),...clone(extra)})}
function statusText(status){return({queued:'Codex開発を待機中です。',in_progress:'CodexがSHADOW環境で開発中です。',suspended:'外部操作または承認を待っています。',completed:'SHADOW開発が完了しました。LIVEには反映していません。',failed:'SHADOW開発は失敗しました。LIVEには影響していません。'})[status]||`開発状態は${status}です。`}
async function poll(id,runId,token){
  const url=endpoint('developmentStatusEndpoint');if(!url||!runId)return;
  try{
    const response=await fetch(`${url}?runId=${encodeURIComponent(runId)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
    if(!response.ok)throw new Error(`STATUS_HTTP_${response.status}`);
    const data=await response.json(),status=String(data.status||'').trim();if(!status)return;
    const prior=latest(id);if(prior?.status!==status){record(id,status,{runId,conversationUrl:data.conversationUrl||prior?.conversationUrl||null,errorCode:data.errorCode||null});emit(status==='completed'?'completed':status==='failed'?'error':'development',{role:'assistant',text:statusText(status),developmentStatus:status,requestId:id})}
    if(!TERMINAL.has(status))timers.set(id,setTimeout(()=>poll(id,runId,token),5000));
  }catch(error){record(id,'status_unavailable',{runId,error:String(error?.message||error)});emit('error',{role:'assistant',text:'開発状況を確認できません。依頼履歴は保持しています。',requestId:id})}
}
async function submit(question){
  const q=String(question||'').trim().slice(0,1200),id=requestId(),url=endpoint('developmentEndpoint'),token=accessToken();
  emit('heard',{role:'user',text:q});
  if(!url||!token){record(id,'connection_required',{question:q});const text='開発依頼を接続待ちとして保存しました。VercelとWorkspace Agentの接続後に送信できます。';emit('error',{role:'assistant',text,requestId:id});return text}
  record(id,'submitting',{question:q});emit('thinking',{intent:'DEVELOPMENT_SUBMIT',requestId:id});
  try{
    const agent=window.BOAT_COMMAND_AGENT_V0335;
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},cache:'no-store',body:JSON.stringify({requestId:id,question:q,snapshot:agent?.snapshot?.()||null})});
    if(response.status===401)throw new Error('AUTH_REQUIRED');
    const data=await response.json().catch(()=>({}));if(response.status!==202)throw new Error(data.error||`DEVELOPMENT_HTTP_${response.status}`);
    const runId=String(data.runId||''),text='開発依頼をSHADOWタスクとして受け付けました。LIVEには自動反映しません。';
    record(id,'queued',{question:q,runId,conversationUrl:data.conversationUrl||null});emit('development',{role:'assistant',text,developmentStatus:'queued',requestId:id});
    if(runId)timers.set(id,setTimeout(()=>poll(id,runId,token),5000));return text;
  }catch(error){const code=String(error?.message||error),text=code==='AUTH_REQUIRED'?'AIアクセスコードを確認してください。':'開発接続を開始できませんでした。依頼は接続待ちとして保持しています。';record(id,'connection_required',{question:q,error:code});emit('error',{role:'assistant',text,requestId:id});return text}
}
window.BOAT_COMMAND_DEVELOPMENT_AGENT_V0337=Object.freeze({version:VERSION,submit,history:rows,latest,configured:()=>!!endpoint('developmentEndpoint'),appendOnly:true,shadowOnly:true,autoLivePromotion:false,predictionMutation:false,hardLockMutation:false,resultMutation:false,payoutMutation:false,bankrollMutation:false});
})();
