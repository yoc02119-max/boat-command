// BOAT COMMAND JARVIS UI v0.33.6
(()=>{
'use strict';
function bubble(role,text){const chat=document.getElementById('jarvisChat');if(!chat)return;const el=document.createElement('div');el.className=`bubble ${role==='user'?'user':'ai'}`;el.textContent=String(text||'');chat.appendChild(el);chat.scrollTop=chat.scrollHeight;}
function health(){const el=document.getElementById('jarvisHealth');const h=window.BOAT_JARVIS_V0336?.health?.();if(el)el.textContent=h?.ready?'JARVIS CORE · ONLINE':'JARVIS CORE · BOOT CHECK';return h}
async function send(){const input=document.getElementById('jarvisPrompt');const button=document.getElementById('jarvisSend');const q=input?.value?.trim();if(!q)return;input.value='';bubble('user',q);if(button)button.disabled=true;try{const out=await window.BOAT_JARVIS_V0336.input(q);bubble('assistant',out?.response?.message||out?.response?.message=== ''?'':out?.response?.message||out?.response?.response?.message||out?.message||'実行しました。');if(out?.type==='DEVELOPMENT'&&out?.execution?.id)bubble('assistant',`開発ジョブ ${out.execution.id} をキューに登録しました。`);}catch(e){bubble('assistant',`実行エラー: ${e?.message||e}`)}finally{if(button)button.disabled=false;health()}}
function boot(){document.getElementById('jarvisSend')?.addEventListener('click',send);document.getElementById('jarvisPrompt')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();send()}});health();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.BOAT_JARVIS_UI_V0336=Object.freeze({version:'BOAT-JARVIS-UI-V0.33.6',send,health});
})();
