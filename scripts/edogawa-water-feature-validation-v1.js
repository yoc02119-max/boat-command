#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'..');
const liveRoot=path.join(root,'live','edogawa');
const config=JSON.parse(fs.readFileSync(path.join(root,'venues','edogawa','config-v1.json'),'utf8'));
const policy=config.promotionPolicy||{};
const MIN_ROWS=Number(policy.minimumFullPreForwardRaces)||30;
const MIN_TIDE=Number(policy.minimumOfficialTideMappedRaces)||6;
const output=process.argv[2]||path.join(root,'edogawa-water-feature-validation-v1.json');

function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function dirs(p){try{return fs.readdirSync(p,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name)}catch{return[]}}
function bucketWind(v){v=Number(v);if(!Number.isFinite(v))return'UNKNOWN';return v<=2?'CALM_0_2':v<=5?'MID_3_5':'STRONG_6_PLUS'}
function bucketWave(v){v=Number(v);if(!Number.isFinite(v))return'UNKNOWN';return v<=5?'LOW_0_5':v<=10?'MID_6_10':'HIGH_11_PLUS'}
function add(map,key,row){
  if(!map[key])map[key]={races:0,lane1Wins:0,outerWins:0,payoutSum:0,payouts:[]};
  const b=map[key];b.races++;b.lane1Wins+=row.first===1?1:0;b.outerWins+=row.first>=4?1:0;b.payoutSum+=row.payout;b.payouts.push(row.payout);
}
function finish(map){
  const out={};
  for(const [k,b] of Object.entries(map)){
    const p=[...b.payouts].sort((a,b)=>a-b);
    out[k]={
      races:b.races,
      lane1WinRate:b.races?b.lane1Wins/b.races:null,
      outerFirstRate:b.races?b.outerWins/b.races:null,
      averagePayout:b.races?b.payoutSum/b.races:null,
      medianPayout:p.length?p[Math.floor((p.length-1)/2)]:null
    };
  }
  return out;
}

const rows=[];
for(const date of dirs(liveRoot).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort()){
  const base=path.join(liveRoot,date);
  for(let race=1;race<=12;race++){
    const pre=read(path.join(base,'pre',`race-${race}-pack.json`));
    const result=read(path.join(base,'post',`race-${race}-result.json`));
    if(!pre||!result)continue;
    if(pre.venue!=='EDOGAWA'||pre.venueCode!=='03'||pre.date!==date||Number(pre.race)!==race)continue;
    if(pre.resultEndpointsIncluded!==false||pre.payoutEndpointsIncluded!==false||pre.predictionEnabled!==false)continue;
    if(pre.boatMappingVerified!==true||pre.weatherMappingVerified!==true)continue;
    if(result.venue!=='EDOGAWA'||result.venueCode!=='03'||result.date!==date||Number(result.race)!==race)continue;
    if(result.preRaceDataIncluded!==false||result.resultEndpointsIncluded!==true)continue;
    const m=String(result.trifecta||'').match(/^([1-6])-([1-6])-([1-6])$/);if(!m)continue;
    const tide=read(path.join(base,'pre',`race-${race}-tide-source.json`));
    const mappedTide=tide?.venueCode==='03'&&tide?.mapping?.status==='EXPLICIT_TEXT_ONLY'&&
      typeof tide?.mapping?.tideDirection==='string'&&!!tide.mapping.tideDirection&&
      tide?.mapping?.inferredFromImageCode===false?tide.mapping.tideDirection:null;
    rows.push({
      date,race,first:Number(m[1]),payout:Number(result.payout100)||0,
      windSpeed:Number(pre.water?.windSpeedMps),
      waveHeight:Number(pre.water?.waveHeightCm),
      windDirectionCode:pre.water?.windDirectionCode||null,
      tideDirection:mappedTide
    });
  }
}

const wind={},wave={},direction={},tide={},joint={};
for(const r of rows){
  const wb=bucketWind(r.windSpeed),wav=bucketWave(r.waveHeight);
  add(wind,wb,r);add(wave,wav,r);
  if(r.windDirectionCode)add(direction,String(r.windDirectionCode),r);
  if(r.tideDirection)add(tide,r.tideDirection,r);
  add(joint,`${wb}|${wav}`,r);
}
const mappedTideRows=rows.filter(r=>r.tideDirection).length;
const ready=rows.length>=MIN_ROWS&&mappedTideRows>=MIN_TIDE;
const out={
  schema:'boat-command-edogawa-water-feature-validation-v1',
  version:'EDOGAWA-WATER-FEATURE-VALIDATION-V1',
  venue:'EDOGAWA',venueCode:'03',
  generatedAt:new Date().toISOString(),
  thresholds:{minimumCompletePreResultRows:MIN_ROWS,minimumMappedTideRows:MIN_TIDE},
  rows:rows.length,
  mappedTideRows,
  dateCount:new Set(rows.map(r=>r.date)).size,
  firstDate:rows[0]?.date??null,
  lastDate:rows.at(-1)?.date??null,
  stats:{
    byWindSpeedBucket:finish(wind),
    byWaveHeightBucket:finish(wave),
    byWindDirectionCode:finish(direction),
    byTideDirection:finish(tide),
    byWindWaveJoint:finish(joint)
  },
  ready,
  researchOnly:true,
  predictionInput:false,
  resultUsedOnlyAfterRace:true,
  modelWeightsPromoted:false
};
fs.writeFileSync(output,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({rows:out.rows,mappedTideRows,ready,thresholds:out.thresholds},null,2));
