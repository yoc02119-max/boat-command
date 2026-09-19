#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const model=require('../toda-research-model-v1.js');
const classes=['A1','A2','B1','B2'];
const history=[];
for(let i=0;i<360;i++){
  const day=1+Math.floor(i/12),m=1+Math.floor((day-1)/28),d=1+((day-1)%28);
  const date=`2026-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const r=i%12+1,a=i%6+1,b=(a+i%5+1)%6+1,c=[1,2,3,4,5,6].find(x=>x!==a&&x!==b);
  history.push({d:date,r,c:Array.from({length:6},(_,j)=>classes[(i+j)%4]),o:`${a}-${b}-${c}`,t:r>9?'一般':'予選'});
}
const program={venue:'TODA',venueCode:'02',date:'2026-12-31',race:7,raceType:'予選',boats:Array.from({length:6},(_,i)=>({lane:i+1,class:classes[i%4]})),resultEndpointsIncluded:false,resultIncluded:false,exhibitionIncluded:false};
const d=model.distribution(program,history,{targetDate:'2026-12-31',config:{recencyWindow:300}});
assert.equal(d.version,'TODA-RESEARCH-MODEL-V1');
assert.equal(d.historyRows,300);
assert.ok(Math.abs(d.sum-1)<1e-9);
assert.equal(model.select(d,{count:4}).length,4);
assert.equal(new Set(model.select(d,{count:4}).map(x=>x.order)).size,4);
assert.throws(()=>model.distribution({...program,venue:'EDOGAWA'},history,{targetDate:'2026-12-31'}),/TODA_ONLY/);
assert.throws(()=>model.distribution({...program,resultIncluded:true},history,{targetDate:'2026-12-31'}),/BOUNDARY/);
console.log('TODA_RESEARCH_MODEL_TEST_PASS');
