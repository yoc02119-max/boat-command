#!/usr/bin/env node
'use strict';

/**
 * BOAT COMMAND - racer-period second-place FORWARD SHADOW evaluation v1
 *
 * Reads only immutable PRE-RACE forward snapshots plus verified POST results.
 * It never writes or mutates prediction/TRY/bankroll/HARD LOCK state.
 */

const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const registry=require(path.join(ROOT,'venue-registry-v1.js'));
const OUT=path.join(ROOT,'research','racer-period-forward-evaluation-v1.json');

function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function validOrder(v){const s=String(v||'');return /^[1-6]-[1-6]-[1-6]$/.test(s)&&new Set(s.split('-')).size===3}
function deadlineMs(date,hm){
  if(!/^\d{1,2}:\d{2}$/.test(String(hm||'')))return NaN;
  return Date.parse(`${date}T${hm}:00+09:00`);
}
function validSnapshot(x){
  if(!x||x.schema!=='boat-command-racer-period-forward-shadow-v1')return false;
  if(x.resultInput!==false||x.payoutInput!==false||x.researchOnly!==true||
     x.productionEnabled!==false||x.tryEnabled!==false||x.cashNeutral!==true||
     x.hardLockEnabled!==false||x.bankrollMutation!==false||
     x.immutableAfterFirstWrite!==true||x.promotionEligible!==false)return false;
  if(x.firstPlaceMutation!==false||x.periodJoin?.allSixMatched!==true)return false;
  if(!validOrder(x.baselineTopOrder)||!validOrder(x.marginalSecondOrder)||!validOrder(x.periodCandidateOrder))return false;
  const first=Number(String(x.baselineTopOrder).split('-')[0]);
  if(Number(x.baselineFirst)!==first)return false;
  if(Number(String(x.marginalSecondOrder).split('-')[0])!==first)return false;
  if(Number(String(x.periodCandidateOrder).split('-')[0])!==first)return false;
  const gen=Date.parse(String(x.generatedAt||''));
  const dl=deadlineMs(x.date,x.deadline);
  if(!Number.isFinite(gen)||!Number.isFinite(dl)||gen>dl-180000)return false;
  return true;
}
function validResult(r,x){
  return !!r&&r.schema==='boat-command-live-result-v1'&&
    r.venue===x.venue&&r.venueCode===x.venueCode&&r.date===x.date&&Number(r.race)===Number(x.race)&&
    r.preRaceDataIncluded===false&&r.resultEndpointsIncluded===true&&r.evaluationEligible!==false&&
    validOrder(r.trifecta)&&Number.isFinite(Number(r.payout100))&&Number(r.payout100)>=0;
}
function pairMetrics(rows,key){
  let firstCorrect=0,secondHits=0,exact=0,changed=0,changedSecondWins=0,changedSecondLosses=0;
  for(const z of rows){
    const pred=String(z[key]),actual=String(z.actual);
    const [pa,pb]=pred.split('-').map(Number),[aa,ab]=actual.split('-').map(Number);
    if(pa===aa){firstCorrect++;if(pb===ab)secondHits++}
    if(pred===actual)exact++;
    if(z.periodCandidateOrder!==z.marginalSecondOrder){
      changed++;
      if(key==='periodCandidateOrder'&&pa===aa&&pb===ab)changedSecondWins++;
      if(key==='marginalSecondOrder'&&pa===aa&&pb===ab)changedSecondLosses++;
    }
  }
  return {
    evaluated:rows.length,firstCorrect,
    firstAccuracy:rows.length?firstCorrect/rows.length:null,
    secondHitsWhenFirstCorrect:secondHits,
    secondRateWhenFirstCorrect:firstCorrect?secondHits/firstCorrect:null,
    exactHits:exact,exactRate:rows.length?exact/rows.length:null,
    candidateChangedRaces:changed,changedSecondWins,changedSecondLosses
  };
}
function summarize(rows){
  const top=pairMetrics(rows,'baselineTopOrder');
  const marginal=pairMetrics(rows,'marginalSecondOrder');
  const period=pairMetrics(rows,'periodCandidateOrder');
  return {
    baselineTop:top,marginalSecond:marginal,periodCandidate:period,
    periodSecondDeltaVsMarginal:
      period.secondRateWhenFirstCorrect!=null&&marginal.secondRateWhenFirstCorrect!=null
        ?period.secondRateWhenFirstCorrect-marginal.secondRateWhenFirstCorrect:null,
    periodSecondDeltaVsTop:
      period.secondRateWhenFirstCorrect!=null&&top.secondRateWhenFirstCorrect!=null
        ?period.secondRateWhenFirstCorrect-top.secondRateWhenFirstCorrect:null,
    periodExactDeltaVsTop:
      period.exactRate!=null&&top.exactRate!=null?period.exactRate-top.exactRate:null,
    periodExactDeltaVsMarginal:
      period.exactRate!=null&&marginal.exactRate!=null?period.exactRate-marginal.exactRate:null
  };
}
function collect(){
  const rows=[],invalid={snapshot:0,result:0};
  for(const v of registry.list()){
    const root=path.join(ROOT,'live',v.slug);
    if(!fs.existsSync(root))continue;
    for(const date of fs.readdirSync(root).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort()){
      const dir=path.join(root,date,'shadow','racer-period-second');
      if(!fs.existsSync(dir))continue;
      for(const name of fs.readdirSync(dir).filter(x=>/^race-\d+\.json$/.test(x)).sort()){
        const sp=path.join(dir,name),x=read(sp);
        if(!validSnapshot(x)){invalid.snapshot++;continue}
        const rp=path.join(root,date,'post',`race-${Number(x.race)}-result.json`);
        const r=read(rp);
        if(!r)continue;
        if(!validResult(r,x)){invalid.result++;continue}
        rows.push({
          venue:x.venue,venueCode:x.venueCode,slug:x.slug,date:x.date,race:Number(x.race),
          generatedAt:x.generatedAt,deadline:x.deadline,
          selectedPreset:x.selectedPreset,selectedLambda:x.selectedLambda,
          baselineTopOrder:x.baselineTopOrder,
          marginalSecondOrder:x.marginalSecondOrder,
          periodCandidateOrder:x.periodCandidateOrder,
          candidateChanged:x.periodCandidateOrder!==x.marginalSecondOrder,
          actual:r.trifecta,payout100:Number(r.payout100),
          historicalEvidence:x.historicalEvidence||null
        });
      }
    }
  }
  return {rows,invalid};
}
function selfTest(){
  const x={
    schema:'boat-command-racer-period-forward-shadow-v1',
    venue:'TEST',venueCode:'99',slug:'test',date:'2026-09-25',race:1,
    generatedAt:'2026-09-25T00:50:00.000Z',deadline:'10:00',
    firstPlaceMutation:false,baselineTopOrder:'1-2-3',baselineFirst:1,
    marginalSecondOrder:'1-2-3',periodCandidateOrder:'1-3-2',
    periodJoin:{allSixMatched:true},resultInput:false,payoutInput:false,researchOnly:true,
    productionEnabled:false,tryEnabled:false,cashNeutral:true,hardLockEnabled:false,
    bankrollMutation:false,immutableAfterFirstWrite:true,promotionEligible:false
  };
  if(!validSnapshot(x))throw new Error('SELF_TEST_SNAPSHOT');
  const rows=[{...x,actual:'1-3-2'}];
  const s=summarize(rows);
  if(s.periodCandidate.secondHitsWhenFirstCorrect!==1||s.marginalSecond.secondHitsWhenFirstCorrect!==0)throw new Error('SELF_TEST_METRICS');
  console.log('RACER_PERIOD_FORWARD_EVALUATION_SELF_TEST_PASS');
}
if(process.argv.includes('--self-test')){selfTest();process.exit(0)}

