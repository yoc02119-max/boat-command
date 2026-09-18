#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const model=require('../edogawa-research-model-v1.js');
const feature=require('../edogawa-feature-contract-v1.js');

const date=process.argv[2]||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const root=path.join(__dirname,'..');
const historyPath=path.join(root,'edogawa-history-bootstrap-v1.json');
if(!fs.existsSync(historyPath)){console.log('EDOGAWA_SHADOW_WAIT_HISTORY');process.exit(0)}
const historyDb=JSON.parse(fs.readFileSync(historyPath,'utf8'));
if(historyDb.venueCode!=='03'||!Array.isArray(historyDb.races)||historyDb.races.length<300){console.log('EDOGAWA_SHADOW_WAIT_HISTORY_300');process.exit(0)}

function nowJst(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const o=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return {date:`${o.year}-${o.month}-${o.day}`,minutes:Number(o.hour)*60+Number(o.minute),iso:new Date().toISOString()};
}
function deadlineMinutes(hm){const m=String(hm||'').match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null}
function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function writeOnce(p,payload){
  if(fs.existsSync(p)){console.log('EDOGAWA_SHADOW_KEEP_IMMUTABLE',path.relative(root,p));return false}
  fs.mkdirSync(path.dirname(p),{recursive:true});
  fs.writeFileSync(p,JSON.stringify(payload,null,2)+'\n');
  console.log('EDOGAWA_SHADOW_WRITE',path.relative(root,p));
  return true;
}
function snapshot(program,fx,mode,generatedAt){
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
    picks:picks.map(x=>x.order),
    probabilities:picks.map(x=>({order:x.order,probability:x.probability})),
    probabilitySum:d.sum,
    nearestDistance:d.nearestDistance,
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

  const programOut=path.join(root,'live','edogawa',date,'shadow','program-only',`race-${race}.json`);
  const a=snapshot(program,null,'PROGRAM_ONLY',now.iso);
  if(writeOnce(programOut,a))writes++;

  const prePath=path.join(root,'live','edogawa',date,'pre',`race-${race}-pack.json`);
  const pre=read(prePath);
  if(pre&&pre.boatMappingVerified===true&&pre.weatherMappingVerified===true){
    const fx=feature.extract(program,pre);
    if(fx.preRaceComplete){
      const fullOut=path.join(root,'live','edogawa',date,'shadow','full-pre',`race-${race}.json`);
      const b=snapshot(program,fx,'FULL_PRE_RACE',now.iso);
      if(writeOnce(fullOut,b))writes++;
    }
  }
}
console.log('EDOGAWA_SHADOW_WRITES',writes);
