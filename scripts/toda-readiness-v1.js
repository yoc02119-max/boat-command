#!/usr/bin/env node
'use strict';
const fs=require('fs');
function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
const current=read('venues/toda/readiness-v1.json')||{};
const audit=read('toda-history-audit-v1.json'),analysis=read('toda-history-analysis-v1.json'),baseline=read('toda-baseline-backtest-v1.json');
const historyRows=Number(audit?.races||0),historyReady=historyRows>=300,analysisReady=!!analysis&&Number(analysis.races)>=300;
const baselineReady=!!baseline?.holdout?.metrics4?.races;
let phase='DATA_LAYER';if(historyReady)phase='HISTORY_READY';if(historyReady&&analysisReady&&baselineReady)phase='BASELINE_READY';
const blockers=[];
if(!historyReady)blockers.push('HISTORY_300_RACES_NOT_READY');
if(!analysisReady)blockers.push('VENUE_FEATURE_ANALYSIS_NOT_READY');
if(!baselineReady)blockers.push('STRICT_HOLDOUT_NOT_READY');
blockers.push('FORWARD_36_RACES_NOT_READY','FORWARD_60_RACES_NOT_READY','HUMAN_REVIEW_NOT_READY');
const out={
  schema:'boat-command-toda-readiness-v1',version:'TODA-READINESS-V1',venue:'TODA',venueCode:'02',
  generatedAt:new Date().toISOString(),phase,
  current:{programReady:false,programRaceCount:0,postResults:Number(current.current?.postResults||0),shadowPredictions:Number(current.current?.shadowPredictions||0),evaluatedPredictions:Number(current.current?.evaluatedPredictions||0)},
  history:{rows:historyRows,minimumRows:300,primaryRecencyWindowRaces:300,ready:historyReady,analysisReady},
  baseline:{ready:baselineReady,holdoutRaces:Number(baseline?.holdout?.metrics4?.races||0),holdoutHitRate:baselineReady?Number(baseline.holdout.metrics4.hitRate):null,holdoutRoi:baselineReady?Number(baseline.holdout.metrics4.roi):null,architecture:baseline?.architecture||null},
  forward:{evaluationDays:Number(current.forward?.evaluationDays||0),races:Number(current.forward?.races||0),earlyReviewRaces:36,targetReviewRaces:60,ready:Number(current.forward?.races||0)>=60},
  blockers,modelEnabled:false,tryEnabled:false,realMoneyEnabled:false
};
fs.writeFileSync('venues/toda/readiness-v1.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
