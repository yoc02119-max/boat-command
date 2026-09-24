#!/usr/bin/env node
'use strict';

/**
 * BOAT COMMAND · racer-period second-place SHADOW v1
 *
 * Strict historical comparison:
 * - existing venue model remains the frozen baseline
 * - first-place prediction is NEVER changed by the candidate
 * - H1 2026 selects a small candidate preset/lambda per venue
 * - H2 2026 is untouched holdout
 * - racer-period features are joined only by race-date term + registration + class match
 * - historical result is read only after each prediction for scoring
 * - research only; no LIVE/TRY/bankroll/model mutation
 */

const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const registry=require(path.join(ROOT,'venue-registry-v1.js'));
const OUT=path.join(ROOT,'research','racer-period-second-place-shadow-v1.json');

const DESIGN_TO='2026-06-30';
const HOLDOUT_FROM='2026-07-01';
const LAMBDAS=[0.15,0.30,0.50,0.75,1.00];

const PRESETS={
  ST_GLOBAL:{three:0,st:-1.00,ability:0,f:-0.05,l:-0.05,c2:0,cst:0,crank:0},
  TOP3_GLOBAL:{three:1.00,st:-0.15,ability:0.15,f:-0.05,l:-0.05,c2:0,cst:0,crank:0},
  GLOBAL_MIX:{three:0.90,st:-0.85,ability:0.35,f:-0.12,l:-0.08,c2:0,cst:0,crank:0},
  COURSE_MIX:{three:0.45,st:-0.45,ability:0.20,f:-0.08,l:-0.05,c2:0.60,cst:-0.55,crank:-0.25},
  START_COURSE:{three:0.15,st:-0.80,ability:0.10,f:-0.10,l:-0.05,c2:0.35,cst:-0.75,crank:-0.35}
};

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'))}
function validOrder(s){return /^[1-6]-[1-6]-[1-6]$/.test(String(s||''))&&new Set(String(s).split('-')).size===3}
function periodKey(date){
  const [y,m]=String(date).split('-').map(Number);
  return y+'-'+(m<=6?1:2);
}
function argmax(arr,exclude=new Set()){
  let best=null,bv=-Infinity;
  for(let i=1;i<=6;i++){
    if(exclude.has(i))continue;
    const v=Number(arr[i]);
    if(Number.isFinite(v)&&v>bv){bv=v;best=i}
  }
  return best;
}
function zscores(vals){
  const finite=vals.slice(1).filter(Number.isFinite);
  const out=Array(7).fill(0);
  if(finite.length<2)return out;
  const mean=finite.reduce((a,b)=>a+b,0)/finite.length;
  const variance=finite.reduce((a,b)=>a+(b-mean)**2,0)/finite.length;
  const sd=Math.sqrt(variance);
  if(!(sd>1e-12))return out;
  for(let i=1;i<=6;i++)if(Number.isFinite(vals[i]))out[i]=(vals[i]-mean)/sd;
  return out;
}
function featureScores(records){
  const raw={three:Array(7).fill(NaN),st:Array(7).fill(NaN),ability:Array(7).fill(NaN),
             f:Array(7).fill(NaN),l:Array(7).fill(NaN),c2:Array(7).fill(NaN),
             cst:Array(7).fill(NaN),crank:Array(7).fill(NaN)};
  for(let lane=1;lane<=6;lane++){
    const r=records[lane];
    const c=Array.isArray(r?.courses)?r.courses.find(x=>Number(x.course)===lane):null;
    raw.three[lane]=Number(r?.period3RateDerived);
    raw.st[lane]=Number(r?.periodAvgST);
    raw.ability[lane]=Number(r?.currentAbility);
    raw.f[lane]=Number(r?.periodFCountDerived);
    raw.l[lane]=Number(r?.periodLCountDerived);
    raw.c2[lane]=Number(c?.twoRate);
    raw.cst[lane]=Number(c?.avgST);
    raw.crank[lane]=Number(c?.avgStartRank);
  }
  const z=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,zscores(v)]));
  const out={};
  for(const [name,w] of Object.entries(PRESETS)){
    const a=Array(7).fill(0);
    for(let lane=1;lane<=6;lane++){
      a[lane]=Object.keys(w).reduce((sum,k)=>sum+Number(w[k]||0)*Number(z[k][lane]||0),0);
    }
    out[name]=a;
  }
  return out;
}
function modelDistribution(v,model,program,history,baseline,rowDate){
  if(v.code==='03' && String(model.version||'').includes('EDOGAWA')){
    return model.distribution(program,history,null,{mode:'PROGRAM_ONLY',targetDate:rowDate});
  }
  const cfg=baseline?.calibration?.selected||null;
  return model.distribution(program,history,{mode:'PROGRAM_ONLY',targetDate:rowDate,config:cfg});
}
function compactPrediction(rows){
  if(!Array.isArray(rows)||!rows.length||!validOrder(rows[0].order))return null;
  const top=rows[0].order;
  const first=Number(top.split('-')[0]);
  const secondMass=Array(7).fill(0);
  const bestThird=Array(7).fill(null);
  const bestPairProb=Array(7).fill(-1);
  for(const x of rows){
    if(!validOrder(x.order)||!Number.isFinite(Number(x.probability)))continue;
    const [a,b,c]=x.order.split('-').map(Number);
    if(a!==first)continue;
    secondMass[b]+=Number(x.probability);
    if(Number(x.probability)>bestPairProb[b]){
      bestPairProb[b]=Number(x.probability);bestThird[b]=c;
    }
  }
  const marginalSecond=argmax(secondMass,new Set([first]));
  const marginalThird=bestThird[marginalSecond];
  if(!marginalSecond||!marginalThird)return null;
  return {top,first,secondMass,bestThird,marginalOrder:`${first}-${marginalSecond}-${marginalThird}`};
}
function candidateOrder(sample,preset,lambda){
  const f=sample.features[preset],scores=Array(7).fill(-Infinity);
  for(let b=1;b<=6;b++){
    if(b===sample.first)continue;
    scores[b]=Math.log(Math.max(sample.secondMass[b],1e-12))+lambda*(f?.[b]||0);
  }
  const second=argmax(scores,new Set([sample.first]));
  const third=sample.bestThird[second];
  return third?`${sample.first}-${second}-${third}`:sample.marginalOrder;
}
function scoreOrders(samples,fn){
  let firstCorrect=0,secondHitWhenFirst=0,exact=0;
  for(const s of samples){
    const pred=fn(s);
    const [pa,pb]=pred.split('-').map(Number);
    const [aa,ab]=s.actual.split('-').map(Number);
    if(pa===aa){firstCorrect++;if(pb===ab)secondHitWhenFirst++}
    if(pred===s.actual)exact++;
  }
  return {
    races:samples.length,firstCorrect,secondHitWhenFirst,exact,
    secondHitRateWhenFirst:firstCorrect?secondHitWhenFirst/firstCorrect:null,
    exactRate:samples.length?exact/samples.length:null
  };
}
function chooseCandidate(design){
  const baseline=scoreOrders(design,s=>s.top);
  const marginal=scoreOrders(design,s=>s.marginalOrder);
  let best=null;
  for(const preset of Object.keys(PRESETS)){
    for(const lambda of LAMBDAS){
      const m=scoreOrders(design,s=>candidateOrder(s,preset,lambda));
      const row={preset,lambda,...m};
      if(!best ||
         (row.secondHitRateWhenFirst??-1)>(best.secondHitRateWhenFirst??-1)+1e-12 ||
         (Math.abs((row.secondHitRateWhenFirst??0)-(best.secondHitRateWhenFirst??0))<1e-12 && row.exactRate>best.exactRate+1e-12) ||
         (Math.abs((row.secondHitRateWhenFirst??0)-(best.secondHitRateWhenFirst??0))<1e-12 && Math.abs(row.exactRate-best.exactRate)<1e-12 && row.lambda<best.lambda)){
        best=row;
      }
    }
  }
  return {baseline,marginal,best,
    periodDeltaVsMarginal:(best?.secondHitRateWhenFirst??0)-(marginal.secondHitRateWhenFirst??0),
    periodDeltaVsTop:(best?.secondHitRateWhenFirst??0)-(baseline.secondHitRateWhenFirst??0)};
}
function pct(v){return v==null?null:Number(v.toFixed(6))}
function normalizeMetrics(m){return {...m,secondHitRateWhenFirst:pct(m.secondHitRateWhenFirst),exactRate:pct(m.exactRate)}}

