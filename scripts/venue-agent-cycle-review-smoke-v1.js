#!/usr/bin/env node
'use strict';

const assert=require('assert');

const sample={
  cycle:{days:30,startedAt:'2026-08-01T00:00:00Z',ageDays:30,due:true},
  researchQueue:[{hypothesisId:'H-1'}],
  promotionReview:{eligibleForHumanReview:false}
};

function decide(m){
  if(m.cycle?.due!==true)return['IN_CYCLE','CONTINUE_OBSERVATION'];
  if(m.promotionReview?.eligibleForHumanReview===true)return['HUMAN_REVIEW_READY','REVIEW_SHADOW_FOR_PROMOTION'];
  if((m.researchQueue||[]).length>0)return['NEXT_SHADOW_CYCLE','TEST_TOP_RESEARCH_HYPOTHESIS'];
  return['RESEARCH_INCOMPLETE','CONTINUE_DATA_AND_HYPOTHESIS_DISCOVERY'];
}

assert.deepEqual(decide(sample),['NEXT_SHADOW_CYCLE','TEST_TOP_RESEARCH_HYPOTHESIS']);
assert.deepEqual(decide({...sample,promotionReview:{eligibleForHumanReview:true}}),['HUMAN_REVIEW_READY','REVIEW_SHADOW_FOR_PROMOTION']);
assert.deepEqual(decide({...sample,cycle:{...sample.cycle,due:false}}),['IN_CYCLE','CONTINUE_OBSERVATION']);
assert.deepEqual(decide({...sample,researchQueue:[]}),['RESEARCH_INCOMPLETE','CONTINUE_DATA_AND_HYPOTHESIS_DISCOVERY']);

console.log('VENUE_AGENT_CYCLE_REVIEW_SMOKE_PASS');
