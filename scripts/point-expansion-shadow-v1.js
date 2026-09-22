'use strict';
// POST-RACE callers never select new tickets: all variants are frozen here.
const crypto = require('crypto');
const VERSION = 'POINT-EXPANSION-SHADOW-V1';
const valid = x => /^[1-6]-[1-6]-[1-6]$/.test(x) && new Set(x.split('-')).size === 3;
const hash = x => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function build(distribution, selected) {
  const ranked = distribution.rows.map(x => ({order:x.order, probability:x.probability}));
  const base = selected.map(x => typeof x === 'string' ? x : x.order);
  if (ranked.length !== 120 || new Set(ranked.map(x=>x.order)).size !== 120 ||
      ranked.some((x,i)=>!valid(x.order) || !Number.isFinite(x.probability) || x.probability<0 ||
        (i>0 && ranked[i-1].probability<x.probability)) ||
      Math.abs(ranked.reduce((s,x)=>s+x.probability,0)-1)>1e-8 ||
      base.length!==4 || JSON.stringify(base)!==JSON.stringify(ranked.slice(0,4).map(x=>x.order))) {
    throw Error('RANKING_OR_BASELINE_INVALID');
  }
  const orders=ranked.map(x=>x.order), extra=orders.slice(4);
  const heads=new Set(base.map(x=>x[0])), pairs=new Set(base.map(x=>x.slice(0,3)));
  // Pure rank order within each predeclared category. No day-result fitting.
  function supplement(test) {
    const preferred=extra.filter(test);
    return [...base,...[...preferred,...extra.filter(x=>!test(x))].slice(0,2)];
  }
  const variants={BASE4:base,RANK6:orders.slice(0,6),RANK8:orders.slice(0,8),
    HEAD6:supplement(x=>!heads.has(x[0])),
    SECOND6:supplement(x=>heads.has(x[0])&&!pairs.has(x.slice(0,3))),
    THIRD6:supplement(x=>pairs.has(x.slice(0,3)))};
  return {version:VERSION,status:'FROZEN_WITH_BASELINE',baselineHash:hash(base),
    modelConfigHash:hash(distribution.config||null),ranked,variants,
    researchOnly:true,productionEnabled:false,tryEnabled:false,realMoney:false,
    automaticPromotion:false,selectionUsesResults:false};
}
function capture(distribution, selected, mode) {
  if(mode!=='PROGRAM_ONLY') return null;
  // Auxiliary research must not interrupt the existing four-pick writer.
  try { return build(distribution,selected); }
  catch(e) { return {version:VERSION,status:'SKIPPED_INVALID_RANKING',reason:e.message}; }
}
function evaluate(snapshot,result) {
  const e=snapshot?.pointExpansion;
  if(!e || e.status!=='FROZEN_WITH_BASELINE') return null;
  const date=snapshot.date;
  const deadline=Date.parse(`${date}T${snapshot.deadline}:00+09:00`);
  const generated=Date.parse(snapshot.generatedAt);
  if(!Number.isFinite(deadline)||!Number.isFinite(generated)||generated>deadline-180000 ||
    snapshot.mode!=='PROGRAM_ONLY'||snapshot.resultInput!==false||snapshot.payoutInput!==false||
    snapshot.researchOnly!==true||snapshot.productionEnabled!==false||snapshot.tryEnabled!==false||
    snapshot.immutableAfterFirstWrite!==true||
    result?.date!==date||result.venue!==snapshot.venue||result.venueCode!==snapshot.venueCode||
    Number(result.race)!==Number(snapshot.race)||result.evaluationEligible===false||
    result.preRaceDataIncluded!==false||result.resultEndpointsIncluded!==true||
    !valid(result.trifecta)||!Number.isFinite(result.payout100)||result.payout100<0) return null;
  const rebuilt=build({rows:e.ranked},snapshot.picks);
  if(e.version!==VERSION||e.baselineHash!==hash(snapshot.picks)||
    JSON.stringify(rebuilt.variants)!==JSON.stringify(e.variants)) return null;
  const actual=result.trifecta, baseHit=snapshot.picks.includes(actual);
  const miss=baseHit?'HIT':!snapshot.picks.some(x=>x[0]===actual[0])?'HEAD':
    !snapshot.picks.some(x=>x.slice(0,3)===actual.slice(0,3))?'SECOND':'THIRD';
  const variants={};
  for(const [key,picks] of Object.entries(e.variants)) {
    const hit=picks.includes(actual),added=picks.slice(4),addedHit=added.includes(actual);
    variants[key]={picks,hit,addedHit,stake100:picks.length*100,
      payoutOnlyReturn100:hit?result.payout100:0,
      addedStake100:added.length*100,addedPayoutOnlyReturn100:addedHit?result.payout100:0,
      // 2400 yen divides across 4, 6 and 8 tickets at 100-yen increments.
      fixedBudgetStake:2400,fixedBudgetPayoutOnlyReturn:hit?result.payout100*24/picks.length:0};
  }
  return {date,race:snapshot.race,venue:snapshot.venue,venueCode:snapshot.venueCode,
    modelVersion:snapshot.modelVersion,configHash:e.modelConfigHash,generatedAt:snapshot.generatedAt,
    actual,baselineMiss:miss,actualRank:e.ranked.findIndex(x=>x.order===actual)+1,variants};
}
module.exports={VERSION,build,capture,evaluate};
