// BOAT COMMAND JARVIS UI v0.33.6
(()=>{
'use strict';
const announced=new Set();
function bubble(role,text){const chat=document.getElementById('jarvisChat');if(!chat)return;const el=document.createElement('div');el.className=`bubble ${role==='user'?'user':'ai'}`;el.textContent=String(text||'');chat.appendChild(el);chat.scrollTop=chat.scrollHeight;}
function health(){const el=document.getElementById('jarvisHealth');const h=window.BOAT_JARVIS_V0336?.health?.();if(el)el.textContent=h?.cloudConnected?'JARVIS AI · ONLINE':h?.generativeAI?'JARVIS AI · AUTH READY':h?.ready?'JARVIS LOCAL · CLOUD WAIT':'JARVIS CORE · BOOT CHECK';return h}
function responseText(out){const r=out?.response;return r?.message ?? r?.response?.message ?? out?.message ?? '実行しました。'}
async function send(){const input=document.getElementById('jarvisPrompt');const button=document.getElementById('jarvisSend');const q=input?.value?.trim();if(!q)return;input.value='';bubble('user',q);if(button)button.disabled=true;try{const runtime=window.BOAT_JARVIS_V0336;if(!runtime?.input)throw new Error('JARVIS_RUNTIME_NOT_READY');const out=await runtime.input(q);bubble('assistant',responseText(out));if(out?.type==='DEVELOPMENT'&&out?.execution?.id)bubble('assistant',`了解。開発ジョブ ${out.execution.id} をGitHubへ送りました。完了したら、この画面に結果を返します。`);}catch(e){bubble('assistant',`実行エラー: ${e?.message||e}`)}finally{if(button)button.disabled=false;health()}}
function resultMessage(r){const sha=r.commitSha?String(r.commitSha).slice(0,12):'';const tests=Array.isArray(r.tests)?r.tests.join(' / '):String(r.tests||'').trim();const summary=String(r.summary||'').trim();if(r.status==='COMPLETED')return [`完了したよ。${summary||'GitHub側の開発処理が完了しました。'}`,sha?`コミット: ${sha}`:'',tests?`テスト: ${tests}`:''].filter(Boolean).join('\n');if(r.status==='FAILED')return [`開発処理が失敗した。${summary||'GitHub側の実行結果を確認する必要があります。'}`,tests?`テスト/詳細: ${tests}`:''].filter(Boolean).join('\n');return ''}
function onDevelopmentResult(event){const r=event?.detail||{};if(!r.jobId||!['COMPLETED','FAILED'].includes(r.status))return;const key=`${r.jobId}:${r.status}:${r.commitSha||''}`;if(announced.has(key))return;announced.add(key);const text=resultMessage(r);if(text)bubble('assistant',text);}
function boot(){document.getElementById('jarvisSend')?.addEventListener('click',send);document.getElementById('jarvisPrompt')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();send()}});window.addEventListener('boat-jarvis-development-result',onDevelopmentResult);health();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.BOAT_JARVIS_UI_V0336=Object.freeze({version:'BOAT-JARVIS-UI-V0.33.6',send,health,responseText,onDevelopmentResult,resultMessage});
})();
