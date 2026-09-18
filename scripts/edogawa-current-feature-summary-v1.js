#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const feature=require('../edogawa-feature-contract-v1.js');

const date=process.argv[2]||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const root=path.join(__dirname,'..','live','edogawa',date,'program');
const outPath=process.argv[3]||path.join(__dirname,'..','live','edogawa',date,'research-feature-summary-v1.json');
if(!fs.existsSync(root))throw new Error('EDOGAWA_PROGRAM_DIR_MISSING '+root);

const races=[];
for(let race=1;race<=12;race++){
  const p=path.join(root,`race-${race}.json`);
  if(!fs.existsSync(p))throw new Error('EDOGAWA_PROGRAM_RACE_MISSING '+race);
  const program=JSON.parse(fs.readFileSync(p,'utf8'));
  const x=feature.extract(program,null);
  const lanes=x.lanes.map(v=>({
    lane:v.lane,
    class:v.class,
    registration:v.registration,
    avgST:v.avgST,
    nationalWinRate:v.nationalWinRate,
    localWinRate:v.localWinRate,
    localVsNationalWinDelta:v.localVsNationalWinDelta,
    national2Rate:v.national2Rate,
    local2Rate:v.local2Rate,
    localVsNational2Delta:v.localVsNational2Delta,
    motor2Rate:v.motor2Rate,
    boat2Rate:v.boat2Rate
  }));
  const maxBy=(key,dir=1)=>lanes.filter(v=>Number.isFinite(v[key])).sort((a,b)=>dir*(b[key]-a[key]))[0]||null;
  races.push({
    race,
    raceType:x.raceType,
    deadline:x.deadline,
    lanes,
    leaders:{
      bestAvgST:maxBy('avgST',-1)?.lane??null,
      bestLocalWin:maxBy('localWinRate')?.lane??null,
      bestLocalDelta:maxBy('localVsNationalWinDelta')?.lane??null,
      bestMotor2:maxBy('motor2Rate')?.lane??null
    },
    resultInput:false,
    payoutInput:false,
    predictionEnabled:false
  });
}
const payload={
  schema:'boat-command-edogawa-research-feature-summary-v1',
  venue:'EDOGAWA',venueCode:'03',date,
  generatedAt:new Date().toISOString(),
  races,
  audit:{
    raceCount:races.length,
    allSixBoats:races.every(r=>r.lanes.length===6),
    localStatsReady:races.every(r=>r.lanes.every(x=>Number.isFinite(x.localWinRate)&&Number.isFinite(x.local2Rate))),
    avgSTReady:races.every(r=>r.lanes.every(x=>Number.isFinite(x.avgST))),
    resultInput:false,payoutInput:false,predictionEnabled:false
  }
};
fs.writeFileSync(outPath,JSON.stringify(payload,null,2)+'\n');
console.log(JSON.stringify(payload.audit));
