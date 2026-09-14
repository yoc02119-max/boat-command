#!/usr/bin/env node
'use strict';
const fs=require('fs');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const pre=read('gamagori-shadow-pre-v0330.json'),report=read('gamagori-shadow-evaluation-v0333.json'),pred=read('gamagori-replay-predictions-v0333.json'),post=read('gamagori-replay-results-v0333.json');
const fail=message=>{throw new Error(message)};
if(pre.races.length!==360||pre.outcomeFieldsIncluded!==false||pre.resultOddsIncluded!==false||pre.exhibitionIncluded!==false)fail('PRE_RACE_360_BOUNDARY');
if(report.scope.races!==360||report.scope.raceDays!==30||report.scope.hits!==96||report.scope.misses!==264)fail('SHADOW_SCOPE_BASELINE');
if(report.boundaries.designDates.length!==15||report.boundaries.holdoutDates.length!==15||!report.boundaries.strictWalkForward||!report.boundaries.sameDayOutcomeExcluded||!report.boundaries.targetAndFutureOutcomeExcluded||report.boundaries.exhibitionUsed)fail('WALK_FORWARD_BOUNDARY');
if(report.thresholds.source!=='FIRST_15_DAYS_INPUT_DISTRIBUTION_ONLY'||report.boundaries.thresholdsOutcomeOptimized)fail('THRESHOLD_LEAK');
for(const key of ['all','confidence','program','combined'])for(const split of ['design','holdout','all360']){
  const x=report.strategies[key]?.[split];
  if(!x||!Number.isFinite(x.betRaces)||!Number.isFinite(x.skipRaces)||!Number.isFinite(x.maxDrawdown)||x.betRaces+x.skipRaces!==x.sampleRaces)fail(`STRATEGY_METRICS_${key}_${split}`);
}
if(Object.values(report.missAnalysis.primaryFiveClass).reduce((s,v)=>s+v,0)!==264)fail('MISS_CLASS_TOTAL');
if(!report.probabilityAudit.pass||report.probabilityAudit.orders!==120||Math.abs(report.probabilityAudit.minSum-1)>1e-12||Math.abs(report.probabilityAudit.maxSum-1)>1e-12)fail('PROBABILITY_120');
if(report.livePromotionEligible!==false||report.decision!=='STOP_FOR_USER_ADOPTION_DECISION')fail('LIVE_PROMOTION_GUARD');
if(pred.schema!=='boat-command-replay-predictions-v0333'||pred.resultsIncluded!==false||pred.payoutsIncluded!==false||pred.exhibitionIncluded!==false||pred.futureDataIncluded!==false||pred.races.length<360)fail('REPLAY_PRED_BOUNDARY');
if(post.schema!=='boat-command-replay-results-v0333'||post.predictionInputsIncluded!==false||post.races.length!==pred.races.length)fail('REPLAY_RESULT_BOUNDARY');
const forbidden=new Set(['result','resultOdds','payout','payouts','exhibition','finishOrder','winningTrifecta']);
function audit(value,path='root'){
  if(!value||typeof value!=='object')return;
  for(const [key,next] of Object.entries(value)){if(forbidden.has(key))fail(`FORBIDDEN_PRE_FIELD ${path}.${key}`);audit(next,`${path}.${key}`)}
}
audit(pred);
const html=fs.readFileSync('index.html','utf8');
if(!html.includes('data-view="data"><span>⇅</span><em>REPLAY</em>')||html.includes('<em>DATA</em>'))fail('REPLAY_NAV_LABEL');
if((html.match(/historical-replay-v0333\.js/g)||[]).length!==1||html.includes('historical-replay-v0320.js'))fail('REPLAY_SCRIPT_VERSION');
if(!html.includes('<section id="data" class="view">')||html.includes('id="replayCenter"'))fail('EXISTING_DATA_VIEW_NOT_REUSED');
console.log(JSON.stringify({status:'PASS',races:report.scope.races,hits:report.scope.hits,misses:report.scope.misses,strategies:4,replayRows:pred.races.length,livePromotion:false}));
