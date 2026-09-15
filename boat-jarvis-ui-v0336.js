// BOAT COMMAND JARVIS UI v0.33.6
(()=>{
'use strict';
function bubble(role,text){const chat=document.getElementById('jarvisChat');if(!chat)return;const el=document.createElement('div');el.className=`bubble ${role==='user'?'user':'ai'}`;el.textContent=String(text||'');chat.appendChild(el);chat.scrollTop=chat.scrollHeight;}
function health(){const el=document.getElementById('jarvisHealth');const h=window.BOAT_JARVIS_V0336?.health?.();if(el)el.textContent=h?.ready?'JARVIS CORE · ONLINE':'JARVIS CORE · BOOT CHECK';return h}
function responseText(out){const r=out?.response;return r?.message ?? r?.response?.message ?? out?.message ?? '実行しました。'}
async function send(){const input=document.getElementById('jarvisPrompt');const button=document.getElementById('jarvisSend');const q=input?.value?.trim();if(!q)return;input.value='';bubble('user',q);if(button)button.disabled=true;try{const runtime=window.BOAT_JARVIS_V0336;if(!runtime?.input)throw new Error('JARVIS_RUNTIME_NOT_READY');const out=await runtime.input(q);bubble('assistant',responseText(out));if(out?.type==='DEVELOPMENT'&&out?.execution?.id)bubble('assistant',`開発ジョブ ${out.execution.id} を登録しました。実行結果はこの会話に戻します。`);}catch(e){bubble('assistant',`実行エラー: ${e?.message||e}`)}finally{if(button)button.disabled=false;health()}}
function onDevelopmentResult(event){const r=event?.detail||{};if(!r.jobId)return;const status=r.status==='COMPLETED'?'完了':r.status==='FAILED'?'失敗':'実行中';const sha=r.commitSha?` · ${String(r.commitSha).slice(0,7)}`:'';const summary=r.summary?`\n${r.summary}`:'';bubble('assistant',`開発ジョブ ${r.jobId}: ${status}${sha}${summary}`);}
function boot(){document.getElementById('jarvisSend')?.addEventListener('click',send);document.getElementById('jarvisPrompt')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();send()}});window.addEventListener('boat-jarvis-development-result',onDevelopmentResult);health();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.BOAT_JARVIS_UI_V0336=Object.freeze({version:'BOAT-JARVIS-UI-V0.33.6',send,health,responseText,onDevelopmentResult});
})();
