// BOAT COMMAND TRY race deep-link v1
(()=>{'use strict';
  const q=new URLSearchParams(location.search);
  const race=Math.max(1,Math.min(12,Number(q.get('race'))||0));
  if(!race)return;

  let attempts=0;
  let timer=null;

  function markAndScroll(card){
    if(!card)return false;
    document.querySelectorAll('[data-try-focus="1"]').forEach(x=>{
      x.removeAttribute('data-try-focus');
      x.style.boxShadow='';
      x.style.borderColor='';
    });
    card.setAttribute('data-try-focus','1');
    card.style.borderColor='#20e0c7';
    card.style.boxShadow='0 0 0 2px rgba(32,224,199,.35),0 12px 34px rgba(0,0,0,.25)';
    card.scrollIntoView({behavior:'smooth',block:'center'});
    return true;
  }

  function focusVenueRace(){
    const racesTab=document.querySelector('#commonVenueTabs [data-common-view="races"]')
      ||document.querySelector('#venueTabs [data-view="races"]');
    racesTab?.click();
    if(typeof window.__BC_VENUE_ACTIVATE==='function')window.__BC_VENUE_ACTIVATE('races');
    const card=document.querySelector(`#researchBoard .rrb-card[data-race="${race}"]`);
    return markAndScroll(card);
  }

  function focusGamagoriRace(){
    const predict=document.querySelector('.nav[data-view="predict"]');
    predict?.click();
    const card=document.querySelector(`#predictionList .race-card[data-race="${race}"]`);
    return markAndScroll(card);
  }

  function todayJst(){
    return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  }

  function ensureNextButton(){
    let b=document.getElementById('bcNextTryRace');
    if(b)return b;
    const st=document.createElement('style');
    st.textContent='#bcNextTryRace{position:fixed;right:18px;bottom:calc(138px + env(safe-area-inset-bottom));z-index:99998;display:none;align-items:center;gap:8px;padding:10px 13px;border:1px solid rgba(32,224,199,.45);border-radius:12px;background:rgba(6,25,39,.94);color:#eafffb;font:inherit;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.32);backdrop-filter:blur(12px)}#bcNextTryRace:hover{background:rgba(11,45,60,.98)}@media(max-width:640px){#bcNextTryRace{right:12px;bottom:calc(130px + env(safe-area-inset-bottom));max-width:calc(100vw - 24px)}}';
    document.head.appendChild(st);
    b=document.createElement('button');b.id='bcNextTryRace';b.type='button';
    document.body.appendChild(b);
    return b;
  }

  async function refreshNextTryButton(){
    const code=String(q.get('jcd')||'').padStart(2,'0');
    if(!/^\d{2}$/.test(code))return;
    const btn=ensureNextButton();
    try{
      const r=await fetch(`./shared-try-portfolio-v1.json?t=${Date.now()}`,{cache:'no-store'});
      if(!r.ok)throw new Error('TRY_WAIT');
      const x=await r.json(),day=todayJst();
      const rows=(Array.isArray(x.ledger)?x.ledger:[]).filter(z=>String(z.date)===day).sort((a,b)=>String(a.deadline||'').localeCompare(String(b.deadline||''))||Number(a.race)-Number(b.race));
      const here=rows.findIndex(z=>String(z.venueCode||'').padStart(2,'0')===code&&Number(z.race)===race);
      if(here<0){btn.style.display='none';return}
      const next=rows.slice(here+1).find(z=>z.settled!==true);
      if(!next){btn.style.display='none';return}
      const nextCode=String(next.venueCode||'').padStart(2,'0'),meta=window.BOAT_COMMAND_VENUE_REGISTRY?.resolve?.(nextCode);
      const name=meta?.name||next.venue||nextCode,nextRace=Number(next.race);
      btn.textContent=`次のTRY → ${name} ${nextRace}R`;
      btn.style.display='inline-flex';
      btn.onclick=()=>{
        const base=window.BOAT_COMMAND_VENUE_REGISTRY?.routeFor?.(meta)||`./venue.html?jcd=${encodeURIComponent(nextCode)}&shell=5`;
        const u=new URL(base,location.href);u.searchParams.set('race',String(nextRace));location.href=u.toString();
      };
    }catch{btn.style.display='none'}
  }

  function tick(){
    attempts++;
    const isVenue=/\/venue\.html$/.test(location.pathname);
    const done=isVenue?focusVenueRace():focusGamagoriRace();
    if(done||attempts>=80){
      if(timer)clearInterval(timer);
      timer=null;
    }
  }

  function boot(){tick();timer=setInterval(tick,125);refreshNextTryButton();setInterval(refreshNextTryButton,30000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
