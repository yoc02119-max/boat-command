#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),feature=require('../toda-feature-contract-v1.js');
const date=process.argv[2]||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),root=path.join(__dirname,'..','live','toda',date,'program'),outPath=process.argv[3]||path.join(__dirname,'..','live','toda',date,'research-feature-summary-v1.json');
if(!fs.existsSync(root))throw new Error('TODA_PROGRAM_DIR_MISSING '+root);
const races=[];
for(let race=1;race<=12;race++){
 const p=path.join(root,`race-${race}.json`);if(!fs.existsSync(p))throw new Error('TODA_PROGRAM_RACE_MISSING '+race);
 const program=JSON.parse(fs.readFileSync(p,'utf8')),prePath=path.join(__dirname,'..','live','toda',date,'pre',`race-${race}-pack.json`),pre=fs.existsSync(prePath)?JSON.parse(fs.readFileSync(prePath,'utf8')):null,x=feature.extract(program,pre);
 const lanes=x.lanes.map(v=>({lane:v.lane,class:v.class,registration:v.registration,avgST:v.avgST,nationalWinRate:v.nationalWinRate,localWinRate:v.localWinRate,localVsNationalWinDelta:v.localVsNationalWinDelta,national2Rate:v.national2Rate,local2Rate:v.local2Rate,motor2Rate:v.motor2Rate,boat2Rate:v.boat2Rate,exhibitionTime:v.exhibitionTime,exhibitionRank:v.exhibitionRank,exhibitionST:v.exhibitionST,exhibitionSTRank:v.exhibitionSTRank}));
 const maxBy=(key,dir=1)=>lanes.filter(v=>Number.isFinite(v[key])).sort((a,b)=>dir*(b[key]-a[key]))[0]||null;
 races.push({race,raceType:x.raceType,deadline:x.deadline,lanes,water:x.water,preRaceComplete:x.preRaceComplete,leaders:{bestAvgST:maxBy('avgST',-1)?.lane??null,bestLocalWin:maxBy('localWinRate')?.lane??null,bestLocalDelta:maxBy('localVsNationalWinDelta')?.lane??null,bestMotor2:maxBy('motor2Rate')?.lane??null,bestExhibition:maxBy('exhibitionTime',-1)?.lane??null},resultInput:false,payoutInput:false,predictionEnabled:false});
}
const payload={schema:'boat-command-toda-research-feature-summary-v1',venue:'TODA',venueCode:'02',date,generatedAt:new Date().toISOString(),races,audit:{raceCount:races.length,allSixBoats:races.every(r=>r.lanes.length===6),localStatsReady:races.every(r=>r.lanes.every(x=>Number.isFinite(x.localWinRate)&&Number.isFinite(x.local2Rate))),avgSTReady:races.every(r=>r.lanes.every(x=>Number.isFinite(x.avgST)||x.avgST===null)),preRaceCompleteRaces:races.filter(r=>r.preRaceComplete).length,resultInput:false,payoutInput:false,predictionEnabled:false}};
fs.writeFileSync(outPath,JSON.stringify(payload,null,2)+'\n');console.log(JSON.stringify(payload.audit));
