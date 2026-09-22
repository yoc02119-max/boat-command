// BOAT COMMAND DAILY LAB v1
(function(){
'use strict';
const LABELS={BASE4:'現行4点',RANK6:'順位6点',RANK8:'順位8点',HEAD6:'1着筋拡張',SECOND6:'2着筋拡張',THIRD6:'3着筋拡張'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=v=>Number.isFinite(Number(v))?`${(Number(v)*100).toFixed(1)}%`:'—';
const signed=n=>`${Number(n)>0?'+':''}${Number(n)||0}`;
const q=s=>document.querySelector(s);

async function load(){
 const r=await fetch(`./daily-lab-v1.json?t=${Date.now()}`,{cache:'no-store'});
 if(!r.ok)throw new Error('DAILY_LAB_REPORT_WAIT');
 const x=await r.json();
 if(x?.schema!=='boat-command-daily-lab-v1'||x?.totals?.venues!==24||!Array.isArray(x?.venues)||x.venues.length!==24)throw new Error('DAILY_LAB_REPORT_INVALID');
 return x;
}
function metric(id,value,sub){const el=q(id);if(el)el.innerHTML=`<strong>${esc(value)}</strong><small>${esc(sub)}</small>`}

function venueCard(v){
 const base=v.summary?.BASE4||{},r6=v.summary?.RANK6||{},r8=v.summary?.RANK8||{};
 const d6=(Number(r6.hits)||0)-(Number(base.hits)||0),d8=(Number(r8.hits)||0)-(Number(base.hits)||0);
 const obs=(v.observations||[])[0];
 const obsText=v.evaluated?`${LABELS[obs?.key]||obs?.key||'—'} ${signed(obs?.deltaHits||0)}的中`:'結果待ち';
 return `<button class="lab-venue ${v.captured?'has-data':''}" data-code="${esc(v.code)}">
   <div class="lab-venue-top"><span>${esc(v.code)}</span><b>${esc(v.name)}</b><em>${v.captured?`${v.captured}/12固定`:'未固定'}</em></div>
   <div class="lab-venue-kpis">
    <div><small>評価</small><strong>${Number(v.evaluated)||0}R</strong></div>
    <div><small>BASE4</small><strong>${Number(base.hits)||0}的中</strong></div>
    <div><small>RANK6</small><strong class="${d6>0?'up':''}">${signed(d6)}</strong></div>
    <div><small>RANK8</small><strong class="${d8>0?'up':''}">${signed(d8)}</strong></div>
   </div>
   <div class="lab-observe"><span>今日の観察</span><b>${esc(obsText)}</b></div>
  </button>`;
}
function variantRow(v,key){
 const s=v.summary?.[key]||{},delta=(Number(s.hits)||0)-(Number(v.summary?.BASE4?.hits)||0);
 return `<div class="lab-variant-row">
  <div><b>${esc(LABELS[key]||key)}</b><small>${key==='BASE4'?'現行基準':key==='RANK8'?'4点追加':'2点追加'}</small></div>
  <strong>${Number(s.hits)||0}/${Number(s.races)||0}</strong>
  <span>${pct(s.hitRate)}</span>
  <em class="${delta>0?'up':''}">${key==='BASE4'?'基準':`${signed(delta)}的中`}</em>
  <i>${key==='BASE4'?'—':`${Number(s.addedHits)||0}R救済`}</i>
 </div>`;
}
function pickChips(xs,cls=''){return (xs||[]).map(x=>`<i class="${cls}">${esc(x)}</i>`).join('')}
function raceCard(r){
 const settled=r.status==='SETTLED';
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
   <header><div><strong>${Number(r.race)}R</strong><span>${settled?`結果 ${esc(r.actual)}`:'結果待ち'}</span></div><em>${settled&&r.actualRank?`実着順ランク #${r.actualRank}`:'PRE-RACE固定'}</em></header>
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
 q('#labDetailMeta').textContent=`${data.date} · ${v.captured}/12固定 · ${v.evaluated}R評価 · 自動昇格なし`;
 q('#labVariantTable').innerHTML=['BASE4','RANK6','RANK8','HEAD6','SECOND6','THIRD6'].map(k=>variantRow(v,k)).join('');
 q('#labRaceGrid').innerHTML=v.races.length?v.races.map(raceCard).join(''):'<div class="lab-empty">今日はまだPoint Expansionの固定データがありません。</div>';
 document.querySelectorAll('.lab-venue').forEach(x=>x.classList.toggle('selected',x.dataset.code===v.code));
 history.replaceState(null,'',`daily-lab.html?venue=${encodeURIComponent(v.code)}`);
 box.scrollIntoView({behavior:'smooth',block:'start'});
}
function render(data){
 q('#labDate').textContent=data.date;
 metric('#labVenues',`${data.totals.venuesCaptured}/24場`,'本日固定あり');
 metric('#labCaptured',`${data.totals.capturedRaces}R`,'結果前固定');
 metric('#labEvaluated',`${data.totals.evaluatedRaces}R`,'結果照合済み');
 metric('#labBaseHits',`${data.totals.baseHits}的中`,'現行BASE4');
 metric('#labRank6',signed(data.totals.rank6Hits-data.totals.baseHits),'RANK6追加差');
 metric('#labRank8',signed(data.totals.rank8Hits-data.totals.baseHits),'RANK8追加差');
 q('#labVenueGrid').innerHTML=data.venues.map(venueCard).join('');
 q('#labVenueGrid').addEventListener('click',e=>{const b=e.target.closest('.lab-venue');if(b)renderDetail(data,b.dataset.code)});
 const initial=new URLSearchParams(location.search).get('venue');
 if(initial&&data.venues.some(v=>v.code===initial))renderDetail(data,initial);
}
async function boot(){
 try{const data=await load();render(data);q('#labLoading').hidden=true}
 catch(e){q('#labLoading').innerHTML='<b>DAILY LAB 集計待ち</b><span>初回サマリー生成後に24場の検証結果が表示されます。既存の本番予想には影響しません。</span>'}
}
boot();
})();