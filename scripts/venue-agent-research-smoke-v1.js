#!/usr/bin/env node
'use strict';

const assert=require('assert');
const research=require('../venue-agent-research-v1.js');

function history(venueCode,lane1,race1,race6){
  return {
    venueCode,
    cutoff:'2026-09-20',
    races:1000,
    raceDays:84,
    lane:{
      first:{'1':lane1,'2':0.2,'3':0.15,'4':0.12,'5':0.08,'6':0.05},
      lane1FirstRate:lane1
    },
    firstToSecond:{
      '1':{'1':0,'2':0.40,'3':0.22,'4':0.18,'5':0.12,'6':0.08},
      '2':{'1':0.36,'2':0,'3':0.25,'4':0.17,'5':0.12,'6':0.10}
    },
    byRaceNumber:{
      '1':{races:84,lane1FirstRate:race1},
      '6':{races:84,lane1FirstRate:race6}
    },
    byRaceType:{
      'A':{races:100,lane1FirstRate:lane1+0.12},
      'B':{races:100,lane1FirstRate:lane1-0.12}
    }
  };
}

const a=research.buildMemory({
  venueCode:'02',
  now:'2026-09-21T00:00:00Z',
  historyAnalysis:history('02',0.40,0.62,0.20),
  historyAudit:{races:1000,raceDays:84,cutoff:'2026-09-20'},
  readiness:{
    history:{rows:1000,raceDays:84},
    baseline:{ready:true,candidateUplift:true},
    forward:{
      pairedRaces:60,
      classHitRate:0.18,
      programHitRate:0.22,
      classRoi:0.90,
      programRoi:0.95,
      forwardUpliftReady:true
    }
  },
  shadowEvaluation:{
    pairedRaces:60,
    classBaseline:{hitRate:0.18,roi:0.90},
    programOnly:{hitRate:0.22,roi:0.95},
    forwardUpliftReady:true
  },
  sources:{
    historyAnalysis:{},
    historyAudit:{},
    readiness:{},
    shadowEvaluation:{},
    config:{},
    model:'x'
  }
});

const b=research.buildMemory({
  venueCode:'21',
  now:'2026-09-21T00:00:00Z',
  historyAnalysis:history('21',0.65,0.76,0.42),
  historyAudit:{races:1000,raceDays:84,cutoff:'2026-09-20'},
  readiness:{
    history:{rows:1000,raceDays:84},
    baseline:{ready:true,candidateUplift:false},
    forward:{pairedRaces:0}
  },
  sources:{historyAnalysis:{},historyAudit:{},readiness:{},config:{},model:'x'}
});

assert.equal(a.researchOnly,true);
assert.equal(a.preRaceRuntimeConsumable,false);
assert.equal(a.productionMutation,false);
assert.equal(a.autoPromotion,false);
assert.equal(a.guardrails.canFeedPostRaceIntoPreRace,false);
assert.equal(a.guardrails.canMutateHardLock,false);
assert.equal(a.guardrails.canMutateProduction,false);
assert.equal(a.guardrails.canAutoPromote,false);
assert.equal(a.promotionReview.autoPromote,false);
assert.equal(a.promotionReview.productionChanged,false);
assert.equal(a.promotionReview.eligibleForHumanReview,true);
assert.ok(a.hypotheses.some(x=>x.type==='FIRST_TO_SECOND_TRANSITION'));
assert.ok(a.hypotheses.some(x=>x.type==='RACE_NUMBER_LANE1_INTERACTION'));
assert.notDeepEqual(
  a.hypotheses.map(x=>x.id),
  b.hypotheses.map(x=>x.id),
  'VENUE_DATA_MUST_PRODUCE_DISTINCT_RESEARCH_MEMORY'
);

const index=research.buildIndex([a,b],'2026-09-21T00:00:00Z');
assert.equal(index.agents,2);

console.log('VENUE_AGENT_RESEARCH_SMOKE_PASS',{
  todaHypotheses:a.hypotheses.length,
  ashiyaHypotheses:b.hypotheses.length,
  reviewCandidate:a.promotionReview.eligibleForHumanReview
});
