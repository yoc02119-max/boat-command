'use strict';

const registry=require('./venue-registry-v1.js');
const VERSION='VENUE-AGENT-CORE-V1';

const POLICY=Object.freeze({
  researchCycleDays:30,
  strictPreRaceOnly:true,
  hardLockImmutable:true,
  venueIsolation:true,
  crossVenueWeightCopy:false,
  shadowBeforePromotion:true,
  minimumHistoricalRaces:300,
  minimumForwardRaces:60,
  requireHoldout:true,
  requireForwardValidation:true,
  requireHumanReview:true,
  autoPromotion:false,
  productionMutation:false,
  realMoney:false
});

function finite(v){return Number.isFinite(Number(v));}
function rate(v){return finite(v)?Number(v):null;}
function freeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);
    for(const key of Object.keys(value))freeze(value[key]);
  }
  return value;
}

function createAgent(input, persistedState={}){
  const venue=registry.resolve(input);
  if(!venue)throw new Error('UNKNOWN_VENUE');

  const state=freeze({
    schema:'boat-command-venue-agent-state-v1',
    agentId:`venue-agent:${venue.code}:${venue.slug}`,
    venueCode:venue.code,
    venueName:venue.name,
    slug:venue.slug,
    cycleDays:POLICY.researchCycleDays,
    cycleStartedAt:persistedState.cycleStartedAt||null,
    lastEvaluatedAt:persistedState.lastEvaluatedAt||null,
    activeCandidate:persistedState.activeCandidate||null,
    status:persistedState.status||'OBSERVE',
    notes:Array.isArray(persistedState.notes)?persistedState.notes.slice(-20):[]
  });

  function researchPlan(){
    return freeze({
      agentId:state.agentId,
      venueCode:venue.code,
      scope:`VENUE_ONLY:${venue.slug}`,
      mode:'RESEARCH_SHADOW_ONLY',
      canReadHistoricalPreRace:true,
      canReadHistoricalResultsForEvaluation:true,
      canReadCurrentPostRaceForEvaluation:true,
      canFeedPostRaceIntoPreRace:false,
      canMutateHardLock:false,
      canMutateProduction:false,
      canAutoPromote:false,
      allowedOutputs:['HYPOTHESIS','BACKTEST_REPORT','SHADOW_CANDIDATE','PROMOTION_REVIEW']
    });
  }

  function assessPromotion(input={}){
    const baseline=input.baseline||{};
    const candidate=input.candidate||{};
    const sample=Number(input.forwardRaces||0);
    const blockers=[];
    if(input.noLeakage!==true)blockers.push('NO_LEAKAGE_NOT_PROVEN');
    if(input.strictHoldout!==true)blockers.push('STRICT_HOLDOUT_NOT_PROVEN');
    if(sample<POLICY.minimumForwardRaces)blockers.push('FORWARD_SAMPLE_TOO_SMALL');

    const bh=rate(baseline.hitRate),ch=rate(candidate.hitRate);
    const br=rate(baseline.roi),cr=rate(candidate.roi);
    if(bh===null||ch===null)blockers.push('HIT_RATE_MISSING');
    else if(ch<=bh)blockers.push('HIT_RATE_NOT_IMPROVED');
    if(br!==null&&cr!==null&&cr<br)blockers.push('ROI_REGRESSION');

    return freeze({
      agentId:state.agentId,
      venueCode:venue.code,
      eligibleForHumanReview:blockers.length===0,
      autoPromote:false,
      productionChanged:false,
      blockers,
      comparison:{
        forwardRaces:sample,
        baselineHitRate:bh,
        candidateHitRate:ch,
        baselineRoi:br,
        candidateRoi:cr
      }
    });
  }

  return freeze({
    version:VERSION,
    venue,
    state,
    policy:POLICY,
    researchPlan,
    assessPromotion
  });
}

function listAgents(){
  return freeze(registry.list().map(v=>createAgent(v.code)));
}

module.exports=freeze({
  version:VERSION,
  policy:POLICY,
  createAgent,
  listAgents
});
