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
const MIN_TIDE=Number(policy.minimumOfficialTideMappedRaces)||1;
const MIN_PAIRED=Number(policy.minimumPairedForwardRaces)||30;

function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function dirs(p){try{return fs.readdirSync(p,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name)}catch{return[]}}
function files(p,re){try{return fs.readdirSync(p).filter(x=>re.test(x))}catch{return[]}}

const dates=dirs(liveRoot).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort();
const latestDate=dates.at(-1)||null;
const latest=latestDate?path.join(liveRoot,latestDate):null;

let programReady=false,programRaceCount=0,featureSummaryReady=false,featureLocalReady=false,featureSTReady=false;
let preComplete=0,tideSources=0,mappedTide=0,postResults=0,shadowClass=0,shadowProgram=0,shadowRich=0,shadowFull=0,evaluatedClass=0,evaluatedProgram=0,evaluatedRich=0,evaluatedFull=0;

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
  const tideFiles=files(path.join(latest,'pre'),/^race-\d+-tide-source\.json$/);
  tideSources=tideFiles.filter(name=>{
    const x=read(path.join(latest,'pre',name));
    return x?.venueCode==='03'&&x?.markerVerified===true&&x?.resultEndpointsIncluded===false;
  }).length;
  mappedTide=tideFiles.filter(name=>{
    const x=read(path.join(latest,'pre',name));
    return x?.venueCode==='03'&&x?.markerVerified===true&&
      x?.mapping?.status==='EXPLICIT_TEXT_ONLY'&&
      typeof x?.mapping?.tideDirection==='string'&&!!x.mapping.tideDirection&&
      x?.mapping?.inferredFromImageCode===false&&
      x?.resultEndpointsIncluded===false;
  }).length;
  postResults=files(path.join(latest,'post'),/^race-\d+-result\.json$/).filter(name=>{
    const x=read(path.join(latest,'post',name));
    return x?.venueCode==='03'&&x?.resultEndpointsIncluded===true&&x?.preRaceDataIncluded===false;
  }).length;
  shadowClass=files(path.join(latest,'shadow','class-baseline'),/^race-\d+\.json$/).length;
  shadowProgram=files(path.join(latest,'shadow','program-only'),/^race-\d+\.json$/).length;
  shadowRich=files(path.join(latest,'shadow','rich-program'),/^race-\d+\.json$/).length;
  shadowFull=files(path.join(latest,'shadow','full-pre'),/^race-\d+\.json$/).length;
  const ev=read(path.join(latest,'research-evaluation-v1.json'));
  evaluatedClass=Number(ev?.summary?.classBaseline?.evaluated)||0;
  evaluatedProgram=Number(ev?.summary?.programOnly?.evaluated)||0;
  evaluatedRich=Number(ev?.summary?.richProgram?.evaluated)||0;
  evaluatedFull=Number(ev?.summary?.fullPre?.evaluated)||0;
}

const histAudit=read(path.join(root,'edogawa-history-audit-v1.json'));
const histAnalysis=read(path.join(root,'edogawa-history-analysis-v1.json'));
const baseline=read(path.join(root,'edogawa-baseline-backtest-v1.json'));
const richAudit=read(path.join(root,'edogawa-rich-history-audit-v1.json'));
const richBacktest=read(path.join(root,'edogawa-rich-backtest-v1.json'));
const comparison=read(path.join(root,'edogawa-forward-model-comparison-v1.json'));
const lanePriorGate=read(path.join(root,'edogawa-lane-prior-v2-backtest-v1.json'));
const lanePriorV2Eligible=lanePriorGate?.venueCode==='03'&&
  lanePriorGate?.strictWalkForward===true&&lanePriorGate?.sameDayRowsExcluded===true&&
  lanePriorGate?.eligibleForForwardTest===true;
