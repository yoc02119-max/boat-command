#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');

const root=process.argv[2]||path.join(__dirname,'..','live','edogawa');
const output=process.argv[3]||path.join(__dirname,'..','edogawa-shadow-evaluation-v1.json');
const MODES=['CLASS_BASELINE','PROGRAM_ONLY','RICH_PROGRAM','FULL_PRE_RACE'];
const DIRS={CLASS_BASELINE:'class-baseline',PROGRAM_ONLY:'program-only',RICH_PROGRAM:'rich-program',FULL_PRE_RACE:'full-pre'};

function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function exists(p){try{return fs.existsSync(p)}catch{return false}}
function validOrder(v){return /^[1-6]-[1-6]-[1-6]$/.test(String(v||''))&&new Set(String(v).split('-')).size===3}
function empty(){return{races:0,hits:0,stake100YenPerPick:0,returnYen:0,profitYen:0,hitRate:0,roi:0}}
function add(m,hit,payout){
  m.races++;
  m.stake100YenPerPick+=400;
  if(hit){m.hits++;m.returnYen+=Number(payout)||0}
  m.profitYen=m.returnYen-m.stake100YenPerPick;
  m.hitRate=m.races?m.hits/m.races:0;
  m.roi=m.stake100YenPerPick?m.returnYen/m.stake100YenPerPick:0;
}
const aggregate=Object.fromEntries(MODES.map(m=>[m,empty()]));
const days={};
const races=[];

if(exists(root)){
  const dates=fs.readdirSync(root).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort();
  for(const date of dates){
    const day={date,modes:Object.fromEntries(MODES.map(m=>[m,empty()])),races:[]};
    for(let race=1;race<=12;race++){
      const resultPath=path.join(root,date,'post',`race-${race}-result.json`);
      if(!exists(resultPath))continue;
      const result=read(resultPath);
      if(!result||result.venue!=='EDOGAWA'||String(result.venueCode)!=='03'||result.date!==date||Number(result.race)!==race)continue;
      if(result.preRaceDataIncluded!==false||result.resultEndpointsIncluded!==true||!validOrder(result.trifecta))continue;

      const row={date,race,result:result.trifecta,payout100:Number(result.payout100)||0,modes:{}};
      for(const mode of MODES){
        const sp=path.join(root,date,'shadow',DIRS[mode],`race-${race}.json`);
        if(!exists(sp))continue;
        const s=read(sp);
        if(!s||s.schema!=='boat-command-edogawa-shadow-research-v1'||s.mode!==mode)continue;
        if(s.resultInput!==false||s.payoutInput!==false||s.researchOnly!==true||s.cashNeutral!==true)continue;
        const picks=Array.isArray(s.picks)?s.picks.filter(validOrder):[];
        if(picks.length!==4)continue;
        const hit=picks.includes(result.trifecta);
        row.modes[mode]={
          generatedAt:s.generatedAt,
          picks,
          hit,
          simulatedReturnYen:hit?(Number(result.payout100)||0):0,
          simulatedStakeYen:400,
          cashNeutral:true
        };
        add(day.modes[mode],hit,result.payout100);
        add(aggregate[mode],hit,result.payout100);
      }
      if(Object.keys(row.modes).length){
        day.races.push(row);
        races.push(row);
      }
    }
    if(day.races.length)days[date]=day;
  }
}
const comparison={};
for(const a of MODES)for(const b of MODES){
  if(a>=b)continue;
  let paired=0,aOnly=0,bOnly=0,both=0,neither=0;
  for(const r of races){
    const x=r.modes[a],y=r.modes[b];if(!x||!y)continue;
    paired++;
    if(x.hit&&y.hit)both++;
    else if(x.hit)aOnly++;
    else if(y.hit)bOnly++;
    else neither++;
  }
  comparison[`${a}_VS_${b}`]={pairedRaces:paired,aOnlyHits:aOnly,bOnlyHits:bOnly,bothHits:both,neitherHits:neither};
}
const out={
  schema:'boat-command-edogawa-shadow-evaluation-v1',
  version:'EDOGAWA-SHADOW-EVALUATION-V1',
  venue:'EDOGAWA',venueCode:'03',
  generatedAt:null,
  purpose:'POST_RACE_RESEARCH_ONLY',
  fundingScope:'NONE',
  cashNeutral:true,
  realMoney:false,
  stakeConvention:'SIMULATION_ONLY_100_YEN_PER_PICK_FOR_COMPARABILITY',
  aggregate,
  comparison,
  days,
  evaluatedRows:races.length,
  boundaries:{
    shadowsRequiredPreRace:true,
    resultsReadPostRaceOnly:true,
    predictionMutation:false,
    bankrollMutation:false,
    tryMutation:false
  }
};
const _previous=read(output),_before=_previous?{..._previous}:null,_after={...out};
if(_before)delete _before.generatedAt;delete _after.generatedAt;
out.generatedAt=_before&&JSON.stringify(_before)===JSON.stringify(_after)?(_previous.generatedAt||new Date().toISOString()):new Date().toISOString();
fs.writeFileSync(output,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({evaluatedRows:out.evaluatedRows,aggregate:out.aggregate,comparison:out.comparison},null,2));
