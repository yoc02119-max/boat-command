#!/usr/bin/env node
'use strict';
const model=require('../edogawa-rich-model-v2.js');

const program={
 venue:'EDOGAWA',venueCode:'03',date:'2026-09-19',race:5,raceType:'予選',
 resultEndpointsIncluded:false,resultIncluded:false,exhibitionIncluded:false,
 boats:Array.from({length:6},(_,i)=>({
  lane:i+1,class:i===0?'A1':i===1?'A2':'B1',
  nationalWinRate:5+i*.2,national2Rate:.25+i*.02,
  localWinRate:5.2+i*.15,local2Rate:.27+i*.02,
  motor2Rate:.30+i*.015,boat2Rate:.31+i*.01
 }))
};
const cfg={classW:1,abilityW:.5,localW:.75,motorW:.45,boatW:.2,neighbors:120,decay:.5,racePenalty:.5,typePenalty:.65,globalMass:18};
const hist=[];
const orders=model.orders;
for(let i=0;i<360;i++){
 hist.push({
  d:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),r:(i%12)+1,t:i%5===0?'予選特選':'予選',
  boats:Array.from({length:6},(_,j)=>({
   lane:j+1,class:j===0?'A1':j===1?'A2':'B1',
   nationalWinRate:4.5+j*.2+(i%3)*.05,national2Rate:.2+j*.02,
   localWinRate:4.8+j*.18+(i%4)*.04,local2Rate:.22+j*.02,
   motor2Rate:.25+((i+j)%7)*.02,boat2Rate:.27+((i+j)%5)*.02
  })),
  o:orders[i%orders.length],p:500+(i%40)*100
 });
}
const d=model.distribution(program,hist,cfg);
if(Math.abs(d.sum-1)>1e-10)throw new Error('SUM');
if(d.historyRows!==360)throw new Error('HISTORY');
if(d.mode!=='RICH_PROGRAM')throw new Error('MODE');
if(d.resultInput!==false||d.payoutInput!==false||d.exhibitionUsed!==false||d.waterUsed!==false||d.tideUsed!==false)throw new Error('BOUNDARY');
if(d.researchOnly!==true||d.productionEnabled!==false||d.tryEnabled!==false)throw new Error('PROMOTION');
if(model.select(d,4).length!==4)throw new Error('PICKS');
console.log('EDOGAWA_RICH_MODEL_V2_PASS');
