#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const gatePath=path.join(root,'daily-lab','forward-gate-v1.json');
const gate=JSON.parse(fs.readFileSync(gatePath,'utf8'));
if(gate.schema!=='boat-command-daily-lab-forward-gate-v1'||gate.researchOnly!==true||gate.automaticPromotion!==false)throw Error('EXPANSION_POLICY_GATE_CONTRACT');
const venues=gate.venues.map(v=>{
  const candidate=v.mode==='EXPANSION_CANDIDATE';
  const forwardReady=v.status==='REVIEW_READY';
  const humanReviewPending=candidate&&v.reviewEligible===true;
  const decision=!candidate?'KEEP_BASE4':
    !forwardReady?'COLLECT_FORWARD':
    v.candidateUplift!==true?'FORWARD_NOT_CONFIRMED':
    'AWAITING_HUMAN_REVIEW';
  return {
    code:v.code,slug:v.slug,name:v.name,
    baseVariant:'BASE4',
    candidateVariant:candidate?v.variant:null,
    decision,
    forward:{
      races:Number(v.forwardRaces)||0,
      target:Number(v.targetRaces)||60,
      progress:Number(v.progress)||0,
      hitRateDelta:v.hitRateDelta,
      roiDelta:v.roiDelta,
      candidateUplift:v.candidateUplift,
      reviewEligible:v.reviewEligible===true
    },
    humanReviewRequired:candidate,
    humanReviewPending,
    humanApproved:false,
    integrationReady:false,
    applyToPrediction:false,
    productionEnabled:false
  };
});
const output={
  schema:'boat-command-venue-expansion-policy-v1',
  version:'VENUE-EXPANSION-POLICY-V1',
  generatedFrom:'daily-lab/forward-gate-v1.json',
  candidateVersion:gate.candidateVersion,
  forwardStartDate:gate.forwardStartDate,
  evaluatedThrough:gate.evaluatedThrough,
  policyPurpose:'REVIEW_GATE_ONLY',
  researchOnly:true,
  automaticPromotion:false,
  requiresExplicitHumanApproval:true,
  productionChanged:false,
  predictionLogicChanged:false,
  bankrollChanged:false,
  summary:{
    venues:venues.length,
    keepBase4:venues.filter(v=>v.decision==='KEEP_BASE4').length,
    collecting:venues.filter(v=>v.decision==='COLLECT_FORWARD').length,
    forwardNotConfirmed:venues.filter(v=>v.decision==='FORWARD_NOT_CONFIRMED').length,
    awaitingHumanReview:venues.filter(v=>v.decision==='AWAITING_HUMAN_REVIEW').length,
    integrationReady:venues.filter(v=>v.integrationReady).length,
    productionEnabled:venues.filter(v=>v.productionEnabled).length
  },
  venues
};
if(output.venues.length!==24)throw Error('EXPANSION_POLICY_24_VENUES_REQUIRED');
if(output.summary.integrationReady!==0||output.summary.productionEnabled!==0)throw Error('EXPANSION_POLICY_AUTOMATION_BOUNDARY');
const out=path.join(root,'daily-lab','venue-expansion-policy-v1.json');
const next=JSON.stringify(output,null,2)+'\n',prev=fs.existsSync(out)?fs.readFileSync(out,'utf8'):null;
if(next!==prev)fs.writeFileSync(out,next);
console.log(JSON.stringify({status:'PASS',...output.summary,changed:next!==prev}));
module.exports={build:()=>output};
