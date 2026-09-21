#!/usr/bin/env node
'use strict';

// BOAT COMMAND GAMAGORI second-place diversified SHADOW candidate v0.34.2
// ANALYSIS ONLY. Never imported by LIVE.
// Goal: preserve the current 4-pick head set, then diversify the runner-up lane
// using PRE-RACE probabilities only. Parameter selection uses 2025 design data;
// 2026 remains untouched until the final evaluation step.

const fs=require('fs');
const path=require('path');
const model=require('../gamagori-main-model-v0320.js');

const input=process.argv[2]||path.join(__dirname,'..','gamagori-main-history-v0320.json');
const output=process.argv[3]||path.join(__dirname,'..','gamagori-second-place-candidate-v0342.json');
const db=JSON.parse(fs.readFileSync(input,'utf8'));
const rows=[...(db.races||[])].sort((a,b)=>String(a.d).localeCompare(String(b.d))||Number(a.r)-Number(b.r));

const LAMBDAS=[0,0.05,0.1,0.2,0.35,0.5,0.75,1,1.5,2];

function parsePick(v){
  const p=String(v||'').split('-').map(Number);
  return p.length===3&&p.every(x=>x>=1&&x<=6)&&new Set(p).size===3?p:null;
}
function key12(order){
  const p=parsePick(order);
  return p?String(p[0])+'-'+String(p[1]):null;
}
function head(order){
  const p=parsePick(order);return p?String(p[0]):null;
}
function second(order){
  const p=parsePick(order);return p?String(p[1]):null;
}
function metrics(records,key){
  const races=records.length;
  if(!races)return {races:0,hits:0,hitRate:null,roi:null,headHits:0,headRate:null,secondHitsGivenHead:0,conditionalSecondRate:null,averageSecondCandidatesGivenHead:null};
  let hits=0,stake=0,returns=0,headHits=0,secondHits=0,secondCandidateTotal=0;
  for(const x of records){
    const picks=x[key]||[];
    const actual=String(x.actual||'');
    const parts=actual.split('-');
    stake+=picks.length*100;
    if(picks.includes(actual)){hits++;returns+=Number(x.payout||0);}
    const heads=[...new Set(picks.map(head).filter(Boolean))];
    const actualHead=parts[0],actualSecond=parts[1];
    if(heads.includes(actualHead)){
      headHits++;
      const seconds=[...new Set(picks.filter(p=>head(p)===actualHead).map(second).filter(Boolean))];
      secondCandidateTotal+=seconds.length;
      if(seconds.includes(actualSecond))secondHits++;
    }
  }
  return {
    races,
    hits,
    hitRate:hits/races,
    roi:stake?returns/stake:null,
    headHits,
    headRate:headHits/races,
    secondHitsGivenHead:secondHits,
    conditionalSecondRate:headHits?secondHits/headHits:null,
    averageSecondCandidatesGivenHead:headHits?secondCandidateTotal/headHits:null
  };
}
function deltas(a,b){
  const d=(x,y)=>(Number.isFinite(x)&&Number.isFinite(y))?x-y:null;
  return {
    hitRate:d(a.hitRate,b.hitRate),
    roi:d(a.roi,b.roi),
    headRate:d(a.headRate,b.headRate),
    conditionalSecondRate:d(a.conditionalSecondRate,b.conditionalSecondRate),
    averageSecondCandidatesGivenHead:d(a.averageSecondCandidatesGivenHead,b.averageSecondCandidatesGivenHead)
  };
}
function pairMasses(dist){
  const pair=new Map(),headMass=new Map();
  for(const row of dist.rows){
    const h=head(row.order),s=second(row.order);
    if(!h||!s)continue;
    pair.set(h+'-'+s,(pair.get(h+'-'+s)||0)+Number(row.probability||0));
    headMass.set(h,(headMass.get(h)||0)+Number(row.probability||0));
  }
  return {pair,headMass};
}
function diversified(dist,lambda){
  const baseline=model.select(dist,{count:4}).map(x=>x.order);
  const allowedHeads=[...new Set(baseline.map(head).filter(Boolean))];
  if(!allowedHeads.length)return baseline;
  const {pair,headMass}=pairMasses(dist);
  const rows=dist.rows.filter(x=>allowedHeads.includes(head(x.order)));
  const selected=[];
  const selectedPairs=new Set();

  // Preserve every head that the frozen 4-pick selector would expose.
  for(const h of allowedHeads){
    const best=rows.find(x=>head(x.order)===h && !selected.includes(x.order));
    if(best){
      selected.push(best.order);
      selectedPairs.add(key12(best.order));
      if(selected.length===4)return selected;
    }
  }

  while(selected.length<4){
    let best=null,bestScore=-Infinity;
    for(const row of rows){
      if(selected.includes(row.order))continue;
      const h=head(row.order),pairKey=key12(row.order);
      const p=Number(row.probability||0);
      const hm=Number(headMass.get(h)||0);
      const pm=Number(pair.get(pairKey)||0);
      const conditional=hm>0?pm/hm:0;
      const uncovered=selectedPairs.has(pairKey)?0:1;
      // lambda=0 reproduces raw probability ordering subject to head preservation.
      // Positive lambda rewards covering a different runner-up lane for the same head.
      const score=p + lambda*uncovered*conditional*hm;
      if(score>bestScore+1e-15){
        bestScore=score;best=row;
      }else if(Math.abs(score-bestScore)<=1e-15 && best && p>Number(best.probability||0)){
        best=row;
      }
    }
    if(!best)break;
    selected.push(best.order);
    selectedPairs.add(key12(best.order));
  }
  return selected.slice(0,4);
}

