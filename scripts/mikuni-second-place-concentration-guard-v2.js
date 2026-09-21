#!/usr/bin/env node
'use strict';

const fs=require('fs');
const model=require('../mikuni-research-model-v1.js');

const INPUT=process.argv[2]||'mikuni-history-bootstrap-v1.json';
const OUTPUT=process.argv[3]||'mikuni-second-place-concentration-guard-v2.json';
const db=JSON.parse(fs.readFileSync(INPUT,'utf8'));
if(db.venueCode!=='10')throw new Error('MIKUNI_ONLY');

const rows=[...(db.races||[])].sort((a,b)=>String(a.d).localeCompare(String(b.d))||Number(a.r)-Number(b.r));
if(rows.length<300)throw new Error('INSUFFICIENT_HISTORY');

const baseCfg={recencyWindow:300,classScale:.28,neighborMix:.45,neighborLimit:240,decay:.55,laplace:1};
const configs=[];
for(const minHeadMass of [.40,.50,.60])for(const maxDistinctSeconds of [1,2])for(const replacements of [1,2])configs.push({minHeadMass,maxDistinctSeconds,replacements});

function programFrom(t){
  return {
    venue:'MIKUNI',venueCode:'10',date:t.d,race:Number(t.r),raceType:String(t.t||''),
    boats:t.c.map((c,i)=>({lane:i+1,class:c})),
    resultEndpointsIncluded:false,resultIncluded:false,exhibitionIncluded:false
  };
}
function secondOf(order){return String(order).split('-')[1]}
function headOf(order){return String(order).split('-')[0]}
function uniq(xs){return [...new Set(xs)]}

function guardSelect(dist,{count=4,minHeadMass=.5,maxDistinctSeconds=1,replacements=1}={}){
  const all=Array.isArray(dist?.rows)?dist.rows:[];
  const base=all.slice(0,count);
  if(base.length<count)return base;

  const primaryHead=headOf(all[0].order);
  const headRows=all.filter(x=>headOf(x.order)===primaryHead);
  const headMass=headRows.reduce((s,x)=>s+Number(x.probability||0),0);
  if(headMass<minHeadMass)return base;

  const basePrimary=base.filter(x=>headOf(x.order)===primaryHead);
  if(basePrimary.length<3)return base;
  const represented=uniq(basePrimary.map(x=>secondOf(x.order)));
  if(represented.length>maxDistinctSeconds)return base;

  const altGroups=new Map();
  for(const x of headRows){
    const second=secondOf(x.order);
    if(represented.includes(second))continue;
    if(!altGroups.has(second))altGroups.set(second,{second,mass:0,best:x});
    const g=altGroups.get(second);
    g.mass+=Number(x.probability||0);
    if(Number(x.probability||0)>Number(g.best.probability||0))g.best=x;
  }
  const alts=[...altGroups.values()].sort((a,b)=>b.mass-a.mass||Number(b.best.probability)-Number(a.best.probability)).map(x=>x.best);
  if(!alts.length)return base;

  const out=[...base];
  const replaceable=out
    .map((x,i)=>({x,i}))
    .filter(z=>headOf(z.x.order)===primaryHead)
    .sort((a,b)=>Number(a.x.probability)-Number(b.x.probability));

  let applied=0;
  for(const alt of alts){
    if(applied>=replacements||!replaceable.length)break;
    const target=replaceable.shift();
    if(out.some(x=>x.order===alt.order))continue;
    out[target.i]=alt;applied++;
  }
  return out.sort((a,b)=>Number(b.probability)-Number(a.probability));
}

function evaluate(targets,selector){
  const ids=new Set(targets.map(x=>x.id));
  const rec=[];let history=[],day=null,dayRows=[];
  const flush=()=>{
    if(!dayRows.length)return;
    if(history.length>=300){
      for(const t of dayRows)if(ids.has(t.id)){
        const d=model.distribution(programFrom(t),history,{targetDate:t.d,config:baseCfg,mode:'PROGRAM_ONLY'});
        const baseline=d.rows.slice(0,4).map(x=>x.order);
        const selected=selector(d).map(x=>x.order);
        const primaryHead=headOf(d.rows[0].order),actual=String(t.o).split('-');
        rec.push({
          id:t.id,d:t.d,r:t.r,actual:t.o,payout:Number(t.p)||0,
          baseline,selected,primaryHead,actualHead:actual[0],actualSecond:actual[1],
          changed:baseline.join('|')!==selected.join('|'),
          baselineSeconds:uniq(baseline.filter(p=>headOf(p)===primaryHead).map(secondOf)),
          selectedSeconds:uniq(selected.filter(p=>headOf(p)===primaryHead).map(secondOf))
        });
      }
    }
    history=history.concat(dayRows);dayRows=[];
  };
  for(const row of rows){if(day!==null&&row.d!==day)flush();day=row.d;dayRows.push(row)}
  flush();return rec;
}

