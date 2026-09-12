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

  const originalBankrollSeries=bankrollSeries;
  bankrollSeries=function(){
    const rows=originalBankrollSeries();
    const deposits=virtualDepositTotal();
    if(!deposits)return rows;
    return rows.map((point,index)=>({
      ...point,
      value:Number(point.value||0)+deposits,
      label:index===0?'START + DEPOSIT':point.label
    }));
  };

  window.bcVirtualDepositTotal=virtualDepositTotal;
  renderAll();
})();
