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

  function liveSessions(){
    return (typeof allSessions==='function'
      ?allSessions()
      :(typeof store!=='undefined'?Object.values(store?.sessions||{}):[]))
      .filter(s=>s&&!s.retestMode&&s.runType==='LIVE');
  }

  function virtualTryLedger(){
    let data=null;
    try{data=window.BOAT_COMMAND_FORWARD_V0347?.state||null}catch(_){}
    const empty={settledStakeYen:0,returnYen:0,settledProfitYen:0,committedStakeYen:0,pendingStakeYen:0,todayCommittedStakeYen:0,todayPendingStakeYen:0,todaySettledStakeYen:0,todayReturnYen:0,todayProfitYen:0,todayHits:0,todaySettledRaces:0,todayPendingRaces:0,currentTryRaces:[]};
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
    const base=typeof START_BANKROLL==='number'?START_BANKROLL:100000;
    let bal=base+virtualDepositTotal();
    for(const s of liveSessions()){
      for(const r of (s.races||[])){
        if(r?.settled)bal+=settledProfit(r);
        else if(r?.locked)bal-=Number(r?.stake)||0;
      }
    }
    const t=virtualTryLedger();
    bal+=t.settledProfitYen-t.pendingStakeYen;
    return bal;
  }

  // Virtual-cash ledger: official MAIN locks and SHADOW TRY commitments are simulated only.
  // TRY commitment is deducted immediately; official POST-RACE return is added after settlement.
  window.bankrollSeries=function(){
    const base=typeof START_BANKROLL==='number'?START_BANKROLL:100000;
    let bal=base+virtualDepositTotal();
    const out=[{label:'START + DEPOSIT',value:bal}];
    const events=[];
    for(const s of liveSessions()){
      for(const r of (s.races||[])){
        const stake=Number(r?.stake)||0;
        const ret=Number(r?.returnAmount)||0;
        if(r?.locked&&stake>0&&r?.lockedAt)events.push({at:Date.parse(r.lockedAt)||0,label:`${String(s.date||'').slice(5)} ${r.race}R LOCK`,delta:-stake});
        if(r?.settled&&r?.settledAt)events.push({at:Date.parse(r.settledAt)||0,label:`${String(s.date||'').slice(5)} ${r.race}R RESULT`,delta:ret});
        else if(r?.settled&&!r?.lockedAt)events.push({at:Date.parse(r.settledAt||'')||0,label:`${String(s.date||'').slice(5)} ${r.race}R`,delta:settledProfit(r)});
      }
    }
    events.sort((a,b)=>a.at-b.at);
    for(const e of events){bal+=e.delta;out.push({label:e.label,value:bal});}
    const t=virtualTryLedger();
    if(t.settledStakeYen>0){
      bal+=t.settledProfitYen;
      out.push({label:'SHADOW TRY 精算',value:bal});
    }
    if(t.pendingStakeYen>0){
      bal-=t.pendingStakeYen;
      out.push({label:'SHADOW TRY 投入中',value:bal});
    }
    return out;
  };

  window.bcVirtualTryLedger=virtualTryLedger;
  window.bcVirtualBankrollNow=virtualBankrollNow;
  window.bcVirtualDepositTotal=virtualDepositTotal;
  window.addEventListener('storage',e=>{
    if(e.key===DEPOSIT_KEY&&typeof renderAll==='function')renderAll();
  });
  if(typeof renderAll==='function')renderAll();
})();
