// BOAT COMMAND research race board v1
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.BOAT_COMMAND_RESEARCH_BOARD_V1=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='VENUE-RESEARCH-BOARD-V1';

  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const pct=v=>Number.isFinite(Number(v))?`${(Number(v)*100).toFixed(1)}%`:'—';
  const money=v=>Number.isFinite(Number(v))?`¥${Math.round(Number(v)).toLocaleString('ja-JP')}`:'—';

  async function fetchJson(path){
    const sep=path.includes('?')?'&':'?';
    const r=await fetch(`${path}${sep}t=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP_${r.status}`);
    return r.json();
  }
  async function maybe(path){try{return await fetchJson(path)}catch{return null}}

  function boatRows(program){
    return (program?.boats||[]).map(b=>{
      const st=Number.isFinite(Number(b.avgST))?Number(b.avgST).toFixed(2):'—';
      return `<div class="rrb-boat"><span class="rrb-lane lane-${Number(b.lane)}">${Number(b.lane)}</span><b>${esc(b.name||'—')}</b><small>${esc(b.class||'—')} · ST ${st}</small></div>`;
    }).join('');
  }

  function picksHtml(shadow,label,primary=false){
    if(!shadow)return `<div class="rrb-model ${primary?'primary':''}"><span>${esc(label)}</span><b>未固定</b></div>`;
    const picks=(shadow.picks||[]).map(x=>`<i>${esc(x)}</i>`).join('');
    return `<div class="rrb-model ${primary?'primary':''}"><span>${esc(label)}</span><div class="rrb-picks">${picks||'<b>—</b>'}</div><small>${shadow.immutableAfterFirstWrite===true&&shadow.resultInput===false?'結果前固定':'境界確認中'}</small></div>`;
  }

  function hitText(shadow,result){
    if(!shadow||!result?.trifecta)return null;
    return (shadow.picks||[]).includes(result.trifecta)?'的中':'不的中';
  }

  function raceCard(row){
    const p=row.program||{},r=row.result;
    const primaryHit=hitText(row.primary,r),baseHit=hitText(row.baseline,r);
    const resultHtml=r
      ?`<div class="rrb-result"><span>RESULT</span><b>${esc(r.trifecta||'—')} · ${money(r.payout100)}</b><small>戸田 ${primaryHit||'—'} / 基準 ${baseHit||'—'}</small></div>`
      :'<div class="rrb-result pending"><span>RESULT</span><b>結果待ち</b><small>予想は結果前に固定済み</small></div>';
    return `<article class="rrb-card" data-race="${row.race}" data-settled="${r?'1':'0'}">
      <header><div><strong>${row.race}R</strong><span>${esc(p.raceType||'')}</span></div><time>締切 ${esc(p.deadline||'—')}</time></header>
      <div class="rrb-boats">${boatRows(p)}</div>
      <div class="rrb-models">
        ${picksHtml(row.primary,'戸田専用 SHADOW',true)}
        ${picksHtml(row.baseline,'基準比較')}
      </div>
      ${resultHtml}
      <button class="rrb-lock" type="button" disabled>TRY LOCK · 検証中</button>
    </article>`;
  }

  function setView(state,view){
    state.view=view;
    const root=state.root;
    root.querySelectorAll('.rrb-subtab').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
    root.querySelectorAll('.rrb-card').forEach(card=>{
      card.hidden=view==='results'&&card.dataset.settled!=='1';
    });
    const empty=root.querySelector('.rrb-empty');
    if(empty)empty.hidden=!(view==='results'&&![...root.querySelectorAll('.rrb-card')].some(x=>!x.hidden));
    const title=root.querySelector('.rrb-view-title');
    if(title)title.textContent=view==='results'?'確定結果':'12R SHADOW';
  }

  async function mount(opts){
    const root=typeof opts.root==='string'?document.querySelector(opts.root):opts.root;
    if(!root)throw new Error('RESEARCH_BOARD_ROOT_MISSING');
    const readiness=opts.readiness||{},date=readiness.latestDate||opts.date;
    if(!date)throw new Error('RESEARCH_BOARD_DATE_MISSING');
    const dataRoot=String(opts.dataRoot||'').replace(/\/$/,'');
    if(!dataRoot)throw new Error('RESEARCH_BOARD_DATA_ROOT_MISSING');
    const modes=opts.modes||{};
    const programOnlyPath=r=>`${dataRoot}/${date}/program/race-${r}.json`;
    const modePath=(dir,r)=>dir?`${dataRoot}/${date}/shadow/${dir}/race-${r}.json`:null;
    const resultPath=r=>`${dataRoot}/${date}/post/race-${r}-result.json`;

    root.hidden=false;
    root.innerHTML=`<div class="rrb-shell">
      <div class="rrb-head">
        <div><small>${esc(date)} · ${esc(opts.venueName||'VENUE')}</small><h2><span class="rrb-view-title">12R SHADOW</span></h2><p>結果前に固定した研究予想です。TRY・資金連動は無効です。</p></div>
        <div class="rrb-head-stats">
          <span>HISTORY <b>${Number(readiness.history?.rows||0).toLocaleString('ja-JP')}R</b></span>
          <span>FORWARD <b>${Number(readiness.forward?.programOnlyRaces??readiness.forward?.races??0)}/${Number(readiness.forward?.targetReviewRaces||60)}R</b></span>
        </div>
      </div>
      <div class="rrb-subtabs">
        <button class="rrb-subtab active" type="button" data-view="all">12R</button>
        <button class="rrb-subtab" type="button" data-view="results">結果</button>
        <span class="rrb-safe">RESULT-BLIND · CASH NEUTRAL</span>
      </div>
      <div class="rrb-loading">12Rを読み込み中…</div>
      <div class="rrb-grid"></div>
      <div class="rrb-empty" hidden>まだ確定結果はありません。</div>
    </div>`;

    const rows=[];
    const shouldLoadResults=Number(readiness.current?.postResults||0)>0;
    await Promise.all(Array.from({length:12},(_,i)=>i+1).map(async race=>{
      const [program,primary,baseline,result]=await Promise.all([
        maybe(programOnlyPath(race)),
        maybe(modePath(modes.primaryDir||'program-only',race)),
        maybe(modePath(modes.baselineDir||'class-baseline',race)),
        shouldLoadResults?maybe(resultPath(race)):Promise.resolve(null)
      ]);
      rows.push({race,program,primary,baseline,result});
    }));
    rows.sort((a,b)=>a.race-b.race);

    const grid=root.querySelector('.rrb-grid');
    grid.innerHTML=rows.filter(x=>x.program).map(raceCard).join('');
    root.querySelector('.rrb-loading').hidden=true;
    if(!grid.children.length){
      root.querySelector('.rrb-empty').hidden=false;
      root.querySelector('.rrb-empty').textContent='番組データ待ちです。';
    }

    const state={root,rows,view:'all'};
    root.querySelectorAll('.rrb-subtab').forEach(btn=>btn.addEventListener('click',()=>setView(state,btn.dataset.view)));
    return Object.freeze({version:VERSION,date,rows,setView:view=>setView(state,view)});
  }

  return Object.freeze({version:VERSION,mount});
});
