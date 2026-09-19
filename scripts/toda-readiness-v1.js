#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function countFiles(dir,re){try{return fs.readdirSync(dir).filter(x=>re.test(x)).length}catch{return 0}}
const current=read('venues/toda/readiness-v1.json')||{};
const audit=read('toda-history-audit-v1.json'),analysis=read('toda-history-analysis-v1.json'),baseline=read('toda-baseline-backtest-v1.json'),forwardEval=read('toda-shadow-evaluation-v1.json');
const historyRows=Number(audit?.races||0),historyReady=historyRows>=300,analysisReady=!!analysis&&Number(analysis.races)>=300,baselineReady=!!baseline?.holdout?.metrics4?.races;
const liveRoot=path.join('live','toda');
let latestDate=null;
try{latestDate=fs.readdirSync(liveRoot).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort().at(-1)||null}catch{}
const programCount=latestDate?countFiles(path.join(liveRoot,latestDate,'program'),/^race-\d+\.json$/):0;
const shadowCount=latestDate?countFiles(path.join(liveRoot,latestDate,'shadow','program-only'),/^race-\d+\.json$/):0;
const postCount=latestDate?countFiles(path.join(liveRoot,latestDate,'post'),/^race-\d+-result\.json$/):0;
const evaluated=Number(forwardEval?.evaluatedRows||0),evalDays=Number(forwardEval?.evaluationDays||0);
let phase='DATA_LAYER';if(historyReady)phase='HISTORY_READY';if(historyReady&&analysisReady&&baselineReady)phase='SHADOW_VALIDATION';
const blockers=[];
if(!historyReady)blockers.push('HISTORY_300_RACES_NOT_READY');
if(!analysisReady)blockers.push('VENUE_FEATURE_ANALYSIS_NOT_READY');
if(!baselineReady)blockers.push('STRICT_HOLDOUT_NOT_READY');
if(evaluated<36)blockers.push('FORWARD_36_RACES_NOT_READY');
if(evaluated<60)blockers.push('FORWARD_60_RACES_NOT_READY');
blockers.push('HUMAN_REVIEW_NOT_READY');
const out={
  schema:'boat-command-toda-readiness-v1',version:'TODA-READINESS-V1',venue:'TODA',venueCode:'02',generatedAt:new Date().toISOString(),phase,latestDate,
  current:{programReady:programCount===12,programRaceCount:programCount,postResults:postCount,shadowPredictions:shadowCount,evaluatedPredictions:evaluated},
  history:{rows:historyRows,minimumRows:300,primaryRecencyWindowRaces:300,ready:historyReady,analysisReady},
  baseline:{ready:baselineReady,holdoutRaces:Number(baseline?.holdout?.metrics4?.races||0),holdoutHitRate:baselineReady?Number(baseline.holdout.metrics4.hitRate):null,holdoutRoi:baselineReady?Number(baseline.holdout.metrics4.roi):null,architecture:baseline?.architecture||null,selectedConfig:baseline?.calibration?.selected||null},
  forward:{evaluationDays:evalDays,races:evaluated,earlyReviewRaces:36,targetReviewRaces:60,hitRate:Number.isFinite(Number(forwardEval?.hitRate))?Number(forwardEval.hitRate):null,roi:Number.isFinite(Number(forwardEval?.roi))?Number(forwardEval.roi):null,earlyReviewReady:evaluated>=36,ready:evaluated>=60},
  blockers,modelEnabled:false,tryEnabled:false,realMoneyEnabled:false
};
fs.writeFileSync('venues/toda/readiness-v1.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
