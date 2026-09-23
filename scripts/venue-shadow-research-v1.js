#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');

const [slug,venue,code,dateArg]=process.argv.slice(2);
if(!slug||!venue||!/^\d{2}$/.test(String(code||'')))throw new Error('USAGE: venue-shadow-research-v1.js <slug> <VENUE> <code> [YYYY-MM-DD]');
if(!/^[a-z0-9-]+$/.test(slug)||!/^[A-Z0-9_]+$/.test(venue))throw new Error('VENUE_ARGS_INVALID');

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const date=dateArg||today();
const root=path.join(__dirname,'..');
const modelPath=path.join(root,slug+'-research-model-v1.js');
const historyPath=path.join(root,slug+'-history-bootstrap-v1.json');
const baselinePath=path.join(root,slug+'-baseline-backtest-v1.json');

if(!fs.existsSync(modelPath)||!fs.existsSync(historyPath)||!fs.existsSync(baselinePath)){
  console.log('VENUE_SHADOW_WAIT_INPUTS',slug);process.exit(0);
}
const model=require(modelPath);
const db=JSON.parse(fs.readFileSync(historyPath,'utf8'));
const baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8'));
if(db.venue!==venue||db.venueCode!==code||!Array.isArray(db.races)||db.races.length<300){
  console.log('VENUE_SHADOW_WAIT_HISTORY_300',slug);process.exit(0);
}
if(baseline.venue!==venue||baseline.venueCode!==code||!baseline.calibration?.selected){
  console.log('VENUE_SHADOW_WAIT_BASELINE_CONFIG',slug);process.exit(0);
}

function nowJst(){
  const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const o=Object.fromEntries(p.map(x=>[x.type,x.value]));
  return {date:o.year+'-'+o.month+'-'+o.day,minutes:Number(o.hour)*60+Number(o.minute),iso:new Date().toISOString()};
}
function deadlineMinutes(hm){
  const m=String(hm||'').match(/^(\d{1,2}):(\d{2})$/);
  return m?Number(m[1])*60+Number(m[2]):null;
}
function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function hash(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}

function snapshot(program,programPath,mode,now){
  const d=model.distribution(program,db.races,{targetDate:date,config:baseline.calibration.selected,mode});
  const picks=model.select(d,{count:4});
  if(!Array.isArray(picks)||picks.length!==4||new Set(picks.map(x=>x.order)).size!==4)throw new Error('VENUE_SHADOW_PICK_CONTRACT');
  return {
    schema:'boat-command-venue-shadow-research-v1',
    version:'VENUE-SHADOW-RESEARCH-V1',
    venue,venueCode:code,slug,date,race:Number(program.race),mode,
    generatedAt:now.iso,deadline:program.deadline||null,
    modelVersion:model.version,modelArchitecture:d.architecture,modelConfig:d.config,
    historyRows:d.historyRows,historyCutoff:db.cutoff||null,
    sources:{
      programPath:path.relative(root,programPath).replace(/\\/g,'/'),
      programSha256:hash(programPath),programFetchedAt:program.fetchedAt||null,
      historyPath:slug+'-history-bootstrap-v1.json',
      baselinePath:slug+'-baseline-backtest-v1.json'
    },
    picks:picks.map(x=>x.order),
    probabilities:picks.map(x=>({order:x.order,probability:x.probability})),
    pointExpansion:require('./point-expansion-shadow-v1.js').capture(d,picks,mode),probabilitySum:d.sum,
    preRaceFeatures:mode==='PROGRAM_ONLY'?require('./pre-race-feature-freeze-v1.js').freeze(program,now.iso):null,
    resultInput:false,payoutInput:false,researchOnly:true,
    productionEnabled:false,tryEnabled:false,cashNeutral:true,
    immutableAfterFirstWrite:true
  };
}

const now=nowJst();
if(now.date!==date){console.log('VENUE_SHADOW_DATE_NOT_TODAY',slug,date,now.date);process.exit(0)}
let writes=0;
for(let race=1;race<=12;race++){
  const pp=path.join(root,'live',slug,date,'program','race-'+race+'.json');
  if(!fs.existsSync(pp))continue;
  const program=read(pp);
  if(!program||program.venue!==venue||program.venueCode!==code||Number(program.race)!==race)continue;
  if(program.resultEndpointsIncluded!==false||program.resultIncluded!==false||program.exhibitionIncluded!==false)throw new Error('VENUE_SHADOW_PROGRAM_BOUNDARY');
  const deadline=deadlineMinutes(program.deadline);
  if(deadline==null||deadline-now.minutes<3)continue;
  for(const [mode,dir] of [['CLASS_BASELINE','class-baseline'],['PROGRAM_ONLY','program-only']]){
    const out=path.join(root,'live',slug,date,'shadow',dir,'race-'+race+'.json');
    if(fs.existsSync(out))continue;
    const payload=snapshot(program,pp,mode,now);
    fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,JSON.stringify(payload,null,2)+'\n');
    writes++;
  }
}
console.log('VENUE_SHADOW_WRITES',slug,writes);
