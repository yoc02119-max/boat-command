#!/usr/bin/env node
'use strict';

const fs=require('fs');
const model=require('../mikuni-research-model-v1.js');

const INPUT=process.argv[2]||'mikuni-history-bootstrap-v1.json';
const OUTPUT=process.argv[3]||'mikuni-second-place-diversity-v1.json';
const db=JSON.parse(fs.readFileSync(INPUT,'utf8'));
if(db.venueCode!=='10')throw new Error('MIKUNI_ONLY');

const rows=[...(db.races||[])].sort((a,b)=>String(a.d).localeCompare(String(b.d))||Number(a.r)-Number(b.r));
if(rows.length<300)throw new Error('INSUFFICIENT_HISTORY');

const baseCfg={recencyWindow:300,classScale:.28,neighborMix:.45,neighborLimit:240,decay:.55,laplace:1};
const candidates=[];
for(const minHeadMass of [.35,.45,.55])for(const secondSlots of [2,3])candidates.push({minHeadMass,secondSlots});

function programFrom(t){
  return {
    venue:'MIKUNI',venueCode:'10',date:t.d,race:Number(t.r),raceType:String(t.t||''),
    boats:t.c.map((c,i)=>({lane:i+1,class:c})),
    resultEndpointsIncluded:false,resultIncluded:false,exhibitionIncluded:false
  };
}
function uniq(xs){const s=new Set(),out=[];for(const x of xs)if(!s.has(x)){s.add(x);out.push(x)}return out}

function secondDiversitySelect(dist,{count=4,minHeadMass=.45,secondSlots=3}={}){
  const rows=Array.isArray(dist?.rows)?dist.rows:[];
  if(rows.length<count)return rows.slice(0,count);
  const top=rows[0],head=String(top.order).split('-')[0];
  const headRows=rows.filter(x=>String(x.order).startsWith(head+'-'));
  const headMass=headRows.reduce((s,x)=>s+Number(x.probability||0),0);
  if(headMass<minHeadMass)return rows.slice(0,count);

  const bySecond=new Map();
  for(const x of headRows){
    const parts=String(x.order).split('-'),second=parts[1];
    if(!bySecond.has(second))bySecond.set(second,{second,mass:0,best:x});
    const g=bySecond.get(second);
    g.mass+=Number(x.probability||0);
    if(Number(x.probability||0)>Number(g.best.probability||0))g.best=x;
  }
  const ranked=[...bySecond.values()].sort((a,b)=>b.mass-a.mass||Number(b.best.probability)-Number(a.best.probability));
  const chosen=ranked.slice(0,Math.max(1,Math.min(count,secondSlots))).map(x=>x.best);
  const picked=new Set(chosen.map(x=>x.order));
  for(const x of rows){
    if(chosen.length>=count)break;
    if(!picked.has(x.order)){chosen.push(x);picked.add(x.order)}
  }
  return chosen.slice(0,count);
}

function evaluate(targets,selector){
  const ids=new Set(targets.map(x=>x.id));
  const rec=[];let history=[],day=null,dayRows=[];
  const flush=()=>{
    if(!dayRows.length)return;
    if(history.length>=300){
      for(const t of dayRows)if(ids.has(t.id)){
        const d=model.distribution(programFrom(t),history,{targetDate:t.d,config:baseCfg,mode:'PROGRAM_ONLY'});
        const picks=selector(d).map(x=>x.order);
        const topHead=String(d.rows[0].order).split('-')[0];
        const actualParts=String(t.o).split('-');
        rec.push({
          id:t.id,d:t.d,r:t.r,actual:t.o,payout:Number(t.p)||0,picks,
          topHead,actualHead:actualParts[0],actualSecond:actualParts[1],
          secondCandidates:uniq(picks.filter(p=>p.startsWith(topHead+'-')).map(p=>p.split('-')[1]))
        });
      }
    }
    history=history.concat(dayRows);dayRows=[];
  };
  for(const row of rows){if(day!==null&&row.d!==day)flush();day=row.d;dayRows.push(row)}
  flush();return rec;
}

