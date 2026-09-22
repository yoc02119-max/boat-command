#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const {buildReport,writeReport,VARIANTS,VENUES}=require('./daily-lab-report-v1.js');
const {buildHistoricalReplay}=require('./daily-lab-historical-replay-v1.js');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'daily-lab');
const latest=buildReport(process.argv[2]);
const end=Date.parse(latest.date+'T00:00:00Z');
if(!Number.isFinite(end)||new Date(end).toISOString().slice(0,10)!==latest.date)throw Error('INVALID_DATE');
fs.mkdirSync(dir,{recursive:true});
const dates=[];
const venues=VENUES.map(([code,slug,name])=>({code,slug,name,days:0,summary:Object.fromEntries(VARIANTS.map(k=>[k,{races:0,hits:0,addedHits:0,stake100:0,payoutOnlyReturn100:0}]))}));
for(let offset=29;offset>=0;offset--){
 const date=new Date(end-offset*86400000).toISOString().slice(0,10);
 let report;
 if(date===latest.date) report=latest;
 else{
   const archivePath=path.join(dir,date+'.json');
   const archived=fs.existsSync(archivePath)?JSON.parse(fs.readFileSync(archivePath,'utf8')):null;
   // Preserve genuine PRE-RACE captures forever. Reuse completed strict replay to keep recurring LAB refresh cheap.
   if(archived?.schema==='boat-command-daily-lab-v1'&&archived?.sourceMode!=='STRICT_HISTORICAL_REPLAY_V1'&&Number(archived?.totals?.capturedRaces)>0) report=archived;
   else if(archived?.sourceMode==='STRICT_HISTORICAL_REPLAY_V1'&&archived?.version==='DAILY-LAB-STRICT-REPLAY-V1') report=archived;
   else{
     const live=buildReport(date);
     report=live.totals.capturedRaces?live:buildHistoricalReplay(date);
   }
 }
 if(!report.totals.capturedRaces&&date!==latest.date)continue;
 writeReport(report,path.join(dir,date+'.json'));
 dates.push({date,sourceMode:report.sourceMode||'LIVE_PRE_RACE_CAPTURE',...report.totals});
 for(const v of report.venues){
  const total=venues.find(x=>x.code===v.code);if(v.evaluated)total.days++;
  for(const key of VARIANTS)for(const field of Object.keys(total.summary[key]))total.summary[key][field]+=v.summary[key][field];
 }
}
for(const v of venues)for(const s of Object.values(v.summary)){
 s.hitRate=s.races?s.hits/s.races:null;
 s.payoutOnlyRoi=s.stake100?s.payoutOnlyReturn100/s.stake100:null;
}
writeReport(latest,path.join(root,'daily-lab-v1.json'));
writeReport({schema:'boat-command-daily-lab-history-v1',from:new Date(end-29*86400000).toISOString().slice(0,10),to:latest.date,
 researchOnly:true,automaticPromotion:false,strictReplayEnabled:true,dates,venues},path.join(dir,'index.json'));
console.log(JSON.stringify({status:'PASS',date:latest.date,availableDays:dates.length,...latest.totals}));
