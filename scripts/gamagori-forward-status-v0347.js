#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const model=require('../gamagori-main-model-v0320.js');

const ROOT=path.join(__dirname,'..');
const LIVE=path.join(ROOT,'live','gamagori');
const HISTORY_PATH=path.join(ROOT,'gamagori-main-history-v0320.json');
const POLICY_PATH=path.join(ROOT,'gamagori-forward-validation-policy-v0346.json');
const STATUS_PATH=path.join(LIVE,'forward-status-v0347.json');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'))}
function writeJson(p,x){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n')}
function dateDirs(){return fs.existsSync(LIVE)?fs.readdirSync(LIVE,{withFileTypes:true}).filter(x=>x.isDirectory()&&/^\d{4}-\d{2}-\d{2}$/.test(x.name)).map(x=>x.name).sort():[]}
function daysInclusive(a,b){const x=Date.parse(a+'T00:00:00Z'),y=Date.parse(b+'T00:00:00Z');return Number.isFinite(x)&&Number.isFinite(y)?Math.floor((y-x)/86400000)+1:0}
function validProgram(pack,race){
  if(!pack||pack.schema!=='boat-command-program-pack-v1')throw new Error('PROGRAM_SCHEMA_INVALID');
  if(pack.venue!=='GAMAGORI'&&pack.venueCode!=='07')throw new Error('VENUE_INVALID');
  if(Number(pack.race)!==race||pack.programReady!==true)throw new Error('PROGRAM_TARGET_INVALID');
  if(pack.resultEndpointsIncluded!==false||pack.resultIncluded!==false||pack.exhibitionIncluded!==false)throw new Error('PROGRAM_BOUNDARY_INVALID');
  const boats=[...(pack.boats||[])].sort((a,b)=>Number(a.lane)-Number(b.lane));
  if(boats.length!==6||boats.some((b,i)=>Number(b.lane)!==i+1))throw new Error('PROGRAM_BOATS_INVALID');
  const classes=boats.map(b=>String(b.class||'').toUpperCase());
  if(classes.some(c=>!['A1','A2','B1','B2'].includes(c)))throw new Error('PROGRAM_CLASSES_INVALID');
  return {boats,classes};
}
function ensureRace7Gate(date,history){
  const programPath=path.join(LIVE,date,'program','race-7.json');
  if(!fs.existsSync(programPath))return null;
  const out=path.join(LIVE,date,'shadow','race-7-trifecta-gate-v0347.json');
  if(fs.existsSync(out))return readJson(out);
  const pack=readJson(programPath),v=validProgram(pack,7);
  const aClassCount=v.classes.filter(c=>c==='A1'||c==='A2').length;
  const dist=model.probabilities({classes:v.classes,race:7,raceType:String(pack.raceType||'')},history.races||[],{targetDate:String(date)});
  const picks=model.select(dist,{count:4,mode:'PROBABILITY'}).map(x=>x.order);
  if(picks.length!==4||picks.some(x=>!model.validPick(x)))throw new Error('TRIFECTA_FREEZE_INVALID');
  const matched=aClassCount===3;
  const gate={
    schema:'boat-command-gamagori-trifecta-forward-gate-v0347',
    version:'0.34.7',
    shadowOnly:true,
    liveBettingEnabled:false,
    stakeChangeEnabled:false,
    targetResultRead:false,
    targetPayoutRead:false,
    venue:'GAMAGORI',venueCode:'07',date,race:7,
    sourceProgramPack:path.relative(ROOT,programPath).replaceAll('\\','/'),
    sourceFetchedAt:pack.fetchedAt||null,
    deadline:pack.deadline||null,
    raceType:String(pack.raceType||''),
    classes:v.classes,aClassCount,
    modelVersion:model.version,
    historySource:'gamagori-main-history-v0320.json',
    historyCutoff:history.cutoff||null,
    historicalPriorResultsUsed:true,
    gate:{label:'race=7 & aClassCount=3',betType:'3連単',variant:'FIXED4',matched,promotionStatus:'NOT_PROMOTED',freshForwardRequired:true,forwardEvaluationMode:'FIXED_30_CALENDAR_DAYS',forwardCycleDays:30},
    frozenTrifectaPicks:matched?picks:[],
    allModelPicks:picks,
    decision:matched?'FORWARD_SHADOW_TRACK':'FORWARD_SHADOW_SKIP',
    frozenAt:pack.fetchedAt||new Date().toISOString(),
    note:'Frozen from PRE-only program data. It never changes LIVE predictions/stakes/hard locks and never reads the target result or payout.'
  };
  writeJson(out,gate);
  return gate;
}
function loadExactaGate(date){
  const p=path.join(LIVE,date,'shadow','race-3-exacta-gate-v0345.json');
  return fs.existsSync(p)?readJson(p):null;
}
function loadTriGate(date){
  const p=path.join(LIVE,date,'shadow','race-7-trifecta-gate-v0347.json');
  return fs.existsSync(p)?readJson(p):null;
}
function loadPost(date,race){
  const p=path.join(LIVE,date,'post',`race-${race}-result.json`);
  if(!fs.existsSync(p))return null;
  const x=readJson(p);
  if(x.schema!=='boat-command-live-result-v1'||x.venue!=='GAMAGORI'||x.date!==date||Number(x.race)!==race)return null;
  return x;
}
function methodSummary(kind,dates,latestDate){
  const exacta=kind==='EXACTA';
  const observations=[];
  for(const date of dates){
    const gate=exacta?loadExactaGate(date):loadTriGate(date);
    if(!gate)continue;
    const matched=Boolean(gate.gate?.matched);
    const picks=exacta?(gate.frozenExactaPicks||[]): (gate.frozenTrifectaPicks||[]);
    const post=matched?loadPost(date,exacta?3:7):null;
    let settled=false,hit=false,stake=0,ret=0,result=null,payout100=null;
    if(matched&&post){
      if(exacta&&/^[1-6]-[1-6]$/.test(String(post.exacta||''))&&Number.isFinite(Number(post.exactaPayout100))){
        settled=true;result=String(post.exacta);payout100=Number(post.exactaPayout100);stake=picks.length*100;hit=picks.includes(result);ret=hit?payout100:0;
      }else if(!exacta&&/^[1-6]-[1-6]-[1-6]$/.test(String(post.trifecta||''))&&Number.isFinite(Number(post.payout100))){
        settled=true;result=String(post.trifecta);payout100=Number(post.payout100);stake=picks.length*100;hit=picks.includes(result);ret=hit?payout100:0;
      }
    }
    observations.push({date,matched,decision:gate.decision,picks,settled,hit,stakeYen:stake,returnYen:ret,result,payout100});
  }
  const startDate=observations[0]?.date||latestDate;
  const day=daysInclusive(startDate,latestDate);
  const tracked=observations.filter(x=>x.matched);
  const settled=tracked.filter(x=>x.settled);
  const stake=settled.reduce((s,x)=>s+x.stakeYen,0),ret=settled.reduce((s,x)=>s+x.returnYen,0);
  const current=observations.find(x=>x.date===latestDate)||null;
  return {
    method:exacta?'2連単':'3連単',
    label:exacta?'3R × 予選 × TOP1':'7R × A級3人 × 4点',
    race:exacta?3:7,
    cycleStartDate:startDate,
    cycleDays:30,
    cycleDay:Math.min(day,30),
    daysRemaining:Math.max(0,30-day),
    cycleStatus:day>=30?'REVIEW_DUE':'COLLECTING',
    observedDays:observations.length,
    matchedRaces:tracked.length,
    settledMatchedRaces:settled.length,
    hits:settled.filter(x=>x.hit).length,
    hitRate:settled.length?settled.filter(x=>x.hit).length/settled.length:null,
    stakeYen:stake,
    returnYen:ret,
    profitYen:ret-stake,
    roi:stake?ret/stake:null,
    current
  };
}

const dates=dateDirs();
if(!dates.length)throw new Error('NO_LIVE_DATES');
const latestDate=dates.at(-1);
const history=readJson(HISTORY_PATH);
if(history.schema!=='boat-command-program-history-v2'||history.exhibitionIncluded!==false)throw new Error('HISTORY_INVALID');
ensureRace7Gate(latestDate,history);
const policy=readJson(POLICY_PATH);
const exacta=methodSummary('EXACTA',dates,latestDate);
const trifecta=methodSummary('TRIFECTA',dates,latestDate);
const manifestPath=path.join(LIVE,latestDate,'program','manifest.json');
const manifest=fs.existsSync(manifestPath)?readJson(manifestPath):null;
const status={
  schema:'boat-command-gamagori-forward-status-v0347',
  version:'0.34.7',
  venue:'GAMAGORI',
  date:latestDate,
  updatedAt:manifest?.fetchedAt||new Date().toISOString(),
  shadowOnly:true,
  liveBettingEnabled:false,
  policy:{source:'gamagori-forward-validation-policy-v0346.json',cycleDays:Number(policy?.evaluation?.cycleDays)||30,cycleType:policy?.evaluation?.cycleType||'FIXED_CALENDAR_WINDOW'},
  program:{races:manifest?.races||null,allProgramReady:manifest?.allProgramReady===true,fetchedAt:manifest?.fetchedAt||null},
  methods:{exacta,trifecta},
  note:'Display-only forward validation status. SHADOW methods cannot alter official LIVE predictions, HARD LOCKs, or stakes.'
};
writeJson(STATUS_PATH,status);
console.log(JSON.stringify({statusPath:path.relative(ROOT,STATUS_PATH),date:latestDate,exacta,trifecta},null,2));
