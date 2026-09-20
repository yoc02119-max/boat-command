'use strict';

const crypto=require('crypto');
const core=require('./venue-agent-core-v1.js');

const VERSION='VENUE-AGENT-RESEARCH-V1';
const MIN_SEGMENT_RACES=30;
const MAX_HYPOTHESES=12;

function numberOrNull(v){
  if(v===null||v===undefined||v==='')return null;
  const n=Number(v);
  return Number.isFinite(n)?n:null;
}

function rounded(v,digits=6){
  const n=numberOrNull(v);
  return n===null?null:Number(n.toFixed(digits));
}

function stableId(venueCode,type,key){
  const raw=[venueCode,type,key].join('|');
  return 'H-'+crypto.createHash('sha1').update(raw).digest('hex').slice(0,12);
}

function evidenceScore(delta,sample){
  const d=Math.abs(Number(delta)||0);
  const n=Math.max(0,Number(sample)||0);
  return d*Math.sqrt(n);
}

function pushHypothesis(out,venueCode,type,key,payload){
  out.push({
    id:stableId(venueCode,type,key),
    type,
    researchOnly:true,
    preRaceRuntimeConsumable:false,
    productionMutation:false,
    ...payload
  });
}

function buildHistoryHypotheses(history,venueCode){
  if(!history||typeof history!=='object')return [];
  const out=[];
  const totalRaces=Number(history.races||0);
  const lane1Base=numberOrNull(history?.lane?.lane1FirstRate??history?.lane?.first?.['1']);

  if(lane1Base!==null){
    for(const [raceNumber,row] of Object.entries(history.byRaceNumber||{})){
      const sample=Number(row?.races||0);
      const rate=numberOrNull(row?.lane1FirstRate??row?.lane1WinRate);
      if(sample<MIN_SEGMENT_RACES||rate===null)continue;
      const delta=rate-lane1Base;
      if(Math.abs(delta)<0.08)continue;
      pushHypothesis(out,venueCode,'RACE_NUMBER_LANE1_INTERACTION',String(raceNumber),{
        priorityScore:rounded(evidenceScore(delta,sample)),
        evidence:{
          segment:'raceNumber',
          value:Number(raceNumber),
          races:sample,
          venueLane1FirstRate:rounded(lane1Base),
          segmentLane1FirstRate:rounded(rate),
          delta:rounded(delta)
        },
        experiment:{
          mode:'STRICT_WALK_FORWARD_SHADOW',
          featureFamily:'RACE_NUMBER_X_LANE_PRIOR',
          objective:'IMPROVE_HIT_RATE_WITHOUT_ROI_REGRESSION'
        }
      });
    }

    for(const [raceType,row] of Object.entries(history.byRaceType||{})){
      const sample=Number(row?.races||0);
      const rate=numberOrNull(row?.lane1FirstRate??row?.lane1WinRate);
      if(sample<MIN_SEGMENT_RACES||rate===null)continue;
      const delta=rate-lane1Base;
      if(Math.abs(delta)<0.10)continue;
      pushHypothesis(out,venueCode,'RACE_TYPE_LANE1_INTERACTION',String(raceType),{
        priorityScore:rounded(evidenceScore(delta,sample)),
        evidence:{
          segment:'raceType',
          value:String(raceType),
          races:sample,
          venueLane1FirstRate:rounded(lane1Base),
          segmentLane1FirstRate:rounded(rate),
          delta:rounded(delta)
        },
        experiment:{
          mode:'STRICT_WALK_FORWARD_SHADOW',
          featureFamily:'RACE_TYPE_X_LANE_PRIOR',
          objective:'IMPROVE_HIT_RATE_WITHOUT_ROI_REGRESSION'
        }
      });
    }
  }

  const firstRates=history?.lane?.first||{};
  for(const [firstLane,transitions] of Object.entries(history.firstToSecond||{})){
    if(!transitions||typeof transitions!=='object')continue;
    const estimatedSample=Math.round(totalRaces*(Number(firstRates[firstLane])||0));
    if(estimatedSample<MIN_SEGMENT_RACES)continue;
    let bestLane=null,bestRate=-1;
    for(const [secondLane,value] of Object.entries(transitions)){
      if(String(secondLane)===String(firstLane))continue;
      const rate=numberOrNull(value);
      if(rate!==null&&rate>bestRate){bestLane=secondLane;bestRate=rate;}
    }
    if(bestLane===null||bestRate<0.25)continue;
    pushHypothesis(out,venueCode,'FIRST_TO_SECOND_TRANSITION',firstLane+'>'+bestLane,{
      priorityScore:rounded(bestRate*Math.sqrt(estimatedSample)),
      evidence:{
        firstLane:Number(firstLane),
        candidateSecondLane:Number(bestLane),
        conditionalSecondRate:rounded(bestRate),
        estimatedFirstPlaceSamples:estimatedSample
      },
      experiment:{
        mode:'STRICT_WALK_FORWARD_SHADOW',
        featureFamily:'FIRST_PLACE_X_SECOND_PLACE_TRANSITION',
        objective:'IMPROVE_SECOND_PLACE_ORDERING'
      }
    });
  }
  return out;
}

