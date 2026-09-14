#!/usr/bin/env node
'use strict';
const fs=require('fs');
const model=require('../gamagori-main-model-v0320.js');
const hist=JSON.parse(fs.readFileSync('gamagori-main-history-v0320.json','utf8'));
const shadow=JSON.parse(fs.readFileSync('gamagori-shadow-pre-v0330.json','utf8'));
const byId=new Map((shadow.races||[]).map(r=>[r.id,r]));
const rows=[...(hist.races||[])].sort((a,b)=>String(a.d).localeCompare(String(b.d))||Number(a.r)-Number(b.r));
const targetDates=[...new Set((shadow.races||[]).map(r=>r.date))].sort();
const split=Math.floor(targetDates.length/2);
const designDates=new Set(targetDates.slice(0,split));
const holdoutDates=new Set(targetDates.slice(split));
function avg(a){return a.length?a.reduce((s,x)=>s+x,0)/a.length:null}
function q(a,p){const v=a.filter(Number.isFinite).sort((x,y)=>x-y);return v.length?v[Math.floor((v.length-1)*p)]:null}
function safe(n){return Number.isFinite(Number(n))?Number(n):null}
function stats(a){const n=a.length,h=a.filter(x=>x.hit).length;return {races:n,hits:h,hitRate:n?h/n:null}}
function featureRow(pre){
 const b=pre.boats||[]; const lane1=b[0]||{}; const outer=b.slice(1);
 const av=(k,x=b)=>avg(x.map(z=>safe(z[k])).filter(Number.isFinite));
 const mx=(k,x=b)=>Math.max(...x.map(z=>safe(z[k])).filter(Number.isFinite));
 const mn=(k,x=b)=>Math.min(...x.map(z=>safe(z[k])).filter(Number.isFinite));
 const oBest=(k)=>mx(k,outer);
 return {
  eventDay:safe(pre.eventDay),
  lane1AvgST:safe(lane1.averageST), stOuterEdge:safe(lane1.averageST)-mn('averageST',outer), stSpread:mx('averageST')-mn('averageST'),
  lane1National:safe(lane1.nationalWinRate), nationalOuterEdge:oBest('nationalWinRate')-safe(lane1.nationalWinRate), nationalSpread:mx('nationalWinRate')-mn('nationalWinRate'),
  lane1Local:safe(lane1.localWinRate), localOuterEdge:oBest('localWinRate')-safe(lane1.localWinRate), localSpread:mx('localWinRate')-mn('localWinRate'),
  lane1Motor2:safe(lane1.motor2Rate), motorOuterEdge:oBest('motor2Rate')-safe(lane1.motor2Rate), motorSpread:mx('motor2Rate')-mn('motor2Rate'),
  fieldAvgST:av('averageST'), fieldNational:av('nationalWinRate'), fieldLocal:av('localWinRate'), fieldMotor2:av('motor2Rate')
 };
}
const out=[];let history=[],day=null,dayRows=[];
function flush(){
 if(!dayRows.length)return;
 for(const r of dayRows){
  const pre=byId.get(r.id); if(!pre||history.length<120)continue;
  const dist=model.probabilities({classes:r.c,race:r.r,raceType:r.t},history,{targetDate:r.d});
  const picks=model.select(dist,{count:4}).map(x=>x.order); const probs=dist.rows.map(x=>x.probability);
  const f=featureRow(pre); out.push({id:r.id,date:r.d,race:Number(r.r),actual:r.o,payout:Number(r.p)||0,picks,hit:picks.includes(r.o),top1:probs[0],top4:probs.slice(0,4).reduce((a,b)=>a+b,0),margin45:probs[3]-probs[4],nearestDistance:dist.nearestDistance,...f});
 }
 history=history.concat(dayRows);dayRows=[];
}
for(const r of rows){if(day!==null&&r.d!==day)flush();day=r.d;dayRows.push(r)}flush();
const target=out.filter(x=>designDates.has(x.date)||holdoutDates.has(x.date));
const design=target.filter(x=>designDates.has(x.date)); const holdout=target.filter(x=>holdoutDates.has(x.date));
const featureNames=['eventDay','lane1AvgST','stOuterEdge','stSpread','lane1National','nationalOuterEdge','nationalSpread','lane1Local','localOuterEdge','localSpread','lane1Motor2','motorOuterEdge','motorSpread','fieldAvgST','fieldNational','fieldLocal','fieldMotor2','top1','top4','margin45','nearestDistance'];
function effect(name,set){const h=set.filter(x=>x.hit).map(x=>x[name]).filter(Number.isFinite),m=set.filter(x=>!x.hit).map(x=>x[name]).filter(Number.isFinite);return {hitMean:avg(h),missMean:avg(m),delta:(avg(h)==null||avg(m)==null)?null:avg(h)-avg(m),hitMedian:q(h,.5),missMedian:q(m,.5)}}
const effects=Object.fromEntries(featureNames.map(n=>[n,{design:effect(n,design),holdout:effect(n,holdout)}]));
const candidates=[];
for(const name of featureNames){const vals=design.map(x=>x[name]).filter(Number.isFinite);for(const pct of [.25,.5,.75]){const t=q(vals,pct);if(t==null)continue;for(const dir of ['gte','lte']){const test=x=>Number.isFinite(x[name])&&(dir==='gte'?x[name]>=t:x[name]<=t);const ds=design.filter(test),hs=holdout.filter(test);if(ds.length<40||hs.length<40)continue;candidates.push({feature:name,direction:dir,threshold:t,design:stats(ds),holdout:stats(hs),coverage:{design:ds.length/design.length,holdout:hs.length/holdout.length}})}}}
candidates.sort((a,b)=>(b.design.hitRate-a.design.hitRate)||(b.holdout.hitRate-a.holdout.hitRate));
function cause(x){if(x.hit)return 'HIT';if(x.payout>=10000)return 'HIGH_PAYOUT_UPSET';if(x.nationalOuterEdge>=1.5||x.localOuterEdge>=1.5)return 'OUTER_PROFILE_EDGE';if(x.motorOuterEdge>=.12)return 'OUTER_MOTOR_EDGE';if(x.stOuterEdge>=.04)return 'OUTER_ST_EDGE';if(x.nationalSpread<=1.0&&x.localSpread<=1.0)return 'BALANCED_FIELD';return 'OTHER';}
const causes={};for(const x of target){const c=cause(x);causes[c]=(causes[c]||0)+1}
const report={schema:'boat-command-shadow-feature-analysis-v1',model:model.version,sourcePre:'gamagori-shadow-pre-v0330.json',sourceHistory:'gamagori-main-history-v0320.json',strictWalkForward:true,sameDayOutcomeExcluded:true,targetDates,designDates:[...designDates],holdoutDates:[...holdoutDates],rows:target.length,baseline:{design:stats(design),holdout:stats(holdout)},effects,missCauseCounts:causes,candidates:candidates.slice(0,30),note:'All candidate thresholds are fit on the first 15 race-days only and evaluated unchanged on the later 15 race-days. Outcome/payout fields are used only after prediction for evaluation and miss labeling.',decision:'SHADOW_ONLY'};
fs.writeFileSync('gamagori-shadow-feature-analysis-v0331.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({rows:report.rows,baseline:report.baseline,missCauseCounts:causes,topCandidates:report.candidates.slice(0,10),decision:report.decision},null,2));
