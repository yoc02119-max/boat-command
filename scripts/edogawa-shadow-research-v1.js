#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const modelV1=require('../edogawa-research-model-v1.js');
const modelV2=require('../edogawa-research-model-v2.js');
const feature=require('../edogawa-feature-contract-v1.js');

const date=process.argv[2]||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const root=path.join(__dirname,'..');
const historyPath=path.join(root,'edogawa-history-bootstrap-v1.json');
if(!fs.existsSync(historyPath)){console.log('EDOGAWA_SHADOW_WAIT_HISTORY');process.exit(0)}
const historyDb=JSON.parse(fs.readFileSync(historyPath,'utf8'));
if(historyDb.venueCode!=='03'||!Array.isArray(historyDb.races)||historyDb.races.length<300){console.log('EDOGAWA_SHADOW_WAIT_HISTORY_300');process.exit(0)}

function readExistingModelVersion(date){
  const base=path.join(root,'live','edogawa',date,'shadow','program-only');
  if(!fs.existsSync(base))return null;
  for(const name of fs.readdirSync(base).filter(x=>/^race-\d+\.json$/.test(x)).sort()){
    try{
      const x=JSON.parse(fs.readFileSync(path.join(base,name),'utf8'));
      if(x?.modelVersion)return String(x.modelVersion);
    }catch{}
  }
  return null;
}
const existingModelVersion=readExistingModelVersion(date);
const gatePath=path.join(root,'edogawa-lane-prior-v2-backtest-v1.json');
let v2Eligible=false;
if(fs.existsSync(gatePath)){
  try{
    const gate=JSON.parse(fs.readFileSync(gatePath,'utf8'));
    v2Eligible=gate?.schema==='boat-command-edogawa-lane-prior-v2-backtest-v1'&&
      gate?.venueCode==='03'&&gate?.strictWalkForward===true&&
      gate?.eligibleForForwardTest===true;
  }catch{}
}
let model;
if(existingModelVersion===modelV1.version)model=modelV1;
else if(existingModelVersion===modelV2.version)model=modelV2;
else if(existingModelVersion)throw new Error('EDOGAWA_UNKNOWN_SAME_DAY_MODEL_VERSION '+existingModelVersion);
else model=v2Eligible?modelV2:modelV1;
console.log('EDOGAWA_SHADOW_MODEL_VERSION',model.version,existingModelVersion?'SAME_DAY_PINNED':(v2Eligible?'V2_GATE_PASS':'V2_GATE_NOT_READY'));

function nowJst(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const o=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return {date:`${o.year}-${o.month}-${o.day}`,minutes:Number(o.hour)*60+Number(o.minute),iso:new Date().toISOString()};
}
function deadlineMinutes(hm){const m=String(hm||'').match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null}
function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function sha256File(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}
function writeOnce(p,payload){
  if(fs.existsSync(p)){console.log('EDOGAWA_SHADOW_KEEP_IMMUTABLE',path.relative(root,p));return false}
  fs.mkdirSync(path.dirname(p),{recursive:true});
  fs.writeFileSync(p,JSON.stringify(payload,null,2)+'\n');
  console.log('EDOGAWA_SHADOW_WRITE',path.relative(root,p));
  return true;
}
function snapshot(program,fx,mode,generatedAt,sources){
  const d=model.distribution(program,historyDb.races,fx,{mode,targetDate:date});
  const picks=model.select(d,{count:4});
  return {
    schema:'boat-command-edogawa-shadow-research-v1',
    version:'EDOGAWA-SHADOW-RESEARCH-V1',
    venue:'EDOGAWA',venueCode:'03',date,race:Number(program.race),
    mode,generatedAt,
    deadline:program.deadline||null,
    modelVersion:model.version,
    featureVersion:feature.version,
    historyRows:d.historyRows,
    historyCutoff:historyDb.cutoff||null,
    sources:{
      programPath:sources.programPath,
      programSha256:sources.programSha256,
      programFetchedAt:program.fetchedAt||null,
      preRacePath:sources.preRacePath||null,
      preRaceSha256:sources.preRaceSha256||null,
      preRaceFetchedAt:sources.preRaceFetchedAt||null
    },
    picks:picks.map(x=>x.order),
    probabilities:picks.map(x=>({order:x.order,probability:x.probability})),
    pointExpansion:require('./point-expansion-shadow-v1.js').capture(d,picks,mode),probabilitySum:d.sum,
    preRaceFeatures:mode==='PROGRAM_ONLY'?require('./pre-race-feature-freeze-v1.js').freeze(program,generatedAt):null,
    nearestDistance:d.nearestDistance,
    lanePriorSource:d.lanePriorSource||null,
    preRaceComplete:!!fx?.preRaceComplete,
    waterUsed:false,tideUsed:false,
    resultInput:false,payoutInput:false,
    researchOnly:true,productionEnabled:false,tryEnabled:false,
    cashNeutral:true,immutableAfterFirstWrite:true
  };
}

const now=nowJst();
if(now.date!==date){console.log('EDOGAWA_SHADOW_DATE_NOT_TODAY',date,now.date);process.exit(0)}
let writes=0;
for(let race=1;race<=12;race++){
  const programPath=path.join(root,'live','edogawa',date,'program',`race-${race}.json`);
  if(!fs.existsSync(programPath))continue;
  const program=read(programPath);if(!program)continue;
  if(program.venue!=='EDOGAWA'||program.venueCode!=='03'||Number(program.race)!==race)continue;
  if(program.resultEndpointsIncluded!==false||program.resultIncluded!==false||program.exhibitionIncluded!==false)throw new Error('EDOGAWA_SHADOW_PROGRAM_BOUNDARY');

  const dm=deadlineMinutes(program.deadline);
  if(dm==null||dm-now.minutes<3){console.log('EDOGAWA_SHADOW_CUTOFF',race,program.deadline);continue}

  const programSource={
    programPath:path.relative(root,programPath).replace(/\\/g,'/'),
    programSha256:sha256File(programPath)
  };

  const classOut=path.join(root,'live','edogawa',date,'shadow','class-baseline',`race-${race}.json`);
  const z=snapshot(program,null,'CLASS_BASELINE',now.iso,programSource);
  if(writeOnce(classOut,z))writes++;

  const programOut=path.join(root,'live','edogawa',date,'shadow','program-only',`race-${race}.json`);
  const a=snapshot(program,null,'PROGRAM_ONLY',now.iso,programSource);
  if(writeOnce(programOut,a))writes++;

  const prePath=path.join(root,'live','edogawa',date,'pre',`race-${race}-pack.json`);
  const pre=read(prePath);
  if(pre&&pre.boatMappingVerified===true&&pre.weatherMappingVerified===true){
    const fx=feature.extract(program,pre);
    if(fx.preRaceComplete){
      const fullOut=path.join(root,'live','edogawa',date,'shadow','full-pre',`race-${race}.json`);
      const b=snapshot(program,fx,'FULL_PRE_RACE',now.iso,{
        ...programSource,
        preRacePath:path.relative(root,prePath).replace(/\\/g,'/'),
        preRaceSha256:sha256File(prePath),
        preRaceFetchedAt:pre.fetchedAt||null
      });
      if(writeOnce(fullOut,b))writes++;
    }
  }
}
console.log('EDOGAWA_SHADOW_WRITES',writes);
