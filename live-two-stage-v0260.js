// BOAT COMMAND GAMAGORI TWO-STAGE PREDICTION v0.26.0
// FIRST = historical/program-composition only. Same-day results + exhibition excluded.
// SECOND = existing verified LIVE candidate. No result fetch here.
(()=>{
  'use strict';
  const VERSION='GAMAGORI-TWO-STAGE-V0.26.0';
  function validResult(v){const s=String(v||'').trim();return /^[1-6]-[1-6]-[1-6]$/.test(s)&&new Set(s.split('-')).size===3?s:null;}
  function historicComp(hs,hr){const saved=hr?.programComposition;if(saved?.fingerprint&&Array.isArray(saved?.classes)&&saved.classes.length===6)return saved;try{const c=typeof analyzeProgram==='function'?analyzeProgram(hs,hr):null;return c?.available?c:null;}catch{return null;}}
  function firstCandidate(s,r){
    if(r?.firstSuggestion?.status==='CANDIDATE'&&r.firstSuggestion?.lockedAt)return r.firstSuggestion;
    let comp=null;try{comp=typeof analyzeProgram==='function'?analyzeProgram(s,r):null;}catch{}
    if(!comp?.available||!comp?.fingerprint||!Array.isArray(comp.classes)||comp.classes.length!==6)return {status:'WAIT',reason:'6艇の級別・番組構成データ待ち'};
    const scores=new Map();let samples=0,exact=0,sameType=0;let sessions=[];try{sessions=typeof allSessions==='function'?allSessions():[];}catch{}
    const base=String(s.date||'');
    for(const hs of sessions){
      if(!hs?.date||String(hs.date)>=base)continue; // same-day/future results are strictly excluded
      for(const hr of hs.races||[]){
        if(!hr?.settled)continue;const res=validResult(hr.result);if(!res)continue;const hc=historicComp(hs,hr);if(!hc?.classes||hc.classes.length!==6)continue;
        let sim=.15;if(hc.type===comp.type){sim+=1.2;sameType++;}let laneMatch=0;for(let i=0;i<6;i++)if(hc.classes[i]===comp.classes[i])laneMatch++;sim+=laneMatch*.32;if(hc.fingerprint===comp.fingerprint){sim+=2.5;exact++;}
        let recency=1;try{recency=typeof programAgeWeight==='function'?programAgeWeight(hs.date,base):1;}catch{}if(!(recency>0))continue;scores.set(res,(scores.get(res)||0)+sim*recency);samples++;
      }
    }
    if(!samples||!scores.size)return {status:'WAIT',reason:'照合可能な過去レース結果がまだありません'};
    const ranked=[...scores.entries()].sort((a,b)=>b[1]-a[1]),picks=ranked.slice(0,4).map(x=>x[0]),total=[...scores.values()].reduce((a,b)=>a+b,0)||1,confidence=Math.max(1,Math.min(99,Math.round((ranked[0]?.[1]||0)/total*100))),now=new Date().toISOString();
    return {status:'CANDIDATE',stage:'FIRST',picks,confidence,samples,exactSamples:exact,typeSamples:sameType,programType:comp.type,programFingerprint:comp.fingerprint,rationale:`過去データ型。今日の結果と展示は不使用。番組構成 ${comp.classes.join('/')} を過去データへ照合（参照${samples}件・完全一致${exact}件・同型${sameType}件）。`,generatedAt:now,lockedAt:now,strategyVersion:VERSION};
  }
  function refresh(){
    let s=null;try{s=session();}catch{return;}if(!s||s.runType!=='LIVE')return;let changed=false;
    for(const r of s.races||[]){if(r.firstSuggestion?.status==='CANDIDATE'&&r.firstSuggestion?.lockedAt)continue;const x=firstCandidate(s,r);if(JSON.stringify(r.firstSuggestion||null)!==JSON.stringify(x)){r.firstSuggestion=x;changed=true;}}
    if(changed&&typeof saveStore==='function')saveStore();
  }
  function firstHtml(r){const x=r?.firstSuggestion;if(!x)return '';if(x.status!=='CANDIDATE')return `<div class="prediction-gate limited"><b>第一候補｜過去データ待ち</b><span>${esc(x.reason||'準備中')}</span></div>`;return `<div class="prediction-gate ready"><b>第一候補｜過去データ 🔒</b><span>${x.picks.map(esc).join(' / ')}</span></div><div class="snapshot-note">${esc(x.rationale)} · 参考集中度 ${x.confidence}%</div>`;}
  function secondHtml(r){const x=r?.liveSuggestion;if(!x||x.status==='WAIT')return `<div class="prediction-gate limited"><b>第二候補｜展示待ち</b><span>${esc(x?.reason||r?.liveDataReason||'展示・ST待ち')}</span></div>`;if(x.status==='SKIP')return `<div class="no-prediction-panel"><div class="no-prediction-head"><b>第二候補｜なし</b><span>${esc(x.reason||'直前情報不足')}</span></div></div>`;return `<div class="prediction-gate ready"><b>第二候補｜展示反映</b><span>${x.picks.map(esc).join(' / ')}</span></div><div class="snapshot-note">${esc(x.rationale||'展示情報を反映した磨き込み予想')}</div>`;}
  function render(){
    let s=null;try{s=session();}catch{return;}if(!s||s.runType!=='LIVE')return;
    document.querySelectorAll('#predictionList .race-card').forEach(card=>{
      const race=Number((card.querySelector('.race-no')?.textContent||'').replace(/\D/g,'')),r=s.races.find(x=>Number(x.race)===race);if(!r)return;
      const legacy=card.querySelector('.live-candidate-v0200');if(legacy)legacy.style.display='none';
      let box=card.querySelector('.two-stage-v0260');if(!box){box=document.createElement('div');box.className='two-stage-v0260';card.prepend(box);}box.innerHTML=firstHtml(r)+secondHtml(r);
    });
  }
  const priorRender=typeof renderAll==='function'?renderAll:null;if(priorRender){renderAll=function(){const out=priorRender.apply(this,arguments);refresh();render();return out;};}
  const priorSweep=typeof sweepVerifiedLiveRelays==='function'?sweepVerifiedLiveRelays:null;if(priorSweep){sweepVerifiedLiveRelays=async function(opts={}){const out=await priorSweep(opts);refresh();render();return out;};}
  const priorAnswer=typeof answer==='function'?answer:null;if(priorAnswer){answer=function(q){const t=String(q||'').replace(/\s/g,''),m=t.match(/(\d{1,2})R/),race=m?Number(m[1]):Number($("#liveRace")?.value)||1;if(/第一候補|第二候補|買い目|予想候補/.test(t)){const r=session().races.find(x=>Number(x.race)===race),a=r?.firstSuggestion,b=r?.liveSuggestion,one=a?.status==='CANDIDATE'?`第一候補 <strong>${a.picks.join(' / ')}</strong>`:`第一候補は${esc(a?.reason||'準備中')}`,two=b?.status==='CANDIDATE'?`第二候補 <strong>${b.picks.join(' / ')}</strong>`:b?.status==='SKIP'?`第二候補なし（${esc(b.reason)}）`:`第二候補は展示待ち`;return `${race}R：${one}。${two}。`;}return priorAnswer(q);};}
  window.BOAT_COMMAND_TWO_STAGE_V0260=Object.freeze({version:VERSION,venue:'蒲郡',firstUsesSameDayResults:false,firstUsesExhibition:false,secondUsesVerifiedLive:true,noResultLookahead:true});
  refresh();render();
})();
