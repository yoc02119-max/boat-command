#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const root=path.join(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'baseline/live-v0324-freeze.json'),'utf8'));
const changed=[];
for(const [file,expected] of Object.entries(manifest.sha256)){
  const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
  if(actual!==expected)changed.push({file,expected,actual});
}
if(changed.length){console.error(JSON.stringify({status:'FAIL',changed},null,2));process.exit(1)}
if(manifest.policy.productionModel!=='FROZEN_BASELINE_V0.29.1'||!manifest.policy.shadowOnly||manifest.policy.exhibitionUsed||manifest.policy.resultFetchInPrediction||manifest.policy.payoutFetchInPrediction||!manifest.policy.hardLockImmutable)process.exit(1);
console.log(JSON.stringify({status:'PASS',version:manifest.version,files:Object.keys(manifest.sha256).length}));
