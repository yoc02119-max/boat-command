#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const model=require('../gamagori-main-model-v0320.js');
const input=process.argv[2]||path.join(__dirname,'..','gamagori-main-history-v0320.json');
const output=process.argv[3]||path.join(__dirname,'..','gamagori-main-backtest-v0320.json');
const db=JSON.parse(fs.readFileSync(input,'utf8'));
const rows=[...(db.races||[])].sort((a,b)=>String(a.d).localeCompare(String(b.d))||Number(a.r)-Number(b.r));
const strength={A1:4,A2:3,B1:2,B2:1};
function baseline(target,history){
  const scores=new Map();
  for(const h of history){let sim=.06;if(Number(h.r)===Number(target.r))sim+=.18;if(h.c.join('-')===target.c.join('-'))sim+=1.25;let same=0;for(let i=0;i<6;i++)if(h.c[i]===target.c[i])same++;sim+=same*.34;if(same===6)sim+=2.5;scores.set(h.o,(scores.get(h.o)||0)+sim)}
  if(scores.size)return [...scores].sort((a,b)=>b[1]-a[1]).slice(0,4).map(x=>x[0]);
  const lanes=[1,2,3,4,5,6].sort((a,b)=>((strength[target.c[b-1]]||1)+(b===1?1.3:0))-((strength[target.c[a-1]]||1)+(a===1?1.3:0))),a=lanes.slice(0,4),out=[];
  for(const x of a)for(const y of a)for(const z of lanes)if(x!==y&&x!==z&&y!==z){const p=`${x}-${y}-${z}`;if(!out.includes(p))out.push(p);if(out.length===4)return out}return out;
}
function metrics(records,key){
  const n=records.length,hits=records.filter(x=>x[key].includes(x.actual)).length,points=records.reduce((s,x)=>s+x[key].length,0);
  const stake=points*100,returns=records.reduce((s,x)=>s+(x[key].includes(x.actual)?Number(x.payout||0):0),0);
  const first=records.filter(x=>x[key][0]===x.actual).length;
  const lane1=records.reduce((s,x)=>s+x[key].filter(p=>p.startsWith('1-')).length,0)/points;
  return {races:n,averagePoints:points/n,hits,hitRate:hits/n,top1Hits:first,top1Rate:first/n,stake,returns,roi:returns/stake,lane1PickShare:lane1};
}
const records=[];let history=[];let day=null,dayRows=[];
function evaluateDay(){if(!dayRows.length)return;if(history.length>=120){for(const t of dayRows){const dist=model.probabilities({classes:t.c,race:t.r,raceType:t.t},history,{targetDate:t.d}),all={};for(let n=1;n<=6;n++)all[`candidate${n}`]=model.select(dist,{count:n}).map(x=>x.order);const variableCount=model.variableCount(dist,{maxCount:6});records.push({id:t.id,date:t.d,race:t.r,actual:t.o,payout:t.p,baseline:baseline(t,history),candidate:all.candidate4,...all,variableCount,variable:all[`candidate${variableCount}`],probabilitySum:dist.sum})}}history=history.concat(dayRows);dayRows=[]}
for(const row of rows){if(day!==null&&row.d!==day)evaluateDay();day=row.d;dayRows.push(row)}evaluateDay();
const baselineStats=metrics(records,'baseline'),candidateStats=metrics(records,'candidate');
const recentStart=rows.length?rows.at(-1).d:null,recent=records.slice(-360);
const holdout2026=records.filter(x=>String(x.date).startsWith('2026-'));
const holdoutBaseline=metrics(holdout2026,'baseline'),holdoutCandidate=metrics(holdout2026,'candidate');
const holdoutDelta={hitRate:holdoutCandidate.hitRate-holdoutBaseline.hitRate,roi:holdoutCandidate.roi-holdoutBaseline.roi,top1Rate:holdoutCandidate.top1Rate-holdoutBaseline.top1Rate,lane1PickShare:holdoutCandidate.lane1PickShare-holdoutBaseline.lane1PickShare};
const pointCountComparison=Object.fromEntries(Array.from({length:6},(_,i)=>[String(i+1),metrics(records,`candidate${i+1}`)]));
const report={schema:'boat-command-main-backtest-v1',model:model.version,source:path.basename(input),strictWalkForward:true,sameDayRowsExcluded:true,resultBlockedUntilPrediction:true,records:records.length,baseline:baselineStats,candidate:candidateStats,pointCountComparison,variable:metrics(records,'variable'),delta:{hitRate:candidateStats.hitRate-baselineStats.hitRate,roi:candidateStats.roi-baselineStats.roi,top1Rate:candidateStats.top1Rate-baselineStats.top1Rate,lane1PickShare:candidateStats.lane1PickShare-baselineStats.lane1PickShare},holdout2026:{role:'UNTOUCHED_TIME_ORDERED_HOLDOUT',records:holdout2026.length,baseline:holdoutBaseline,candidate:holdoutCandidate,delta:holdoutDelta},recent360:{baseline:metrics(recent,'baseline'),candidate:metrics(recent,'candidate'),variable:metrics(recent,'variable')},probabilityAudit:{orders:model.orders.length,minSum:Math.min(...records.map(x=>x.probabilitySum)),maxSum:Math.max(...records.map(x=>x.probabilitySum)),tolerance:1e-12,pass:records.every(x=>Math.abs(x.probabilitySum-1)<=1e-12)},promotionEligible:false,notes:['2025 is the design/training period; 2026 is the untouched time-ordered promotion holdout.','Expected-value mode requires a complete PRE-RACE odds snapshot; no historical odds are fabricated.']};
report.promotionEligible=report.probabilityAudit.pass&&report.holdout2026.delta.hitRate>0&&report.holdout2026.delta.roi>=0;
fs.writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
