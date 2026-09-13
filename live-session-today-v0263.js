// BOAT COMMAND GAMAGORI TODAY LIVE SESSION GUARD v0.26.3
// Normal app launch is always today's GAMAGORI LIVE session.
// Explicit backtest/retest actions remain available only after user selects them in-app.
(()=>{
'use strict';
const KEY='boatCommand.lastDate';
const jstToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function bootTodayLive(){
  const today=jstToday();
  try{
    localStorage.setItem(KEY,today);
    if(typeof currentDate!=='undefined') currentDate=today;
    let s=null;
    try{s=typeof session==='function'?session(today):null}catch{}
    if(s){
      // Do not mutate locked historical records. Only normalize a fresh/current session.
      const races=Array.isArray(s.races)?s.races:[];
      const locked=races.some(r=>r&&r.locked);
      if(!locked){
        s.date=today;
        s.runType='LIVE';
        s.replayPackId=null;
        s.replayRevealed=false;
        if(typeof save==='function') try{save()}catch{}
      }
    }
    const date=document.querySelector('#sessionDate'); if(date) date.value=today;
    const type=document.querySelector('#runType'); if(type&&!type.disabled) type.value='LIVE';
    if(typeof renderAll==='function') renderAll();
    window.dispatchEvent(new CustomEvent('boatcommand:today-live',{detail:{date:today,venue:'蒲郡'}}));
  }catch(e){console.warn('[today-live-guard]',e)}
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(bootTodayLive,0),{once:true});
else setTimeout(bootTodayLive,0);
window.BOAT_COMMAND_TODAY_LIVE_V0263=Object.freeze({version:'0.26.3',venue:'蒲郡',bootTodayLive});
})();