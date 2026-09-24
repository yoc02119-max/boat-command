#!/usr/bin/env node
'use strict';

/**
 * BOAT COMMAND - racer-period second-place FORWARD SHADOW snapshot v1
 *
 * PRE-RACE only. Preserves the existing venue model first-place prediction,
 * adjusts only the second-place lane with H1-selected period parameters, and
 * chooses the best baseline third conditional on fixed first+candidate second.
 *
 * No result/payout endpoint, no TRY/bankroll/HARD LOCK/production mutation.
 */

const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.join(__dirname,'..');
const registry=require(path.join(ROOT,'venue-registry-v1.js'));

const PARAM_REPORT=path.join(ROOT,'research','racer-period-second-place-shadow-v1.json');
const HIST_REPORT=JSON.parse(fs.readFileSync(PARAM_REPORT,'utf8'));
const PARAMS=new Map((HIST_REPORT.venues||[])
  .filter(v=>v.status==='EVALUATED'&&v.selected?.preset&&Number.isFinite(Number(v.selected?.lambda)))
  .map(v=>[String(v.code),{
    preset:v.selected.preset,
    lambda:Number(v.selected.lambda),
    modelVersion:String(v.modelVersion||''),
    holdoutSecondDeltaVsMarginal:Number(v.holdout?.periodSecondDeltaVsMarginal||0),
    holdoutSecondDeltaVsTop:Number(v.holdout?.periodSecondDeltaVsTop||0),
    holdoutExactDeltaVsTop:Number(v.holdout?.periodExactDeltaVsTop||0)
  }]));

const PRESETS={
  ST_GLOBAL:{three:0,st:-1.00,ability:0,f:-0.05,l:-0.05,c2:0,cst:0,crank:0},
  TOP3_GLOBAL:{three:1.00,st:-0.15,ability:0.15,f:-0.05,l:-0.05,c2:0,cst:0,crank:0},
  GLOBAL_MIX:{three:0.90,st:-0.85,ability:0.35,f:-0.12,l:-0.08,c2:0,cst:0,crank:0},
  COURSE_MIX:{three:0.45,st:-0.45,ability:0.20,f:-0.08,l:-0.05,c2:0.60,cst:-0.55,crank:-0.25},
  START_COURSE:{three:0.15,st:-0.80,ability:0.10,f:-0.10,l:-0.05,c2:0.35,cst:-0.75,crank:-0.35}
};

