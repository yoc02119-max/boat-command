#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'daily-lab');
const gate=JSON.parse(fs.readFileSync(path.join(dir,'forward-gate-v1.json'),'utf8'));
if(gate.schema!=='boat-command-daily-lab-forward-gate-v1'||gate.researchOnly!==true||gate.automaticPromotion!==false)throw Error('EXPANSION_POLICY_GATE_CONTRACT');
const decisionsPath=path.join(dir,'venue-expansion-decisions-v1.json');
const ledger=fs.existsSync(decisionsPath)?JSON.parse(fs.readFileSync(decisionsPath,'utf8')):{schema:'boat-command-venue-expansion-decisions-v1',version:'VENUE-EXPANSION-DECISIONS-V1',decisions:[]};
if(ledger.schema!=='boat-command-venue-expansion-decisions-v1'||!Array.isArray(ledger.decisions))throw Error('EXPANSION_POLICY_DECISION_CONTRACT');
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const venues=gate.venues.map(v=>{
  const candidate=v.mode==='EXPANSION_CANDIDATE',forwardReady=v.status==='REVIEW_READY';
  const approval=[...ledger.decisions].reverse().find(x=>x.code===v.code&&x.candidateVersion===gate.candidateVersion&&x.variant===v.variant)||null;
  const approved=approval?.decision==='APPROVE',rejected=approval?.decision==='REJECT';
  const effective=approved&&String(approval.effectiveDate||'')<=today;
  const active=candidate&&v.reviewEligible===true&&approved&&effective;
  const suspended=candidate&&approved&&effective&&v.reviewEligible!==true;
  let decision;
  if(!candidate)decision='KEEP_BASE4';
  else if(rejected)decision='REJECTED_KEEP_BASE4';
  else if(active)decision='APPROVED_ACTIVE';
  else if(approved&&!effective)decision='APPROVED_NEXT_DAY';
  else if(suspended)decision='APPROVED_SUSPENDED_GATE';
  else if(!forwardReady)decision='COLLECT_FORWARD';
  else if(v.reviewEligible!==true)decision='FORWARD_NOT_CONFIRMED';
  else decision='AWAITING_HUMAN_REVIEW';
  return {
    code:v.code,slug:v.slug,name:v.name,baseVariant:'BASE4',candidateVariant:candidate?v.variant:null,decision,
    forward:{races:Number(v.forwardRaces)||0,target:Number(v.targetRaces)||120,progress:Number(v.progress)||0,hitRateDelta:v.hitRateDelta,roiDelta:v.roiDelta,addedHits:v.addedHits,recent:v.recent,robustness:v.robustness,reviewEligible:v.reviewEligible===true},
    approval:approval?{decision:approval.decision,decidedAt:approval.decidedAt,decidedBy:approval.decidedBy,effectiveDate:approval.effectiveDate}:null,
    humanReviewRequired:candidate,humanReviewPending:decision==='AWAITING_HUMAN_REVIEW',
    humanApproved:approved,integrationReady:active,applyToPrediction:active,productionEnabled:active,
    automaticRollbackToBase4:suspended
  };
});
const output={
  schema:'boat-command-venue-expansion-policy-v1',version:'VENUE-EXPANSION-POLICY-V1.1',
  generatedFrom:'daily-lab/forward-gate-v1.json',candidateVersion:gate.candidateVersion,
  forwardStartDate:gate.forwardStartDate,evaluatedThrough:gate.evaluatedThrough,policyPurpose:'OWNER_DECISION_GATE',
  researchOnly:false,automaticPromotion:false,requiresExplicitHumanApproval:true,
  activationStartsNextJstDay:true,automaticRollbackOnGateFailure:true,bankrollChanged:false,
  summary:{
    venues:venues.length,keepBase4:venues.filter(v=>v.decision==='KEEP_BASE4').length,
    collecting:venues.filter(v=>v.decision==='COLLECT_FORWARD').length,
    forwardNotConfirmed:venues.filter(v=>v.decision==='FORWARD_NOT_CONFIRMED').length,
    awaitingHumanReview:venues.filter(v=>v.decision==='AWAITING_HUMAN_REVIEW').length,
    approvedNextDay:venues.filter(v=>v.decision==='APPROVED_NEXT_DAY').length,
    active:venues.filter(v=>v.productionEnabled).length,
    suspended:venues.filter(v=>v.decision==='APPROVED_SUSPENDED_GATE').length,
    rejected:venues.filter(v=>v.decision==='REJECTED_KEEP_BASE4').length
  },venues
};
if(output.venues.length!==24)throw Error('EXPANSION_POLICY_24_VENUES_REQUIRED');
const out=path.join(dir,'venue-expansion-policy-v1.json'),next=JSON.stringify(output,null,2)+'\n',prev=fs.existsSync(out)?fs.readFileSync(out,'utf8'):null;
if(next!==prev)fs.writeFileSync(out,next);
console.log(JSON.stringify({status:'PASS',...output.summary,changed:next!==prev}));
module.exports={build:()=>output};
