#!/usr/bin/env node
'use strict';
// Read-only audit. POST is counted and scored only after selection facts are read.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const ROOT=path.join(__dirname,'..');
const read=p=>{try{return JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'))}catch{return null}};
const cfg=read('shared-try-config-v1.json');
const date=process.argv[2];if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))throw Error('USAGE: try-selection-coverage-v1.js YYYY-MM-DD [--write]');
const now=new Date().toISOString(),cal=read('venue-calendar-v1.json');
const epoch=(day,hm)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(hm||'')?Date.parse(`${day}T${hm}:00+09:00`):NaN;
const pick=k=>/^[1-6]-[1-6]-[1-6]$/.test(k||'')&&new Set(k.split('-')).size===3;
const valid=(p,a,day,r)=>p&&p.venueCode===a.venueCode&&p.venue===a.venue&&p.date===day&&p.race===r&&p.resultInput===false&&p.payoutInput===false&&p.immutableAfterFirstWrite===true&&Array.isArray(p.picks)&&p.picks.length===4&&p.picks.every(pick)&&new Set(p.picks).size===4&&Number.isFinite(Date.parse(p.generatedAt))&&Date.parse(p.generatedAt)<=epoch(day,p.deadline)-180000;
const selections=[];for(let delta=7;delta>=0;delta--){const day=new Date(Date.parse(date+'T00:00:00Z')-delta*86400000).toISOString().slice(0,10),s=read(`live/portfolio/${day}/try-selection-v1.json`);selections.push({day,s});}
const venues=cfg.activeAdapters.map(a=>{
 const row={venueCode:a.venueCode,venue:a.venue,slug:a.slug,date,calendarStatus:cal?.today===date?(cal.venues?.[a.venueCode]?.todayStatus||'UNKNOWN'):'UNKNOWN_HISTORICAL_CALENDAR',programFiles:0,programOnlyPredictionFiles:0,validPreRacePredictions:0,missingPreRaceRaceNumbers:[],invalidPreRaceRaceNumbers:[],postResultFiles:0,pairedFourPickHits:0,pairedRaces:0,pairedStakeYen:0,pairedReturnYen:0,earliestPreRaceGeneratedAt:null,latestPreRaceGeneratedAt:null,selectedTryRaces:[],generatedAfterFreezeInEightDayWindow:0,paths:{program:`live/${a.slug}/${date}/program`,pre:`live/${a.slug}/${date}/shadow/program-only`,post:`live/${a.slug}/${date}/post`}};
 const times=[];
 for(let race=1;race<=12;race++){
  const p=read(`${row.paths.pre}/race-${race}.json`),program=read(`${row.paths.program}/race-${race}.json`),post=read(`${row.paths.post}/race-${race}-result.json`);
  if(program)row.programFiles++;if(p)row.programOnlyPredictionFiles++;if(post)row.postResultFiles++;
  if(!p){row.missingPreRaceRaceNumbers.push(race);continue;}if(!valid(p,a,date,race)){row.invalidPreRaceRaceNumbers.push(race);continue;}
  row.validPreRacePredictions++;times.push(p.generatedAt);
  if(post?.venueCode===a.venueCode&&post.date===date&&post.race===race&&post.resultEndpointsIncluded===true&&post.preRaceDataIncluded===false&&pick(post.trifecta)&&Number.isFinite(post.payout100)&&post.payout100>0){row.pairedRaces++;row.pairedStakeYen+=400;if(p.picks.includes(post.trifecta)){row.pairedFourPickHits++;row.pairedReturnYen+=post.payout100;}}
 }
 times.sort((a,b)=>Date.parse(a)-Date.parse(b));row.earliestPreRaceGeneratedAt=times[0]||null;row.latestPreRaceGeneratedAt=times.at(-1)||null;
 const sel=selections.find(x=>x.day===date)?.s;row.selectedTryRaces=(sel?.selected||[]).filter(x=>x.venueCode===a.venueCode).map(x=>x.race);
 for(const {day,s} of selections){if(!s||!s.selected?.length)continue;for(let race=1;race<=12;race++){const p=read(`live/${a.slug}/${day}/shadow/program-only/race-${race}.json`);if(valid(p,a,day,race)&&Date.parse(p.generatedAt)>Date.parse(s.generatedAt))row.generatedAfterFreezeInEightDayWindow++;}}
 row.fileObservation=row.programFiles?'PROGRAM_FILES_PRESENT':row.calendarStatus==='NOT_SCHEDULED'?'CALENDAR_NOT_SCHEDULED':row.calendarStatus==='CANCELLED'?'CALENDAR_CANCELLED':'NO_PROGRAM_FILES_OBSERVED_NOT_PROOF_OF_NON開催';
 row.pairedHitRate=row.pairedRaces?row.pairedFourPickHits/row.pairedRaces:null;row.pairedRoi=row.pairedStakeYen?row.pairedReturnYen/row.pairedStakeYen:null;return row;
});
const daily=selections.map(({day,s})=>{if(!s)return{date:day,status:'NO_FROZEN_SELECTION_OBSERVED'};let generatedLater=0;const laterByVenue={};for(const a of cfg.activeAdapters){let n=0;for(let r=1;r<=12;r++){const p=read(`live/${a.slug}/${day}/shadow/program-only/race-${r}.json`);if(valid(p,a,day,r)&&Date.parse(p.generatedAt)>Date.parse(s.generatedAt))n++;}if(n)laterByVenue[a.venueCode]=n;generatedLater+=n;}return{date:day,frozenAt:s.generatedAt,status:s.status,candidateCount:s.candidateCount,selectedCount:s.selectedCount,selectedVenues:[...new Set((s.selected||[]).map(x=>x.venueCode))],validPredictionsGeneratedAfterFreeze:generatedLater,laterByVenue};});
const total=key=>venues.reduce((s,v)=>s+v[key],0);const paired=total('pairedRaces'),stake=total('pairedStakeYen');
let head=null;try{head=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();}catch{}
const report={schema:'boat-command-try-selection-coverage-v1',generatedAt:now,sourceHead:head,date,readOnly:true,productionChanged:false,selectionChanged:false,bankrollChanged:false,definitions:{coverage:'Observed files in this checkout, not an assertion of complete official races or successful collection.',post:'POST counted separately; used only to score immutable PRE picks, never for selection.',pairedFourPick:'Every valid saved PRE with >=3min margin and verified POST: 4 picks x 100 yen. This is NOT actual TRY performance or unseen-model validation.',freezeEvidence:'Generated after freeze proves absence from that earlier selection. Generated before freeze does NOT prove GitHub publication/availability at freeze.',missing:'Missing files do not imply non開催. Historical calendar status unknown unless the saved calendar matches date.',window:'Eight calendar dates ending on date; existing HARD LOCK files read without modification.'},totals:{registeredVenues:venues.length,venuesWithProgramFiles:venues.filter(v=>v.programFiles).length,programRaceFiles:total('programFiles'),validPreRacePredictions:total('validPreRacePredictions'),postResultFiles:total('postResultFiles'),pairedRaces:paired,pairedFourPickHits:total('pairedFourPickHits'),pairedFourPickHitRate:paired?total('pairedFourPickHits')/paired:null,pairedStakeYen:stake,pairedReturnYen:total('pairedReturnYen'),pairedRoi:stake?total('pairedReturnYen')/stake:null},dailyFreeze:daily,venues};
if(process.argv.includes('--write'))fs.writeFileSync(path.join(ROOT,'research/try-selection-coverage-v1.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sourceHead:head,date,totals:report.totals,dailyFreeze:daily},null,2));