function backtestPair(backtest,scope='holdout'){
  if(!backtest||typeof backtest!=='object')return null;
  if(scope==='holdout'){
    const x=backtest.holdout2026;
    if(x?.baseline&&x?.candidate)return {baseline:x.baseline,candidate:x.candidate,races:Number(x.records||x.candidate.races||0)};
  }
  if(scope==='recent'){
    const x=backtest.recent360;
    if(x?.baseline&&x?.candidate)return {baseline:x.baseline,candidate:x.candidate,races:Number(x.candidate.races||x.baseline.races||0)};
  }
  if(backtest.baseline&&backtest.candidate){
    return {baseline:backtest.baseline,candidate:backtest.candidate,races:Number(backtest.records||backtest.candidate.races||0)};
  }
  return null;
}

function buildBacktestHypotheses(backtest,venueCode){
  const out=[];
  for(const scope of ['holdout','recent']){
    const pair=backtestPair(backtest,scope);
    if(!pair||pair.races<MIN_SEGMENT_RACES)continue;
    const bh=numberOrNull(pair.baseline.hitRate),ch=numberOrNull(pair.candidate.hitRate);
    const br=numberOrNull(pair.baseline.roi),cr=numberOrNull(pair.candidate.roi);
    if(bh===null||ch===null||br===null||cr===null)continue;
    const hitDelta=ch-bh,roiDelta=cr-br;
    if(hitDelta>=0.01&&roiDelta<=-0.01){
      pushHypothesis(out,venueCode,'HIT_RATE_ROI_TRADEOFF',scope,{
        priorityScore:rounded((hitDelta+Math.abs(roiDelta))*Math.sqrt(pair.races)),
        evidence:{
          scope,
          races:pair.races,
          baselineHitRate:rounded(bh),
          candidateHitRate:rounded(ch),
          hitRateDelta:rounded(hitDelta),
          baselineRoi:rounded(br),
          candidateRoi:rounded(cr),
          roiDelta:rounded(roiDelta)
        },
        experiment:{
          mode:'STRICT_WALK_FORWARD_SHADOW',
          featureFamily:'SELECTION_GATE_CALIBRATION',
          objective:'KEEP_HIT_RATE_GAIN_AND_REMOVE_ROI_REGRESSION'
        }
      });
    }
  }
  return out;
}

function buildHypotheses(history,venueCode,backtest=null){
  return [
    ...buildHistoryHypotheses(history,venueCode),
    ...buildBacktestHypotheses(backtest,venueCode)
  ]
    .sort((a,b)=>(b.priorityScore||0)-(a.priorityScore||0)||a.id.localeCompare(b.id))
    .slice(0,MAX_HYPOTHESES);
}

function sourceCoverage(sources={}){
  return {
    config:!!sources.config,
    readiness:!!sources.readiness,
    historyAnalysis:!!sources.historyAnalysis,
    historyAudit:!!sources.historyAudit,
    shadowEvaluation:!!sources.shadowEvaluation,
    backtest:!!sources.backtest,
    model:!!sources.model
  };
}

