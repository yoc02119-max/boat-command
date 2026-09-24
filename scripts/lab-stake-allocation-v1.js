'use strict';

// Research-only staking calculation. Never submit tickets or read race results here.
const validPick=x=>typeof x==='string'&&/^[1-6]-[1-6]-[1-6]$/.test(x)&&new Set(x.split('-')).size===3;

function allocate({picks,odds,budgetYen,unitYen=100,safetyRate=0.10}){
 if(!Array.isArray(picks)||!picks.length||picks.length>8||new Set(picks).size!==picks.length||picks.some(x=>!validPick(x)))throw Error('INVALID_PICKS');
 if(!Number.isSafeInteger(unitYen)||unitYen<100||unitYen%100!==0||!Number.isSafeInteger(budgetYen)||budgetYen<0||budgetYen%unitYen!==0)throw Error('INVALID_BUDGET');
 if(typeof safetyRate!=='number'||!Number.isFinite(safetyRate)||safetyRate<0||safetyRate>=1)throw Error('INVALID_SAFETY_RATE');
 const prices=picks.map(p=>Number(odds?.[p]));
 if(prices.some(x=>!Number.isFinite(x)||x<=1))return {status:'SKIP',reason:'MISSING_OR_INVALID_ODDS',budgetYen};
 if(budgetYen<picks.length*unitYen)return {status:'SKIP',reason:'INSUFFICIENT_BUDGET',budgetYen};
 const units=Array(picks.length).fill(1),remaining=budgetYen/unitYen-picks.length;
 // Equalize projected returns in 100-yen steps. Fixed input order resolves ties.
 for(let n=0;n<remaining;n++){
  let lowest=0;
  for(let i=1;i<units.length;i++)if(units[i]*prices[i]<units[lowest]*prices[lowest])lowest=i;
  units[lowest]++;
 }
 const entries=picks.map((pick,i)=>{
  const stakeYen=units[i]*unitYen;
  const grossYen=Math.floor(stakeYen*prices[i]);
  const bufferedGrossYen=Math.floor(stakeYen*prices[i]*(1-safetyRate));
  return {pick,odds:prices[i],stakeYen,grossYen,profitYen:grossYen-budgetYen,bufferedProfitYen:bufferedGrossYen-budgetYen};
 });
 const worstProfitYen=Math.min(...entries.map(x=>x.profitYen));
 const worstBufferedProfitYen=Math.min(...entries.map(x=>x.bufferedProfitYen));
 return {status:worstBufferedProfitYen>0?'FEASIBLE':'NOT_FEASIBLE',budgetYen,unitYen,safetyRate,worstProfitYen,worstBufferedProfitYen,entries};
}

module.exports={allocate};
