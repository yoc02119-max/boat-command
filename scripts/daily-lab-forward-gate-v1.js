#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const dir=path.join(root,'daily-lab');
const candidates=JSON.parse(fs.readFileSync(path.join(dir,'forward-candidates-v1.json'),'utf8'));
if(candidates.schema!=='boat-command-daily-lab-forward-candidates-v1'||candidates.researchOnly!==true||candidates.automaticPromotion!==false)throw Error('FORWARD_CANDIDATE_CONTRACT');
const target=Number(candidates.forwardTargetRacesPerVenue)||120;
const recentTarget=Math.min(60,target);
const minAddedHits=3,minHitRateDelta=0.01,minRoiDelta=0.05,maxSingleAddedReturnShare=0.70;
const start=String(candidates.forwardStartDate);
const validDate=x=>/^\d{4}-\d{2}-\d{2}$/.test(x);
if(!validDate(start))throw Error('FORWARD_START_DATE_INVALID');
const files=fs.readdirSync(dir).filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort();
const reports=[];
for(const file of files){
  const date=file.slice(0,10);if(date<start)continue;
  const x=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
  const live=x.sourceMode==='LIVE_PRE_RACE_CAPTURE'||(!x.sourceMode&&x.resultBlindSelection===true&&x.version==='DAILY-LAB-V1');
  if(!live)continue;
  if(x.researchOnly!==true||x.automaticPromotion!==false||x.productionChanged!==false||x.tryChanged!==false||x.bankrollChanged!==false)throw Error('FORWARD_REPORT_BOUNDARY');
  reports.push(x);
}
function aggregate(rows,key){
  let hits=0,stake100=0,ret100=0;
  for(const r of rows){
    const picks=r?.variants?.[key]?.picks||[];
    if(!Array.isArray(picks)||!picks.length)continue;
    const hit=picks.includes(r.actual);
    hits+=hit?1:0;stake100+=picks.length*100;ret100+=hit?(Number(r.payout100)||0):0;
  }
  const races=rows.length;
  return {races,hits,stake100,payoutOnlyReturn100:ret100,hitRate:races?hits/races:null,payoutOnlyRoi:stake100?ret100/stake100:null};
}
function metrics(rows,variant){
  const base=aggregate(rows,'BASE4'),candidate=aggregate(rows,variant);
  return {
    base,candidate,
    hitRateDelta:base.hitRate==null||candidate.hitRate==null?null:candidate.hitRate-base.hitRate,
    roiDelta:base.payoutOnlyRoi==null||candidate.payoutOnlyRoi==null?null:candidate.payoutOnlyRoi-base.payoutOnlyRoi,
    addedHits:candidate.hits-base.hits
  };
}
const venues=candidates.venues.map(c=>{
  const raceRows=[];let datesUsed=0,lastDate=null;
  for(const report of reports){
    const v=report.venues?.find(x=>x.code===c.code);if(!v)continue;
    const rows=(v.races||[]).filter(r=>(r.status==='SETTLED'||r.status==='SETTLED_REPLAY')&&/^\d-\d-\d$/.test(String(r.actual||''))&&Number.isFinite(Number(r.payout100)));
    if(!rows.length)continue;
    for(const r of rows){
      const b=r.variants?.BASE4?.picks,s=r.variants?.[c.variant]?.picks;
      if(!Array.isArray(b)||!Array.isArray(s)||b.length!==4||s.length<4)continue;
      raceRows.push({...r,__date:report.date});
    }
    datesUsed++;lastDate=report.date;
  }
  raceRows.sort((a,b)=>String(a.__date).localeCompare(String(b.__date))||Number(a.race)-Number(b.race));
  const all=metrics(raceRows,c.variant),recentRows=raceRows.slice(-recentTarget),recent=metrics(recentRows,c.variant);
  const addedReturns=raceRows.filter(r=>{
    const b=r.variants?.BASE4?.picks||[],s=r.variants?.[c.variant]?.picks||[];
    return !b.includes(r.actual)&&s.includes(r.actual);
  }).map(r=>Number(r.payout100)||0).sort((a,b)=>b-a);
  const addedReturnTotal=addedReturns.reduce((a,b)=>a+b,0),maxAddedReturn=addedReturns[0]||0;
  const singleAddedReturnShare=addedReturnTotal>0?maxAddedReturn/addedReturnTotal:null;
  const candidateMode=c.mode==='EXPANSION_CANDIDATE';
  const ready=all.base.races>=target;
  const gates={
    targetRacesReady:ready,
    addedHitsReady:all.addedHits>=minAddedHits,
    hitRateDeltaReady:all.hitRateDelta!=null&&all.hitRateDelta>=minHitRateDelta,
    roiDeltaReady:all.roiDelta!=null&&all.roiDelta>=minRoiDelta,
    recentWindowReady:recent.base.races>=recentTarget,
    recentHitRateNonRegression:recent.hitRateDelta!=null&&recent.hitRateDelta>=0,
    recentRoiNonRegression:recent.roiDelta!=null&&recent.roiDelta>=0,
    payoutConcentrationReady:singleAddedReturnShare==null||singleAddedReturnShare<=maxSingleAddedReturnShare
  };
  const uplift=ready&&candidateMode&&Object.values(gates).every(Boolean);
  const reasons=Object.entries(gates).filter(([,ok])=>!ok).map(([k])=>k);
  return {
    code:c.code,slug:c.slug,name:c.name,mode:c.mode,variant:c.variant,
    forwardDates:datesUsed,forwardRaces:all.base.races,lastDate,
    targetRaces:target,progress:Math.min(1,target?all.base.races/target:0),
    base:all.base,candidate:all.candidate,hitRateDelta:all.hitRateDelta,roiDelta:all.roiDelta,addedHits:all.addedHits,
    recent:{targetRaces:recentTarget,...recent},
    robustness:{addedReturnTotal100:addedReturnTotal,maxAddedReturn100:maxAddedReturn,singleAddedReturnShare},
    gates,reasons,
    status:!candidateMode?'BASE4_CONTROL':ready?'REVIEW_READY':'COLLECTING',
    reviewEligible:candidateMode&&uplift===true,
    candidateUplift:ready&&candidateMode?uplift:null,
    automaticPromotion:false
  };
});
const evaluatedDates=reports.filter(r=>Number(r.totals?.evaluatedRaces)>0).map(r=>r.date);
const output={
  schema:'boat-command-daily-lab-forward-gate-v1',version:'DAILY-LAB-FORWARD-GATE-V1.1',
  candidateVersion:candidates.version,frozenAt:candidates.frozenAt,sourceWindow:candidates.sourceWindow,
  forwardStartDate:start,evaluatedThrough:evaluatedDates.length?evaluatedDates.sort().at(-1):null,
  liveCaptureOnly:true,strictReplayExcluded:true,researchOnly:true,automaticPromotion:false,
  productionChanged:false,tryChanged:false,bankrollChanged:false,targetRacesPerVenue:target,
  gatePolicy:{recentTargetRaces:recentTarget,minAddedHits,minHitRateDelta,minRoiDelta,maxSingleAddedReturnShare,requireFullAndRecentNonRegression:true},
  summary:{
    venues:venues.length,
    expansionCandidates:venues.filter(v=>v.mode==='EXPANSION_CANDIDATE').length,
    controls:venues.filter(v=>v.mode==='BASE4_CONTROL').length,
    reviewReady:venues.filter(v=>v.status==='REVIEW_READY').length,
    reviewEligible:venues.filter(v=>v.reviewEligible).length,
    forwardRaces:venues.reduce((s,v)=>s+v.forwardRaces,0)
  },
  venues
};
if(output.venues.length!==24)throw Error('FORWARD_24_VENUES_REQUIRED');
const out=path.join(dir,'forward-gate-v1.json'),next=JSON.stringify(output,null,2)+'\n',prev=fs.existsSync(out)?fs.readFileSync(out,'utf8'):null;
if(next!==prev)fs.writeFileSync(out,next);
console.log(JSON.stringify({status:'PASS',...output.summary,evaluatedThrough:output.evaluatedThrough,changed:next!==prev}));
