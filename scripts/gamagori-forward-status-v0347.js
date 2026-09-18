#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');

const ROOT=path.join(__dirname,'..');
const LIVE=path.join(ROOT,'live','gamagori');
const POLICY_PATH=path.join(ROOT,'gamagori-forward-validation-policy-v0346.json');
const STATUS_PATH=path.join(LIVE,'forward-status-v0347.json');

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'))}
function writeJson(p,x){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n')}
function dateDirs(){return fs.existsSync(LIVE)?fs.readdirSync(LIVE,{withFileTypes:true}).filter(x=>x.isDirectory()&&/^\d{4}-\d{2}-\d{2}$/.test(x.name)).map(x=>x.name).sort():[]}
function daysInclusive(a,b){const x=Date.parse(a+'T00:00:00Z'),y=Date.parse(b+'T00:00:00Z');return Number.isFinite(x)&&Number.isFinite(y)?Math.floor((y-x)/86400000)+1:0}
function gatePath(date){return path.join(LIVE,date,'shadow','all-race-try-gates-v0349.json')}
function loadGate(date){
  const p=gatePath(date); if(!fs.existsSync(p))return null;
  const x=readJson(p);
  if(x.schema!=='boat-command-gamagori-all-race-try-gates-v0349'||x.shadowOnly!==true||x.liveBettingEnabled!==false||x.targetResultsRead!==false||x.targetPayoutsRead!==false)throw new Error('ALL_RACE_GATE_BOUNDARY_INVALID');
  return x;
}
function loadPost(date,race){
  const p=path.join(LIVE,date,'post',`race-${race}-result.json`);
  if(!fs.existsSync(p))return null;
  const x=readJson(p);
  if(x.schema!=='boat-command-live-result-v1'||x.venue!=='GAMAGORI'||x.date!==date||Number(x.race)!==Number(race))return null;
  return x;
}
function summarize(kind,dates,latestDate){
  const exacta=kind==='EXACTA';
  const allDays=[];
  const obs=[];
  for(const date of dates){
    const gate=loadGate(date); if(!gate)continue;
    allDays.push(date);
    for(const row of gate.races||[]){
      const m=exacta?row.exacta:row.trifecta;
      if(!m?.matched)continue;
      const picks=Array.isArray(m.frozenPicks)?m.frozenPicks:[];
      const post=loadPost(date,Number(row.race));
      let settled=false,hit=false,stake=0,ret=0,result=null,payout100=null;
      if(post){
        if(exacta&&/^[1-6]-[1-6]$/.test(String(post.exacta||''))&&Number.isFinite(Number(post.exactaPayout100))){
          settled=true;result=String(post.exacta);payout100=Number(post.exactaPayout100);stake=picks.length*100;hit=picks.includes(result);ret=hit?payout100:0;
        }else if(!exacta&&/^[1-6]-[1-6]-[1-6]$/.test(String(post.trifecta||''))&&Number.isFinite(Number(post.payout100))){
          settled=true;result=String(post.trifecta);payout100=Number(post.payout100);stake=picks.length*100;hit=picks.includes(result);ret=hit?payout100:0;
        }
      }
      obs.push({date,race:Number(row.race),picks,settled,hit,stakeYen:stake,returnYen:ret,result,payout100});
    }
  }
  const startDate=allDays[0]||latestDate;
  const day=daysInclusive(startDate,latestDate);
  const settled=obs.filter(x=>x.settled);
  const stake=settled.reduce((s,x)=>s+x.stakeYen,0),ret=settled.reduce((s,x)=>s+x.returnYen,0);
  const currentGate=loadGate(latestDate);
  const currentTry=(currentGate?.races||[]).filter(x=>(exacta?x.exacta:x.trifecta)?.matched).map(x=>{
    const m=exacta?x.exacta:x.trifecta;
    return {race:Number(x.race),deadline:x.deadline||null,raceType:x.raceType||'',aClassCount:Number(x.aClassCount),picks:m.frozenPicks||[]};
  });
  return {
    method:exacta?'2連単':'3連単',
    label:exacta?'予選 × TOP1｜1〜12R':'A級3人 × 4点｜1〜12R',
    raceRestriction:false,
    tryOnly:true,
    cycleStartDate:startDate,
    cycleDays:30,
    cycleDay:Math.min(day,30),
    daysRemaining:Math.max(0,30-day),
    cycleStatus:day>=30?'REVIEW_DUE':'COLLECTING',
    observedDays:allDays.length,
    matchedRaces:obs.length,
    settledMatchedRaces:settled.length,
    hits:settled.filter(x=>x.hit).length,
    hitRate:settled.length?settled.filter(x=>x.hit).length/settled.length:null,
    stakeYen:stake,
    returnYen:ret,
    profitYen:ret-stake,
    roi:stake?ret/stake:null,
    currentTry,
    current:{
      date:latestDate,
      matched:currentTry.length>0,
      decision:currentTry.length?'FORWARD_SHADOW_TRY':'FORWARD_SHADOW_SKIP',
      picks:currentTry.flatMap(x=>x.picks),
      tryRaces:currentTry.map(x=>x.race),
      settled:false
    }
  };
}

const dates=dateDirs(); if(!dates.length)throw new Error('NO_LIVE_DATES');
const latestDate=dates.at(-1);
const policy=readJson(POLICY_PATH);
const manifestPath=path.join(LIVE,latestDate,'program','manifest.json');
const manifest=fs.existsSync(manifestPath)?readJson(manifestPath):null;
const status={
  schema:'boat-command-gamagori-forward-status-v0347',
  version:'0.35.0',
  venue:'GAMAGORI',
  date:latestDate,
  updatedAt:manifest?.fetchedAt||new Date().toISOString(),
  shadowOnly:true,
  tryOnly:true,
  liveBettingEnabled:false,
  raceNumberRestricted:false,
  policy:{source:'gamagori-forward-validation-policy-v0346.json',cycleDays:Number(policy?.evaluation?.cycleDays)||30,cycleType:policy?.evaluation?.cycleType||'FIXED_CALENDAR_WINDOW'},
  program:{races:manifest?.races||null,allProgramReady:manifest?.allProgramReady===true,fetchedAt:manifest?.fetchedAt||null},
  methods:{exacta:summarize('EXACTA',dates,latestDate),trifecta:summarize('TRIFECTA',dates,latestDate)},
  note:'Display-only all-race TRY validation. Race number restrictions are removed. TRY methods cannot alter official LIVE predictions, HARD LOCKs, or stakes.'
};
writeJson(STATUS_PATH,status);
console.log(JSON.stringify(status,null,2));
