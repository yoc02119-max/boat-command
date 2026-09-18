#!/usr/bin/env node
'use strict';
const fs=require('fs');

const input=process.argv[2]||'edogawa-history-bootstrap-v1.json';
const output=process.argv[3]||'edogawa-baseline-backtest-v1.json';
const db=JSON.parse(fs.readFileSync(input,'utf8'));
if(db.venueCode!=='03')throw new Error('EDOGAWA_ONLY');
const rows=[...(db.races||[])].sort((a,b)=>String(a.d).localeCompare(String(b.d))||Number(a.r)-Number(b.r));
if(rows.length<300)throw new Error('INSUFFICIENT_HISTORY');

const CLASS={A1:3,A2:2,B1:1,B2:0};
const validClasses=x=>Array.isArray(x)&&x.length===6&&x.every(c=>Object.hasOwn(CLASS,c));
const validOrder=x=>/^[1-6]-[1-6]-[1-6]$/.test(String(x||''))&&new Set(String(x).split('-')).size===3;
function typeGroup(s){
  s=String(s||'');
  if(/優勝/.test(s))return'FINAL';
  if(/準優/.test(s))return'SEMI';
  if(/ドリーム/.test(s))return'DREAM';
  if(/選抜/.test(s))return'SELECT';
  if(/特選|特賞/.test(s))return'SPECIAL';
  if(/予選/.test(s))return'QUALIFY';
  if(/一般/.test(s))return'GENERAL';
  return'UNKNOWN';
}
function raceBucket(r){r=Number(r)||0;return r<=4?'EARLY':r<=8?'MIDDLE':'LATE'}
function distance(a,b,cfg){
  let d=0;
  for(let i=0;i<6;i++)d+=cfg.laneWeights[i]*Math.abs(CLASS[a.c[i]]-CLASS[b.c[i]]);
  d+=Number(a.r)===Number(b.r)?0:(raceBucket(a.r)===raceBucket(b.r)?cfg.bucketPenalty:cfg.racePenalty);
  const at=typeGroup(a.t),bt=typeGroup(b.t);
  if(at!=='UNKNOWN'&&bt!=='UNKNOWN'&&at!==bt)d+=cfg.typePenalty;
  return d;
}
const configs=[];
for(const neighborLimit of [120,240,480])
for(const decay of [.35,.55,.8])
configs.push({
  neighborLimit,decay,
  laneWeights:[1.28,1.16,1.08,1.0,.94,.9],
  bucketPenalty:.45,racePenalty:.9,typePenalty:.85,
  globalPriorMass:18
});

function distribution(target,history,cfg){
  const safe=history.filter(x=>validClasses(x.c)&&validOrder(x.o)&&String(x.d)<String(target.d));
  const global=new Map();
  for(const x of safe)global.set(x.o,(global.get(x.o)||0)+1);
  const nearest=safe.map(x=>({x,d:distance(target,x,cfg)})).sort((a,b)=>a.d-b.d).slice(0,cfg.neighborLimit);
  const score=new Map();
  let localMass=0;
  for(const n of nearest){
    const w=Math.exp(-cfg.decay*n.d);
    score.set(n.x.o,(score.get(n.x.o)||0)+w);
    localMass+=w;
  }
  const totalGlobal=safe.length||1;
  for(const [o,n] of global){
    score.set(o,(score.get(o)||0)+cfg.globalPriorMass*(n/totalGlobal));
  }
  let total=[...score.values()].reduce((a,b)=>a+b,0);
  if(!(total>0))return[];
  return [...score.entries()].map(([order,s])=>({order,p:s/total})).sort((a,b)=>b.p-a.p);
}
function evaluateConfig(cfg,targetRows){
  const rec=[];
  let history=[];
  let ti=0;
  const targets=new Set(targetRows.map(x=>x.id));
  let day=null,dayRows=[];
  function flush(){
    if(!dayRows.length)return;
    if(history.length>=120){
      for(const t of dayRows){
        if(!targets.has(t.id))continue;
        const dist=distribution(t,history,cfg);
        const picks=dist.slice(0,6).map(x=>x.order);
        rec.push({id:t.id,d:t.d,r:t.r,actual:t.o,payout:Number(t.p)||0,picks});
      }
    }
    history=history.concat(dayRows);dayRows=[];
  }
  for(const row of rows){
    if(day!==null&&row.d!==day)flush();
    day=row.d;dayRows.push(row);
  }
  flush();
  return rec;
}
function metrics(rec,count){
  const n=rec.length;
  if(!n)return{races:0,hits:0,hitRate:0,stake:0,returns:0,roi:0};
  let hits=0,returns=0;
  for(const x of rec){
    const p=x.picks.slice(0,count);
    if(p.includes(x.actual)){hits++;returns+=x.payout;}
  }
  const stake=n*count*100;
  return{races:n,hits,hitRate:hits/n,stake,returns,roi:stake?returns/stake:0};
}

const dates=[...new Set(rows.map(x=>x.d))].sort();
const cutIndex=Math.max(1,Math.floor(dates.length*.7));
const calibrationEnd=dates[cutIndex-1];
const holdoutStart=dates[cutIndex];
const calibTargets=rows.filter(x=>x.d<=calibrationEnd);
const holdoutTargets=rows.filter(x=>x.d>=holdoutStart);

const calibration=[];
for(const cfg of configs){
  const rec=evaluateConfig(cfg,calibTargets);
  const m4=metrics(rec,4);
  const score=m4.hitRate*0.65+Math.min(m4.roi,2)*0.35;
  calibration.push({cfg,m4,score});
}
calibration.sort((a,b)=>b.score-a.score||b.m4.hitRate-a.m4.hitRate||b.m4.roi-a.m4.roi);
const best=calibration[0];
const holdoutRecords=evaluateConfig(best.cfg,holdoutTargets);
const allRecords=evaluateConfig(best.cfg,rows);
const pointCounts=Object.fromEntries(Array.from({length:6},(_,i)=>[String(i+1),metrics(holdoutRecords,i+1)]));

const report={
  schema:'boat-command-edogawa-baseline-backtest-v1',
  venue:'EDOGAWA',venueCode:'03',
  source:input,
  strictWalkForward:true,
  sameDayRowsExcluded:true,
  resultBlockedUntilPrediction:true,
  gamagoriWeightsReused:false,
  calibration:{
    dateCount:cutIndex,
    lastDate:calibrationEnd,
    candidates:calibration.map(x=>({config:x.cfg,metrics4:x.m4,score:x.score})),
    selected:best.cfg
  },
  holdout:{
    role:'UNTOUCHED_TIME_ORDERED_HOLDOUT',
    firstDate:holdoutStart,
    dateCount:dates.length-cutIndex,
    pointCounts,
    metrics4:metrics(holdoutRecords,4)
  },
  allWalkForward:{
    pointCounts:Object.fromEntries(Array.from({length:6},(_,i)=>[String(i+1),metrics(allRecords,i+1)]))
  },
  productionEnabled:false,
  tryEnabled:false,
  promotionEligible:false,
  promotionBlockers:[
    'EDOGAWA_WATER_FEATURES_NOT_VALIDATED',
    'TIDE_MAPPING_NOT_VALIDATED',
    'LOCAL_EXPERIENCE_FEATURE_NOT_VALIDATED'
  ]
};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({
  selected:best.cfg,
  calibration4:best.m4,
  holdout4:report.holdout.metrics4,
  productionEnabled:false
},null,2));
