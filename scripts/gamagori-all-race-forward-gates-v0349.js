#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const model=require('../gamagori-main-model-v0320.js');

const ROOT=path.join(__dirname,'..');
const HISTORY=path.join(ROOT,'gamagori-main-history-v0320.json');
const LIVE=path.join(ROOT,'live','gamagori');

function read(p){return JSON.parse(fs.readFileSync(p,'utf8'))}
function write(p,x){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n')}
function dates(){return fs.readdirSync(LIVE,{withFileTypes:true}).filter(x=>x.isDirectory()&&/^\d{4}-\d{2}-\d{2}$/.test(x.name)).map(x=>x.name).sort()}
function validate(pack,race){
  if(!pack||pack.schema!=='boat-command-program-pack-v1')throw new Error('PROGRAM_SCHEMA_INVALID');
  if(pack.venue!=='GAMAGORI'&&pack.venueCode!=='07')throw new Error('VENUE_INVALID');
  if(Number(pack.race)!==race||pack.programReady!==true)throw new Error('PROGRAM_INVALID');
  if(pack.resultEndpointsIncluded!==false||pack.resultIncluded!==false||pack.exhibitionIncluded!==false)throw new Error('PRE_BOUNDARY_INVALID');
  const boats=[...(pack.boats||[])].sort((a,b)=>Number(a.lane)-Number(b.lane));
  if(boats.length!==6||boats.some((x,i)=>Number(x.lane)!==i+1))throw new Error('BOATS_INVALID');
  const classes=boats.map(x=>String(x.class||'').toUpperCase());
  if(classes.some(c=>!['A1','A2','B1','B2'].includes(c)))throw new Error('CLASS_INVALID');
  return {boats,classes};
}
function uniq(xs){const s=new Set(),out=[];for(const x of xs)if(!s.has(x)){s.add(x);out.push(x)}return out;}

const ds=dates(); if(!ds.length)throw new Error('NO_DATES');
const date=process.argv[2]||ds.at(-1);
const history=read(HISTORY);
if(history.schema!=='boat-command-program-history-v2'||history.exhibitionIncluded!==false)throw new Error('HISTORY_INVALID');
const out=process.argv[3]||path.join(LIVE,date,'shadow','all-race-try-gates-v0349.json');

if(fs.existsSync(out)){
  const frozen=read(out);
  console.log(JSON.stringify({status:'ALREADY_FROZEN',out:path.relative(ROOT,out),date,tracked:frozen.summary},null,2));
  process.exit(0);
}

const rows=[];
for(let race=1;race<=12;race++){
  const programPath=path.join(LIVE,date,'program',`race-${race}.json`);
  if(!fs.existsSync(programPath))throw new Error(`PROGRAM_MISSING_${race}`);
  const pack=read(programPath),v=validate(pack,race);
  const dist=model.probabilities({classes:v.classes,race,raceType:String(pack.raceType||'')},history.races||[],{targetDate:date});
  const tri4=model.select(dist,{count:4,mode:'PROBABILITY'}).map(x=>x.order);
  if(tri4.length!==4||tri4.some(x=>!model.validPick(x)))throw new Error(`MODEL_PICKS_INVALID_${race}`);
  const exactaPairs=uniq(tri4.map(p=>p.split('-').slice(0,2).join('-')));
  const exactaMatched=String(pack.raceType||'')==='予選';
  const aClassCount=v.classes.filter(c=>c==='A1'||c==='A2').length;
  const trifectaMatched=aClassCount===3;
  rows.push({
    race,
    deadline:pack.deadline||null,
    raceType:String(pack.raceType||''),
    classes:v.classes,
    aClassCount,
    sourceFetchedAt:pack.fetchedAt||null,
    exacta:{
      label:'予選 × 2連単TOP1',
      matched:exactaMatched,
      decision:exactaMatched?'FORWARD_SHADOW_TRY':'FORWARD_SHADOW_SKIP',
      frozenPicks:exactaMatched?[exactaPairs[0]]:[],
      allDerivedPairs:exactaPairs
    },
    trifecta:{
      label:'A級3人 × 3連単4点',
      matched:trifectaMatched,
      decision:trifectaMatched?'FORWARD_SHADOW_TRY':'FORWARD_SHADOW_SKIP',
      frozenPicks:trifectaMatched?tri4:[],
      allModelPicks:tri4
    }
  });
}
const report={
  schema:'boat-command-gamagori-all-race-try-gates-v0349',
  version:'0.34.9',
  shadowOnly:true,
  tryOnly:true,
  liveBettingEnabled:false,
  stakeChangeEnabled:false,
  targetResultsRead:false,
  targetPayoutsRead:false,
  venue:'GAMAGORI',venueCode:'07',date,
  modelVersion:model.version,
  historySource:'gamagori-main-history-v0320.json',
  historyCutoff:history.cutoff||null,
  policy:{
    raceNumberRestricted:false,
    scanRaces:'1-12',
    exactaCondition:'raceType=予選',
    exactaVariant:'TOP1',
    trifectaCondition:'aClassCount=3',
    trifectaVariant:'FIXED4',
    forwardCycleDays:30,
    promotionStatus:'NOT_PROMOTED_TRY_ONLY'
  },
  races:rows,
  summary:{
    exactaTryRaces:rows.filter(x=>x.exacta.matched).map(x=>x.race),
    trifectaTryRaces:rows.filter(x=>x.trifecta.matched).map(x=>x.race),
    exactaTryCount:rows.filter(x=>x.exacta.matched).length,
    trifectaTryCount:rows.filter(x=>x.trifecta.matched).length
  },
  note:'TRY-only all-race shadow scan. Race-number restrictions are removed. Frozen picks cannot alter official LIVE predictions, stakes, or HARD LOCKs.'
};
write(out,report);
console.log(JSON.stringify({status:'FROZEN',date,out:path.relative(ROOT,out),summary:report.summary,races:rows.filter(x=>x.exacta.matched||x.trifecta.matched).map(x=>({race:x.race,raceType:x.raceType,aClassCount:x.aClassCount,exacta:x.exacta,trifecta:x.trifecta}))},null,2));
