#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const registry=require('../venue-registry-v1.js');

const root=path.resolve(__dirname,'..');
const index=JSON.parse(fs.readFileSync(path.join(root,'venue-agent-memory-index-v1.json'),'utf8'));
const venues=registry.list();

const failures=[];
const rows=[];

if(venues.length!==24)failures.push('REGISTRY_COUNT_NOT_24');
if(index.agents!==24)failures.push('MEMORY_INDEX_COUNT_NOT_24');
if(!Array.isArray(index.rows)||index.rows.length!==24)failures.push('MEMORY_INDEX_ROWS_NOT_24');

for(const v of venues){
  const memoryPath=path.join(root,'venue-agents',v.slug,'memory-v1.json');
  if(!fs.existsSync(memoryPath)){
    failures.push(`${v.code}:${v.slug}:MEMORY_MISSING`);
    continue;
  }
  const m=JSON.parse(fs.readFileSync(memoryPath,'utf8'));
  const row={
    code:v.code,
    slug:v.slug,
    status:m.status,
    historicalRaces:Number(m?.evidence?.historicalRaces||0),
    hypotheses:Array.isArray(m.hypotheses)?m.hypotheses.length:0,
    researchOnly:m.researchOnly===true,
    productionMutation:m.productionMutation===true,
    autoPromotion:m.autoPromotion===true,
    preRaceRuntimeConsumable:m.preRaceRuntimeConsumable===true,
    postToPre:m?.guardrails?.canFeedPostRaceIntoPreRace===true,
    hardLockMutation:m?.guardrails?.canMutateHardLock===true,
    sourceCoverage:m.sourceCoverage||{}
  };
  rows.push(row);

  if(row.historicalRaces<300)failures.push(`${v.code}:${v.slug}:HISTORY_LT_300`);
  if(row.hypotheses<1)failures.push(`${v.code}:${v.slug}:NO_HYPOTHESIS`);
  if(row.researchOnly!==true)failures.push(`${v.code}:${v.slug}:NOT_RESEARCH_ONLY`);
  if(row.productionMutation)failures.push(`${v.code}:${v.slug}:PRODUCTION_MUTATION_ENABLED`);
  if(row.autoPromotion)failures.push(`${v.code}:${v.slug}:AUTO_PROMOTION_ENABLED`);
  if(row.preRaceRuntimeConsumable)failures.push(`${v.code}:${v.slug}:PRE_RACE_CONSUMPTION_ENABLED`);
  if(row.postToPre)failures.push(`${v.code}:${v.slug}:POST_TO_PRE_ENABLED`);
  if(row.hardLockMutation)failures.push(`${v.code}:${v.slug}:HARD_LOCK_MUTATION_ENABLED`);
  if(row.status==='DATA_BOOTSTRAP')failures.push(`${v.code}:${v.slug}:DATA_BOOTSTRAP_REMAINS`);
}

const summary={
  schema:'boat-command-24-venue-agent-audit-v1',
  generatedAt:new Date().toISOString(),
  venueCount:venues.length,
  memoryCount:rows.length,
  historicalReady:rows.filter(x=>x.historicalRaces>=300).length,
  hypothesisReady:rows.filter(x=>x.hypotheses>=1).length,
  dataBootstrapRemaining:rows.filter(x=>x.status==='DATA_BOOTSTRAP').length,
  guardrailPass:rows.filter(x=>
    x.researchOnly &&
    !x.productionMutation &&
    !x.autoPromotion &&
    !x.preRaceRuntimeConsumable &&
    !x.postToPre &&
    !x.hardLockMutation
  ).length,
  appVerificationReady:failures.length===0,
  failures,
  statuses:rows.reduce((a,x)=>{a[x.status]=(a[x.status]||0)+1;return a;},{}),
  rows
};

if(process.argv.includes('--write')){
  fs.writeFileSync(path.join(root,'venue-agent-24-audit-v1.json'),JSON.stringify(summary,null,2)+'\n');
}

console.log(JSON.stringify({
  venueCount:summary.venueCount,
  memoryCount:summary.memoryCount,
  historicalReady:summary.historicalReady,
  hypothesisReady:summary.hypothesisReady,
  dataBootstrapRemaining:summary.dataBootstrapRemaining,
  guardrailPass:summary.guardrailPass,
  appVerificationReady:summary.appVerificationReady,
  failures:summary.failures,
  statuses:summary.statuses
},null,2));

if(failures.length)process.exit(1);
