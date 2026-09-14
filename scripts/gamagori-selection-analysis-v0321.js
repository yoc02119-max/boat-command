#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const model=require('../gamagori-main-model-v0320.js');
const input=process.argv[2]||path.join(__dirname,'..','gamagori-main-history-v0320.json');
const output=process.argv[3]||path.join(__dirname,'..','gamagori-selection-analysis-v0321.json');
const source=JSON.parse(fs.readFileSync(input,'utf8'));
const rows=[...(source.races||[])].sort((a,b)=>String(a.d).localeCompare(String(b.d))||Number(a.r)-Number(b.r));

function quantile(values,q){const a=[...values].sort((x,y)=>x-y);return a[Math.max(0,Math.min(a.length-1,Math.floor((a.length-1)*q)))]}
function stats(records,predicate=()=>true){
  const selected=records.filter(predicate),hits=selected.filter(x=>x.hit).length;
  const returned=selected.reduce((s,x)=>s+(x.hit?Number(x.payout||0):0),0);
  return {races:selected.length,coverage:records.length?selected.length/records.length:0,hits,hitRate:selected.length?hits/selected.length:null,analyticalRoi:selected.length?returned/(selected.length*400):null};
}
function makeRecord(t,history){
  const dist=model.probabilities({classes:t.c,race:t.r,raceType:t.t},history,{targetDate:t.d});
  const picks=model.select(dist,{count:4}).map(x=>x.order),variableCount=model.variableCount(dist,{maxCount:6});
  const probs=dist.rows.map(x=>x.probability),entropy=-probs.reduce((s,p)=>s+(p? p*Math.log(p):0),0)/Math.log(120);
  return {id:t.id,date:t.d,race:Number(t.r),classes:[...t.c],raceType:t.t||'',actual:t.o,payout:Number(t.p)||0,
    picks,hit:picks.includes(t.o),variableCount,top1:probs[0],top4:probs.slice(0,4).reduce((a,b)=>a+b,0),
    margin45:probs[3]-probs[4],entropy,nearestDistance:dist.nearestDistance,
    lane1Class:t.c[0],balance:dist.features.balance,raceBucket:dist.features.raceBucket,typeGroup:dist.features.typeGroup};
}

const records=[];let history=[],day=null,dayRows=[];
function evaluateDay(){
  if(!dayRows.length)return;
  if(history.length>=120)for(const t of dayRows)records.push(makeRecord(t,history));
  history=history.concat(dayRows);dayRows=[];
}
for(const row of rows){if(day!==null&&row.d!==day)evaluateDay();day=row.d;dayRows.push(row)}evaluateDay();

const design=records.filter(x=>x.date<'2026-01-01'),holdout=records.filter(x=>x.date>='2026-01-01');
const definitions=[{name:'ALL',test:()=>true}];
for(const field of ['top1','top4','margin45']){
  for(const q of [.25,.5,.75]){const threshold=quantile(design.map(x=>x[field]),q);definitions.push({name:`${field.toUpperCase()}_Q${q*100}_UP`,field,direction:'gte',threshold,test:x=>x[field]>=threshold})}
}
for(const field of ['entropy','nearestDistance']){
  for(const q of [.25,.5,.75]){const threshold=quantile(design.map(x=>x[field]),q);definitions.push({name:`${field.toUpperCase()}_Q${q*100}_DOWN`,field,direction:'lte',threshold,test:x=>x[field]<=threshold})}
}
for(const value of ['A1','A2','B1','B2'])definitions.push({name:`LANE1_${value}`,field:'lane1Class',value,test:x=>x.lane1Class===value});
for(const value of ['EARLY','MIDDLE','LATE'])definitions.push({name:`RACE_${value}`,field:'raceBucket',value,test:x=>x.raceBucket===value});
for(const value of ['QUALIFY','GENERAL','SPECIAL','SEMI','FINAL'])definitions.push({name:`TYPE_${value}`,field:'typeGroup',value,test:x=>x.typeGroup===value});
for(const n of [4,5])definitions.push({name:`VARIABLE_LE_${n}`,field:'variableCount',value:n,test:x=>x.variableCount<=n});

const comparisons=definitions.map(g=>({name:g.name,field:g.field||null,direction:g.direction||null,threshold:g.threshold??null,value:g.value??null,design:stats(design,g.test),holdout:stats(holdout,g.test),recent360:stats(records.slice(-360),g.test)}));
const eligible=comparisons.filter(x=>x.name!=='ALL'&&x.design.coverage>=.25).sort((a,b)=>(b.design.analyticalRoi-a.design.analyticalRoi)||(b.design.hitRate-a.design.hitRate));
const selected=eligible[0]||comparisons[0];
const confidenceSelected=[...eligible].sort((a,b)=>(b.design.hitRate-a.design.hitRate)||(b.design.analyticalRoi-a.design.analyticalRoi))[0]||comparisons[0];
const baseline=comparisons.find(x=>x.name==='ALL');
const report={schema:'boat-command-selection-analysis-v1',model:model.version,source:path.basename(input),
  policy:'Gate definitions use PRE-RACE features only. Thresholds and selection use 2025 design rows; 2026 remains untouched until evaluation.',
  strictWalkForward:true,sameDayRowsExcluded:true,designPeriod:'through 2025-12-31',holdoutPeriod:'2026-01-01 onward',
  records:records.length,designRows:design.length,holdoutRows:holdout.length,baseline,selected,confidenceSelected,
  holdoutImprovement:{hitRate:selected.holdout.hitRate-baseline.holdout.hitRate,analyticalRoi:selected.holdout.analyticalRoi-baseline.holdout.analyticalRoi,coverage:selected.holdout.coverage},
  recentMissBreakdown:{
    rows:records.slice(-360).length,misses:records.slice(-360).filter(x=>!x.hit).length,
    byLane1Class:Object.fromEntries(['A1','A2','B1','B2'].map(v=>[v,stats(records.slice(-360),x=>x.lane1Class===v)])),
    byRaceBucket:Object.fromEntries(['EARLY','MIDDLE','LATE'].map(v=>[v,stats(records.slice(-360),x=>x.raceBucket===v)])),
    resultOdds:{median:quantile(records.slice(-360).map(x=>x.payout/100),.5),q75:quantile(records.slice(-360).map(x=>x.payout/100),.75),missMedian:quantile(records.slice(-360).filter(x=>!x.hit).map(x=>x.payout/100),.5)}
  },
  comparisons:comparisons.map(({name,field,direction,threshold,value,design,holdout,recent360})=>({name,field,direction,threshold,value,design,holdout,recent360})),
  livePromotionEligible:selected.holdout.coverage>=.25&&selected.holdout.hitRate>=baseline.holdout.hitRate&&selected.holdout.analyticalRoi>=1,
  decision:'SHADOW_ONLY'
};
fs.writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({baseline:report.baseline,selected:report.selected,confidenceSelected:report.confidenceSelected,holdoutImprovement:report.holdoutImprovement,recentMissBreakdown:report.recentMissBreakdown,livePromotionEligible:report.livePromotionEligible,decision:report.decision},null,2));
