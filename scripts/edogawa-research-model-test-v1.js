#!/usr/bin/env node
'use strict';
const model=require('../edogawa-research-model-v1.js');
const feature=require('../edogawa-feature-contract-v1.js');

const program={
  venue:'EDOGAWA',venueCode:'03',date:'2026-09-19',race:1,raceType:'予選',
  resultEndpointsIncluded:false,resultIncluded:false,exhibitionIncluded:false,
  boats:Array.from({length:6},(_,i)=>({
    lane:i+1,class:i===0?'A1':i===1?'A2':'B1',
    nationalWinRate:5+i*.1,localWinRate:5.2+i*.08,
    national2Rate:.3+i*.01,local2Rate:.32+i*.01,
    motor2Rate:.33+i*.01,boat2Rate:.31+i*.01,avgST:.16+i*.01
  }))
};
const pre={
 schema:'boat-command-edogawa-pre-race-pack-v1',venue:'EDOGAWA',venueCode:'03',date:'2026-09-19',race:1,
 resultEndpointsIncluded:false,payoutEndpointsIncluded:false,predictionEnabled:false,hardLockEnabled:false,
 boatMappingVerified:true,weatherMappingVerified:true,
 boats:Array.from({length:6},(_,i)=>({lane:i+1,exhibitionTime:6.75+i*.02,tilt:0})),
 startExhibition:Array.from({length:6},(_,i)=>({course:i+1,st:'.'+String(11+i).padStart(2,'0')})),
 water:{airTempC:25,windSpeedMps:3,waterTempC:25,waveHeightCm:8,windDirectionCode:'is-wind3',tideMappingStatus:'PENDING_EDOGAWA_OFFICIAL_SOURCE_MAP'}
};
const fx=feature.extract(program,pre);
const orders=model.orders;
const hist=[];
for(let i=0;i<360;i++){
  const d=new Date(Date.UTC(2025,0,1+i));
  const ds=d.toISOString().slice(0,10);
  hist.push({
    d:ds,r:(i%12)+1,
    c:[i%5===0?'A1':'B1',i%3===0?'A2':'B1','B1','B1','B1','B1'],
    t:i%12===11?'特選':'予選',
    o:orders[i%orders.length],
    p:500+(i%50)*100
  });
}
const z=model.distribution(program,hist,null,{mode:'CLASS_BASELINE',targetDate:'2026-09-19'});
const a=model.distribution(program,hist,null,{mode:'PROGRAM_ONLY',targetDate:'2026-09-19'});
const b=model.distribution(program,hist,fx,{mode:'FULL_PRE_RACE',targetDate:'2026-09-19'});
for(const x of [z,a,b]){
  if(Math.abs(x.sum-1)>1e-12)throw new Error('PROB_SUM');
  if(x.historyRows!==360)throw new Error('HISTORY_ROWS');
  if(x.researchOnly!==true||x.productionEnabled!==false||x.tryEnabled!==false)throw new Error('PROMOTION_BOUNDARY');
  if(x.resultInput!==false||x.payoutInput!==false||x.waterUsed!==false||x.tideUsed!==false)throw new Error('INPUT_BOUNDARY');
  if(model.select(x,{count:4}).length!==4)throw new Error('SELECT_COUNT');
}
if(z.mode!=='CLASS_BASELINE'||a.mode!=='PROGRAM_ONLY'||b.mode!=='FULL_PRE_RACE')throw new Error('MODE');
if(JSON.stringify(z.laneScores)===JSON.stringify(a.laneScores))throw new Error('CLASS_CONTROL_MUST_DIFFER_FROM_PROGRAM_ENRICHED');
console.log('EDOGAWA_RESEARCH_MODEL_PASS');
