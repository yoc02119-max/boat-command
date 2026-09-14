// BOAT COMMAND GAMAGORI LIVE FINAL LOCK GUARD v0.31.3
// Final fail-closed check immediately before HARD LOCK. LIVE only.
// Formal prediction uses result-free official program + historical DB only; exhibition is not required.
const BC_LIVE_LOCK_GUARD_V0202={
  version:'GAMAGORI-LIVE-LOCK-GUARD-V0.31.3',
  minMarginMinutes:3,
  maxFutureSkewMinutes:2,
  maxProgramAgeHours:24
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
  if(r.programSnapshotStatus!=='READY'||!Array.isArray(r.preRaceProfiles)||r.preRaceProfiles.length!==6)return {ok:false,status:'BLOCKED',reason:r.programSnapshotReason||'公式番組データがREADYではありません'};

  const suggestion=r.firstSuggestion;
  if(suggestion?.status!=='CANDIDATE'||suggestion.sessionDate!==s.date)return {ok:false,status:'BLOCKED',reason:suggestion?.reason||'正式メイン予想がREADYではありません'};
  if(!Array.isArray(suggestion.picks)||suggestion.picks.length<1||suggestion.picks.length>4)return {ok:false,status:'BLOCKED',reason:'正式メイン予想の買い目数が不正です'};

  const deadline=bcLiveDeadlineAt(s.date,r.programDeadline);
  if(!deadline)return {ok:false,status:'BLOCKED',reason:'公式番組の締切時刻を安全に解釈できません'};
  const margin=bcMinutes(deadline,now);
  if(margin<BC_LIVE_LOCK_GUARD_V0202.minMarginMinutes){
    return {ok:false,status:'BLOCKED',reason:`締切まで${Math.max(0,margin).toFixed(1)}分。安全余裕${BC_LIVE_LOCK_GUARD_V0202.minMarginMinutes}分未満のためLOCK禁止`,marginMinutes:margin};
  }

  const sourceRaw=r.programSnapshotAt||null;
  const source=sourceRaw?new Date(sourceRaw):null;
  if(!source||!Number.isFinite(source.getTime()))return {ok:false,status:'BLOCKED',reason:'公式番組取得時刻を確認できません',marginMinutes:margin};
  const age=bcMinutes(now,source);
  if(age < -BC_LIVE_LOCK_GUARD_V0202.maxFutureSkewMinutes)return {ok:false,status:'BLOCKED',reason:'公式番組取得時刻が未来値になっているためLOCK禁止',marginMinutes:margin,sourceAgeMinutes:age};
  if(age > BC_LIVE_LOCK_GUARD_V0202.maxProgramAgeHours*60)return {ok:false,status:'BLOCKED',reason:'公式番組データが24時間以上古いため再同期が必要です',marginMinutes:margin,sourceAgeMinutes:age};

  const picks=(r.picks||[]).map(v=>String(v||'').trim()).filter(Boolean);
  if(picks.length<1||picks.length>4)return {ok:false,status:'BLOCKED',reason:'買い目が1〜4点の範囲ではありません',marginMinutes:margin,sourceAgeMinutes:age};
  const expected=(suggestion.picks||[]).map(v=>String(v||'').trim()).filter(Boolean);
  if(JSON.stringify(picks)!==JSON.stringify(expected))return {ok:false,status:'BLOCKED',reason:'買い目欄が正式メイン予想と一致しません。手入力変更があるため安全確認が必要です',marginMinutes:margin,sourceAgeMinutes:age};

  return {ok:true,status:'SAFE_TO_LOCK',reason:'',marginMinutes:margin,sourceAgeMinutes:age,checkedAt:now.toISOString(),predictionSource:'firstSuggestion',exhibitionUsed:false,version:BC_LIVE_LOCK_GUARD_V0202.version};
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

const _bcLockAllEligibleV0239=lockAllEligible;
lockAllEligible=async function(){
  const s=typeof session==='function'?session():null;
  if(!s||s.runType!=='LIVE')return _bcLockAllEligibleV0239();
  const eligible=typeof eligibleReplayRaces==='function'?eligibleReplayRaces(s).filter(r=>!r.locked):(s.races||[]).filter(r=>!r.locked);
  if(!eligible.length)return _bcLockAllEligibleV0239();
  const now=new Date();
  const blocked=[];
  for(const r of eligible){
    const audit=bcFinalLiveLockAudit(s,r,now);
    bcSaveLiveLockAudit(r,audit);
    if(!audit.ok)blocked.push({race:r.race,reason:audit.reason});
  }
  if(blocked.length){
    const first=blocked[0];
    alert(`一括HARD LOCK BLOCKED\n${first.race}R: ${first.reason}\n\n全対象を事前監査し、1件でもBLOCKEDなら一括LOCKを開始しません。`);
    if(typeof renderAll==='function')renderAll();
    return false;
  }
  return _bcLockAllEligibleV0239();
};

function renderLiveLockGuard(){
  const s=session();
  if(!s||s.runType!=='LIVE')return;
  const cards=[...document.querySelectorAll('#predictionList .race-card')];
  cards.forEach(card=>{
    const parsedRace=Number((card.querySelector('.race-no')?.textContent||'').replace(/\D/g,''));
    let box=card.querySelector('.live-lock-guard-v0202');
    if(!box){box=document.createElement('div');box.className='live-lock-guard-v0202';card.prepend(box);}
    if(!Number.isInteger(parsedRace)||parsedRace<1||parsedRace>12){
      box.innerHTML='<div class="prediction-gate limited"><b>FINAL LOCK GATE｜BLOCKED</b><span>レース番号を安全に確認できないためLOCK禁止</span></div>';
      return;
    }
    const r=s.races.find(x=>Number(x.race)===parsedRace);
    if(!r){box.innerHTML='<div class="prediction-gate limited"><b>FINAL LOCK GATE｜BLOCKED</b><span>レース情報を照合できないためLOCK禁止</span></div>';return;}
    if(r.locked){box.innerHTML='';return;}
    const a=bcFinalLiveLockAudit(s,r,new Date());
    if(a.ok){
      box.innerHTML=`<div class="prediction-gate ready"><b>FINAL LOCK GATE｜SAFE</b><span>メイン予想一致 · 締切余裕 ${a.marginMinutes.toFixed(1)}分 · 番組取得 ${a.sourceAgeMinutes.toFixed(1)}分前</span></div>`;
    }else{
      box.innerHTML=`<div class="prediction-gate limited"><b>FINAL LOCK GATE｜BLOCKED</b><span>${esc(a.reason)}</span></div>`;
    }
  });
}

const _bcRenderAllV0202=renderAll;
renderAll=function(){_bcRenderAllV0202();renderLiveLockGuard();};

const _bcAnswerV0202=answer;
answer=function(q){
  const t=String(q||'').replace(/\s/g,'');
  const m=t.match(/(\d{1,2})R/),race=m?Number(m[1]):Number($('#liveRace')?.value)||1;
  if(/LOCKできる|ロックできる|LOCK安全|ロック安全|最終確認|締切余裕|鮮度/.test(t)){
    const s=session(),r=s.races.find(x=>Number(x.race)===race),a=bcFinalLiveLockAudit(s,r,new Date());
    if(a.ok)return `${race}Rは <strong>FINAL LOCK GATE SAFE</strong>。正式メイン予想一致、締切余裕 ${a.marginMinutes.toFixed(1)}分です。`;
    return `${race}Rは <strong>HARD LOCK BLOCKED</strong>。理由は「${esc(a.reason)}」です。`;
  }
  return _bcAnswerV0202(q);
};

renderAll();
