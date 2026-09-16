// BOAT COMMAND JARVIS cloud transport v0.33.7
// Public endpoint configuration only. API keys and server secrets never belong in this file.
(()=>{
'use strict';
const VERSION='BOAT-JARVIS-CLOUD-V0.33.7';
const TOKEN_KEY='boatCommand.jarvis.access.v0337';
const CONFIG=Object.freeze({apiBase:'',venue:'蒲郡'});
let online=false;
function base(){const sameOrigin=/\.vercel\.app$/i.test(String(window.location?.hostname||''))?window.location.origin:'';return String(window.BOAT_JARVIS_API_BASE||CONFIG.apiBase||sameOrigin).trim().replace(/\/$/,'')}
function configured(){return /^https:\/\//i.test(base())}
function endpoint(path){if(!configured())throw new Error('JARVIS_CLOUD_NOT_CONFIGURED');return`${base()}${String(path||'').startsWith('/')?'':'/'}${String(path||'')}`}
function accessToken(){let value='';try{value=sessionStorage.getItem(TOKEN_KEY)||''}catch{}if(value)return value;value=String(window.prompt?.('BOAT COMMAND AIアクセスコードを入力してください')||'').trim();if(value)try{sessionStorage.setItem(TOKEN_KEY,value)}catch{}return value}
function clearToken(){online=false;try{sessionStorage.removeItem(TOKEN_KEY)}catch{}}
async function request(path,options={}){const token=accessToken();if(!token)throw new Error('JARVIS_ACCESS_REQUIRED');const url=endpoint(path),sameOrigin=new URL(url,window.location?.href||undefined).origin===window.location?.origin;const headers={...(options.headers||{}),Authorization:`Bearer ${token}`};const response=await fetch(url,{...options,headers,mode:'cors',cache:'no-store',credentials:sameOrigin?'same-origin':'omit'});if(response.status===401){clearToken();throw new Error('JARVIS_AUTH_REQUIRED')}if(response.ok)online=true;return response}
window.BOAT_JARVIS_CLOUD_V0337=Object.freeze({version:VERSION,configured,connected:()=>online,endpoint,request,clearToken,clientApiKey:false,serverSecretsOnly:true});
})();
