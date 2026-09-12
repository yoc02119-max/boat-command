// BOAT COMMAND GAMAGORI LIVE AUTO-POLL v0.19.9
// No manual relay button is required. Only same-origin verified PRE-RACE relay files are read.
// Final-state freeze v0.24.8: once a race is HARD LOCKed, or the global POST-RACE gate opens,
// PRE-RACE polling must stop mutating live state. This keeps lock evidence immutable and prevents
// SKIP/WAIT/CANDIDATE reclassification from reopening a completed PRE-RACE target set.
const BC_LIVE_AUTOPOLL_V0199={timer:null,running:false,lastSweepAt:null};
function liveAutoPollEligible(){
  try{
    const s=session();
    if(!s||s.runType!=='LIVE'||document.hidden)return false;
    // Result mode is evaluated dynamically after all LIVE wrappers have loaded. If the target set
    // is complete, PRE-RACE acquisition is finished for the day and the POST-RACE layer owns updates.
    if(typeof isResultMode==='function'&&isResultMode(s))return false;
    return true;
  }catch{return false}
}
function liveAutoStatusSummary(s){
  let ready=0,wait=0,unknown=0;
  for(const r of s.races||[]){
    if(r.liveDataStatus==='READY')ready++;
    else if(r.liveDataStatus==='WAIT')wait++;
    else unknown++;
  }
  return {ready,wait,unknown};
}
async function sweepVerifiedLiveRelays({render=true}={}){
  if(BC_LIVE_AUTOPOLL_V0199.running||!liveAutoPollEligible())return null;
  BC_LIVE_AUTOPOLL_V0199.running=true;
  try{
    const s=session(),date=s.date||todayISO();
    let changed=false;
    for(let race=1;race<=12;race++){
      const rec=s.races.find(x=>Number(x.race)===race);
      // HARD LOCK captures immutable PRE-RACE evidence. Never refresh that race afterward.
      // Settled is included as an additional fail-closed guard for restored/imported sessions.
      if(!rec||rec.locked||rec.settled)continue;
      const before=JSON.stringify([rec.liveDataStatus,rec.liveDataReason,rec.liveVerifiedAt]);
      const x=await loadVerifiedLiveRace(date,race,{silent:true});
      rec.liveDataStatus=x.ready?'READY':'WAIT';
      rec.liveDataReason=x.reason||'';
      rec.liveVerifiedAt=x.ready?(x.payload?.fetchedAt||x.checkedAt):null;
      rec.liveRelayPath=x.path;
      rec.livePreRace=x.ready?{deadline:x.payload.deadline,beforeinfo:x.payload.beforeinfo,racelist:x.payload.racelist,verified:x.payload.verified}:null;
      const after=JSON.stringify([rec.liveDataStatus,rec.liveDataReason,rec.liveVerifiedAt]);
      if(before!==after)changed=true;
    }
    BC_LIVE_AUTOPOLL_V0199.lastSweepAt=new Date().toISOString();
    if(changed)saveStore();
    if(render){
      renderAll();
      const sum=liveAutoStatusSummary(s),st=$("#relayGateStatus");
      if(st){
        st.className=`live-gate-status ${sum.ready?'ok':'warn'}`;
        st.textContent=`AUTO LIVE · READY ${sum.ready}/12 · WAIT ${sum.wait}/12 · 未確認 ${sum.unknown}/12`;
      }
    }
    return liveAutoStatusSummary(s);
  }catch(e){
    console.error('LIVE_AUTO_POLL_FAILED',e);
    return null;
  }finally{
    BC_LIVE_AUTOPOLL_V0199.running=false;
  }
}
function startVerifiedLiveAutoPoll(){
  if(BC_LIVE_AUTOPOLL_V0199.timer)clearInterval(BC_LIVE_AUTOPOLL_V0199.timer);
  setTimeout(()=>sweepVerifiedLiveRelays({render:true}),350);
  BC_LIVE_AUTOPOLL_V0199.timer=setInterval(()=>sweepVerifiedLiveRelays({render:true}),60000);
}
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)sweepVerifiedLiveRelays({render:true});
});
const _bcSessionDateChangeV0199=$("#sessionDate")?.onchange;
if($("#sessionDate"))$("#sessionDate").onchange=e=>{
  if(typeof _bcSessionDateChangeV0199==='function')_bcSessionDateChangeV0199(e);
  setTimeout(()=>sweepVerifiedLiveRelays({render:true}),100);
};
const _bcRunTypeChangeV0199=$("#runType")?.onchange;
if($("#runType"))$("#runType").onchange=e=>{
  if(typeof _bcRunTypeChangeV0199==='function')_bcRunTypeChangeV0199(e);
  if(session().runType==='LIVE')setTimeout(()=>sweepVerifiedLiveRelays({render:true}),100);
};
const _bcAnswerV0199=answer;
answer=function(q){
  const t=String(q||'').replace(/\s/g,'');
  if(/進捗|LIVE全体|ライブ全体|READY数|WAIT数|自動更新/.test(t)){
    const s=session(),sum=liveAutoStatusSummary(s);
    return `蒲郡LIVEは <strong>READY ${sum.ready}/12</strong>、WAIT ${sum.wait}/12、未確認 ${sum.unknown}/12です。verified relayはアプリが自動確認します。`;
  }
  return _bcAnswerV0199(q);
};
startVerifiedLiveAutoPoll();