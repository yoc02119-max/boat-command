// BOAT COMMAND fixed browser controls v2
(()=>{'use strict';
function mount(){
 if(/\/venue\.html$/.test(location.pathname))return;
 if(document.getElementById('bcBrowserControls'))return;
 const st=document.createElement('style');
 st.textContent=`#bcBrowserControls{position:fixed;left:50%;bottom:calc(82px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:99999;display:grid;grid-template-columns:repeat(3,52px);gap:8px;padding:7px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(5,15,25,.9);backdrop-filter:blur(14px);box-shadow:0 8px 28px rgba(0,0,0,.35)}#bcBrowserControls button{appearance:none;width:52px;height:42px;border:1px solid #294c68;border-radius:11px;background:#0b2033;color:#e8f4fc;font-size:19px;font-weight:900;cursor:pointer}#bcBrowserControls button:active{transform:scale(.94);background:#123451}@media(max-width:640px){#bcBrowserControls{bottom:calc(76px + env(safe-area-inset-bottom));grid-template-columns:repeat(3,48px);gap:6px}#bcBrowserControls button{width:48px;height:40px}}`;
 document.head.appendChild(st);
 const el=document.createElement('div');el.id='bcBrowserControls';el.setAttribute('aria-label','ページ操作');
 el.innerHTML='<button type="button" data-act="back" aria-label="ページ戻る">‹</button><button type="button" data-act="forward" aria-label="ページ進む">›</button><button type="button" data-act="reload" aria-label="ページ更新">↻</button>';
 el.onclick=e=>{const a=e.target?.dataset?.act;if(a==='back')history.back();else if(a==='forward')history.forward();else if(a==='reload'){const u=new URL(location.href);u.searchParams.set('_bc_refresh',Date.now().toString());location.replace(u.toString())}};
 document.body.appendChild(el);
}
function focusGamagoriRaceDeepLink(){
 if(/\/venue\.html$/.test(location.pathname))return;
 const q=new URLSearchParams(location.search);
 if(String(q.get('venue')||'').toLowerCase()!=='gamagori')return;
 const race=Number(q.get('race'));if(!Number.isInteger(race)||race<1||race>12)return;
 let attempts=0;
 const tick=()=>{
  attempts++;
  document.querySelector('.nav[data-view="predict"]')?.click();
  const card=document.querySelector(`#predictionList .race-card[data-race="${race}"]`);
  if(card){
   card.setAttribute('data-try-focus','1');
   card.style.borderColor='#20e0c7';
   card.style.boxShadow='0 0 0 2px rgba(32,224,199,.35),0 12px 34px rgba(0,0,0,.25)';
   card.scrollIntoView({behavior:'smooth',block:'center'});
   return;
  }
  if(attempts<80)setTimeout(tick,125);
 };
 tick();
}
function todayJst(){
 return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
function ensureNextTryButton(){
 let b=document.getElementById('bcNextTryRace');if(b)return b;
 const st=document.createElement('style');
 st.textContent='#bcNextTryRace{position:fixed;right:18px;bottom:calc(138px + env(safe-area-inset-bottom));z-index:99998;display:none;align-items:center;gap:8px;padding:10px 13px;border:1px solid rgba(32,224,199,.45);border-radius:12px;background:rgba(6,25,39,.94);color:#eafffb;font:inherit;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.32);backdrop-filter:blur(12px)}#bcNextTryRace:hover{background:rgba(11,45,60,.98)}@media(max-width:640px){#bcNextTryRace{right:12px;bottom:calc(130px + env(safe-area-inset-bottom));max-width:calc(100vw - 24px)}}';
 document.head.appendChild(st);b=document.createElement('button');b.id='bcNextTryRace';b.type='button';document.body.appendChild(b);return b;
}
async function refreshGamagoriNextTry(){
 if(/\/venue\.html$/.test(location.pathname))return;
 const q=new URLSearchParams(location.search);
 if(String(q.get('venue')||'').toLowerCase()!=='gamagori')return;
 const race=Number(q.get('race'));if(!Number.isInteger(race)||race<1||race>12)return;
 const btn=ensureNextTryButton();
 try{
  const r=await fetch(`./shared-try-portfolio-v1.json?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error('TRY_WAIT');
  const x=await r.json(),day=todayJst();
  const rows=(Array.isArray(x.ledger)?x.ledger:[]).filter(z=>String(z.date)===day).sort((a,b)=>String(a.deadline||'').localeCompare(String(b.deadline||''))||Number(a.race)-Number(b.race));
  const here=rows.findIndex(z=>String(z.venueCode||'').padStart(2,'0')==='07'&&Number(z.race)===race);
  if(here<0){btn.style.display='none';return}
  const next=rows.slice(here+1).find(z=>{
    const deadline=String(z.deadline||'');
    const ms=/^\d{2}:\d{2}(?::\d{2})?$/.test(deadline)?Date.parse(`${day}T${deadline.length===5?deadline+':00':deadline}+09:00`):NaN;
    return z.settled!==true&&z.voided!==true&&Number.isInteger(Number(z.race))&&Number(z.race)>=1&&Number(z.race)<=12&&ms>Date.now();
  });
  if(!next){btn.style.display='none';return}
  const nextCode=String(next.venueCode||'').padStart(2,'0'),meta=window.BOAT_COMMAND_VENUE_REGISTRY?.resolve?.(nextCode);
  const name=meta?.name||next.venue||nextCode,nextRace=Number(next.race);
  btn.textContent=`次のTRY → ${name} ${nextRace}R`;btn.style.display='inline-flex';
  btn.onclick=()=>{const base=window.BOAT_COMMAND_VENUE_REGISTRY?.routeFor?.(meta)||`./venue.html?jcd=${encodeURIComponent(nextCode)}&shell=5`;const u=new URL(base,location.href);u.searchParams.set('race',String(nextRace));location.href=u.toString()};
 }catch{btn.style.display='none'}
}
function boot(){mount();focusGamagoriRaceDeepLink();refreshGamagoriNextTry();setInterval(refreshGamagoriNextTry,30000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();