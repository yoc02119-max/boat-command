(()=>{
  'use strict';

  const STATUS = Object.freeze({
    venue: '蒲郡',
    venueCode: 'GAMAGORI-01',
    appVersion: '0.21.8',
    overall: 84,
    currentTask: '公開版の安全監査 PASS・iPad実機試用待ち',
    nextTask: 'iPad実操作 → READY/WAIT → 予想 → HARD LOCK確認',
    phases: [
      ['LIVE基盤', 100, 'done'],
      ['安全・HARD LOCK', 100, 'done'],
      ['結果取得・自動精算', 96, 'done'],
      ['学習・成績記録', 92, 'active'],
      ['完全自動運用', 84, 'active'],
      ['予想ロジック検証', 58, 'active'],
      ['アプリ内AI', 38, 'active'],
    ],
  });

  function esc(v){
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function injectStyle(){
    if(document.getElementById('bcDevProgressStyleV0217')) return;
    const style = document.createElement('style');
    style.id = 'bcDevProgressStyleV0217';
    style.textContent = `
      .bc-dev-card{grid-column:1/-1}
      .bc-dev-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
      .bc-dev-overall{font-size:28px;font-weight:800;white-space:nowrap}
      .bc-dev-overall small{display:block;font-size:11px;font-weight:600;opacity:.65;text-align:right}
      .bc-dev-progress{height:10px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;margin:14px 0 18px}
      .bc-dev-progress>i{display:block;height:100%;width:var(--p);background:linear-gradient(90deg,#32d583,#5eead4);border-radius:inherit}
      .bc-dev-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px}
      .bc-dev-row{display:grid;grid-template-columns:minmax(120px,1fr) 2fr 48px;align-items:center;gap:10px;font-size:12px}
      .bc-dev-bar{height:7px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}
      .bc-dev-bar>i{display:block;height:100%;width:var(--p);background:linear-gradient(90deg,#60a5fa,#22d3ee);border-radius:inherit}
      .bc-dev-meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}
      .bc-dev-meta>div{padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025)}
      .bc-dev-meta small{display:block;opacity:.6;margin-bottom:4px}
      .bc-dev-meta b{font-size:13px}
      @media(max-width:900px){.bc-dev-grid,.bc-dev-meta{grid-template-columns:1fr}.bc-dev-row{grid-template-columns:110px 1fr 42px}}
    `;
    document.head.appendChild(style);
  }

  function build(){
    if(document.getElementById('bcDevelopmentStatusV0217')) return;
    const home = document.getElementById('home');
    if(!home) return;
    const grid = home.querySelector('.dashboard-grid') || home;
    const card = document.createElement('section');
    card.id = 'bcDevelopmentStatusV0217';
    card.className = 'panel wide bc-dev-card';
    const rows = STATUS.phases.map(([name,pct,state]) => `
      <div class="bc-dev-row" data-state="${esc(state)}">
        <span>${esc(name)}</span>
        <span class="bc-dev-bar" aria-label="${esc(name)} ${pct}%"><i style="--p:${pct}%"></i></span>
        <b>${pct}%</b>
      </div>`).join('');
    card.innerHTML = `
      <div class="bc-dev-head">
        <div><h2>開発進捗 · ${esc(STATUS.venue)}</h2><p>${esc(STATUS.venueCode)} / 早期試用版を最優先</p></div>
        <div class="bc-dev-overall">${STATUS.overall}%<small>v${esc(STATUS.appVersion)}</small></div>
      </div>
      <div class="bc-dev-progress" aria-label="総合完成度 ${STATUS.overall}%"><i style="--p:${STATUS.overall}%"></i></div>
      <div class="bc-dev-grid">${rows}</div>
      <div class="bc-dev-meta">
        <div><small>現在</small><b>${esc(STATUS.currentTask)}</b></div>
        <div><small>NEXT</small><b>${esc(STATUS.nextTask)}</b></div>
      </div>`;
    grid.appendChild(card);
  }

  function boot(){
    injectStyle();
    build();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();

  window.BOAT_COMMAND_DEVELOPMENT_STATUS_V0217 = STATUS;
})();
