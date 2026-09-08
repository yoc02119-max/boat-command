// BOAT COMMAND GAMAGORI LIVE FINAL LOCK GUARD v0.20.2
// Final fail-closed check immediately before HARD LOCK. LIVE only.
// Verifies READY, verified mappings, candidate state, source freshness, and deadline margin.
const BC_LIVE_LOCK_GUARD_V0202={
  version:'GAMAGORI-LIVE-LOCK-GUARD-V0.20.2',
  minMarginMinutes:3,
  maxSourceAgeMinutes:20,
  maxFutureSkewMinutes:2
};

function bcLiveDeadlineAt(date,deadline){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||''))||!/^\d{1,2}:\d{2}$/.test(String(deadline||'')))return null;
  const [h,m]=String(deadline).split(':').map(Number);
  const d=new Date(`${date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00+09:00`);
  return Number.isFinite(d.getTime())?d:null;
}
function bcMinutes(a,b){return (a-b)/60000;}
function bcFinalLiveLockAudit(s,r,now=new Date()){
  if(!s||s.runType!=='LIVE')return {ok:true,status:'NOT_LIVE',reason:''};
  if(!r)return {ok:false,status:'BLOCKED',reason:'レース情報を確認できません'};
  if(r.locked)return {ok:false,status:'BLOCKED',reason:'すでにHARD LOCK済みです'};
  if(r.liveDataStatus!=='READY'||!r.livePreRace)return {ok:false,status:'BLOCKED',reason:r.liveDataReason||'LIVEデータがREADYではありません'};

  const v=r.livePreRace.verified||{};
  if(v.timingStatus!=='VERIFIED')return {ok:false,status:'BLOCKED',reason:'締切時刻の安全確認がVERIFIEDではありません'};
  if(v.boatMappingVerified!==true)return {ok:false,status:'BLOCKED',reason:'艇番対応の確認が完了していません'};
  if(v.weatherMappingVerified!==true)return {ok:false,status:'BLOCKED',reason:'水面気象の対応確認が完了していません'};
  if(v.readyForPrediction!==true)return {ok:false,status:'BLOCKED',reason:'readyForPredictionがtrueではありません'};

  const suggestion=r.liveSuggestion;
  if(suggestion?.status!=='CANDIDATE')return {ok:false,status:'BLOCKED',reason:suggestion?.reason||'現在のLIVE判定は予想候補成立ではありません'};

  const deadline=bcLiveDeadlineAt(s.date,r.livePreRace.deadline);
  if(!deadline)return {ok:false,status:'BLOCKED',reason:'締切時刻を安全に解釈できません'};
  const margin=bcMinutes(deadline,now);
  if(margin<BC_LIVE_LOCK_GUARD_V0202.minMarginMinutes){
    return {ok:false,status:'BLOCKED',reason:`締切まで${Math.max(0,margin).toFixed(1)}分。安全余裕${BC_LIVE_LOCK_GUARD_V0202.minMarginMinutes}分未満のためLOCK禁止`,marginMinutes:margin};
  }

  const sourceRaw=r.liveVerifiedAt||r.livePreRace?.verifiedAt||null;
  const source=sourceRaw?new Date(sourceRaw):null;
  if(!source||!Number.isFinite(source.getTime()))return {ok:false,status:'BLOCKED',reason:'verified LIVE取得時刻を確認できません',marginMinutes:margin};
  const age=bcMinutes(now,source);
  if(age < -BC_LIVE_LOCK_GUARD_V0202.maxFutureSkewMinutes)return {ok:false,status:'BLOCKED',reason:'LIVE取得時刻が未来値になっているためLOCK禁止',marginMinutes:margin,sourceAgeMinutes:age};
  if(age > BC_LIVE_LOCK_GUARD_V0202.maxSourceAgeMinutes)return {ok:false,status:'BLOCKED',reason:`LIVEデータが古すぎます（${age.toFixed(1)}分前）。再取得後にLOCKしてください`,marginMinutes:margin,sourceAgeMinutes:age};

  const picks=(r.picks||[]).map(v=>String(v||'').trim()).filter(Boolean);
  if(picks.length<1||picks.length>4)return {ok:false,status:'BLOCKED',reason:'買い目が1〜4点の範囲ではありません',marginMinutes:margin,sourceAgeMinutes:age};

  return {ok:true,status:'SAFE_TO_LOCK',reason:'',marginMinutes:margin,sourceAgeMinutes:age,checkedAt:now.toISOString(),version:BC_LIVE_LOCK_GUARD_V0202.version};
}
function bcSaveLiveLockAudit(r,audit){
  if(!r)return;
  r.liveLockAudit={...audit,checkedAt:audit.checkedAt||new Date().toISOString(),version:BC_LIVE_LOCK_GUARD_V0202.version};
  saveStore();
}