const {rows,invalid}=collect();
const venues=[];
for(const v of registry.list()){
  const r=rows.filter(x=>x.venueCode===v.code);
  if(!r.length)continue;
  const s=summarize(r);
  venues.push({code:v.code,slug:v.slug,key:v.key,evaluationDays:new Set(r.map(x=>x.date)).size,...s});
}
const aggregate=summarize(rows);
const report={
  schema:'boat-command-racer-period-forward-evaluation-v1',
  version:'RACER-PERIOD-FORWARD-EVALUATION-V1',
  generatedAt:new Date().toISOString(),
  researchOnly:true,productionChanged:false,predictionInputChanged:false,tryChanged:false,
  bankrollChanged:false,hardLockChanged:false,promotionEligible:false,
  source:{
    snapshotSchema:'boat-command-racer-period-forward-shadow-v1',
    resultSchema:'boat-command-live-result-v1',
    resultUse:'EVALUATION_ONLY_AFTER_IMMUTABLE_PRE_RACE_SNAPSHOT'
  },
  gates:{
    earlyReviewRaces:36,targetReviewRaces:60,
    earlyReviewReady:rows.length>=36,targetReviewReady:rows.length>=60,
    automaticPromotion:false,
    nextDecision:'REVIEW_FORWARD_EVIDENCE_ONLY_AFTER_TARGET_SAMPLE'
  },
  invalid,aggregate,venues,rows
};
fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
console.log('RACER_PERIOD_FORWARD_EVALUATION',JSON.stringify({
  evaluated:rows.length,venues:venues.length,
  secondDeltaVsMarginal:aggregate.periodSecondDeltaVsMarginal,
  secondDeltaVsTop:aggregate.periodSecondDeltaVsTop,
  exactDeltaVsTop:aggregate.periodExactDeltaVsTop,
  earlyReviewReady:report.gates.earlyReviewReady,targetReviewReady:report.gates.targetReviewReady,
  invalid
}));
