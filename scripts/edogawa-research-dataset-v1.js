#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');

const root=process.argv[2]||path.join(__dirname,'..','live','edogawa');
const output=process.argv[3]||path.join(__dirname,'..','edogawa-research-dataset-v1.json');

function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function exists(p){try{return fs.existsSync(p)}catch{return false}}
function validOrder(v){return /^[1-6]-[1-6]-[1-6]$/.test(String(v||''))&&new Set(String(v).split('-')).size===3}

const rows=[];
if(exists(root)){
  for(const date of fs.readdirSync(root).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort()){
    for(let race=1;race<=12;race++){
      const programPath=path.join(root,date,'program',`race-${race}.json`);
      const prePath=path.join(root,date,'pre',`race-${race}-pack.json`);
      const tidePath=path.join(root,date,'pre',`race-${race}-tide-source.json`);
      const resultPath=path.join(root,date,'post',`race-${race}-result.json`);
      if(!exists(programPath)||!exists(resultPath))continue;
      const program=read(programPath),pre=read(prePath),tide=read(tidePath),result=read(resultPath);
      if(!program||!result)continue;
      if(program.venue!=='EDOGAWA'||program.venueCode!=='03'||program.date!==date||Number(program.race)!==race)continue;
      if(program.resultEndpointsIncluded!==false||program.resultIncluded!==false||program.exhibitionIncluded!==false)continue;
      if(result.venue!=='EDOGAWA'||result.venueCode!=='03'||result.date!==date||Number(result.race)!==race)continue;
      if(result.preRaceDataIncluded!==false||result.resultEndpointsIncluded!==true||!validOrder(result.trifecta))continue;

      const boats=[...(program.boats||[])].sort((a,b)=>Number(a.lane)-Number(b.lane));
      if(boats.length!==6)continue;
      const preOk=!!pre&&pre.schema==='boat-command-edogawa-pre-race-pack-v1'&&pre.date===date&&Number(pre.race)===race&&pre.resultEndpointsIncluded===false&&pre.payoutEndpointsIncluded===false;
      const tideOk=!!tide&&tide.schema==='boat-command-edogawa-tide-source-v1'&&tide.date===date&&Number(tide.race)===race&&tide.resultEndpointsIncluded===false;

      const preBoats=preOk?[...(pre.boats||[])].sort((a,b)=>Number(a.lane)-Number(b.lane)):[];
      const starts=preOk?Object.fromEntries((pre.startExhibition||[]).map(x=>[String(x.course),x.st])):{};
      const row={
        id:`${date}-03-${String(race).padStart(2,'0')}`,
        d:date,r:race,
        c:boats.map(b=>String(b.class||'')),
        reg:boats.map(b=>Number(b.registration)||null),
        fCount:boats.map(b=>Number.isFinite(Number(b.fCount))?Number(b.fCount):null),
        lCount:boats.map(b=>Number.isFinite(Number(b.lCount))?Number(b.lCount):null),
        avgST:boats.map(b=>Number.isFinite(Number(b.avgST))?Number(b.avgST):null),
        nationalWin:boats.map(b=>Number.isFinite(Number(b.nationalWinRate))?Number(b.nationalWinRate):null),
        national2:boats.map(b=>Number.isFinite(Number(b.national2Rate))?Number(b.national2Rate):null),
        national3:boats.map(b=>Number.isFinite(Number(b.national3Rate))?Number(b.national3Rate):null),
        localWin:boats.map(b=>Number.isFinite(Number(b.localWinRate))?Number(b.localWinRate):null),
        local2:boats.map(b=>Number.isFinite(Number(b.local2Rate))?Number(b.local2Rate):null),
        local3:boats.map(b=>Number.isFinite(Number(b.local3Rate))?Number(b.local3Rate):null),
        m:boats.map(b=>Number(b.motor)||null),
        motor2:boats.map(b=>Number.isFinite(Number(b.motor2Rate))?Number(b.motor2Rate):null),
        boat2:boats.map(b=>Number.isFinite(Number(b.boat2Rate))?Number(b.boat2Rate):null),
        t:String(program.raceType||''),
        deadline:program.deadline||null,
        preRaceComplete:preOk&&pre.boatMappingVerified===true&&pre.weatherMappingVerified===true,
        exhibition:preBoats.length===6?preBoats.map(b=>Number.isFinite(Number(b.exhibitionTime))?Number(b.exhibitionTime):null):null,
        tilt:preBoats.length===6?preBoats.map(b=>Number.isFinite(Number(b.tilt))?Number(b.tilt):null):null,
        startExhibition:Object.keys(starts).length===6?Array.from({length:6},(_,i)=>starts[String(i+1)]??null):null,
        water:preOk?{
          airTempC:pre.water?.airTempC??null,
          windSpeedMps:pre.water?.windSpeedMps??null,
          waterTempC:pre.water?.waterTempC??null,
          waveHeightCm:pre.water?.waveHeightCm??null,
          windDirectionCode:pre.water?.windDirectionCode??null
        }:null,
        tideSource:tideOk?{
          sourceFingerprint:tide.sourceFingerprint||null,
          imageTokens:Array.isArray(tide.imageTokens)?tide.imageTokens:[],
          mapping:tide.mapping||null
        }:null,
        o:String(result.trifecta),
        p:Number(result.payout100)||0,
        exacta:result.exacta||null,
        exactaPayout100:Number(result.exactaPayout100)||null,
        winningMethod:result.winningMethod||null,
        sourceBoundary:{
          programPreRaceOnly:true,
          preRaceResultFree:preOk,
          tideResultFree:tideOk,
          resultSeparated:true
        }
      };
      if(row.c.length!==6||row.c.some(x=>!['A1','A2','B1','B2'].includes(x)))continue;
      rows.push(row);
    }
  }
}

rows.sort((a,b)=>a.d.localeCompare(b.d)||a.r-b.r);
const ids=rows.map(x=>x.id);
if(new Set(ids).size!==ids.length)throw new Error('DUPLICATE_RESEARCH_ID');
const complete=rows.filter(x=>x.preRaceComplete);
const tideRows=rows.filter(x=>x.tideSource);
const out={
  schema:'boat-command-edogawa-research-dataset-v1',
  version:'EDOGAWA-RESEARCH-DATASET-V1',
  venue:'EDOGAWA',venueCode:'03',
  generatedAt:new Date().toISOString(),
  resultUse:'TRAINING_AND_BACKTEST_ROWS_ONLY_AFTER_SEPARATED_POST_RACE_JOIN',
  noSameRaceResultInPrediction:true,
  races:rows,
  audit:{
    rows:rows.length,
    completePreRaceRows:complete.length,
    tideSourceRows:tideRows.length,
    localExperienceRows:rows.filter(x=>Array.isArray(x.localWin)&&x.localWin.every(v=>Number.isFinite(v))).length,
    firstDate:rows[0]?.d??null,
    lastDate:rows.at(-1)?.d??null,
    duplicateIds:ids.length-new Set(ids).size,
    predictionEnabled:false
  }
};
fs.writeFileSync(output,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out.audit,null,2));