function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function sha(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}
function validOrder(v){const s=String(v||'');return /^[1-6]-[1-6]-[1-6]$/.test(s)&&new Set(s.split('-')).size===3}
function deadlineMinutes(v){const m=String(v||'').match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null}
function nowJst(){
  const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const o=Object.fromEntries(p.map(x=>[x.type,x.value]));
  return {date:`${o.year}-${o.month}-${o.day}`,minutes:Number(o.hour)*60+Number(o.minute),iso:new Date().toISOString()};
}
function periodKey(date){const [y,m]=String(date).split('-').map(Number);return `${y}-${m<=6?1:2}`}
function zscores(vals){
  const finite=vals.slice(1).filter(Number.isFinite),out=Array(7).fill(0);
  if(finite.length<2)return out;
  const mean=finite.reduce((a,b)=>a+b,0)/finite.length;
  const sd=Math.sqrt(finite.reduce((a,b)=>a+(b-mean)**2,0)/finite.length);
  if(!(sd>1e-12))return out;
  for(let i=1;i<=6;i++)if(Number.isFinite(vals[i]))out[i]=(vals[i]-mean)/sd;
  return out;
}
function periodFeatureScores(records,presetName){
  const w=PRESETS[presetName];if(!w)throw new Error('PERIOD_PRESET_UNKNOWN_'+presetName);
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
  const score=Array(7).fill(0);
  for(let lane=1;lane<=6;lane++)score[lane]=Object.keys(w).reduce((s,k)=>s+Number(w[k]||0)*Number(z[k][lane]||0),0);
  return {score,z};
}
function modelDistribution(v,model,program,history,baseline,date){
  if(v.code==='03'&&String(model.version||'').includes('EDOGAWA')){
    return model.distribution(program,history,null,{mode:'PROGRAM_ONLY',targetDate:date});
  }
  return model.distribution(program,history,{mode:'PROGRAM_ONLY',targetDate:date,config:baseline?.calibration?.selected||null});
}
function baselineCompact(rows){
  if(!Array.isArray(rows)||!rows.length||!validOrder(rows[0].order))return null;
  const top=rows[0].order,first=Number(top.split('-')[0]);
  const secondMass=Array(7).fill(0),bestThird=Array(7).fill(null),bestProb=Array(7).fill(-1);
  for(const x of rows){
    if(!validOrder(x.order)||!Number.isFinite(Number(x.probability)))continue;
    const [a,b,c]=x.order.split('-').map(Number);if(a!==first)continue;
    secondMass[b]+=Number(x.probability);
    if(Number(x.probability)>bestProb[b]){bestProb[b]=Number(x.probability);bestThird[b]=c}
  }
  let marginalSecond=null,mv=-1;
  for(let b=1;b<=6;b++)if(b!==first&&secondMass[b]>mv){mv=secondMass[b];marginalSecond=b}
  if(!marginalSecond||!bestThird[marginalSecond])return null;
  return {top,first,secondMass,bestThird,marginalOrder:`${first}-${marginalSecond}-${bestThird[marginalSecond]}`};
}
function buildCandidate(compact,featureScore,lambda){
  let second=null,best=-Infinity;
  for(let b=1;b<=6;b++){
    if(b===compact.first)continue;
    const s=Math.log(Math.max(compact.secondMass[b],1e-12))+lambda*Number(featureScore[b]||0);
    if(s>best){best=s;second=b}
  }
  const third=compact.bestThird[second];
  if(!second||!third)return null;
  return {second,third,order:`${compact.first}-${second}-${third}`};
}
function periodIndex(date){
  const p=path.join(ROOT,'racer-period-24',periodKey(date)+'.json');
  if(!fs.existsSync(p))return null;
  const x=read(p);
  if(!x||!Array.isArray(x.racers))return null;
  return {path:p,map:new Map(x.racers.map(r=>[Number(r.registration),r])),meta:x};
}
function safeRecords(program,index){
  const records=Array(7).fill(null);
  for(const b of program.boats||[]){
    const lane=Number(b.lane),rec=index.map.get(Number(b.registration));
    if(!(lane>=1&&lane<=6)||!rec||String(rec.class)!==String(b.class))return null;
    records[lane]=rec;
  }
  return records.slice(1).every(Boolean)?records:null;
}

function selfTest(){
  const records=Array(7).fill(null);
  for(let i=1;i<=6;i++)records[i]={period3RateDerived:.3+i*.02,periodAvgST:.20-i*.01,currentAbility:45+i,periodFCountDerived:i%2,periodLCountDerived:0,courses:[{course:i,twoRate:.2+i*.03,avgST:.2-i*.01,avgStartRank:4-i*.2}]};
  const f=periodFeatureScores(records,'GLOBAL_MIX');
  const c={first:1,secondMass:[0,0,.2,.18,.16,.14,.12],bestThird:[null,null,3,2,2,2,2]};
  const x=buildCandidate(c,f.score,.3);
  if(!x||Number(x.order.split('-')[0])!==1)throw new Error('SELF_TEST_FIRST_MUTATION');
  console.log('RACER_PERIOD_FORWARD_SNAPSHOT_SELF_TEST_PASS',x.order);
}

if(process.argv.includes('--self-test')){selfTest();process.exit(0)}

const dateArg=process.argv.find(x=>/^\d{4}-\d{2}-\d{2}$/.test(x))||null;
const now=nowJst(),date=dateArg||now.date;
if(now.date!==date){console.log('FORWARD_SHADOW_DATE_NOT_TODAY',date,now.date);process.exit(0)}
const pindex=periodIndex(date);
if(!pindex){console.log('FORWARD_SHADOW_PERIOD_PACK_MISSING',periodKey(date));process.exit(0)}

