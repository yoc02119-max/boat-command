// BOAT COMMAND JARVIS LLM CLIENT v0.33.6
// Calls a same-origin backend. NEVER stores or sends an OpenAI API key from the browser.
(()=>{
'use strict';
const VERSION='BOAT-JARVIS-LLM-CLIENT-V0.33.6';
const ENDPOINT='/api/jarvis/chat';
async function chat(text,context={}){const q=String(text||'').normalize('NFKC').trim();if(!q) return '';
  const res=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({message:q,context})});
  if(!res.ok)throw new Error(`JARVIS_LLM_HTTP_${res.status}`);
  const data=await res.json();
  if(!data||typeof data.message!=='string')throw new Error('JARVIS_LLM_BAD_RESPONSE');
  return data.message;
}
window.BOAT_JARVIS_LLM_CLIENT_V0336=Object.freeze({version:VERSION,chat,endpoint:ENDPOINT,clientApiKey:false});
})();