function evaluationSnapshot(readiness={},shadow={},backtest={}){
  const s=shadow&&typeof shadow==='object'?shadow:{};
  const f=readiness?.forward||{};
  const b=readiness?.baseline||{};
  const bt=backtestPair(backtest,'holdout')||backtestPair(backtest,'recent')||backtestPair(backtest,'all');

  const baseline={
    hitRate:numberOrNull(s?.classBaseline?.hitRate??f.classHitRate??bt?.baseline?.hitRate),
    roi:numberOrNull(s?.classBaseline?.roi??f.classRoi??bt?.baseline?.roi)
  };
  const candidate={
    hitRate:numberOrNull(s?.programOnly?.hitRate??f.programHitRate??bt?.candidate?.hitRate),
    roi:numberOrNull(s?.programOnly?.roi??f.programRoi??bt?.candidate?.roi)
  };
  const forwardRaces=Number(
    s.pairedRaces??
    f.pairedRaces??
    f.programOnlyRaces??
    bt?.races??
    0
  );
  const backtestStrict=
    backtest?.strictWalkForward===true&&
    backtest?.sameDayRowsExcluded===true&&
    backtest?.resultBlockedUntilPrediction===true;
  const holdoutReady=b.ready===true||backtestStrict;
  const calculatedUplift=
    baseline.hitRate!==null&&candidate.hitRate!==null&&
    baseline.roi!==null&&candidate.roi!==null&&
    candidate.hitRate>baseline.hitRate&&
    candidate.roi>=baseline.roi;
  const holdoutUplift=typeof b.candidateUplift==='boolean'?b.candidateUplift:calculatedUplift;
  const forwardUplift=(s.forwardUpliftReady??f.forwardUpliftReady)===true||
    (backtest?.promotionEligible===true&&calculatedUplift);

  return {
    forwardRaces,
    holdoutReady,
    holdoutUplift,
    forwardUplift,
    baseline,
    candidate
  };
}

function statusFor({historyRaces,historyAnalysis,backtest,hypotheses,evaluation,review}){
  if(historyRaces<core.policy.minimumHistoricalRaces)return 'DATA_BOOTSTRAP';
  if(!historyAnalysis&&backtest)return 'MODEL_EVALUATION';
  if(!historyAnalysis)return 'ANALYSIS_BOOTSTRAP';
  if(hypotheses.length===0)return 'DISCOVERY_WAITING';
  if(evaluation.forwardRaces===0)return 'BACKTEST_QUEUE';
  if(evaluation.forwardRaces<core.policy.minimumForwardRaces)return 'FORWARD_OBSERVATION';
  if(review.eligibleForHumanReview&&evaluation.holdoutUplift&&evaluation.forwardUplift)return 'PROMOTION_REVIEW_CANDIDATE';
  return 'SHADOW_RESEARCH';
}

function daysBetween(a,b){
  const x=Date.parse(a),y=Date.parse(b);
  if(!Number.isFinite(x)||!Number.isFinite(y))return 0;
  return Math.max(0,Math.floor((y-x)/86400000));
}

function preserveHypothesisLifecycle(hypotheses,previous,now){
  const prev=new Map((previous?.hypotheses||[]).map(h=>[h.id,h]));
  return hypotheses.map(h=>{
    const p=prev.get(h.id);
    return {
      ...h,
      firstObservedAt:p?.firstObservedAt||now,
      lastObservedAt:now,
      status:p?.status||'NEEDS_BACKTEST'
    };
  });
}