let writes=0,eligible=0,joinSkips=0,lateSkips=0;
for(const v of registry.list()){
  const param=PARAMS.get(v.code);
  if(!param||!v.model?.script)continue;
  const modelPath=path.join(ROOT,String(v.model.script).replace(/^\.\//,''));
  const historyPath=path.join(ROOT,v.slug+'-history-bootstrap-v1.json');
  const baselinePath=path.join(ROOT,v.slug+'-baseline-backtest-v1.json');
  if(!fs.existsSync(modelPath)||!fs.existsSync(historyPath)||!fs.existsSync(baselinePath))continue;
  const model=require(modelPath),historyDb=read(historyPath),baseline=read(baselinePath);
  if(!historyDb?.races?.length)continue;
  if(param.modelVersion && String(model.version||'')!==param.modelVersion){
    console.log('FORWARD_SHADOW_MODEL_VERSION_DRIFT',v.code,v.slug,param.modelVersion,model.version||null);
    continue;
  }

  for(let race=1;race<=12;race++){
    const pp=path.join(ROOT,'live',v.slug,date,'program','race-'+race+'.json');
    if(!fs.existsSync(pp))continue;
    const program=read(pp);
    if(!program||program.venue!==v.key||program.venueCode!==v.code||Number(program.race)!==race)continue;
    if(program.resultEndpointsIncluded!==false||program.resultIncluded!==false||program.exhibitionIncluded!==false)throw new Error('FORWARD_PROGRAM_BOUNDARY');
    const dm=deadlineMinutes(program.deadline);
    if(dm==null||dm-now.minutes<3){lateSkips++;continue}
    const out=path.join(ROOT,'live',v.slug,date,'shadow','racer-period-second','race-'+race+'.json');
    if(fs.existsSync(out))continue;

    const records=safeRecords(program,pindex);
    if(!records){joinSkips++;continue}
    const d=modelDistribution(v,model,program,historyDb.races,baseline,date);
    const compact=baselineCompact(d.rows);
    if(!compact)continue;
    const f=periodFeatureScores(records,param.preset);
    const cand=buildCandidate(compact,f.score,param.lambda);
    if(!cand)continue;
    eligible++;

    const payload={
      schema:'boat-command-racer-period-forward-shadow-v1',
      version:'RACER-PERIOD-FORWARD-SHADOW-V1',
      venue:v.key,venueCode:v.code,slug:v.slug,date,race,
      generatedAt:now.iso,deadline:program.deadline,
      modelVersion:model.version,
      firstPlaceSource:'FROZEN_EXISTING_VENUE_MODEL_TOP_ORDER',
      firstPlaceMutation:false,
      baselineTopOrder:compact.top,
      baselineFirst:compact.first,
      marginalSecondOrder:compact.marginalOrder,
      periodCandidateOrder:cand.order,
      selectedPreset:param.preset,selectedLambda:param.lambda,
      selectedFromHistoricalDesign:'2026_H1_ONLY',
      historicalEvidence:{
        strongModelDistributionHoldoutReport:'research/racer-period-second-place-shadow-v1.json',
        mixedSimplifiedRankingReport:'research/racer-period-second-place-audit-v1.json',
        ticketExpansionReport:'research/period-second-expansion-v1.json',
        holdoutSecondDeltaVsMarginal:param.holdoutSecondDeltaVsMarginal,
        holdoutSecondDeltaVsTop:param.holdoutSecondDeltaVsTop,
        holdoutExactDeltaVsTop:param.holdoutExactDeltaVsTop,
        forwardValidationRequired:true
      },
      sources:{
        programPath:path.relative(ROOT,pp).replace(/\\/g,'/'),programSha256:sha(pp),
        historyPath:v.slug+'-history-bootstrap-v1.json',
        baselinePath:v.slug+'-baseline-backtest-v1.json',
        periodPackPath:path.relative(ROOT,pindex.path).replace(/\\/g,'/'),
        parameterReportPath:'research/racer-period-second-place-shadow-v1.json'
      },
      periodJoin:{policy:'RACE_DATE_PERIOD + REGISTRATION + CLASS_MATCH_REQUIRED',allSixMatched:true,period:periodKey(date)},
      candidateFeatureScoreByLane:f.score.slice(1),
      resultInput:false,payoutInput:false,researchOnly:true,productionEnabled:false,tryEnabled:false,cashNeutral:true,
      hardLockEnabled:false,bankrollMutation:false,immutableAfterFirstWrite:true,promotionEligible:false
    };
    if(Number(String(payload.periodCandidateOrder).split('-')[0])!==payload.baselineFirst)throw new Error('FORWARD_FIRST_MUTATION');
    fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,JSON.stringify(payload,null,2)+'\n');
    writes++;
  }
}
console.log('RACER_PERIOD_FORWARD_SHADOW',JSON.stringify({date,writes,eligible,joinSkips,lateSkips}));
