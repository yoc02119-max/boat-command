(()=>{
  'use strict';
  const DEPOSIT_KEY='boatCommand.portalDeposits.v1';

  function virtualDepositTotal(){
    try{
      const rows=JSON.parse(localStorage.getItem(DEPOSIT_KEY)||'[]');
      if(!Array.isArray(rows))return 0;
      return rows.reduce((sum,row)=>sum+(Number(row?.amount)||0),0;
    }catch(_){
      return 0;
    }
  }

  function settledProfit(r){
    const saved=Number(r?.profit);
    if(Number.isFinite(saved))return saved;
    const returned=Number(r?.returnAmount)||0;
    const stake=Number(r?.stake)||0;
    return returned-stake;
  }

  // Operational bankroll must match the launcher exactly:
  // fixed trial base + portal deposits + LIVE settlements only.
  // BACKTEST/RETEST remains analytics-only.
  window.bankrollSeries=function(){
    const base=typeof START_BANKROLL==='number'?START_BANKROLL:100000;
    let bal=base+virtualDepositTotal();
    const out=[{label:'START + DEPOSIT',value:bal}];
    const sessions=typeof allSessions==='function'
      ?allSessions()
      :(typeof store!=='undefined'?Object.values(store?.sessions||{}):[]);
    for(const s of sessions.filter(s=>s&&!s.retestMode&&s.runType==='LIVE')){
      for(const r of (s.races||[]).filter(x=>x.settled)){
        bal+=settledProfit(r);
        out.push({label:`${String(s.date||'').slice(5)} ${r.race}R`,value:bal});
      }
    }
    return out;
  };

  window.bcVirtualDepositTotal=virtualDepositTotal;
  window.addEventListener('storage',e=>{
    if(e.key===DEPOSIT_KEY&&typeof renderAll==='function')renderAll();
  });
  if(typeof renderAll==='function')renderAll();
})();
