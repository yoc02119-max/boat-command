'use strict';
const fs=require('fs');
const path=require('path');
const model=require('../gamagori-main-model-v0320.js');

const HISTORY='gamagori-main-history-v0320.json';

function latestRace3(){
  const base='live/gamagori';
  if(!fs.existsSync(base))throw new Error('LIVE_GAMAGORI_DIR_MISSING');
  const dates=fs.readdirSync(base,{withFileTypes:true})
    .filter(x=>x.isDirectory()&&/^\d{4}-\d{2}-\d{2}$/.test(x.name))
    .map(x=>x.name).sort().reverse();
  for(const d of dates){
    const p=path.join(base,d,'program','race-3.json');
    if(fs.existsSync(p))return p;
  }
  throw new Error('RACE3_PROGRAM_NOT_FOUND');
}
function orderedUnique(xs){const s=new Set(),out=[];for(const x of xs)if(!s.has(x)){s.add(x);out.push(x)}return out;}

const input=process.argv[2]||latestRace3();
const pack=JSON.parse(fs.readFileSync(input,'utf8'));
if(pack.schema!=='boat-command-program-pack-v1')throw new Error('PROGRAM_SCHEMA_INVALID');
if(pack.venue!=='GAMAGORI'&&pack.venueCode!=='07')throw new Error('VENUE_INVALID');
if(Number(pack.race)!==3)throw new Error('RACE_INVALID');
if(pack.programReady!==true)throw new Error('PROGRAM_NOT_READY');
if(pack.resultEndpointsIncluded!==false||pack.resultIncluded!==false||pack.exhibitionIncluded!==false)throw new Error('PRE_RACE_BOUNDARY_INVALID');
const boats=[...(pack.boats||[])].sort((a,b)=>Number(a.lane)-Number(b.lane));
if(boats.length!==6)throw new Error('BOAT_COUNT_INVALID');
const classes=boats.map(x=>String(x.class||'UNKNOWN').toUpperCase());
if(classes.some(x=>!['A1','A2','B1','B2'].includes(x)))throw new Error('CLASS_INVALID');

const out=process.argv[3]||path.join('live','gamagori',String(pack.date),'shadow','race-3-exacta-gate-v0345.json');
if(fs.existsSync(out)){
  const frozen=JSON.parse(fs.readFileSync(out,'utf8'));
  console.log(JSON.stringify({status:'ALREADY_FROZEN',out,decision:frozen.decision,frozenAt:frozen.frozenAt},null,2));
  process.exit(0);
}

const history=JSON.parse(fs.readFileSync(HISTORY,'utf8'));
if(history.schema!=='boat-command-program-history-v2'||history.exhibitionIncluded!==false)throw new Error('HISTORY_BOUNDARY_INVALID');
const dist=model.probabilities({classes,race:3,raceType:String(pack.raceType||'')},history.races||[],{targetDate:String(pack.date)});
const fixed4=model.select(dist,{count:4,mode:'PROBABILITY'}).map(x=>x.order);
if(fixed4.length!==4)throw new Error('FIXED4_INVALID');
const exactaPairs=orderedUnique(fixed4.map(p=>p.split('-').slice(0,2).join('-')));
const top1=exactaPairs[0]||null;
if(!top1||!/^[1-6]-[1-6]$/.test(top1))throw new Error('EXACTA_TOP1_INVALID');

const matched=String(pack.raceType||'')==='予選';
const report={
  schema:'boat-command-gamagori-exacta-forward-gate-v0345',
  version:'0.34.5',
  shadowOnly:true,
  liveBettingEnabled:false,
  stakeChangeEnabled:false,
  targetResultRead:false,
  targetPayoutRead:false,
  venue:'GAMAGORI',venueCode:'07',date:String(pack.date),race:3,
  sourceProgramPack:input,
  sourceFetchedAt:pack.fetchedAt||null,
  deadline:pack.deadline||null,
  raceType:String(pack.raceType||''),
  classes,
  modelVersion:model.version,
  historySource:HISTORY,
  historyCutoff:history.cutoff||null,
  historicalPriorResultsUsed:true,
  fixedTrifecta4:fixed4,
  derivedExactaPairs:exactaPairs,
  gate:{
    label:'race=3 & title=予選',
    betType:'2連単',
    variant:'TOP1',
    matched,
    historicalResearch:'v0.34.4',
    historicalAllThreeSplitsRoiAbove100:true,
    promotionStatus:'NOT_PROMOTED',
    freshForwardRequired:true
  },
  frozenExactaPicks:matched?[top1]:[],
  decision:matched?'FORWARD_SHADOW_TRACK':'FORWARD_SHADOW_SKIP',
  frozenAt:pack.fetchedAt||new Date().toISOString(),
  note:'Eligibility and TOP1 exacta are frozen from PRE-only target data. This file never changes LIVE predictions, stakes, or hard locks and never reads the target race result/payout.'
};
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:'FROZEN',out,decision:report.decision,gate:report.gate,frozenExactaPicks:report.frozenExactaPicks},null,2));
