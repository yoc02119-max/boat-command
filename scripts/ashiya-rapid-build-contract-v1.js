#!/usr/bin/env node
'use strict';
const fs=require('fs'),assert=require('node:assert/strict');
const registry=require('../venue-registry-v1.js');
const model=require('../ashiya-research-model-v1.js');
const config=require('../venues/ashiya/config-v1.json');

assert.equal(model.version,'ASHIYA-RESEARCH-MODEL-V1');
assert.equal(model.resultInput,false);
assert.equal(model.payoutInput,false);
assert.equal(config.venueCode,'21');
assert.equal(config.state,'LIVE_SIMULATION');
assert.equal(config.realMoneyEnabled,false);
assert.equal(config.operationPolicy.mainLogicFrozen,true);
assert.equal(config.operationPolicy.sharedBankrollStartYen,1000000);

const k=registry.resolve('21');
assert.equal(k.slug,'ashiya');
assert.equal(k.state,'LIVE_SIMULATION');
assert.equal(k.model.global,'BOAT_COMMAND_ASHIYA_RESEARCH_MODEL_V1');
assert.equal(k.capabilities.try,true);
assert.equal(k.capabilities.realMoney,false);

const history=fs.readFileSync('.github/workflows/ashiya-history-bootstrap-v1.yml','utf8');
const program=fs.readFileSync('.github/workflows/ashiya-program-snapshot-v1.yml','utf8');
const shadow=fs.readFileSync('.github/workflows/ashiya-shadow-research-v1.yml','utf8');
const result=fs.readFileSync('.github/workflows/ashiya-result-collector-v1.yml','utf8');
assert.match(history,/--venue 21/);
assert.match(program,/jcd=10/);
assert.match(result,/jcd=10/);
assert.match(shadow,/live\/ashiya/);
for(const [name,text] of Object.entries({history,program,shadow,result})){
  assert.ok(!text.includes("venueCode':'02"),name+' leaked Toda venueCode');
  assert.ok(!text.includes('jcd=02'),name+' leaked Toda jcd');
}
console.log('ASHIYA_RAPID_BUILD_CONTRACT_PASS');
