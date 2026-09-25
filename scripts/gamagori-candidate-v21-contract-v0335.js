// Strict contract for the frozen 360-race Candidate V2.1 SHADOW comparison.
'use strict';
const fs=require('fs');
const model=require('../gamagori-candidate-model-v0335.js');
const REPORT=process.argv[2]||'gamagori-candidate-v21-analysis-v0335.json';
const PRE='gamagori-shadow-pre-v0330.json';
const fail=(message)=>{throw new Error(message)};
const near=(actual,expected,tolerance=1e-10)=>Math.abs(actual-expected)<=tolerance;
const report=JSON.parse(fs.readFileSync(REPORT,'utf8'));
const modelSource=fs.readFileSync('gamagori-candidate-model-v0335.js','utf8');

for(const forbidden of ['fetch(', "require('fs')", 'exhibitionTime', 'exhibitionST', 'exhibitionCourse', 'payoutOdds']){
  if(modelSource.includes(forbidden))fail(`FORBIDDEN_MODEL_SOURCE_${forbidden}`);
}

if(report.schema!=='boat-command-gamagori-candidate-v21-analysis-v0335')fail('REPORT_SCHEMA_INVALID');
if(report.status!=='SHADOW_ONLY'||report.decision?.promoteLive!==false)fail('LIVE_PROMOTION_MUST_REMAIN_FALSE');
if(report.baselineModel!=='GAMAGORI-CANDIDATE-V0.33.4')fail('BASELINE_VERSION_CHANGED');
if(report.candidateModel!==model.version||model.baseline!==report.baselineModel)fail('MODEL_VERSION_LINK_INVALID');
if(report.scope?.races!==360||report.scope?.design?.races!==180||report.scope?.holdout?.races!==180)fail('TIME_SPLIT_INVALID');
for(const [name,value] of Object.entries(report.boundaries||{})){
  if(name==='exhibitionUsed'||name==='sameDayOrFutureOutcomeUsed'||name==='hardLockMutation'||name==='livePromotion'){
    if(value!==false)fail(`BOUNDARY_${name}_MUST_BE_FALSE`);
  }else if(value!==true)fail(`BOUNDARY_${name}_MUST_BE_TRUE`);
}

const v2=report.comparison.v2,v21=report.comparison.v21,delta=report.comparison.delta;
if(v2.all.hits!==102||!near(v2.all.hitRate,102/360)||!near(v2.all.roi,1359.6/1440))fail('V2_BASELINE_DRIFT');
if(v2.all.highFrozenV2.races!==251||v2.all.highFrozenV2.hits!==83)fail('V2_HIGH_BASELINE_DRIFT');
if(v21.design.hits!==54||v21.holdout.hits!==51||v21.all.hits!==105)fail('V21_HIT_COUNT_DRIFT');
if(!near(v21.all.hitRate,105/360)||!near(v21.all.roi,1533.1/1440))fail('V21_METRIC_DRIFT');
if(delta.design.hits!==2||delta.holdout.hits!==1||delta.all.hits!==3)fail('V21_SPLIT_DELTA_DRIFT');
if(report.changeAudit.gainedHits!==3||report.changeAudit.lostHits!==0)fail('V21_CHANGE_AUDIT_DRIFT');
if(report.decision.retainShadow!==true||report.decision.highPayoutDependency!==true)fail('V21_DECISION_GUARD_INVALID');

const pre=JSON.parse(fs.readFileSync(PRE,'utf8'));
if(pre.outcomeFieldsIncluded!==false||pre.resultOddsIncluded!==false||pre.exhibitionIncluded!==false)fail('PRE_RACE_SOURCE_CONTAMINATED');
for(const race of pre.races){
  const prediction=model.predict({classes:race.boats.map(x=>x.class),profiles:race.boats.map(x=>({racerWinRate:x.nationalWinRate,localWinRate:x.localWinRate,motor2Rate:x.motor2Rate,averageST:x.averageST}))},{count:4});
  if(prediction.shadowOnly!==true||prediction.exhibitionUsed!==false||prediction.resultDataUsed!==false)fail(`MODEL_BOUNDARY_INVALID_${race.date}_${race.race}`);
  if(prediction.rows.length!==120||prediction.fixed.length!==4)fail(`MODEL_CARDINALITY_INVALID_${race.date}_${race.race}`);
  const sum=prediction.rows.reduce((s,x)=>s+x.probability,0);
  if(!near(sum,1,1e-12))fail(`PROBABILITY_SUM_INVALID_${race.date}_${race.race}_${sum}`);
}

console.log(JSON.stringify({status:'PASS',model:model.version,races:360,baselineHits:102,candidateHits:105,promoteLive:false},null,2));
