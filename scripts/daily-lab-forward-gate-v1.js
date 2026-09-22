#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const dir=path.join(root,'daily-lab');
const candidates=JSON.parse(fs.readFileSync(path.join(dir,'forward-candidates-v1.json'),'utf8'));
if(candidates.schema!=='boat-command-daily-lab-forward-candidates-v1'||candidates.researchOnly!==true||candidates.automaticPromotion!==false)throw Error('FORWARD_CANDIDATE_CONTRACT');
const target=Number(candidates.forwardTargetRacesPerVenue)||60;
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
function empty(){return{races:0,hits:0,stake100:0,payoutOnlyReturn100:0}}
function add(a,s){a.races+=Number(s?.races)||0;a.hits+=Number(s?.hits)||0;a.stake100+=Number(s?.stake100)||0;a.payoutOnlyReturn100+=Number(s?.payoutOnlyReturn100)||0}
function finish(x){return{...x,hitRate:x.races?x.hits/x.races:null,payoutOnlyRoi:x.stake100?x.payoutOnlyReturn100/x.stake100:null}}
const venues=candidates.venues.map(c=>{
  const base=empty(),chosen=empty();let datesUsed=0,lastDate=null;
  for(const report of reports){
    const v=report.venues?.find(x=>x.code===c.code);if(!v)continue;
    const b=v.summary?.BASE4,s=v.summary?.[c.variant];
    const n=Number(b?.races)||0;if(!n)continue;
    if(Number(s?.races)!==n)throw Error('FORWARD_PAIRED_RACE_MISMATCH:'+c.code+':'+report.date);
    add(base,b);add(chosen,s);datesUsed++;lastDate=report.date;
  }
  const b=finish(base),s=finish(chosen);
  const hitRateDelta=b.hitRate==null||s.hitRate==null?null:s.hitRate-b.hitRate;
  const roiDelta=b.payoutOnlyRoi==null||s.payoutOnlyRoi==null?null:s.payoutOnlyRoi-b.payoutOnlyRoi;
  const candidateMode=c.mode==='EXPANSION_CANDIDATE';
  const ready=b.races>=target;
  const uplift=ready&&candidateMode?hitRateDelta>=0&&roiDelta>0:null;
  return {
    code:c.code,slug:c.slug,name:c.name,mode:c.mode,variant:c.variant,
    forwardDates:datesUsed,forwardRaces:b.races,lastDate,
    targetRaces:target,progress:Math.min(1,target?b.races/target:0),
    base:b,candidate:s,hitRateDelta,roiDelta,
    status:!candidateMode?'BASE4_CONTROL':ready?'REVIEW_READY':'COLLECTING',
    reviewEligible:candidateMode&&ready&&uplift===true,
    candidateUplift:uplift,
    automaticPromotion:false
  };
});
const evaluatedDates=reports.filter(r=>Number(r.totals?.evaluatedRaces)>0).map(r=>r.date);
const output={
  schema:'boat-command-daily-lab-forward-gate-v1',version:'DAILY-LAB-FORWARD-GATE-V1',
  candidateVersion:candidates.version,frozenAt:candidates.frozenAt,sourceWindow:candidates.sourceWindow,
  forwardStartDate:start,evaluatedThrough:evaluatedDates.length?evaluatedDates.sort().at(-1):null,
  liveCaptureOnly:true,strictReplayExcluded:true,researchOnly:true,automaticPromotion:false,
  productionChanged:false,tryChanged:false,bankrollChanged:false,targetRacesPerVenue:target,
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