const records=[];
let history=[],day=null,dayRows=[];
function evaluateDay(){
  if(!dayRows.length)return;
  if(history.length>=120){
    for(const t of dayRows){
      const dist=model.probabilities({classes:t.c,race:t.r,raceType:t.t},history,{targetDate:t.d});
      const baseline=model.select(dist,{count:4}).map(x=>x.order);
      const candidates=Object.fromEntries(LAMBDAS.map(l=>[String(l),diversified(dist,l)]));
      const baseHeads=[...new Set(baseline.map(head).filter(Boolean))].sort();
      for(const l of LAMBDAS){
        const hs=[...new Set(candidates[String(l)].map(head).filter(Boolean))].sort();
        if(JSON.stringify(hs)!==JSON.stringify(baseHeads))throw new Error('HEAD_SET_CHANGED');
      }
      records.push({
        id:t.id,date:t.d,race:t.r,title:t.t||null,classes:t.c,
        actual:t.o,payout:t.p,baseline,candidates
      });
    }
  }
  history=history.concat(dayRows);
  dayRows=[];
}
for(const row of rows){
  if(day!==null&&row.d!==day)evaluateDay();
  day=row.d;dayRows.push(row);
}
evaluateDay();

const design=records.filter(x=>String(x.date).startsWith('2025-'));
const holdout=records.filter(x=>String(x.date).startsWith('2026-'));
const baselineDesign=metrics(design,'baseline');
const baselineHoldout=metrics(holdout,'baseline');

function candidateMetrics(rs,lambda){
  return metrics(rs,'candidate_'+String(lambda));
}
const expanded=records.map(r=>{
  const x={...r};
  for(const l of LAMBDAS)x['candidate_'+String(l)]=r.candidates[String(l)];
  return x;
});
const designExpanded=expanded.filter(x=>String(x.date).startsWith('2025-'));
const holdoutExpanded=expanded.filter(x=>String(x.date).startsWith('2026-'));

const designGrid=LAMBDAS.map(lambda=>{
  const m=candidateMetrics(designExpanded,lambda);
  return {lambda,metrics:m,delta:deltas(m,baselineDesign)};
});

