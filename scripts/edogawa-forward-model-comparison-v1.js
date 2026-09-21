#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'..');
const liveRoot=path.join(root,'live','edogawa');
const config=JSON.parse(fs.readFileSync(path.join(root,'venues','edogawa','config-v1.json'),'utf8'));
const policy=config.promotionPolicy||{};
const minPair=Number(policy.minimumPairedForwardRaces)||30;
const maxHitRegression=Number(policy.maxAllowedHitRateRegression??0.02);
const maxRoiRegression=Number(policy.maxAllowedResearchRoiRegression??0.10);
const requireOneImprovement=policy.requireOneForwardMetricImprovement!==false;

function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function evalFiles(){
  if(!fs.existsSync(liveRoot))return[];
  const out=[];
  for(const d of fs.readdirSync(liveRoot).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort()){
    const p=path.join(liveRoot,d,'research-evaluation-v1.json');
    const x=read(p);
    if(x?.schema==='boat-command-edogawa-shadow-evaluation-v1'&&x?.venueCode==='03')out.push(x);
  }
  return out;
}
function side(row,key){
  const x=row?.[key];
  if(!x||!Array.isArray(x.picks)||x.picks.length!==4||typeof x.hit!=='boolean')return null;
  return {hit:x.hit,payout100:Number(row.payout100)||0};
}
function paired(a,b){
  const rows=[];
  for(const ev of evalFiles()){
    for(const r of ev.rows||[]){
      const x=side(r,a),y=side(r,b);
      if(x&&y)rows.push({date:ev.date,race:Number(r.race),a:x,b:y});
    }
  }
  const metrics=k=>{
    const hits=rows.filter(r=>r[k].hit).length;
    const returns=rows.reduce((n,r)=>n+(r[k].hit?r[k].payout100:0),0);
    const stake=rows.length*4*100;
    return {races:rows.length,hits,hitRate:rows.length?hits/rows.length:null,stake100Yen:stake,return100Yen:returns,roi:stake?returns/stake:null};
  };
  const ma=metrics('a'),mb=metrics('b');
  const hitDelta=(ma.hitRate!=null&&mb.hitRate!=null)?mb.hitRate-ma.hitRate:null;
  const roiDelta=(ma.roi!=null&&mb.roi!=null)?mb.roi-ma.roi:null;
  const sampleReady=rows.length>=minPair;
  const noBadHit=hitDelta!=null&&hitDelta>=-maxHitRegression;
  const noBadRoi=roiDelta!=null&&roiDelta>=-maxRoiRegression;
  const oneImproved=!requireOneImprovement||(hitDelta>0||roiDelta>0);
  return {rows:rows.length,a:ma,b:mb,hitRateDelta:hitDelta,roiDelta,sampleReady,noBadHit,noBadRoi,oneImproved,pass:sampleReady&&noBadHit&&noBadRoi&&oneImproved};
}
const classVsProgram=paired('classBaseline','programOnly');
const classVsRich=paired('classBaseline','richProgram');
const programVsRich=paired('programOnly','richProgram');
const richVsFull=paired('richProgram','fullPre');
const programVsFull=paired('programOnly','fullPre');
const out={
  schema:'boat-command-edogawa-forward-model-comparison-v1',
  version:'EDOGAWA-FORWARD-MODEL-COMPARISON-V1',
  venue:'EDOGAWA',venueCode:'03',
  generatedAt:null,
  policy:{
    minimumPairedForwardRaces:minPair,
    maxAllowedHitRateRegression:maxHitRegression,
    maxAllowedResearchRoiRegression:maxRoiRegression,
    requireOneForwardMetricImprovement:requireOneImprovement
  },
  classBaselineVsProgramOnly:classVsProgram,
  classBaselineVsRichProgram:classVsRich,
  programOnlyVsRichProgram:programVsRich,
  richProgramVsFullPre:richVsFull,
  programOnlyVsFullPre:programVsFull,
  ready:classVsProgram.pass&&programVsFull.pass,
  fundingScope:'NONE_RESEARCH_ONLY',
  bankrollAffected:false,
  productionEnabled:false,
  tryEnabled:false
};
const _previous=read(path.join(root,'edogawa-forward-model-comparison-v1.json')),_before=_previous?{..._previous}:null,_after={...out};
if(_before)delete _before.generatedAt;delete _after.generatedAt;
out.generatedAt=_before&&JSON.stringify(_before)===JSON.stringify(_after)?(_previous.generatedAt||new Date().toISOString()):new Date().toISOString();
fs.writeFileSync(path.join(root,'edogawa-forward-model-comparison-v1.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({classVsProgram,classVsRich,programVsRich,richVsFull,programVsFull,ready:out.ready},null,2));
