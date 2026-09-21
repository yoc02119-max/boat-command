#!/usr/bin/env node
'use strict';

// BOAT COMMAND GAMAGORI sparse second-place correction candidate v0.34.3
// ANALYSIS ONLY. Never imported by LIVE.
// Only replaces duplicate (head,second) coverage when an uncovered runner-up
// has sufficiently similar PRE-RACE pair mass and exact-order probability.

const fs=require('fs');
const path=require('path');
const model=require('../gamagori-main-model-v0320.js');

const input=process.argv[2]||path.join(__dirname,'..','gamagori-main-history-v0320.json');
const output=process.argv[3]||path.join(__dirname,'..','gamagori-second-place-candidate-v0343.json');
const db=JSON.parse(fs.readFileSync(input,'utf8'));
const rows=[...(db.races||[])].sort((a,b)=>String(a.d).localeCompare(String(b.d))||Number(a.r)-Number(b.r));

const PAIR_MIN=[0.55,0.65,0.75,0.85,0.95];
const RAW_MIN=[0.55,0.65,0.75,0.85,0.95];
const MAX_SWAPS=[1,2];
const CONFIGS=[];
for(const pairMin of PAIR_MIN)for(const rawMin of RAW_MIN)for(const maxSwaps of MAX_SWAPS)CONFIGS.push({pairMin,rawMin,maxSwaps,id:`p${pairMin}-r${rawMin}-s${maxSwaps}`});

function parts(v){const p=String(v||'').split('-').map(Number);return p.length===3&&new Set(p).size===3?p:null}
const head=v=>String(parts(v)?.[0]||'');
const second=v=>String(parts(v)?.[1]||'');
const pairKey=v=>head(v)+'-'+second(v);

function masses(dist){
  const pair=new Map();
  for(const row of dist.rows){
    const k=pairKey(row.order);
    pair.set(k,(pair.get(k)||0)+Number(row.probability||0));
  }
  return pair;
}
function sparse(dist,cfg){
  const baseRows=model.select(dist,{count:4});
  let selected=baseRows.map(x=>x.order);
  const pmap=new Map(dist.rows.map(x=>[x.order,Number(x.probability||0)]));
  const pairMass=masses(dist);
  let swaps=0;

  while(swaps<cfg.maxSwaps){
    const counts=new Map();
    for(const p of selected)counts.set(pairKey(p),(counts.get(pairKey(p))||0)+1);

    const removable=selected
      .filter(p=>(counts.get(pairKey(p))||0)>1)
      .map(p=>({order:p,prob:pmap.get(p)||0,pair:pairKey(p),head:head(p)}))
      .sort((a,b)=>a.prob-b.prob);

    let best=null;
    for(const rem of removable){
      const coveredSeconds=new Set(selected.filter(p=>head(p)===rem.head).map(second));
      const alternatives=dist.rows.filter(r=>
        head(r.order)===rem.head &&
        !selected.includes(r.order) &&
        !coveredSeconds.has(second(r.order))
      );
      for(const alt of alternatives){
        const altProb=Number(alt.probability||0),remProb=rem.prob;
        const altPair=pairMass.get(pairKey(alt.order))||0;
        const remPair=pairMass.get(rem.pair)||0;
        const rawRatio=remProb>0?altProb/remProb:0;
        const pairRatio=remPair>0?altPair/remPair:0;
        if(rawRatio+1e-12<cfg.rawMin||pairRatio+1e-12<cfg.pairMin)continue;
        const score=altPair*0.7+altProb*0.3;
        if(!best||score>best.score)best={rem,alt:alt.order,score,rawRatio,pairRatio};
      }
    }
    if(!best)break;
    selected[selected.indexOf(best.rem.order)]=best.alt;
    swaps++;
  }
  return {picks:selected,swaps};
}
function metrics(rs,key){
  let hits=0,returns=0,stake=0,headHits=0,secondHits=0,secondCandidateTotal=0,swaps=0;
  for(const x of rs){
    const z=x[key],picks=z.picks;swaps+=z.swaps||0;stake+=picks.length*100;
    if(picks.includes(String(x.actual))){hits++;returns+=Number(x.payout||0)}
    const a=String(x.actual).split('-'),hs=[...new Set(picks.map(head))];
    if(hs.includes(a[0])){
      headHits++;
      const ss=[...new Set(picks.filter(p=>head(p)===a[0]).map(second))];
      secondCandidateTotal+=ss.length;
      if(ss.includes(a[1]))secondHits++;
    }
  }
  const n=rs.length;
  return {races:n,hits,hitRate:n?hits/n:null,roi:stake?returns/stake:null,headHits,headRate:n?headHits/n:null,secondHitsGivenHead:secondHits,conditionalSecondRate:headHits?secondHits/headHits:null,averageSecondCandidatesGivenHead:headHits?secondCandidateTotal/headHits:null,totalSwaps:swaps,swapRate:n?swaps/n:null};
}
function delta(a,b){const d=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)?x-y:null;return {hitRate:d(a.hitRate,b.hitRate),roi:d(a.roi,b.roi),headRate:d(a.headRate,b.headRate),conditionalSecondRate:d(a.conditionalSecondRate,b.conditionalSecondRate),averageSecondCandidatesGivenHead:d(a.averageSecondCandidatesGivenHead,b.averageSecondCandidatesGivenHead),swapRate:d(a.swapRate,b.swapRate)}}

