'use strict';
const assert=require('node:assert/strict');
const {freeze}=require('./pre-race-feature-freeze-v1.js');

const program={
  date:'2026-09-24',deadline:'10:47',fetchedAt:'2026-09-24T09:00:00+09:00',
  raceType:'予選',resultEndpointsIncluded:false,resultIncluded:false,exhibitionIncluded:false,
  boats:Array.from({length:6},(_,i)=>({lane:i+1,class:'B1',avgST:.15,
    motor2Rate:.35,local2Rate:.3,result:'MUST_NOT_COPY'})),
  result:'MUST_NOT_COPY'
};
const generated='2026-09-24T09:01:00+09:00';
const frozen=freeze(program,generated);
assert.equal(frozen.schema,'boat-command-pre-race-feature-freeze-v1');
assert.equal(frozen.boats.length,6);
assert.equal(frozen.boats[0].motor2Rate,.35);
assert.equal('result' in frozen,false);
assert.equal('result' in frozen.boats[0],false);
program.boats[0].motor2Rate=.99;
assert.equal(frozen.boats[0].motor2Rate,.35);
assert.equal(freeze({...program,fetchedAt:'2026-09-24T09:02:00+09:00'},generated),null);
assert.equal(freeze({...program,resultIncluded:true},generated),null);
assert.equal(freeze({...program,boats:program.boats.slice(1)},generated),null);
assert.equal(freeze(program,'2026-09-24T10:45:00+09:00'),null);
console.log('PRE_RACE_FEATURE_FREEZE_PASS');
