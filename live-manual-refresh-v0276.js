// BOAT COMMAND GAMAGORI MANUAL REFRESH v0.27.6
// One button refreshes current predictions and checks whether a newer deployed app shell exists.
(()=>{
'use strict';
const VERSION='GAMAGORI-MANUAL-REFRESH-V0.27.6';
const STATUS_ID='bcManualRefreshStatus';
const BTN_ID='bcManualRefreshBtn';
const jstTime=()=>new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date());
const currentCacheKey=()=>{const src=[...document.scripts].map(s=>s.getAttribute('src')||'').find(x=>/app\.js(?:\?|$)/.test(x));try{return new URL(src,location.href).searchParams.get('v')||''}catch{return''}};
function remoteCacheKey(html){try{const doc=new DOMParser().parseFromString(html,'text/html');const src=[...doc.scripts].map(s=>s.getAttribute('src')||'').find(x=>/app\.js(?:\?|$)/.test(x));return new URL(src,location.href).searchParams.get('v')||''}catch{return''}}
function install(){
 const host=document.querySelector('.top-actions');if(!host||document.getElementById(BTN_ID))return;
 const wrap=document.createElement('div');wrap.style.cssText='display:flex;flex-direction:column;align-items:flex-end;gap:3px';
 const btn=document.createElement('button');btn.id=BTN_ID;btn.className='ghost';btn.type='button';btn.textContent='↻ 最新に更新';
 const st=document.createElement('small');st.id=STATUS_ID;st.style.cssText='font-size:9px;color:#7893aa;white-space:nowrap';st.textContent='未更新';
 wrap.append(btn,st);host.prepend(wrap);btn.addEventListener('click',()=>refreshAll({user:true}));
}
async function checkNewestShell(){
 try{
   const url=new URL(location.href);url.searchParams.set('bc_probe',Date.now());
   const res=await fetch(url.toString(),{cache:'no-store',credentials:'same-origin',headers:{'Cache-Control':'no-cache'}});
   if(!res.ok)return {newer:false,remote:'',current:currentCacheKey()};
   const html=await res.text(),remote=remoteCacheKey(html),current=currentCacheKey();
   return {newer:!!remote&&!!current&&remote!==current,remote,current};
 }catch{return {newer:false,remote:'',current:currentCacheKey()}}
}
async function refreshAll({user=false}={}){
 install();const btn=document.getElementById(BTN_ID),st=document.getElementById(STATUS_ID);if(btn)btn.disabled=true;if(st)st.textContent='同期中…';
 try{
   if(typeof window.syncGamagoriProgramSnapshot==='function')await window.syncGamagoriProgramSnapshot({render:false});
   if(typeof window.BOAT_COMMAND_TWO_STAGE_V0260?.ensureHistory==='function')await window.BOAT_COMMAND_TWO_STAGE_V0260.ensureHistory();
   if(typeof window.sweepVerifiedLiveRelays==='function')await window.sweepVerifiedLiveRelays({render:false});
   if(typeof window.BOAT_COMMAND_TWO_STAGE_V0260?.sync==='function')window.BOAT_COMMAND_TWO_STAGE_V0260.sync();
   if(typeof window.renderAll==='function')window.renderAll();
   const newest=await checkNewestShell();
   if(newest.newer){
     if(st)st.textContent=`最新版 v${newest.remote} を反映中…`;
     const next=new URL(location.href);next.searchParams.set('bc_update',Date.now());location.replace(next.toString());return;
   }
   if(st)st.textContent=`更新 ${jstTime()} · app v${newest.current||'?'}`;
   window.BOAT_COMMAND_MANUAL_REFRESH_V0276.lastRefreshAt=new Date().toISOString();
 }catch(e){console.warn('[manual-refresh]',e);if(st)st.textContent=`更新失敗 ${jstTime()}`}
 finally{if(btn)btn.disabled=false}
}
window.BOAT_COMMAND_MANUAL_REFRESH_V0276={version:VERSION,venue:'蒲郡',lastRefreshAt:null,refresh:refreshAll};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