function metrics(rec,key){
  let hits=0,returns=0,headCorrect=0,secondCovered=0,changed=0,changedHits=0,changedReturns=0;
  for(const x of rec){
    const picks=x[key];
    const hit=picks.includes(x.actual);
    if(hit){hits++;returns+=x.payout}
    if(x.primaryHead===x.actualHead){
      headCorrect++;
      const seconds=uniq(picks.filter(p=>headOf(p)===x.primaryHead).map(secondOf));
      if(seconds.includes(x.actualSecond))secondCovered++;
    }
    if(x.changed){
      changed++;
      if(hit){changedHits++;changedReturns+=x.payout}
    }
  }
  const stake=rec.length*400;
  return {
    races:rec.length,hits,hitRate:rec.length?hits/rec.length:0,
    stake,returns,roi:stake?returns/stake:0,
    headCorrect,headRate:rec.length?headCorrect/rec.length:0,
    secondCoveredGivenHead:secondCovered,
    secondCoverageGivenHead:headCorrect?secondCovered/headCorrect:0,
    changedRaces:changed,
    changedHitRate:changed?changedHits/changed:0,
    changedReturns
  };
}

const dates=[...new Set(rows.map(x=>x.d))].sort();
const cut=Math.max(1,Math.floor(dates.length*.7)),calEnd=dates[cut-1],holdStart=dates[cut];
const calibrationTargets=rows.filter(x=>x.d<=calEnd),holdoutTargets=rows.filter(x=>x.d>=holdStart);

const calRuns=configs.map(config=>{
  const rec=evaluate(calibrationTargets,d=>guardSelect(d,{count:4,...config}));
  const base=metrics(rec,'baseline'),cand=metrics(rec,'selected');
  const hitDelta=cand.hitRate-base.hitRate,roiDelta=cand.roi-base.roi,secondDelta=cand.secondCoverageGivenHead-base.secondCoverageGivenHead;
  const score=.55*hitDelta+.25*roiDelta+.20*secondDelta;
  return{config,baseline:base,candidate:cand,hitRateDelta:hitDelta,roiDelta,secondCoverageDelta:secondDelta,score};
}).sort((a,b)=>b.score-a.score||b.hitRateDelta-a.hitRateDelta||b.roiDelta-a.roiDelta);

if(!calRuns.length)throw new Error('NO_CANDIDATES');
const selected=calRuns[0].config;
const holdRec=evaluate(holdoutTargets,d=>guardSelect(d,{count:4,...selected}));
const baseHold=metrics(holdRec,'baseline'),candHold=metrics(holdRec,'selected');

const report={
  schema:'boat-command-mikuni-second-place-concentration-guard-v2',
  version:'MIKUNI-SECOND-PLACE-CONCENTRATION-GUARD-V2',
  venue:'MIKUNI',venueCode:'10',source:INPUT,
  analysisOnly:true,shadowOnly:true,productionEnabled:false,tryEnabled:false,realMoney:false,
  strictWalkForward:true,sameDayRowsExcluded:true,resultBlockedUntilPrediction:true,
  objective:'Only diversify second-place candidates when baseline top-4 is unusually concentrated under the primary head.',
  architecture:{
    baseline:'TOP4_RAW_PROBABILITY',
    candidate:'CONCENTRATION_GUARD_REPLACE_LOWEST_PRIMARY_HEAD_PICK',
    baseModel:'MIKUNI-RESEARCH-MODEL-V1',
    fixedPoints:4
  },
  calibration:{lastDate:calEnd,dateCount:cut,selected,candidates:calRuns},
  holdout:{
    firstDate:holdStart,dateCount:dates.length-cut,
    baseline:baseHold,candidate:candHold,
    hitRateDelta:candHold.hitRate-baseHold.hitRate,
    roiDelta:candHold.roi-baseHold.roi,
    secondCoverageDelta:candHold.secondCoverageGivenHead-baseHold.secondCoverageGivenHead
  },
  decision:'SHADOW_ONLY',
  promotionEligible:false,
  note:'This analysis never mutates LIVE/TRY/frozen predictions. Any adoption requires separate forward SHADOW validation.'
};

fs.writeFileSync(OUTPUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({
  selected,
  baselineHoldout:baseHold,
  candidateHoldout:candHold,
  hitRateDelta:report.holdout.hitRateDelta,
  roiDelta:report.holdout.roiDelta,
  secondCoverageDelta:report.holdout.secondCoverageDelta
},null,2));