// Design-only selection.
// First require no loss in exact hit rate and ROI versus baseline on 2025.
// Among survivors maximize conditional second-place coverage; use smaller lambda on ties.
// If none survive, require exact hit rate not worse and maximize ROI, then second coverage.
let pool=designGrid.filter(x=>x.delta.hitRate>=-1e-12&&x.delta.roi>=-1e-12);
let selectionRule='DESIGN_NO_LOSS_HIT_AND_ROI_MAX_SECOND';
if(!pool.length){
  pool=designGrid.filter(x=>x.delta.hitRate>=-1e-12);
  selectionRule='DESIGN_NO_LOSS_HIT_MAX_ROI_THEN_SECOND';
}
if(!pool.length){
  pool=[...designGrid];
  selectionRule='DESIGN_FALLBACK_MAX_HIT_THEN_SECOND_THEN_ROI';
}
pool.sort((a,b)=>{
  if(selectionRule==='DESIGN_NO_LOSS_HIT_AND_ROI_MAX_SECOND'){
    return (b.metrics.conditionalSecondRate??-Infinity)-(a.metrics.conditionalSecondRate??-Infinity)
      || (b.metrics.hitRate??-Infinity)-(a.metrics.hitRate??-Infinity)
      || (b.metrics.roi??-Infinity)-(a.metrics.roi??-Infinity)
      || a.lambda-b.lambda;
  }
  if(selectionRule==='DESIGN_NO_LOSS_HIT_MAX_ROI_THEN_SECOND'){
    return (b.metrics.roi??-Infinity)-(a.metrics.roi??-Infinity)
      || (b.metrics.conditionalSecondRate??-Infinity)-(a.metrics.conditionalSecondRate??-Infinity)
      || a.lambda-b.lambda;
  }
  return (b.metrics.hitRate??-Infinity)-(a.metrics.hitRate??-Infinity)
    || (b.metrics.conditionalSecondRate??-Infinity)-(a.metrics.conditionalSecondRate??-Infinity)
    || (b.metrics.roi??-Infinity)-(a.metrics.roi??-Infinity)
    || a.lambda-b.lambda;
});
const selectedLambda=pool[0].lambda;
const selectedDesign=candidateMetrics(designExpanded,selectedLambda);
const selectedHoldout=candidateMetrics(holdoutExpanded,selectedLambda);
const holdoutDelta=deltas(selectedHoldout,baselineHoldout);

const report={
  schema:'boat-command-gamagori-second-place-candidate-v0342',
  analysisOnly:true,
  liveImported:false,
  model:model.version,
  source:path.basename(input),
  boundary:'Strict walk-forward. Same-day outcomes excluded. 2025 design selects lambda; 2026 is opened only after lambda is frozen.',
  invariant:{
    fourPicks:true,
    baselineHeadSetPreserved:true,
    resultInput:false,
    payoutInput:false,
    exhibitionInput:false,
    realMoney:false
  },
  records:records.length,
  design:{
    period:'2025',
    races:designExpanded.length,
    baseline:baselineDesign,
    grid:designGrid,
    selectedLambda,
    selectionRule,
    selected:selectedDesign,
    delta:deltas(selectedDesign,baselineDesign)
  },
  holdout:{
    period:'2026',
    role:'UNTOUCHED_TIME_ORDERED_HOLDOUT',
    races:holdoutExpanded.length,
    baseline:baselineHoldout,
    candidate:selectedHoldout,
    delta:holdoutDelta,
    pass:holdoutDelta.headRate!==null&&Math.abs(holdoutDelta.headRate)<=1e-12
      && holdoutDelta.conditionalSecondRate>0
      && holdoutDelta.hitRate>=0
      && holdoutDelta.roi>=0
  },
  promotionEligible:false,
  notes:[
    'This is SHADOW analysis only; LIVE/main prediction logic is unchanged.',
    'The candidate is allowed to reorder only within the current four-pick head set.',
    'Promotion remains false regardless of this report; a separate forward SHADOW gate is required.'
  ]
};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
