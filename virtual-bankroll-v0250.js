// BOAT COMMAND GAMAGORI virtual bankroll v0.35.17
// TRY-only simulated bankroll. MAIN predictions are evaluation-only and never move funds.
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

  function virtualTryLedger(){
    let data=null;
    try{data=window.BOAT_COMMAND_FORWARD_V0347?.state||null}catch(_){}
    const empty={
      settledStakeYen:0,returnYen:0,settledProfitYen:0,committedStakeYen:0,pendingStakeYen:0,
      todayCommittedStakeYen:0,todayPendingStakeYen:0,todaySettledStakeYen:0,todayReturnYen:0,
      todayProfitYen:0,todayHits:0,todaySettledRaces:0,todayPendingRaces:0,currentTryRaces:[]
    };
    if(!data||data.shadowOnly!==true||data.liveBettingEnabled!==false)return empty;
    const methods=Object.values(data.methods||{}).filter(Boolean);
    let settledStakeYen=0,returnYen=0,committedStakeYen=0,pendingStakeYen=0;
    for(const m of methods){
      settledStakeYen+=Number(m?.stakeYen)||0;
      returnYen+=Number(m?.returnYen)||0;
      const rows=Array.isArray(m?.todayResults)?m.todayResults:[];
      const derivedCommitted=rows.reduce((s,r)=>s+(Number(r?.stakeYen)||0),0);
      const derivedPending=rows.filter(r=>!r?.settled).reduce((s,r)=>s+(Number(r?.stakeYen)||0),0);
      committedStakeYen+=Number.isFinite(Number(m?.committedStakeYen))?Number(m.committedStakeYen):derivedCommitted;
      pendingStakeYen+=Number.isFinite(Number(m?.pendingStakeYen))?Number(m.pendingStakeYen):derivedPending;
    }
    const todayRows=methods.flatMap(m=>(m?.todayResults||[]).map(r=>({...r,method:m.method})));
    const todaySettled=todayRows.filter(r=>r?.settled);
    const todayPending=todayRows.filter(r=>!r?.settled);
    const todayCommittedStakeYen=todayRows.reduce((s,r)=>s+(Number(r?.stakeYen)||0),0);
    const todayPendingStakeYen=todayPending.reduce((s,r)=>s+(Number(r?.stakeYen)||0),0);
    const todaySettledStakeYen=todaySettled.reduce((s,r)=>s+(Number(r?.stakeYen)||0),0);
    const todayReturnYen=todaySettled.reduce((s,r)=>s+(Number(r?.returnYen)||0),0);
    const currentTryRaces=[...new Set(methods.flatMap(m=>(m?.currentTry||[]).map(r=>Number(r?.race)).filter(Number.isFinite)))];
    return {
      settledStakeYen,returnYen,settledProfitYen:returnYen-settledStakeYen,
      committedStakeYen,pendingStakeYen,
      todayCommittedStakeYen,todayPendingStakeYen,todaySettledStakeYen,todayReturnYen,
      todayProfitYen:todayReturnYen-todaySettledStakeYen,
      todayHits:todaySettled.filter(r=>r?.hit).length,
      todaySettledRaces:todaySettled.length,
      todayPendingRaces:todayPending.length,
      currentTryRaces
    };
  }

  function virtualBankrollNow(){
    const base=typeof START_BANKROLL==='number'?START_BANKROLL:1000000;
    const t=virtualTryLedger();
    return base+t.settledProfitYen-t.pendingStakeYen;
  }

  // Only SHADOW TRY moves the simulated bankroll.
  // MAIN predictions/results stay available for accuracy evaluation but are cash-neutral.
  window.bankrollSeries=function(){
    const base=typeof START_BANKROLL==='number'?START_BANKROLL:1000000;
    let bal=base;
    const out=[{label:'SHARED START',value:bal}];
    const t=virtualTryLedger();
    if(t.settledStakeYen>0){
      bal+=t.settledProfitYen;
      out.push({label:'TRY 精算',value:bal});
    }
    if(t.pendingStakeYen>0){
      bal-=t.pendingStakeYen;
      out.push({label:'TRY 投入中',value:bal});
    }
    return out;
  };

  window.bcVirtualTryLedger=virtualTryLedger;
  window.bcVirtualBankrollNow=virtualBankrollNow;
  window.bcVirtualDepositTotal=virtualDepositTotal;
  window.BOAT_COMMAND_VIRTUAL_BANKROLL_V0250=Object.freeze({
    version:'0.35.17',fundingScope:'SHARED_24_VENUES_VIRTUAL',mainPredictionCashNeutral:true,fixedStartBankrollYen:1000000,manualDepositsExcluded:true,realMoney:false
  });
  window.addEventListener('storage',e=>{
    if(e.key===DEPOSIT_KEY&&typeof renderAll==='function')renderAll();
  });
  if(typeof renderAll==='function')renderAll();
})();