function metrics(rec){
  let hits=0,returns=0,headCorrect=0,secondCovered=0,secondDistinctSum=0;
  for(const x of rec){
    const hit=x.picks.includes(x.actual);
    if(hit){hits++;returns+=x.payout}
    if(x.topHead===x.actualHead){
      headCorrect++;
      if(x.secondCandidates.includes(x.actualSecond))secondCovered++;
    }
    secondDistinctSum+=x.secondCandidates.length;
  }
  const stake=rec.length*4*100;
  return {
    races:rec.length,hits,hitRate:rec.length?hits/rec.length:0,
    stake,returns,roi:stake?returns/stake:0,
    headCorrect,headRate:rec.length?headCorrect/rec.length:0,
    secondCoveredGivenHead:secondCovered,
    secondCoverageGivenHead:headCorrect?secondCovered/headCorrect:0,
    avgDistinctSecondCandidates:rec.length?secondDistinctSum/rec.length:0
  };
}

const dates=[...new Set(rows.map(x=>x.d))].sort();
const cut=Math.max(1,Math.floor(dates.length*.7)),calEnd=dates[cut-1],holdStart=dates[cut];
const calibrationTargets=rows.filter(x=>x.d<=calEnd);
const holdoutTargets=rows.filter(x=>x.d>=holdStart);

const baselineCal=evaluate(calibrationTargets,d=>d.rows.slice(0,4));
const baselineCalM=metrics(baselineCal);
const tuned=candidates.map(cfg=>{
  const rec=evaluate(calibrationTargets,d=>secondDiversitySelect(d,{count:4,...cfg}));
  const m=metrics(rec);
  const score=.55*m.hitRate+.25*Math.min(m.roi,2)+.20*m.secondCoverageGivenHead;
  return{config:cfg,metrics:m,score};
}).sort((a,b)=>b.score-a.score||b.metrics.hitRate-a.metrics.hitRate||b.metrics.roi-a.metrics.roi);

if(!tuned.length)throw new Error('NO_CANDIDATES');
const selected=tuned[0].config;
const baselineHoldM=metrics(evaluate(holdoutTargets,d=>d.rows.slice(0,4)));
const candidateHoldM=metrics(evaluate(holdoutTargets,d=>secondDiversitySelect(d,{count:4,...selected})));

const report={
  schema:'boat-command-mikuni-second-place-diversity-v1',
  version:'MIKUNI-SECOND-PLACE-DIVERSITY-V1',
  venue:'MIKUNI',venueCode:'10',
  source:INPUT,
  analysisOnly:true,shadowOnly:true,productionEnabled:false,tryEnabled:false,realMoney:false,
  strictWalkForward:true,sameDayRowsExcluded:true,resultBlockedUntilPrediction:true,
  objective:'Improve second-place coverage without changing the underlying PROGRAM_ONLY probability model.',
  architecture:{
    baseline:'TOP4_RAW_PROBABILITY',
    candidate:'PRIMARY_HEAD_SECOND_DIVERSITY_THEN_FILL',
    baseModel:'MIKUNI-RESEARCH-MODEL-V1',
    fixedPoints:4
  },
  calibration:{
    lastDate:calEnd,dateCount:cut,
    baseline:baselineCalM,
    selected,
    candidates:tuned
  },
  holdout:{
    firstDate:holdStart,dateCount:dates.length-cut,
    baseline:baselineHoldM,
    candidate:candidateHoldM,
    hitRateDelta:candidateHoldM.hitRate-baselineHoldM.hitRate,
    roiDelta:candidateHoldM.roi-baselineHoldM.roi,
    secondCoverageDelta:candidateHoldM.secondCoverageGivenHead-baselineHoldM.secondCoverageGivenHead
  },
  decision:'SHADOW_ONLY',
  promotionEligible:false,
  note:'No LIVE picks, frozen predictions, stakes, TRY selection, or result collection are modified by this report.'
};

fs.writeFileSync(OUTPUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({
  selected,
  baselineHoldout:baselineHoldM,
  candidateHoldout:candidateHoldM,
  hitRateDelta:report.holdout.hitRateDelta,
  roiDelta:report.holdout.roiDelta,
  secondCoverageDelta:report.holdout.secondCoverageDelta
},null,2));
