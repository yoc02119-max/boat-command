// BOAT COMMAND fixed browser controls v1
(()=>{'use strict';
function mount(){
 if(document.getElementById('bcBrowserControls'))return;
 const st=document.createElement('style');
 st.textContent=`#bcBrowserControls{position:fixed;left:50%;bottom:calc(10px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:99999;display:grid;grid-template-columns:repeat(3,52px);gap:8px;padding:7px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(5,15,25,.9);backdrop-filter:blur(14px);box-shadow:0 8px 28px rgba(0,0,0,.35)}#bcBrowserControls button{appearance:none;width:52px;height:42px;border:1px solid #294c68;border-radius:11px;background:#0b2033;color:#e8f4fc;font-size:19px;font-weight:900;cursor:pointer}#bcBrowserControls button:active{transform:scale(.94);background:#123451}@media(max-width:640px){#bcBrowserControls{bottom:calc(8px + env(safe-area-inset-bottom));grid-template-columns:repeat(3,48px);gap:6px}#bcBrowserControls button{width:48px;height:40px}}`;
 document.head.appendChild(st);
 const el=document.createElement('div');el.id='bcBrowserControls';el.setAttribute('aria-label','ページ操作');
 el.innerHTML='<button type="button" data-act="back" aria-label="ページ戻る">‹</button><button type="button" data-act="forward" aria-label="ページ進む">›</button><button type="button" data-act="reload" aria-label="ページ更新">↻</button>';
 el.onclick=e=>{const a=e.target?.dataset?.act;if(a==='back')history.back();else if(a==='forward')history.forward();else if(a==='reload')location.reload()};
 document.body.appendChild(el);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();