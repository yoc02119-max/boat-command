// BOAT COMMAND DAILY LAB v1
(function(){
'use strict';
const LABELS={BASE4:'現行4点',RANK6:'順位6点',RANK8:'順位8点',HEAD6:'1着筋拡張',SECOND6:'2着筋拡張',THIRD6:'3着筋拡張'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=v=>v!=null&&v!==''&&Number.isFinite(Number(v))?`${(Number(v)*100).toFixed(1)}%`:'—';
const signed=n=>`${Number(n)>0?'+':''}${Number(n)||0}`;
const q=s=>document.querySelector(s);

// Pages shell and research reports publish independently; read current main data.
const DATA_ROOT=['localhost','127.0.0.1','[::1]'].includes(location.hostname)?'./':'https://raw.githubusercontent.com/yoc02119-max/boat-command/main/';
let current=null,archive=null,requestId=0;
async function load(date){
 const file=date?`daily-lab/${date}.json`:'daily-lab-v1.json';
 const r=await fetch(`${DATA_ROOT}${file}?t=${Date.now()}`,{cache:'no-store'});
 if(!r.ok)throw new Error('DAILY_LAB_REPORT_WAIT');
 const x=await r.json();
 if(x?.schema!=='boat-command-daily-lab-v1'||x?.totals?.venues!==24||!Array.isArray(x?.venues)||x.venues.length!==24)throw new Error('DAILY_LAB_REPORT_INVALID');
 return x;
}
function metric(id,value,sub){const el=q(id);if(el)el.innerHTML=`<strong>${esc(value)}</strong><small>${esc(sub)}</small>`}

function archiveObservation(code){
 if(!archive?.venues)return null;
 const v=archive.venues.find(x=>x.code===code),base=v?.summary?.BASE4;
 if(!v||!base||!Number(base.races))return null;
 const keys=['RANK6','RANK8','HEAD6','SECOND6','THIRD6'];
 const candidates=keys.map(key=>({key,s:v.summary?.[key]})).filter(x=>x.s&&Number(x.s.hitRate)>Number(base.hitRate)&&Number(x.s.payoutOnlyRoi)>Number(base.payoutOnlyRoi))
   .sort((a,b)=>Number(b.s.payoutOnlyRoi)-Number(a.s.payoutOnlyRoi)||Number(b.s.hitRate)-Number(a.s.hitRate));
 if(!candidates.length)return {key:'BASE4',label:'BASE4維持',candidate:false,base,chosen:base};
 const best=candidates[0];
 return {key:best.key,label:`${LABELS[best.key]||best.key}候補`,candidate:true,base,chosen:best.s};
}

function venueCard(v){
 const base=v.summary?.BASE4||{},r6=v.summary?.RANK6||{},r8=v.summary?.RANK8||{};
 const d6=(Number(r6.hits)||0)-(Number(base.hits)||0),d8=(Number(r8.hits)||0)-(Number(base.hits)||0);
 const obs=(v.observations||[])[0];
 const obsText=v.evaluated&&obs?.deltaHits>0?`${LABELS[obs?.key]||obs?.key||'—'} ${signed(obs?.deltaHits||0)}的中`:v.evaluated?'追加的中なし':'結果待ち';
 const hist=archiveObservation(v.code);
 const histText=hist?`30日観察 · ${hist.label}`:'30日観察 · 集計待ち';
 return `<button class="lab-venue ${v.captured?'has-data':''}" data-code="${esc(v.code)}">
   <div class="lab-venue-top"><span>${esc(v.code)}</span><b>${esc(v.name)}</b><em>${v.captured?`${v.captured}/12固定`:'未固定'}</em></div>
   <div class="lab-venue-kpis">
    <div><small>評価</small><strong>${Number(v.evaluated)||0}R</strong></div>
    <div><small>BASE4</small><strong>${Number(base.hits)||0}的中</strong></div>
    <div><small>RANK6</small><strong class="${d6>0?'up':''}">${signed(d6)}</strong></div>
    <div><small>RANK8</small><strong class="${d8>0?'up':''}">${signed(d8)}</strong></div>
   </div>
   <div class="lab-observe"><span>この日の観察</span><b>${esc(obsText)}</b><em class="lab-30d-observe ${hist?.candidate?'candidate':'base'}">${esc(histText)}</em></div>
  </button>`;
}
function variantRow(v,key){
 const s=v.summary?.[key]||{},delta=(Number(s.hits)||0)-(Number(v.summary?.BASE4?.hits)||0);
 return `<div class="lab-variant-row">
  <div><b>${esc(LABELS[key]||key)}</b><small>${key==='BASE4'?'現行基準':key==='RANK8'?'4点追加':'2点追加'}</small></div>
  <strong>${Number(s.hits)||0}/${Number(s.races)||0}</strong>
  <span>${pct(s.hitRate)}</span>
  <em class="${delta>0?'up':''}">${key==='BASE4'?'基準':`${signed(delta)}的中`}</em>
  <i>${key==='BASE4'?'—':`${Number(s.addedHits)||0}R追加的中`}</i>
 </div>`;
}
function pickChips(xs,cls=''){return (xs||[]).map(x=>`<i class="${cls}">${esc(x)}</i>`).join('')}
function raceCard(r){
 const settled=r.status==='SETTLED'||r.status==='SETTLED_REPLAY';
 const v=r.variants||{};
 const base=settled?(v.BASE4?.picks||r.base||[]):r.base||[];
 const variants=['RANK6','RANK8','HEAD6','SECOND6','THIRD6'];
 const rows=variants.map(key=>{
   const row=v[key],picks=settled?row?.picks:r.variants?.[key];
   const added=settled?row?.added:(picks||[]).slice(4);
   const hit=settled?row?.hit:null,addedHit=settled?row?.addedHit:null;
   return `<div class="lab-race-variant ${addedHit?'rescued':''}">
    <span>${esc(LABELS[key])}</span>
    <div class="lab-added">${pickChips(added,addedHit?'hit':'')}</div>
    <b>${!settled?'待ち':hit?(addedHit?'追加点HIT':'HIT'):'MISS'}</b>
   </div>`;
 }).join('');
 const baseHit=settled?v.BASE4?.hit:null;
 return `<article class="lab-race ${settled?(baseHit?'base-hit':'base-miss'):'pending'}">
   <header><div><strong>${Number(r.race)}R</strong><span>${settled?`結果 ${esc(r.actual)}`:r.status==='RESULT_EXCLUDED'?'結果データ確認待ち':'結果待ち'}</span></div><em>${settled&&r.actualRank?`実着順ランク #${r.actualRank}`:'PRE-RACE固定'}</em></header>
   <div class="lab-base"><span>BASE4</span><div>${pickChips(base)}</div><b>${!settled?'固定済み':baseHit?'HIT':`MISS · ${esc(r.baselineMiss||'')}`}</b></div>
   <div class="lab-race-variants">${rows}</div>
  </article>`;
}
function renderDetail(data,code){
 const v=data.venues.find(x=>x.code===code)||data.venues.find(x=>x.captured>0)||data.venues[0];
 if(!v)return;
 const box=q('#labDetail');
 box.hidden=false;
 q('#labDetailTitle').textContent=`${v.name} DAILY LAB`;
 q('#labDetailMeta').textContent=`${data.date} · ${data.sourceMode==='STRICT_HISTORICAL_REPLAY_V1'?'厳密過去再生':'結果前固定'} · ${v.captured}R · ${v.evaluated}R評価 · 自動昇格なし`;
 q('#labVariantTable').innerHTML=['BASE4','RANK6','RANK8','HEAD6','SECOND6','THIRD6'].map(k=>variantRow(v,k)).join('');
 q('#labRaceGrid').innerHTML=v.races.length?v.races.map(raceCard).join(''):'<div class="lab-empty">この日の締切前に固定された試験データはありません。</div>';
 document.querySelectorAll('.lab-venue').forEach(x=>x.classList.toggle('selected',x.dataset.code===v.code));
 history.replaceState(null,'',`daily-lab.html?venue=${encodeURIComponent(v.code)}&date=${encodeURIComponent(data.date)}`);
 renderHistory(v.code);
 box.scrollIntoView({behavior:'smooth',block:'start'});
}
function render(data){
 current=data;
 q('#labDetail').hidden=true;
 q('#labHistory').hidden=true;
 const strictReplay=data.sourceMode==='STRICT_HISTORICAL_REPLAY_V1';
 q('#labDate').textContent=`${data.date} · ${strictReplay?'STRICT REPLAY':'LIVE CAPTURE'}`;
 metric('#labVenues',`${data.totals.venuesCaptured}/24場`,strictReplay?'過去再生できた場':'選択日の固定あり');
 metric('#labCaptured',`${data.totals.capturedRaces}R`,strictReplay?'対象日より前だけで再生成':'結果前固定');
 metric('#labEvaluated',`${data.totals.evaluatedRaces}R`,'結果照合済み');
 metric('#labBaseHits',`${data.totals.baseHits}的中`,'現行BASE4');
 metric('#labRank6',signed(data.totals.rank6Hits-data.totals.baseHits),'RANK6追加差');
 metric('#labRank8',signed(data.totals.rank8Hits-data.totals.baseHits),'RANK8追加差');
 q('#labVenueGrid').innerHTML=data.venues.map(venueCard).join('');
 q('#labVenueGrid').onclick=e=>{const b=e.target.closest('.lab-venue');if(b)renderDetail(current,b.dataset.code)};
 const initial=new URLSearchParams(location.search).get('venue');
 if(initial&&data.venues.some(v=>v.code===initial))renderDetail(data,initial);
}
function renderHistory(code){
 const box=q('#labHistory');
 if(!archive){box.hidden=true;return}
 const v=archive.venues.find(x=>x.code===code);if(!v){box.hidden=true;return}
 box.hidden=false;
 q('#labHistoryTitle').textContent=`${v.name} · 直近30日`;
 const hist=archiveObservation(code);
 const histDetail=hist?.candidate?`観察候補 ${hist.label.replace('候補','')} · 的中率 ${pct(hist.base.hitRate)}→${pct(hist.chosen.hitRate)} · ROI ${pct(hist.base.payoutOnlyRoi)}→${pct(hist.chosen.payoutOnlyRoi)}。`:'観察上はBASE4維持。';
 q('#labHistoryMeta').textContent=`${archive.from}〜${archive.to} · 評価日数 ${v.days}日。 ${histDetail} 保存済み試験のみ／自動昇格なし。`;
 q('#labHistoryTable').innerHTML='<thead><tr><th>試験</th><th>的中/R</th><th>的中率</th><th>追加的中</th><th>払戻÷購入額*</th></tr></thead><tbody>'+Object.keys(LABELS).map(k=>{
  const s=v.summary[k];return `<tr><th>${esc(LABELS[k])}</th><td>${s.hits}/${s.races}</td><td>${pct(s.hitRate)}</td><td>${k==='BASE4'?'—':s.addedHits}</td><td>${pct(s.payoutOnlyRoi)}</td></tr>`;
 }).join('')+'</tbody>';
}
async function selectDate(date){
 const token=++requestId;
 q('#labLoading').hidden=false;q('#labLoading').textContent='読み込み中…';
 q('#labVenueGrid').innerHTML='';q('#labDetail').hidden=true;q('#labHistory').hidden=true;
 document.querySelectorAll('.summary strong').forEach(x=>x.textContent='—');
 try{
  const data=await load(date);if(token!==requestId)return;
  render(data);q('#labLoading').hidden=true;
  const params=new URLSearchParams(location.search);params.set('date',data.date);
  history.replaceState(null,'',`daily-lab.html?${params}`);
 }catch(e){if(token!==requestId)return;q('#labLoading').textContent='この日の集計を取得できません。日付を選び直すか再読み込みしてください。'}
}
async function boot(){
 try{
  const data=await load();
  try{
   const r=await fetch(`${DATA_ROOT}daily-lab/index.json?t=${Date.now()}`,{cache:'no-store'});
   if(r.ok){const x=await r.json();if(x.schema==='boat-command-daily-lab-history-v1'&&Array.isArray(x.dates)&&Array.isArray(x.venues))archive=x}
  }catch{}
  const dates=[...new Set([data.date,...(archive?.dates||[]).map(x=>x.date)])].filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort().reverse();
  const selector=q('#labDateSelect');selector.innerHTML=dates.map(d=>`<option value="${d}">${d}</option>`).join('');selector.disabled=false;
  selector.onchange=()=>selectDate(selector.value);
  const requested=new URLSearchParams(location.search).get('date');
  if(requested&&dates.includes(requested)&&requested!==data.date){selector.value=requested;await selectDate(requested)}
  else{selector.value=data.date;render(data);q('#labLoading').hidden=true}
 }catch(e){q('#labLoading').innerHTML='<b>DAILY LAB 集計を取得できません</b><span>初回集計待ち、または通信エラーです。時間をおいて再読み込みしてください。</span>'}
}
boot();
})();
