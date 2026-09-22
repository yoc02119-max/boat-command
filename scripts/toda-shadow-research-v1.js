#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),model=require('../toda-research-model-v1.js');
const date=process.argv[2]||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const root=path.join(__dirname,'..'),historyPath=path.join(root,'toda-history-bootstrap-v1.json'),baselinePath=path.join(root,'toda-baseline-backtest-v1.json');
if(!fs.existsSync(historyPath)||!fs.existsSync(baselinePath)){console.log('TODA_SHADOW_WAIT_HISTORY_OR_BASELINE');process.exit(0)}
const db=JSON.parse(fs.readFileSync(historyPath,'utf8')),baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8'));
if(db.venueCode!=='02'||!Array.isArray(db.races)||db.races.length<300){console.log('TODA_SHADOW_WAIT_HISTORY_300');process.exit(0)}
if(baseline.venueCode!=='02'||!baseline.calibration?.selected){console.log('TODA_SHADOW_WAIT_BASELINE_CONFIG');process.exit(0)}
function nowJst(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date()),o=Object.fromEntries(p.map(x=>[x.type,x.value]));return{date:`${o.year}-${o.month}-${o.day}`,minutes:Number(o.hour)*60+Number(o.minute),iso:new Date().toISOString()}}
function dm(hm){const m=String(hm||'').match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null}
function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}function hash(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}
function snapshot(program,pp,mode,now){const d=model.distribution(program,db.races,{targetDate:date,config:baseline.calibration.selected,mode}),p=model.select(d,{count:4});return{schema:'boat-command-toda-shadow-research-v1',version:'TODA-SHADOW-RESEARCH-V1',venue:'TODA',venueCode:'02',date,race:Number(program.race),mode,generatedAt:now.iso,deadline:program.deadline||null,modelVersion:model.version,modelArchitecture:d.architecture,modelConfig:d.config,historyRows:d.historyRows,historyCutoff:db.cutoff||null,sources:{programPath:path.relative(root,pp).replace(/\\/g,'/'),programSha256:hash(pp),programFetchedAt:program.fetchedAt||null},picks:p.map(x=>x.order),probabilities:p.map(x=>({order:x.order,probability:x.probability})),pointExpansion:require('./point-expansion-shadow-v1.js').capture(d,p,mode),probabilitySum:d.sum,resultInput:false,payoutInput:false,researchOnly:true,productionEnabled:false,tryEnabled:false,cashNeutral:true,immutableAfterFirstWrite:true}}
const now=nowJst();if(now.date!==date){console.log('TODA_SHADOW_DATE_NOT_TODAY');process.exit(0)}
let writes=0;
for(let race=1;race<=12;race++){
  const pp=path.join(root,'live','toda',date,'program',`race-${race}.json`);if(!fs.existsSync(pp))continue;
  const program=read(pp);if(!program||program.venue!=='TODA'||program.venueCode!=='02')continue;
  if(program.resultEndpointsIncluded!==false||program.resultIncluded!==false||program.exhibitionIncluded!==false)throw new Error('TODA_SHADOW_PROGRAM_BOUNDARY');
  const deadline=dm(program.deadline);if(deadline==null||deadline-now.minutes<3)continue;
  for(const [mode,dir] of [['CLASS_BASELINE','class-baseline'],['PROGRAM_ONLY','program-only']]){
    const out=path.join(root,'live','toda',date,'shadow',dir,`race-${race}.json`);if(fs.existsSync(out))continue;
    const payload=snapshot(program,pp,mode,now);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(payload,null,2)+'\n');writes++;
  }
}
console.log('TODA_SHADOW_WRITES',writes);
