(()=>{
  'use strict';

  const VERSION='GAMAGORI-VIRTUAL-BANKROLL-SYNC-V0.25.0';
  const DEPOSIT_KEY='boatCommand.portalDeposits.v1';

  function deposits(){
    try{
      const x=JSON.parse(localStorage.getItem(DEPOSIT_KEY)||'[]');
      return Array.isArray(x)?x:[];
    }catch{return []}
  }

  function depositTotal(){
    return deposits().reduce((sum,x)=>sum+(Number(x?.amount)||0),0);
  }

  const original=typeof window.bankrollSeries==='function'?window.bankrollSeries:null;
  if(!original){
    window.BOAT_COMMAND_VIRTUAL_BANKROLL_SYNC_V0250=Object.freeze({version:VERSION,ok:false,error:'BANKROLL_SERIES_MISSING'});
    return;
  }

  window.bankrollSeries=function(){
    const series=original();
    const added=depositTotal();
    if(!added||!Array.isArray(series))return series;
    return series.map((p,i)=>({
      ...p,
      value:(Number(p?.value)||0)+added,
      label:i===0?'START + 仮入金':p.label
    }));
  };

  window.BOAT_COMMAND_VIRTUAL_BANKROLL_SYNC_V0250=Object.freeze({
    version:VERSION,
    ok:true,
    depositKey:DEPOSIT_KEY,
    deposited:depositTotal(),
    affectsProfit:false,
    affectsRoi:false
  });

  try{if(typeof window.renderAll==='function')window.renderAll()}catch(e){console.error('VIRTUAL_BANKROLL_SYNC_RENDER_FAIL',e)}
})();
