(()=>{
  'use strict';
  const DEPOSIT_KEY='boatCommand.portalDeposits.v1';

  function virtualDepositTotal(){
    try{
      const rows=JSON.parse(localStorage.getItem(DEPOSIT_KEY)||'[]');
      if(!Array.isArray(rows))return 0;
      return rows.reduce((sum,row)=>sum+(Number(row?.amount)||0),0);
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

  // Operational bankroll must match the launcher: deposits + LIVE settlements only.
  // BACKTEST/RETEST performance remains analytics-only and must never change money available for LIVE trial use.
  bankrollSeries=function(){
    const base=Number(store?.startBankroll)||START_BANKROLL;
    let bal=base+virtualDepositTotal();
    const out=[{label:'START + DEPOSIT',value:bal}];
    for(const s of allSessions().filter(s=>!s.retestMode&&s.runType==='LIVE')){
      for(const r of (s.races||[]).filter(x=>x.settled)){
        bal+=settledProfit(r);
        out.push({label:`${s.date.slice(5)} ${r.race}R`,value:bal});
      }
    }
    return out;
  };

  window.bcVirtualDepositTotal=virtualDepositTotal;
  window.addEventListener('storage',e=>{
    if(e.key===DEPOSIT_KEY&&typeof renderAll==='function')renderAll();
  });
  renderAll();
})();
