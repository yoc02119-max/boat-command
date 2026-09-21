// BOAT COMMAND venue operation board v1
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.BOAT_COMMAND_RESEARCH_BOARD_V1=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='VENUE-OPERATION-BOARD-V1';

  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money=v=>Number.isFinite(Number(v))?`¥${Math.round(Number(v)).toLocaleString('ja-JP')}`:'—';
  const signedMoney=v=>Number.isFinite(Number(v))?`${Number(v)>0?'+':''}${money(v)}`:'—';
  function todayJst(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}

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
    return `<div class="rrb-model ${primary?'primary':''}"><span>${esc(label)}</span><div class="rrb-picks">${picks||'<b>—</b>'}</div><small>${shadow.immutableAfterFirstWrite===true&&shadow.resultInput===false?'結果前固定済み':'境界確認中'}</small></div>`;
  }

  function hitText(shadow,result){
    if(!shadow||!result?.trifecta)return null;
    return (shadow.picks||[]).includes(result.trifecta)?'的中':'不的中';
  }

  function tryHtml(row){
    const t=row.tryRow;
    if(!row.selectionReady)return '<div class="rrb-try waiting"><span>AUTO TRY</span><b>選抜待ち</b><small>24場共通10万円 · 実金なし</small></div>';
    if(!t)return '<div class="rrb-try skip"><span>AUTO TRY</span><b>見送り</b><small>予想は成績検証に保存</small></div>';
    const settled=row.result;
    let tail='24場共通10万円口座から仮投入',state='pending';
    if(settled){
      const hit=(t.picks||[]).includes(settled.trifecta);state=hit?'hit':'miss';
      const ret=hit?Number(settled.payout100||0)*(Number(t.stakePerPickYen||500)/100):0;
      tail=`${hit?'✓ 的中':'✕ 不的中'} · ${signedMoney(ret-Number(t.stakeYen||0))}`;
    }
    row.tryState=state;
    return `<div class="rrb-try selected ${state}"><span>AUTO TRY · #${Number(t.rank)||'—'}</span><b>${t.picks.length}点 × ${money(t.stakePerPickYen)} = ${money(t.stakeYen)}</b><small>${tail}</small></div>`;
  }

  function raceCard(row,opts){
    const p=row.program||{},r=row.result;
    const primaryHit=hitText(row.primary,r),baseHit=hitText(row.baseline,r);
    const resultHtml=r
      ?`<div class="rrb-result"><span>RESULT</span><b>${esc(r.trifecta||'—')} · ${money(r.payout100)}</b><small>${esc(opts.venueName||'専用')} ${primaryHit||'—'} / 基準 ${baseHit||'—'}</small></div>`
      :'<div class="rrb-result pending"><span>RESULT</span><b>結果待ち</b><small>予想とTRY判定は結果前に固定</small></div>';
    const tryHit=row.tryRow&&r?(row.tryRow.picks||[]).includes(r.trifecta):null;
    const tryState=!row.tryRow?'none':!r?'pending':tryHit?'hit':'miss';
    const badge=row.tryRow?(tryState==='hit'?'<span class="rrb-try-badge hit">✓ TRY 的中</span>':tryState==='miss'?'<span class="rrb-try-badge miss">✕ TRY 不的中</span>':'<span class="rrb-try-badge pending">TRY 結果待ち</span>'):'';
    return `<article class="rrb-card try-${tryState}" data-race="${row.race}" data-settled="${r?'1':'0'}" data-try="${row.tryRow?'1':'0'}">
      ${badge}
      <header><div><strong>${row.race}R</strong><span>${esc(p.raceType||'')}</span></div><time>締切 ${esc(p.deadline||'—')}</time></header>
      <div class="rrb-boats">${boatRows(p)}</div>
      <div class="rrb-models">
        ${picksHtml(row.primary,`${opts.venueName||'場'}専用 · 30日固定本線`,true)}
        ${picksHtml(row.baseline,'比較用ベースライン')}
      </div>
      ${tryHtml(row)}
      ${resultHtml}
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
    if(empty){
      const noVisible=view==='results'&&![...root.querySelectorAll('.rrb-card')].some(x=>!x.hidden);
      empty.hidden=!noVisible;
      if(noVisible)empty.textContent=state.cancelled?'本日は中止・順延です。確定結果はありません。事前固定予想は検証記録として保持します。':'まだ確定結果はありません。';
    }
    const title=root.querySelector('.rrb-view-title');
    if(title)title.textContent=view==='results'?'確定結果':'12R 運用';
  }

  async function mount(opts){
    const root=typeof opts.root==='string'?document.querySelector(opts.root):opts.root;
    if(!root)throw new Error('OPERATION_BOARD_ROOT_MISSING');
    const readiness=opts.readiness||{},date=readiness.latestDate||opts.date||todayJst();
    const dataRoot=String(opts.dataRoot||'').replace(/\/$/,'');
    if(!dataRoot)throw new Error('OPERATION_BOARD_DATA_ROOT_MISSING');
    const venueCode=String(opts.venueCode||readiness.venueCode||'').padStart(2,'0');
    const modes=opts.modes||{};
    const programOnlyPath=r=>`${dataRoot}/${date}/program/race-${r}.json`;
    const modePath=(dir,r)=>dir?`${dataRoot}/${date}/shadow/${dir}/race-${r}.json`:null;
    const resultPath=r=>`${dataRoot}/${date}/post/race-${r}-result.json`;

    const [portfolio,selection,calendar]=await Promise.all([
      maybe('./shared-try-portfolio-v1.json'),
      maybe(`./live/portfolio/${date}/try-selection-v1.json`),
      maybe('./venue-calendar-v1.json')
    ]);
    const selected=new Map((selection?.selected||[]).filter(x=>String(x.venueCode).padStart(2,'0')===venueCode).map(x=>[Number(x.race),x]));
    const selectionReady=selection?.immutableAfterFirstWrite===true;
    const venueCalendar=calendar?.today===date?calendar?.venues?.[venueCode]:null;
    const cancelled=venueCalendar?.todayCancelled===true;

    root.hidden=false;
    root.innerHTML=`<div class="rrb-shell">
      <div class="rrb-head">
        <div><small>${esc(date)} · ${esc(opts.venueName||'VENUE')}</small><h2><span class="rrb-view-title">12R 運用</span></h2><p>${cancelled?'本日は中止・順延。事前固定予想は検証記録として保持します。':'本線ロジックを30日固定。AUTO TRYだけが共通仮資金を動かします。'}</p></div>
        <div class="rrb-head-stats">
          <span>24場共通 運用資金 <b>${money(portfolio?.confirmedBankrollYen??portfolio?.startingBankrollYen??100000)}</b></span>
          <span>利用可能 <b>${money(portfolio?.availableBankrollYen??portfolio?.bankrollYen??portfolio?.confirmedBankrollYen??100000)}</b></span>
          <span>本日TRY <b>${selected.size}R</b></span>
          <span>FORWARD <b>${Number(readiness.forward?.programOnlyRaces??readiness.forward?.races??0)}/${Number(readiness.forward?.targetReviewRaces||readiness.policy?.minimumProgramOnlyForwardRaces||60)}R</b></span>
        </div>
      </div>
      <div class="rrb-subtabs">
        <button class="rrb-subtab active" type="button" data-view="all">12R</button>
        <button class="rrb-subtab" type="button" data-view="results">結果</button>
        <span class="rrb-safe">RESULT-BLIND · VIRTUAL ONLY</span>
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
      rows.push({race,program,primary,baseline,result,tryRow:selected.get(race)||null,selectionReady});
    }));
    rows.sort((a,b)=>a.race-b.race);

    const grid=root.querySelector('.rrb-grid');
    grid.innerHTML=rows.filter(x=>x.program).map(row=>raceCard(row,opts)).join('');
    root.querySelector('.rrb-loading').hidden=true;
    if(!grid.children.length){
      root.querySelector('.rrb-empty').hidden=false;
      root.querySelector('.rrb-empty').textContent='本日は番組データがありません。非開催または公式番組の公開前です。';
    }

    const state={root,rows,view:'all',cancelled};
    root.querySelectorAll('.rrb-subtab').forEach(btn=>btn.addEventListener('click',()=>setView(state,btn.dataset.view)));
    return Object.freeze({version:VERSION,date,rows,portfolio,selection,setView:view=>setView(state,view)});
  }

  return Object.freeze({version:VERSION,mount});
});
