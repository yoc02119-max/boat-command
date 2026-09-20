'use strict';

const assert=require('assert');
const registry=require('../venue-registry-v1.js');
const core=require('../venue-agent-core-v1.js');
const policy=require('../venue-agent-policy-v1.json');

const venues=registry.list();
const agents=core.listAgents();

assert.equal(venues.length,24,'VENUE_COUNT');
assert.equal(agents.length,24,'AGENT_COUNT');
assert.equal(new Set(agents.map(a=>a.state.agentId)).size,24,'AGENT_ID_UNIQUE');
assert.equal(new Set(agents.map(a=>a.venue.code)).size,24,'VENUE_CODE_UNIQUE');
assert.equal(policy.venueCount,24,'POLICY_VENUE_COUNT');

for(const agent of agents){
  const plan=agent.researchPlan();
  assert.equal(plan.canFeedPostRaceIntoPreRace,false,'POST_TO_PRE_BLOCKED');
  assert.equal(plan.canMutateHardLock,false,'HARD_LOCK_BLOCKED');
  assert.equal(plan.canMutateProduction,false,'PRODUCTION_MUTATION_BLOCKED');
  assert.equal(plan.canAutoPromote,false,'AUTO_PROMOTE_BLOCKED');
  assert.ok(plan.scope.startsWith('VENUE_ONLY:'),'VENUE_SCOPE');

  const denied=agent.assessPromotion({
    noLeakage:true,
    strictHoldout:true,
    forwardRaces:59,
    baseline:{hitRate:0.2,roi:0.9},
    candidate:{hitRate:0.21,roi:0.91}
  });
  assert.equal(denied.eligibleForHumanReview,false,'MIN_FORWARD_GUARD');

  const review=agent.assessPromotion({
    noLeakage:true,
    strictHoldout:true,
    forwardRaces:60,
    baseline:{hitRate:0.2,roi:0.9},
    candidate:{hitRate:0.21,roi:0.91}
  });
  assert.equal(review.eligibleForHumanReview,true,'REVIEW_GATE');
  assert.equal(review.autoPromote,false,'NO_AUTO_PROMOTION');
  assert.equal(review.productionChanged,false,'NO_PRODUCTION_CHANGE');
}

console.log('VENUE_AGENT_CORE_SMOKE_PASS',{
  version:core.version,
  agents:agents.length,
  cycleDays:core.policy.researchCycleDays,
  autoPromotion:core.policy.autoPromotion,
  productionMutation:core.policy.productionMutation
});
