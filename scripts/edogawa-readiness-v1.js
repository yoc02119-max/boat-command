#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'..');
const liveRoot=path.join(root,'live','edogawa');
const output=process.argv[2]||path.join(root,'venues','edogawa','readiness-v1.json');
const config=JSON.parse(fs.readFileSync(path.join(root,'venues','edogawa','config-v1.json'),'utf8'));
const policy=config.promotionPolicy||{};
const MIN_HISTORY=Number(policy.minimumHistoricalRaces)||300;
const MIN_A=Number(policy.minimumProgramOnlyForwardRaces)||30;
const MIN_B=Number(policy.minimumFullPreForwardRaces)||30;

function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function dirs(p){try{return fs.readdirSync(p,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name)}catch{return[]}}
function files(p,re){try{return fs.readdirSync(p).filter(x=>re.test(x))}catch{return[]}}

const dates=dirs(liveRoot).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort();
const latestDate=dates.at(-1)||null;
const latest=latestDate?path.join(liveRoot,latestDate):null;

let programReady=false,programRaceCount=0,featureSummaryReady=false,featureLocalReady=false,featureSTReady=false;
let preComplete=0,tideSources=0,postResults=0,shadowProgram=0,shadowFull=0,evaluatedProgram=0,evaluatedFull=0;

if(latest){
  const manifest=read(path.join(latest,'program','manifest.json'));
  programReady=!!manifest&&manifest.venue==='EDOGAWA'&&manifest.venueCode==='03'&&manifest.allProgramReady===true&&Number(manifest.races)===12;
  programRaceCount=files(path.join(latest,'program'),/^race-\d+\.json$/).length;

  const feat=read(path.join(latest,'research-feature-summary-v1.json'));
  featureSummaryReady=!!feat&&feat.venueCode==='03'&&feat.audit?.raceCount===12;
  featureLocalReady=featureSummaryReady&&feat.audit?.localStatsReady===true;
  featureSTReady=featureSummaryReady&&feat.audit?.avgSTReady===true;

  for(const name of files(path.join(latest,'pre'),/^race-\d+-pack\.json$/)){
    const x=read(path.join(latest,'pre',name));
    if(x?.venueCode==='03'&&x?.boatMappingVerified===true&&x?.weatherMappingVerified===true&&x?.resultEndpointsIncluded===false)preComplete++;
  }
  tideSources=files(path.join(latest,'pre'),/^race-\d+-tide-source\.json$/).filter(name=>{
    const x=read(path.join(latest,'pre',name));
    return x?.venueCode==='03'&&x?.markerVerified===true&&x?.resultEndpointsIncluded===false;
  }).length;
  postResults=files(path.join(latest,'post'),/^race-\d+-result\.json$/).filter(name=>{
    const x=read(path.join(latest,'post',name));
    return x?.venueCode==='03'&&x?.resultEndpointsIncluded===true&&x?.preRaceDataIncluded===false;
  }).length;
  shadowProgram=files(path.join(latest,'shadow','program-only'),/^race-\d+\.json$/).length;
  shadowFull=files(path.join(latest,'shadow','full-pre'),/^race-\d+\.json$/).length;
  const ev=read(path.join(latest,'research-evaluation-v1.json'));
  evaluatedProgram=Number(ev?.summary?.programOnly?.evaluated)||0;
  evaluatedFull=Number(ev?.summary?.fullPre?.evaluated)||0;
}

const histAudit=read(path.join(root,'edogawa-history-audit-v1.json'));
const histAnalysis=read(path.join(root,'edogawa-history-analysis-v1.json'));
const baseline=read(path.join(root,'edogawa-baseline-backtest-v1.json'));
const historyRows=Number(histAudit?.races)||0;
const historyDays=Number(histAudit?.raceDays)||0;
const historyReady=histAudit?.venueCode==='03'&&histAudit?.readyForResearch===true&&historyRows>=MIN_HISTORY;
const analysisReady=histAnalysis?.venueCode==='03'&&Number(histAnalysis?.races)>=300;
const baselineReady=baseline?.venueCode==='03'&&baseline?.strictWalkForward===true&&baseline?.sameDayRowsExcluded===true&&Number(baseline?.holdout?.metrics4?.races)>0;