const records=[];let history=[],day=null,dayRows=[];
function flush(){
  if(!dayRows.length)return;
  if(history.length>=120){
    for(const t of dayRows){
      const dist=model.probabilities({classes:t.c,race:t.r,raceType:t.t},history,{targetDate:t.d});
      const baseline={picks:model.select(dist,{count:4}).map(x=>x.order),swaps:0};
      const candidates=Object.fromEntries(CONFIGS.map(c=>[c.id,sparse(dist,c)]));
      const bh=[...new Set(baseline.picks.map(head))].sort().join(',');
      for(const c of CONFIGS){
        const ch=[...new Set(candidates[c.id].picks.map(head))].sort().join(',');
        if(ch!==bh)throw new Error('HEAD_SET_CHANGED:'+c.id);
      }
      records.push({date:t.d,race:t.r,actual:t.o,payout:t.p,baseline,candidates});
    }
  }
  history=history.concat(dayRows);dayRows=[];
}
for(const row of rows){if(day!==null&&row.d!==day)flush();day=row.d;dayRows.push(row)}flush();

const design=records.filter(x=>String(x.date).startsWith('2025-'));
const holdout=records.filter(x=>String(x.date).startsWith('2026-'));
for(const x of records)for(const c of CONFIGS)x[c.id]=x.candidates[c.id];

const bd=metrics(design,'baseline'),bh=metrics(holdout,'baseline');
const grid=CONFIGS.map(c=>{const m=metrics(design,c.id);return {...c,metrics:m,delta:delta(m,bd)}});

let safe=grid.filter(x=>x.metrics.totalSwaps>0&&x.delta.hitRate>=-1e-12&&x.delta.roi>=-1e-12&&x.delta.conditionalSecondRate>1e-12);
safe.sort((a,b)=>(b.delta.conditionalSecondRate-a.delta.conditionalSecondRate)||(b.delta.hitRate-a.delta.hitRate)||(b.delta.roi-a.delta.roi)||(a.metrics.swapRate-b.metrics.swapRate));
const selected=safe[0]||null;

let holdoutResult=null;
if(selected){
  const hm=metrics(holdout,selected.id),hd=delta(hm,bh);
  holdoutResult={
    config:{pairMin:selected.pairMin,rawMin:selected.rawMin,maxSwaps:selected.maxSwaps,id:selected.id},
    baseline:bh,candidate:hm,delta:hd,
    pass:Math.abs(hd.headRate)<=1e-12&&hd.conditionalSecondRate>0&&hd.hitRate>=0&&hd.roi>=0
  };
}

const report={
  schema:'boat-command-gamagori-second-place-candidate-v0343',
  analysisOnly:true,liveImported:false,model:model.version,source:path.basename(input),
  boundary:'Strict walk-forward. 2025 selects sparse swap gates. 2026 remains untouched until config freeze.',
  invariant:{fourPicks:true,baselineHeadSetPreserved:true,resultInput:false,payoutInput:false,exhibitionInput:false,realMoney:false},
  design:{period:'2025',races:design.length,baseline:bd,safeCandidateCount:safe.length,selected:selected?{config:{pairMin:selected.pairMin,rawMin:selected.rawMin,maxSwaps:selected.maxSwaps,id:selected.id},metrics:selected.metrics,delta:selected.delta}:null,grid},
  holdout:{period:'2026',role:'UNTOUCHED_TIME_ORDERED_HOLDOUT',races:holdout.length,result:holdoutResult},
  pass:Boolean(holdoutResult?.pass),
  promotionEligible:false,
  notes:['LIVE/main logic unchanged.','No result or payout field is used in candidate generation.','A separate forward SHADOW gate is mandatory even if holdout passes.']
};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({
  schema:report.schema,
  designBaseline:bd,
  designSafeCandidateCount:safe.length,
  selected:report.design.selected,
  holdout:report.holdout.result,
  pass:report.pass,
  promotionEligible:false
},null,2));
