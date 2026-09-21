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

  function tick(){
    attempts++;
    const isVenue=/\/venue\.html$/.test(location.pathname);
    const done=isVenue?focusVenueRace():focusGamagoriRace();
    if(done||attempts>=80){
      if(timer)clearInterval(timer);
      timer=null;
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{tick();timer=setInterval(tick,125)},{once:true});
  else{tick();timer=setInterval(tick,125)}
})();