const forwardDates=dates.filter(d=>{
  const e=read(path.join(liveRoot,d,'research-evaluation-v1.json'));
  return e?.venueCode==='03'&&(Number(e?.summary?.programOnly?.evaluated)>0||Number(e?.summary?.fullPre?.evaluated)>0);
});
const forwardProgramRaces=forwardDates.reduce((n,d)=>{
  const e=read(path.join(liveRoot,d,'research-evaluation-v1.json')); return n+(Number(e?.summary?.programOnly?.evaluated)||0);
},0);
const forwardFullRaces=forwardDates.reduce((n,d)=>{
  const e=read(path.join(liveRoot,d,'research-evaluation-v1.json')); return n+(Number(e?.summary?.fullPre?.evaluated)||0);
},0);

const blockers=[];
if(!programReady)blockers.push('CURRENT_12R_PROGRAM_NOT_READY');
if(!featureLocalReady)blockers.push('LOCAL_PERFORMANCE_FEATURES_NOT_READY');
if(!featureSTReady)blockers.push('AVERAGE_ST_FEATURES_NOT_READY');
if(!historyReady)blockers.push('HISTORICAL_300_RACE_MINIMUM_NOT_READY');
if(!analysisReady)blockers.push('HISTORICAL_STRUCTURE_ANALYSIS_NOT_READY');
if(!baselineReady)blockers.push('STRICT_WALK_FORWARD_BASELINE_NOT_READY');
if(policy.requireOfficialTideMapping!==false&&tideSources===0)blockers.push('OFFICIAL_TIDE_MAPPING_NOT_READY');
if(forwardProgramRaces<MIN_A)blockers.push(`PROGRAM_ONLY_FORWARD_${MIN_A}_RACES_NOT_READY`);
if(forwardFullRaces<MIN_B)blockers.push(`FULL_PRE_FORWARD_${MIN_B}_RACES_NOT_READY`);

let phase='DATA_LAYER';
if(historyReady)phase='HISTORY_READY';
if(baselineReady)phase='BASELINE_READY';
if(baselineReady&&(shadowProgram>0||forwardProgramRaces>0))phase='SHADOW_VALIDATION';
if(blockers.length===0)phase='PROMOTION_REVIEW_REQUIRED';

const out={
  schema:'boat-command-edogawa-readiness-v1',
  version:'EDOGAWA-READINESS-V1',
  venue:'EDOGAWA',venueCode:'03',
  generatedAt:new Date().toISOString(),
  phase,
  latestDate,
  current:{
    programReady,programRaceCount,
    featureSummaryReady,featureLocalReady,featureSTReady,
    completePreRacePacks:preComplete,
    officialTideSourcePacks:tideSources,
    postResults,
    shadowProgramOnly:shadowProgram,
    shadowFullPre:shadowFull,
    evaluatedProgramOnly:evaluatedProgram,
    evaluatedFullPre:evaluatedFull
  },
  history:{
    rows:historyRows,days:historyDays,ready:historyReady,analysisReady
  },
  baseline:{
    ready:baselineReady,
    holdoutRaces:Number(baseline?.holdout?.metrics4?.races)||0,
    holdoutHitRate:Number(baseline?.holdout?.metrics4?.hitRate)||null,
    holdoutRoi:Number(baseline?.holdout?.metrics4?.roi)||null
  },
  forward:{
    evaluationDays:forwardDates.length,
    programOnlyRaces:forwardProgramRaces,
    fullPreRaces:forwardFullRaces
  },
  blockers,
  policy:{
    minimumHistoricalRaces:MIN_HISTORY,
    minimumProgramOnlyForwardRaces:MIN_A,
    minimumFullPreForwardRaces:MIN_B,
    requireOfficialTideMapping:policy.requireOfficialTideMapping!==false,
    requireHumanReview:policy.requireHumanReview!==false,
    autoPromotion:policy.autoPromotion===true,
    autoTryEnable:policy.autoTryEnable===true
  },
  promotionReviewRequired:blockers.length===0,
  modelEnabled:false,
  tryEnabled:false,
  realMoneyEnabled:false
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({phase,latestDate,historyRows,baselineReady,forwardProgramRaces,forwardFullRaces,blockers},null,2));