const historyRows=Number(histAudit?.races)||0;
const historyDays=Number(histAudit?.raceDays)||0;
const historyReady=histAudit?.venueCode==='03'&&histAudit?.readyForResearch===true&&historyRows>=MIN_HISTORY;
const analysisReady=histAnalysis?.venueCode==='03'&&Number(histAnalysis?.races)>=300;
const baselineReady=baseline?.venueCode==='03'&&baseline?.strictWalkForward===true&&baseline?.sameDayRowsExcluded===true&&Number(baseline?.holdout?.metrics4?.races)>0;
const richHistoryReady=richAudit?.venueCode==='03'&&richAudit?.readyForRichBacktest===true&&richAudit?.exactBaseCoverage===true;
const richBacktestReady=richBacktest?.venueCode==='03'&&richBacktest?.strictWalkForward===true&&richBacktest?.sameDayRowsExcluded===true&&Number(richBacktest?.holdout?.pointCounts?.['4']?.races)>0;
const comparisonReady=comparison?.venueCode==='03'&&comparison?.ready===true&&
  Number(comparison?.classBaselineVsProgramOnly?.rows)>=MIN_PAIRED&&
  Number(comparison?.programOnlyVsFullPre?.rows)>=MIN_PAIRED;

const forwardDates=dates.filter(d=>{
  const e=read(path.join(liveRoot,d,'research-evaluation-v1.json'));
  return e?.venueCode==='03'&&(Number(e?.summary?.programOnly?.evaluated)>0||Number(e?.summary?.fullPre?.evaluated)>0);
});
const forwardClassRaces=forwardDates.reduce((n,d)=>{
  const e=read(path.join(liveRoot,d,'research-evaluation-v1.json')); return n+(Number(e?.summary?.classBaseline?.evaluated)||0);
},0);
const forwardProgramRaces=forwardDates.reduce((n,d)=>{
  const e=read(path.join(liveRoot,d,'research-evaluation-v1.json')); return n+(Number(e?.summary?.programOnly?.evaluated)||0);
},0);
const forwardRichRaces=forwardDates.reduce((n,d)=>{
  const e=read(path.join(liveRoot,d,'research-evaluation-v1.json')); return n+(Number(e?.summary?.richProgram?.evaluated)||0);
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
if(policy.requireOfficialTideMapping!==false&&mappedTide<MIN_TIDE)blockers.push(`OFFICIAL_TIDE_MAPPING_${MIN_TIDE}_RACES_NOT_READY`);
const waterValidation=read(path.join(root,'edogawa-water-feature-validation-v1.json'));
const waterValidated=waterValidation?.venueCode==='03'&&waterValidation?.ready===true;
if(policy.requireWaterFeatureValidation===true&&!waterValidated)blockers.push('WATER_FEATURE_VALIDATION_NOT_READY');
if(forwardProgramRaces<MIN_A)blockers.push(`PROGRAM_ONLY_FORWARD_${MIN_A}_RACES_NOT_READY`);
if(forwardFullRaces<MIN_B)blockers.push(`FULL_PRE_FORWARD_${MIN_B}_RACES_NOT_READY`);
if(policy.requireForwardModelUplift===true&&!comparisonReady)blockers.push('FORWARD_MODEL_UPLIFT_NOT_READY');

let phase='DATA_LAYER';
if(historyReady)phase='HISTORY_READY';
if(baselineReady)phase='BASELINE_READY';
if(baselineReady&&(shadowProgram>0||forwardProgramRaces>0))phase='SHADOW_VALIDATION';
if(blockers.length===0)phase='PROMOTION_REVIEW_REQUIRED';

const out={
  schema:'boat-command-edogawa-readiness-v1',
  version:'EDOGAWA-READINESS-V1',
  venue:'EDOGAWA',venueCode:'03',
  generatedAt:null,
  phase,
  latestDate,
  current:{
    programReady,programRaceCount,
    featureSummaryReady,featureLocalReady,featureSTReady,
    completePreRacePacks:preComplete,
    officialTideSourcePacks:tideSources,
    explicitlyMappedTidePacks:mappedTide,
    postResults,
    shadowClassBaseline:shadowClass,
    shadowProgramOnly:shadowProgram,
    shadowRichProgram:shadowRich,
    shadowFullPre:shadowFull,
    evaluatedClassBaseline:evaluatedClass,
    evaluatedProgramOnly:evaluatedProgram,
    evaluatedRichProgram:evaluatedRich,
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
  richHistory:{
    ready:richHistoryReady,
    rows:Number(richAudit?.richRaces)||0,
    coverage:Number(richAudit?.coverage)||0,
    exactBaseCoverage:richAudit?.exactBaseCoverage===true
  },
  richModel:{
    ready:richBacktestReady,
    holdoutRaces:Number(richBacktest?.holdout?.pointCounts?.['4']?.races)||0,
    holdoutHitRate:Number(richBacktest?.holdout?.pointCounts?.['4']?.hitRate)||null,
    holdoutRoi:Number(richBacktest?.holdout?.pointCounts?.['4']?.roi)||null,
    hitRateDeltaVsBaseline:richBacktest?.comparisonToClassBaseline?.hitRateDelta??null,
    roiDeltaVsBaseline:richBacktest?.comparisonToClassBaseline?.roiDelta??null,
    productionEnabled:false,
    tryEnabled:false
  },
  forward:{
    evaluationDays:forwardDates.length,
    classBaselineRaces:forwardClassRaces,
    programOnlyRaces:forwardProgramRaces,
    richProgramRaces:forwardRichRaces,
    fullPreRaces:forwardFullRaces,
    comparisonReady,
    pairedClassVsProgram:Number(comparison?.classBaselineVsProgramOnly?.rows)||0,
    pairedProgramVsFull:Number(comparison?.programOnlyVsFullPre?.rows)||0,
    classVsProgramHitDelta:comparison?.classBaselineVsProgramOnly?.hitRateDelta??null,
    classVsProgramRoiDelta:comparison?.classBaselineVsProgramOnly?.roiDelta??null,
    programVsFullHitDelta:comparison?.programOnlyVsFullPre?.hitRateDelta??null,
    programVsFullRoiDelta:comparison?.programOnlyVsFullPre?.roiDelta??null
  },
  blockers,
  policy:{
    minimumHistoricalRaces:MIN_HISTORY,
    minimumProgramOnlyForwardRaces:MIN_A,
    minimumFullPreForwardRaces:MIN_B,
    minimumPairedForwardRaces:MIN_PAIRED,
    requireForwardModelUplift:policy.requireForwardModelUplift===true,
    requireOfficialTideMapping:policy.requireOfficialTideMapping!==false,
    minimumOfficialTideMappedRaces:MIN_TIDE,
    requireWaterFeatureValidation:policy.requireWaterFeatureValidation===true,
    requireHumanReview:policy.requireHumanReview!==false,
    autoPromotion:policy.autoPromotion===true,
    autoTryEnable:policy.autoTryEnable===true
  },
  waterValidation:{ready:waterValidated},
  candidateModel:{
    v2ForwardEligible:lanePriorV2Eligible,
    modelVersion:lanePriorGate?.v2?.modelVersion??null,
    holdoutRaces:Number(lanePriorGate?.v2?.races)||0,
    v1HitRate:lanePriorGate?.v1?.hitRate??null,
    v2HitRate:lanePriorGate?.v2?.hitRate??null,
    hitRateDelta:lanePriorGate?.delta?.hitRate??null,
    v1Roi:lanePriorGate?.v1?.roi??null,
    v2Roi:lanePriorGate?.v2?.roi??null,
    roiDelta:lanePriorGate?.delta?.roi??null,
    productionEnabled:false,
    tryEnabled:false
  },
  promotionReviewRequired:blockers.length===0,
  operation:{
    mode:config.operationPolicy?.mode||null,
    active:config.state==='LIVE_SIMULATION',
    mainModelVersion:config.operationPolicy?.mainModelVersion||null,
    mainLogicFrozen:config.operationPolicy?.mainLogicFrozen===true,
    sharedBankroll:config.operationPolicy?.sharedBankroll===true,
    sharedBankrollStartYen:Number(config.operationPolicy?.sharedBankrollStartYen||0),
    realMoney:false
  },
  modelEnabled:config.modelEnabled===true,
  tryEnabled:config.tryEnabled===true,
  realMoneyEnabled:false
};
fs.mkdirSync(path.dirname(output),{recursive:true});
const _previousReadiness=read('venues/edogawa/readiness-v1.json');
const _previousComparable=_previousReadiness?{..._previousReadiness}:null;
const _nextComparable={...out};
if(_previousComparable)delete _previousComparable.generatedAt;
delete _nextComparable.generatedAt;
out.generatedAt=_previousComparable&&JSON.stringify(_previousComparable)===JSON.stringify(_nextComparable)
  ? (_previousReadiness.generatedAt||new Date().toISOString())
  : new Date().toISOString();
fs.writeFileSync(output,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({phase,latestDate,historyRows,baselineReady,forwardProgramRaces,forwardFullRaces,comparisonReady,blockers},null,2));