function buildMemory(input={}){
  const venueCode=String(input.venueCode||'').padStart(2,'0');
  const agent=core.createAgent(venueCode,input.previous||{});
  const now=input.now||new Date().toISOString();
  const history=input.historyAnalysis||null;
  const audit=input.historyAudit||null;
  const readiness=input.readiness||{};
  const shadow=input.shadowEvaluation||{};
  const backtest=input.backtest||null;
  const previous=input.previous||null;
  const historyRaces=Number(
    history?.races??
    audit?.races??
    audit?.validRaces??
    audit?.records??
    readiness?.history?.rows??
    0
  );
  const rawHypotheses=buildHypotheses(history,venueCode,backtest);
  const hypotheses=preserveHypothesisLifecycle(rawHypotheses,previous,now);
  const evaluation=evaluationSnapshot(readiness,shadow,backtest);

  const promotion=agent.assessPromotion({
    noLeakage:true,
    strictHoldout:evaluation.holdoutReady,
    forwardRaces:evaluation.forwardRaces,
    baseline:evaluation.baseline,
    candidate:evaluation.candidate
  });

  const cycleStartedAt=previous?.cycle?.startedAt||now;
  const ageDays=daysBetween(cycleStartedAt,now);
  const due=ageDays>=core.policy.researchCycleDays;
  const status=statusFor({
    historyRaces,
    historyAnalysis:history,
    backtest,
    hypotheses,
    evaluation,
    review:promotion
  });

  return {
    schema:'boat-command-venue-agent-memory-v1',
    version:VERSION,
    agentId:agent.state.agentId,
    venueCode:agent.venue.code,
    venueName:agent.venue.name,
    slug:agent.venue.slug,
    updatedAt:now,
    researchOnly:true,
    preRaceRuntimeConsumable:false,
    productionMutation:false,
    autoPromotion:false,
    cycle:{
      days:core.policy.researchCycleDays,
      startedAt:cycleStartedAt,
      ageDays,
      due
    },
    status,
    sourceCoverage:sourceCoverage(input.sources),
    sourcePaths:input.sourcePaths||{},
    dataCutoff:history?.cutoff??audit?.cutoff??audit?.lastDate??null,
    evidence:{
      historicalRaces:historyRaces,
      historicalRaceDays:Number(
        history?.raceDays??
        audit?.raceDays??
        audit?.uniqueDates??
        readiness?.history?.raceDays??
        0
      ),
      forwardRaces:evaluation.forwardRaces,
      holdoutReady:evaluation.holdoutReady,
      holdoutUplift:evaluation.holdoutUplift,
      forwardUplift:evaluation.forwardUplift
    },
    hypotheses,
    researchQueue:hypotheses.map(h=>({
      hypothesisId:h.id,
      priorityScore:h.priorityScore,
      mode:h.experiment.mode,
      featureFamily:h.experiment.featureFamily,
      objective:h.experiment.objective,
      status:h.status
    })),
    promotionReview:{
      ...promotion,
      eligibleForHumanReview:
        promotion.eligibleForHumanReview&&
        evaluation.holdoutUplift&&
        evaluation.forwardUplift,
      autoPromote:false,
      productionChanged:false
    },
    guardrails:agent.researchPlan()
  };
}

function buildIndex(memories,now=new Date().toISOString()){
  const rows=memories.map(m=>({
    venueCode:m.venueCode,
    venueName:m.venueName,
    slug:m.slug,
    agentId:m.agentId,
    status:m.status,
    cycleDue:m.cycle.due,
    historicalRaces:m.evidence.historicalRaces,
    forwardRaces:m.evidence.forwardRaces,
    hypotheses:m.hypotheses.length,
    reviewCandidate:m.promotionReview.eligibleForHumanReview,
    sourceCoverage:m.sourceCoverage
  }));
  return {
    schema:'boat-command-venue-agent-memory-index-v1',
    version:VERSION,
    generatedAt:now,
    agents:rows.length,
    cycleDue:rows.filter(x=>x.cycleDue).length,
    reviewCandidates:rows.filter(x=>x.reviewCandidate).length,
    statuses:rows.reduce((acc,row)=>{
      acc[row.status]=(acc[row.status]||0)+1;
      return acc;
    },{}),
    rows
  };
}

module.exports=Object.freeze({
  version:VERSION,
  buildHypotheses,
  evaluationSnapshot,
  buildMemory,
  buildIndex
});
