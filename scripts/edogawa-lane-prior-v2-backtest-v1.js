#!/usr/bin/env node
'use strict';
const fs=require('fs');
const v1=require('../edogawa-research-model-v1.js');
const v2=require('../edogawa-research-model-v2.js');

const db=JSON.parse(fs.readFileSync(process.argv[2]||'edogawa-history-bootstrap-v1.json','utf8'));
if(db.venueCode!=='03'||!Array.isArray(db.races)||db.races.length<500)throw new Error('EDOGAWA_HISTORY_REQUIRED');
const rows=[...db.races].sort((a,b)=>String(a.d).localeCompare(String(b.d))||Number(a.r)-Number(b.r));
const dates=[...new Set(rows.map(x=>x.d))].sort();
const cut=Math.max(1,Math.floor(dates.length*.7));
const holdoutStart=dates[cut];
const targets=rows.filter(x=>x.d>=holdoutStart);

function programFrom(row){
  return{
    venue:'EDOGAWA',venueCode:'03',date:row.d,race:Number(row.r),raceType:String(row.t||''),
    resultEndpointsIncluded:false,resultIncluded:false,exhibitionIncluded:false,
    boats:(row.c||[]).map((cls,i)=>({lane:i+1,class:String(cls)}))
  };
}
function evalModel(model){
  const records=[];
  for(const t of targets){
    const p=programFrom(t);
    const d=model.distribution(p,rows,null,{mode:'CLASS_BASELINE',targetDate:t.d});
    const picks=model.select(d,{count:4}).map(x=>x.order);
    const hit=picks.includes(t.o);
    records.push({id:t.id,d:t.d,r:t.r,actual:t.o,picks,hit,payout:Number(t.p)||0});
  }
  const hits=records.filter(x=>x.hit).length;
  const stake=records.length*400;
  const returns=records.reduce((a,x)=>a+(x.hit?x.payout:0),0);
  return{races:records.length,hits,hitRate:records.length?hits/records.length:0,stake,returns,roi:stake?returns/stake:0,records};
}
const a=evalModel(v1),b=evalModel(v2);
const delta={hitRate:b.hitRate-a.hitRate,roi:b.roi-a.roi};
const policy={
  minimumHoldoutRaces:200,
  maxAllowedHitRateRegression:.01,
  maxAllowedRoiRegression:.05,
  requireOneImprovement:true
};
const sampleReady=b.races>=policy.minimumHoldoutRaces;
const noBadHit=delta.hitRate>=-policy.maxAllowedHitRateRegression;
const noBadRoi=delta.roi>=-policy.maxAllowedRoiRegression;
const oneImproved=delta.hitRate>0||delta.roi>0;
const eligibleForForwardTest=sampleReady&&noBadHit&&noBadRoi&&oneImproved;

const out={
  schema:'boat-command-edogawa-lane-prior-v2-backtest-v1',
  venue:'EDOGAWA',venueCode:'03',
  generatedAt:new Date().toISOString(),
  strictWalkForward:true,sameDayRowsExcluded:true,
  holdout:{firstDate:holdoutStart,dateCount:dates.length-cut},
  v1:{modelVersion:v1.version,races:a.races,hits:a.hits,hitRate:a.hitRate,stake:a.stake,returns:a.returns,roi:a.roi},
  v2:{modelVersion:v2.version,races:b.races,hits:b.hits,hitRate:b.hitRate,stake:b.stake,returns:b.returns,roi:b.roi},
  delta,policy,
  sampleReady,noBadHit,noBadRoi,oneImproved,eligibleForForwardTest,
  productionEnabled:false,tryEnabled:false,bankrollAffected:false,
  note:'V2 changes only the lane prior source for this historical class-baseline gate.'
};
fs.writeFileSync(process.argv[3]||'edogawa-lane-prior-v2-backtest-v1.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({v1:out.v1,v2:out.v2,delta,eligibleForForwardTest},null,2));