const _bcLockRaceV0202=lockRace;
lockRace=async function(n){
  const s=session(),r=s.races.find(x=>Number(x.race)===Number(n));
  if(s?.runType==='LIVE'){
    const audit=bcFinalLiveLockAudit(s,r,new Date());
    bcSaveLiveLockAudit(r,audit);
    if(!audit.ok){
      alert(`${n}R HARD LOCK BLOCKED\n${audit.reason}`);
      if(typeof renderAll==='function')renderAll();
      return false;
    }
  }
  const ok=await _bcLockRaceV0202(n);
  if(ok&&s?.runType==='LIVE'){
    const rr=session().races.find(x=>Number(x.race)===Number(n));
    if(rr){
      rr.liveLockAudit={...(rr.liveLockAudit||{}),status:'LOCKED_AFTER_FINAL_AUDIT',lockedAt:rr.lockedAt||new Date().toISOString(),version:BC_LIVE_LOCK_GUARD_V0202.version};
      saveStore();
    }
  }
  return ok;
};

function renderLiveLockGuard(){
  const s=session();
  if(!s||s.runType!=='LIVE')return;
  const cards=[...document.querySelectorAll('.race-card')];
  cards.forEach((card,i)=>{
    const r=s.races.find(x=>Number(x.race)===i+1);
    let box=card.querySelector('.live-lock-guard-v0202');
    if(!box){box=document.createElement('div');box.className='live-lock-guard-v0202';card.prepend(box);}
    if(!r||r.locked){box.innerHTML='';return;}
    const a=bcFinalLiveLockAudit(s,r,new Date());
    if(a.ok){
      box.innerHTML=`<div class="prediction-gate ready"><b>FINAL LOCK GATE｜SAFE</b><span>締切余裕 ${a.marginMinutes.toFixed(1)}分 · LIVE鮮度 ${a.sourceAgeMinutes.toFixed(1)}分</span></div>`;
    }else{
      box.innerHTML=`<div class="prediction-gate limited"><b>FINAL LOCK GATE｜BLOCKED</b><span>${esc(a.reason)}</span></div>`;
    }
  });
}

const _bcRenderAllV0202=renderAll;
renderAll=function(){
  _bcRenderAllV0202();
  renderLiveLockGuard();
};

const _bcAnswerV0202=answer;
answer=function(q){
  const t=String(q||'').replace(/\s/g,'');
  const m=t.match(/(\d{1,2})R/),race=m?Number(m[1]):Number($('#liveRace')?.value)||1;
  if(/LOCKできる|ロックできる|LOCK安全|ロック安全|最終確認|締切余裕|鮮度/.test(t)){
    const s=session(),r=s.races.find(x=>Number(x.race)===race),a=bcFinalLiveLockAudit(s,r,new Date());
    if(a.ok)return `${race}Rは <strong>FINAL LOCK GATE SAFE</strong>。締切余裕 ${a.marginMinutes.toFixed(1)}分、LIVEデータ鮮度 ${a.sourceAgeMinutes.toFixed(1)}分です。`;
    return `${race}Rは <strong>HARD LOCK BLOCKED</strong>。理由は「${esc(a.reason)}」です。`;
  }
  return _bcAnswerV0202(q);
};

renderAll();
