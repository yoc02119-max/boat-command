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

  function virtualBankrollNow(){
    const base=typeof START_BANKROLL==='number'?START_BANKROLL:100000;
    let bal=base+virtualDepositTotal();
    for(const s of liveSessions()){
      for(const r of (s.races||[])){
        if(r?.settled)bal+=settledProfit(r);
        else if(r?.locked)bal-=Number(r?.stake)||0;
      }
    }
    return bal;
  }

  // Virtual-cash ledger: HARD LOCK reserves the simulated stake immediately.
  // Settlement then releases the official simulated return. Real money is never touched.
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
    return out;
  };

  window.bcVirtualBankrollNow=virtualBankrollNow;
  window.bcVirtualDepositTotal=virtualDepositTotal;
  window.addEventListener('storage',e=>{
    if(e.key===DEPOSIT_KEY&&typeof renderAll==='function')renderAll();
  });
  if(typeof renderAll==='function')renderAll();
})();
