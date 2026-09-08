// BOAT COMMAND GAMAGORI LIVE INTEGRATION v0.19.8
// Consumes only fail-closed same-origin relay JSON generated from verified packs.
const BC_LIVE_V0198={last:null};

function liveRelayReadyPayload(x,date,race){
  if(!x||x.schema!=="boat-command-pre-race-probe-v1")return false;
  if(x.venue!=="GAMAGORI"||x.date!==date||Number(x.race)!==Number(race))return false;
  const v=x.verified||{},s=x.safety||{};
  const ex=x.beforeinfo?.exhibition||[],st=x.beforeinfo?.startExhibition||[];
  return v.timingStatus==="VERIFIED"&&v.boatMappingVerified===true&&v.weatherMappingVerified===true&&v.readyForPrediction===true&&
    s.resultEndpointsIncluded===false&&s.predictionEnabled===false&&s.hardLockEnabled===false&&
    ex.length===6&&ex.every(a=>a.exhibitionTime!==null&&a.exhibitionTime!==undefined)&&
    st.length===6&&st.every(a=>String(a.st||"").trim())&&!!x.beforeinfo?.weather;
}

function liveRelayReason(x){
  if(!x)return "LIVEデータ未取得";
  const v=x.verified||{};
  const ex=x.beforeinfo?.exhibition||[],st=x.beforeinfo?.startExhibition||[];
  if(v.timingStatus!=="VERIFIED")return "締切時刻の安全確認待ち";
  if(ex.length!==6||!ex.every(a=>a.exhibitionTime!==null&&a.exhibitionTime!==undefined))return `展示タイム待ち ${ex.filter(a=>a.exhibitionTime!==null&&a.exhibitionTime!==undefined).length}/6`;
  if(st.length!==6||!st.every(a=>String(a.st||"").trim()))return `スタート展示待ち ${st.filter(a=>String(a.st||"").trim()).length}/6`;
  if(v.boatMappingVerified!==true)return "艇番対応の確認待ち";
  if(v.weatherMappingVerified!==true||!x.beforeinfo?.weather)return "水面気象の確認待ち";
  if(v.readyForPrediction!==true)return "安全監査READY待ち";
  return "LIVEデータ確認待ち";
}

async function loadVerifiedLiveRace(date,race,{silent=false}={}){
  const path=`./live/gamagori/${date}/pre/race-${race}.json`;
  try{
    const res=await fetch(`${path}?v=${Date.now()}`,{cache:"no-store",credentials:"same-origin"});
    if(!res.ok)throw new Error(`HTTP_${res.status}`);
    const x=validateRelayPayload(await res.json(),date,race);
    const ready=liveRelayReadyPayload(x,date,race);
    BC_LIVE_V0198.last={date,race,path,ready,payload:x,reason:ready?"":liveRelayReason(x),checkedAt:new Date().toISOString()};
    if(!silent){
      const st=$("#relayGateStatus");
      if(st){st.className=`live-gate-status ${ready?"ok":"warn"}`;st.textContent=ready?`PREDICTION READY · ${date} ${race}R · VERIFIED LIVE`:`WAIT · ${date} ${race}R · ${BC_LIVE_V0198.last.reason}`;}
    }
    return BC_LIVE_V0198.last;
  }catch(e){
    BC_LIVE_V0198.last={date,race,path,ready:false,payload:null,reason:"verified LIVE pack待ち",error:String(e?.message||e),checkedAt:new Date().toISOString()};
    if(!silent){const st=$("#relayGateStatus");if(st){st.className="live-gate-status warn";st.textContent=`WAIT · ${date} ${race}R · verified LIVE pack待ち`;}}
    return BC_LIVE_V0198.last;
  }
}

async function applyVerifiedLiveToPrediction(){
  const s=session();
  if(s.runType!=="LIVE")return null;
  const date=s.date||todayISO();
  const race=Math.max(1,Math.min(12,Number($("#liveRace")?.value)||1));
  const x=await loadVerifiedLiveRace(date,race,{silent:false});
  const r=s.races.find(a=>Number(a.race)===race);
  if(r){
    r.liveDataStatus=x.ready?"READY":"WAIT";
    r.liveDataReason=x.reason||"";
    r.liveVerifiedAt=x.ready?(x.payload?.fetchedAt||x.checkedAt):null;
    r.liveRelayPath=x.path;
    r.livePreRace=x.ready?{deadline:x.payload.deadline,beforeinfo:x.payload.beforeinfo,racelist:x.payload.racelist,verified:x.payload.verified}:null;
    saveStore();
  }
  return x;
}

const _bcRelayProbeV0198=runRelayProbe;
runRelayProbe=async function(){
  await _bcRelayProbeV0198();
  await applyVerifiedLiveToPrediction();
  renderAll();
};

const _bcRenderAllV0198=renderAll;
renderAll=function(){
  _bcRenderAllV0198();
  const s=session();
  if(s.runType!=="LIVE")return;
  const cards=[...document.querySelectorAll('.race-card')];
  cards.forEach((card,i)=>{
    if(card.querySelector('.live-auto-snapshot'))return;
    const d=document.createElement('div');d.className='live-auto-snapshot';
    const r=s.races.find(x=>Number(x.race)===i+1);
    if(r?.liveDataStatus==='READY')d.innerHTML='<div class="prediction-gate ready"><b>PREDICTION READY｜LIVE VERIFIED</b><span>展示・ST・艇番・気象・締切を安全監査済み</span></div>';
    else if(r?.liveDataStatus==='WAIT')d.innerHTML=`<div class="prediction-gate limited"><b>WAIT｜予想保留</b><span>${esc(r.liveDataReason||'直前データ待ち')}</span></div>`;
    card.prepend(d);
  });
};

const _bcAnswerV0198=answer;
answer=function(q){
  const t=String(q||"").replace(/\s/g,"");
  if(/READY|WAIT|見送り|保留|直前|展示|ライブ状況|LIVE状況/.test(t)){
    const s=session(),race=Number($("#liveRace")?.value)||1,r=s.races.find(x=>Number(x.race)===race);
    if(r?.liveDataStatus==='READY')return `${race}Rは <strong>PREDICTION READY</strong>。展示6/6・展示ST6/6・艇番対応・水面気象・締切を確認済みです。`;
    if(r?.liveDataStatus==='WAIT')return `${race}Rは <strong>WAIT</strong>。理由は「${esc(r.liveDataReason||'直前データ待ち')}」です。揃うまで予想しません。`;
  }
  return _bcAnswerV0198(q);
};

renderAll();
