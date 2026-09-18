#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const model=require('../edogawa-rich-model-v2.js');

const date=process.argv[2]||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const root=path.join(__dirname,'..');
const historyPath=path.join(root,'edogawa-rich-history-v1.json');
const backtestPath=path.join(root,'edogawa-rich-backtest-v1.json');
if(!fs.existsSync(historyPath)||!fs.existsSync(backtestPath)){
  console.log('EDOGAWA_RICH_SHADOW_WAIT_HISTORY_OR_BACKTEST');process.exit(0);
}
const history=JSON.parse(fs.readFileSync(historyPath,'utf8'));
const backtest=JSON.parse(fs.readFileSync(backtestPath,'utf8'));
if(history.venueCode!=='03'||!Array.isArray(history.races)||history.races.length<500)throw new Error('RICH_HISTORY_INVALID');
if(backtest.schema!=='boat-command-edogawa-rich-backtest-v1'||backtest.venueCode!=='03'||backtest.strictWalkForward!==true)throw new Error('RICH_BACKTEST_INVALID');
if(backtest.productionEnabled!==false||backtest.tryEnabled!==false||backtest.promotionEligible!==false)throw new Error('RICH_PROMOTION_BOUNDARY');
const config=backtest?.calibration?.selected;
if(!config)throw new Error('RICH_SELECTED_CONFIG_MISSING');

function nowJst(){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
 const o=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 return{date:`${o.year}-${o.month}-${o.day}`,minutes:Number(o.hour)*60+Number(o.minute),iso:new Date().toISOString()};
}
function dm(hm){const m=String(hm||'').match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null}
function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function sha(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}
function writeOnce(p,x){
 if(fs.existsSync(p)){console.log('EDOGAWA_RICH_SHADOW_KEEP',path.relative(root,p));return false}
 fs.mkdirSync(path.dirname(p),{recursive:true});
 fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');
 console.log('EDOGAWA_RICH_SHADOW_WRITE',path.relative(root,p));
 return true;
}
const now=nowJst();
if(now.date!==date){console.log('EDOGAWA_RICH_SHADOW_NOT_TODAY',date,now.date);process.exit(0)}
let writes=0;
for(let race=1;race<=12;race++){
 const pp=path.join(root,'live','edogawa',date,'program',`race-${race}.json`);
 if(!fs.existsSync(pp))continue;
 const program=read(pp);if(!program)continue;
 if(program.venue!=='EDOGAWA'||String(program.venueCode)!=='03'||Number(program.race)!==race)continue;
 if(program.resultEndpointsIncluded!==false||program.resultIncluded!==false||program.exhibitionIncluded!==false)throw new Error('RICH_SHADOW_PROGRAM_BOUNDARY');
 const deadline=dm(program.deadline);
 if(deadline==null||deadline-now.minutes<3){console.log('EDOGAWA_RICH_SHADOW_CUTOFF',race);continue}

 const d=model.distribution(program,history.races,config);
 const picks=model.select(d,4);
 const out={
  schema:'boat-command-edogawa-shadow-research-v1',
  version:'EDOGAWA-RICH-SHADOW-V1',
  venue:'EDOGAWA',venueCode:'03',date,race,
  mode:'RICH_PROGRAM',
  generatedAt:now.iso,deadline:program.deadline||null,
  modelVersion:model.version,
  richHistoryCutoff:history.cutoff||null,
  richHistoryRows:d.historyRows,
  backtestSchema:backtest.schema,
  backtestHoldout4:backtest?.holdout?.pointCounts?.['4']||null,
  selectedConfig:config,
  sources:{
   programPath:path.relative(root,pp).replace(/\\/g,'/'),
   programSha256:sha(pp),
   programFetchedAt:program.fetchedAt||null,
   richHistoryPath:'edogawa-rich-history-v1.json',
   richHistorySha256:sha(historyPath),
   backtestPath:'edogawa-rich-backtest-v1.json',
   backtestSha256:sha(backtestPath)
  },
  picks:picks.map(x=>x.order),
  probabilities:picks.map(x=>({order:x.order,probability:x.probability})),
  probabilitySum:d.sum,
  nearestDistance:d.nearestDistance,
  preRaceComplete:false,
  exhibitionUsed:false,waterUsed:false,tideUsed:false,
  resultInput:false,payoutInput:false,
  researchOnly:true,productionEnabled:false,tryEnabled:false,
  cashNeutral:true,immutableAfterFirstWrite:true
 };
 const dest=path.join(root,'live','edogawa',date,'shadow','rich-program',`race-${race}.json`);
 if(writeOnce(dest,out))writes++;
}
console.log('EDOGAWA_RICH_SHADOW_WRITES',writes);