const periodPacks={};
for(const name of ['2026-1','2026-2']){
  const p=path.join(ROOT,'racer-period-24',name+'.json');
  const x=readJson(p);
  periodPacks[name]=new Map(x.racers.map(r=>[Number(r.registration),r]));
}

const venueResults=[];
const agg={races:0,firstCorrect:0,baselineSecond:0,marginalSecond:0,periodSecond:0,baselineExact:0,marginalExact:0,periodExact:0};
for(const v of registry.list()){
  if(!v.model?.script)continue;
  const model=require(path.join(ROOT,v.model.script.replace(/^\.\//,'')));
  const historyDb=readJson(path.join(ROOT,v.slug+'-history-bootstrap-v1.json'));
  const rich=readJson(path.join(ROOT,'rich-history-24',v.slug+'-rich-history-v1.json'));
  const baseline=readJson(path.join(ROOT,v.slug+'-baseline-backtest-v1.json'));
  const history=historyDb.races||[];
  const samples=[];
  const skip={join:0,model:0,invalid:0};
  for(const row of [...(rich.races||[])].sort((a,b)=>String(a.d).localeCompare(String(b.d))||Number(a.r)-Number(b.r))){
    if(!validOrder(row.o)||!Array.isArray(row.boats)||row.boats.length!==6){skip.invalid++;continue}
    const pack=periodPacks[periodKey(row.d)];
    if(!pack){skip.join++;continue}
    const records=Array(7).fill(null);
    let safe=true;
    for(const b of row.boats){
      const lane=Number(b.lane),rec=pack.get(Number(b.registration));
      if(!rec||String(rec.class)!==String(b.class)){safe=false;break}
      records[lane]=rec;
    }
    if(!safe||records.slice(1).some(x=>!x)){skip.join++;continue}
    const program={
      venue:v.key,venueCode:v.code,date:row.d,race:Number(row.r),raceType:row.t,
      boats:row.boats.map(b=>({
        lane:Number(b.lane),registration:Number(b.registration),class:String(b.class),
        nationalWinRate:b.nationalWinRate,national2Rate:b.national2Rate,national3Rate:b.national3Rate,
        localWinRate:b.localWinRate,local2Rate:b.local2Rate,local3Rate:b.local3Rate,
        motor:b.motor,motor2Rate:b.motor2Rate,boat:b.boat,boat2Rate:b.boat2Rate,
        avgST:b.avgST
      })),
      resultEndpointsIncluded:false,resultIncluded:false,exhibitionIncluded:false
    };
    let d;
    try{d=modelDistribution(v,model,program,history,baseline,row.d)}
    catch(e){skip.model++;continue}
    const cp=compactPrediction(d.rows);
    if(!cp){skip.model++;continue}
    samples.push({
      date:row.d,race:Number(row.r),actual:row.o,
      ...cp,features:featureScores(records)
    });
  }
  const design=samples.filter(x=>x.date<=DESIGN_TO);
  const holdout=samples.filter(x=>x.date>=HOLDOUT_FROM);
  if(design.length<80||holdout.length<80){
    venueResults.push({code:v.code,slug:v.slug,status:'INSUFFICIENT_SPLIT',samples:samples.length,design:design.length,holdout:holdout.length,skip});
    continue;
  }
  const selected=chooseCandidate(design);
  const preset=selected.best.preset,lambda=selected.best.lambda;
  const hBase=scoreOrders(holdout,s=>s.top);
  const hMarg=scoreOrders(holdout,s=>s.marginalOrder);
  const hPeriod=scoreOrders(holdout,s=>candidateOrder(s,preset,lambda));
  const result={
    code:v.code,slug:v.slug,status:'EVALUATED',
    modelVersion:model.version,
    split:{designTo:DESIGN_TO,holdoutFrom:HOLDOUT_FROM},
    samples:samples.length,designRaces:design.length,holdoutRaces:holdout.length,skip,
    selected:{preset,lambda,
      design:{
        baseline:normalizeMetrics(selected.baseline),
        marginal:normalizeMetrics(selected.marginal),
        period:normalizeMetrics(selected.best),
        periodSecondDeltaVsMarginal:pct(selected.periodDeltaVsMarginal),
        periodSecondDeltaVsTop:pct(selected.periodDeltaVsTop)
      }
    },
    holdout:{
      baseline:normalizeMetrics(hBase),marginal:normalizeMetrics(hMarg),period:normalizeMetrics(hPeriod),
      periodSecondDeltaVsMarginal:pct((hPeriod.secondHitRateWhenFirst??0)-(hMarg.secondHitRateWhenFirst??0)),
      periodSecondDeltaVsTop:pct((hPeriod.secondHitRateWhenFirst??0)-(hBase.secondHitRateWhenFirst??0)),
      periodExactDeltaVsTop:pct((hPeriod.exactRate??0)-(hBase.exactRate??0))
    }
  };
  venueResults.push(result);
  agg.races+=hPeriod.races;
  agg.firstCorrect+=hPeriod.firstCorrect;
  agg.baselineSecond+=hBase.secondHitWhenFirst;
  agg.marginalSecond+=hMarg.secondHitWhenFirst;
  agg.periodSecond+=hPeriod.secondHitWhenFirst;
  agg.baselineExact+=hBase.exact;
  agg.marginalExact+=hMarg.exact;
  agg.periodExact+=hPeriod.exact;
  console.log('PERIOD_SECOND_HOLDOUT',v.code,v.slug,preset,lambda,
    'firstCorrect',hPeriod.firstCorrect,
    'second',hBase.secondHitWhenFirst,hMarg.secondHitWhenFirst,hPeriod.secondHitWhenFirst,
    'exact',hBase.exact,hMarg.exact,hPeriod.exact);
}
const evaluated=venueResults.filter(x=>x.status==='EVALUATED');
const positive=evaluated.filter(x=>x.holdout.period.secondHitWhenFirst>x.holdout.marginal.secondHitWhenFirst).length;
const negative=evaluated.filter(x=>x.holdout.period.secondHitWhenFirst<x.holdout.marginal.secondHitWhenFirst).length;
const equal=evaluated.length-positive-negative;
const report={
  schema:'boat-command-racer-period-second-place-shadow-v1',
  version:'RACER-PERIOD-SECOND-PLACE-SHADOW-V1',
  generatedAt:new Date().toISOString(),
  researchOnly:true,productionChanged:false,predictionInputChanged:false,bankrollChanged:false,tryChanged:false,
  firstPlaceMutation:false,
  source:{
    baseline:'FROZEN_EXISTING_VENUE_RESEARCH_MODELS_AND_BASELINE_CONFIG',
    racerPeriod:'BOAT_RACE_OFFICIAL_HALF_YEAR_ARCHIVE',
    history:'STRICTLY_PAST_BY_TARGET_DATE',
    resultUse:'SCORING_ONLY_AFTER_EACH_HISTORICAL_PREDICTION'
  },
  joinPolicy:'RACE_DATE_PERIOD + REGISTRATION + CLASS_MATCH_REQUIRED',
  split:{design:'2026-01-01..2026-06-30',holdout:'2026-07-01..latest'},
  candidate:{
    designSelection:'PER_VENUE_PRESET_AND_LAMBDA_SELECTED_ON_H1_ONLY',
    preservesBaselineFirst:true,
    secondBase:'MODEL_CONDITIONAL_SECOND_MARGINAL',
    thirdAfterSecond:'HIGHEST_BASELINE_PROBABILITY_CONDITIONAL_ON_FIXED_FIRST_SECOND',
    presets:PRESETS,lambdas:LAMBDAS
  },
  totals:{
    venuesEvaluated:evaluated.length,
    holdoutRaces:agg.races,
    firstCorrect:agg.firstCorrect,
    baselineSecondHitsWhenFirstCorrect:agg.baselineSecond,
    marginalSecondHitsWhenFirstCorrect:agg.marginalSecond,
    periodSecondHitsWhenFirstCorrect:agg.periodSecond,
    baselineSecondRateWhenFirstCorrect:pct(agg.firstCorrect?agg.baselineSecond/agg.firstCorrect:null),
    marginalSecondRateWhenFirstCorrect:pct(agg.firstCorrect?agg.marginalSecond/agg.firstCorrect:null),
    periodSecondRateWhenFirstCorrect:pct(agg.firstCorrect?agg.periodSecond/agg.firstCorrect:null),
    periodDeltaVsMarginal:pct(agg.firstCorrect?(agg.periodSecond-agg.marginalSecond)/agg.firstCorrect:null),
    periodDeltaVsTop:pct(agg.firstCorrect?(agg.periodSecond-agg.baselineSecond)/agg.firstCorrect:null),
    baselineExactRate:pct(agg.races?agg.baselineExact/agg.races:null),
    marginalExactRate:pct(agg.races?agg.marginalExact/agg.races:null),
    periodExactRate:pct(agg.races?agg.periodExact/agg.races:null),
    periodExactDeltaVsTop:pct(agg.races?(agg.periodExact-agg.baselineExact)/agg.races:null),
    venuesPeriodBetterThanMarginal:positive,
    venuesPeriodEqualMarginal:equal,
    venuesPeriodWorseThanMarginal:negative
  },
  promotionEligible:false,
  nextGate:'FORWARD_SHADOW_REQUIRED_BEFORE_ANY_MODEL_CHANGE',
  venues:venueResults
};
fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
if(report.totals.venuesEvaluated<20)throw new Error('TOO_FEW_VENUES_EVALUATED');
console.log('RACER_PERIOD_SECOND_PLACE_SHADOW_PASS',JSON.stringify(report.totals));
