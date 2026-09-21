#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');

const [slug,venue,code]=process.argv.slice(2);
if(!slug||!venue||!/^\d{2}$/.test(String(code||'')))throw new Error('USAGE: venue-readiness-refresh-v1.js <slug> <VENUE> <code>');
function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function count(dir,re){try{return fs.readdirSync(dir).filter(x=>re.test(x)).length}catch{return 0}}

const audit=read(slug+'-history-audit-v1.json');
const baseline=read(slug+'-baseline-backtest-v1.json');
const forward=read(slug+'-shadow-evaluation-v1.json');
const old=read(path.join('venues',slug,'readiness-v1.json'))||{};
const historyRows=Number(audit?.races||0),historyReady=historyRows>=300;
const baselineReady=!!baseline?.holdout?.programOnly4?.races;
const holdoutUplift=baseline?.holdout?.candidateUplift===true;
const root=path.join('live',slug);
let latestDate=null;
try{latestDate=fs.readdirSync(root).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort().at(-1)||null}catch{}
const programCount=latestDate?count(path.join(root,latestDate,'program'),/^race-\d+\.json$/):0;
const classShadow=latestDate?count(path.join(root,latestDate,'shadow','class-baseline'),/^race-\d+\.json$/):0;
const programShadow=latestDate?count(path.join(root,latestDate,'shadow','program-only'),/^race-\d+\.json$/):0;
const postCount=latestDate?count(path.join(root,latestDate,'post'),/^race-\d+-result\.json$/):0;
const evaluated=Number(forward?.programOnly?.evaluated||0),paired=Number(forward?.pairedRaces||0);
const forwardUplift=forward?.forwardUpliftReady===true;
let phase='DATA_LAYER';
if(historyReady)phase='HISTORY_READY';
if(historyReady&&baselineReady)phase='SHADOW_VALIDATION';

const blockers=[];
if(!historyReady)blockers.push('HISTORY_300_RACES_NOT_READY');
if(!baselineReady)blockers.push('STRICT_HOLDOUT_NOT_READY');
if(baselineReady&&!holdoutUplift)blockers.push('HOLDOUT_UPLIFT_NOT_READY');
if(evaluated<36)blockers.push('FORWARD_36_RACES_NOT_READY');
if(evaluated<60)blockers.push('FORWARD_60_RACES_NOT_READY');
if(!forwardUplift)blockers.push('FORWARD_MODEL_UPLIFT_NOT_READY');
blockers.push('HUMAN_REVIEW_NOT_READY');

const out={
  schema:'boat-command-'+slug+'-readiness-v1',
  version:venue+'-READINESS-V1',venue,venueCode:code,generatedAt:null,phase,
  latestDate:latestDate||audit?.cutoff||old.latestDate||null,
  current:{programReady:programCount===12,programRaceCount:programCount,postResults:postCount,shadowClassBaseline:classShadow,shadowProgramOnly:programShadow,evaluatedProgramOnly:evaluated},
  history:{
    rows:historyRows,raceDays:Number(audit?.raceDays||0),windowDays:Number(audit?.windowDays||180),
    complete12RaceDays:Number(audit?.complete12RaceDays||0),partialOrCancelledDays:Number(audit?.partialOrCancelledDays||0),
    minimumRows:300,primaryRecencyWindowRaces:300,ready:historyReady,analysisReady:historyReady&&baselineReady
  },
  baseline:{
    ready:baselineReady,holdoutRaces:Number(baseline?.holdout?.programOnly4?.races||0),
    classHitRate:baselineReady?Number(baseline.holdout.classBaseline4.hitRate):null,
    programHitRate:baselineReady?Number(baseline.holdout.programOnly4.hitRate):null,
    classRoi:baselineReady?Number(baseline.holdout.classBaseline4.roi):null,
    programRoi:baselineReady?Number(baseline.holdout.programOnly4.roi):null,
    hitRateDelta:baselineReady?Number(baseline.holdout.hitRateDelta):null,
    roiDelta:baselineReady?Number(baseline.holdout.roiDelta):null,
    candidateUplift:holdoutUplift,selectedConfig:baseline?.calibration?.selected||null
  },
  forward:{
    evaluationDays:Number(forward?.evaluationDays||0),programOnlyRaces:evaluated,pairedRaces:paired,
    earlyReviewRaces:36,targetReviewRaces:60,
    classHitRate:forward?.classBaseline?.hitRate??null,programHitRate:forward?.programOnly?.hitRate??null,
    classRoi:forward?.classBaseline?.roi??null,programRoi:forward?.programOnly?.roi??null,
    hitRateDelta:forward?.hitRateDelta??null,roiDelta:forward?.roiDelta??null,
    earlyReviewReady:evaluated>=36,ready:evaluated>=60,forwardUpliftReady:forwardUplift
  },
  blockers,
  policy:{minimumHistoricalRaces:300,primaryRecencyWindowRaces:300,earlyReviewRaces:36,targetReviewRaces:60,requireHoldoutUplift:true,requireForwardUplift:true,requireHumanReview:true,autoPromotion:false,autoTryEnable:false},
  operation:{mode:'SHADOW_ONLY',active:false,mainLogicFrozen:true,sharedBankroll:true,sharedBankrollStartYen:1000000,realMoney:false},
  modelEnabled:false,tryEnabled:false,realMoneyEnabled:false
};
const _previousReadiness=old;
const _previousComparable=_previousReadiness?{..._previousReadiness}:null;
const _nextComparable={...out};
if(_previousComparable)delete _previousComparable.generatedAt;
delete _nextComparable.generatedAt;
out.generatedAt=_previousComparable&&JSON.stringify(_previousComparable)===JSON.stringify(_nextComparable)
  ? (_previousReadiness.generatedAt||new Date().toISOString())
  : new Date().toISOString();
fs.writeFileSync(path.join('venues',slug,'readiness-v1.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({slug,phase,latestDate:out.latestDate,historyRows,programCount,classShadow,programShadow,postCount,evaluated,holdoutUplift,forwardUplift,blockers}));
