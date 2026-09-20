#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const write=process.argv.includes('--write');
const indexPath=path.join(root,'venue-agent-memory-index-v1.json');

if(!fs.existsSync(indexPath))throw new Error('VENUE_AGENT_MEMORY_INDEX_MISSING');
const index=JSON.parse(fs.readFileSync(indexPath,'utf8'));
if(index.agents!==24)throw new Error('VENUE_AGENT_COUNT_NOT_24');

const now=new Date().toISOString();
const rows=[];

for(const row of index.rows){
  const memoryPath=path.join(root,'venue-agents',row.slug,'memory-v1.json');
  if(!fs.existsSync(memoryPath))throw new Error('MEMORY_MISSING:'+row.slug);
  const m=JSON.parse(fs.readFileSync(memoryPath,'utf8'));

  let state='IN_CYCLE';
  let nextAction='CONTINUE_OBSERVATION';

  if(m.cycle?.due===true){
    if(m.promotionReview?.eligibleForHumanReview===true){
      state='HUMAN_REVIEW_READY';
      nextAction='REVIEW_SHADOW_FOR_PROMOTION';
    }else if((m.researchQueue||[]).length>0){
      state='NEXT_SHADOW_CYCLE';
      nextAction='TEST_TOP_RESEARCH_HYPOTHESIS';
    }else{
      state='RESEARCH_INCOMPLETE';
      nextAction='CONTINUE_DATA_AND_HYPOTHESIS_DISCOVERY';
    }
  }

  const out={
    schema:'boat-command-venue-agent-cycle-review-v1',
    agentId:m.agentId,
    venueCode:m.venueCode,
    venueName:m.venueName,
    slug:m.slug,
    generatedAt:now,
    cycle:{
      days:m.cycle?.days??30,
      startedAt:m.cycle?.startedAt??null,
      ageDays:m.cycle?.ageDays??0,
      due:m.cycle?.due===true
    },
    state,
    nextAction,
    evidence:m.evidence||{},
    topHypothesis:(m.hypotheses||[])[0]||null,
    promotionReview:m.promotionReview||null,
    boundaries:{
      autoPromotion:false,
      productionMutation:false,
      hardLockMutation:false,
      preRaceResultLeakage:false
    }
  };

  rows.push(out);

  if(write){
    const outPath=path.join(root,'venue-agents',row.slug,'cycle-review-v1.json');
    fs.writeFileSync(outPath,JSON.stringify(out,null,2)+'\n');
  }
}

const summary={
  schema:'boat-command-venue-agent-cycle-index-v1',
  generatedAt:now,
  agents:rows.length,
  due:rows.filter(x=>x.cycle.due).length,
  humanReviewReady:rows.filter(x=>x.state==='HUMAN_REVIEW_READY').length,
  nextShadowCycle:rows.filter(x=>x.state==='NEXT_SHADOW_CYCLE').length,
  states:rows.reduce((a,x)=>{a[x.state]=(a[x.state]||0)+1;return a;},{}),
  rows:rows.map(x=>({
    venueCode:x.venueCode,
    venueName:x.venueName,
    slug:x.slug,
    state:x.state,
    nextAction:x.nextAction,
    cycleAgeDays:x.cycle.ageDays,
    cycleDue:x.cycle.due,
    topHypothesisId:x.topHypothesis?.id||null
  }))
};

if(write){
  fs.writeFileSync(path.join(root,'venue-agent-cycle-index-v1.json'),JSON.stringify(summary,null,2)+'\n');
}

console.log(JSON.stringify({
  agents:summary.agents,
  due:summary.due,
  humanReviewReady:summary.humanReviewReady,
  nextShadowCycle:summary.nextShadowCycle,
  states:summary.states
},null,2));
