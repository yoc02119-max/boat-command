#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.join(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'baseline/live-v0332-freeze.json'),'utf8'));
const changed=[];
for(const [file,expected] of Object.entries(manifest.sha256)){
  const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
  if(actual!==expected)changed.push({file,expected,actual});
}
if(changed.length){console.error(JSON.stringify({status:'FAIL',changed},null,2));process.exit(1)}
const p=manifest.policy;
if(p.venue!=='GAMAGORI_ONLY'||!p.shadowOnly||p.exhibitionUsed||p.resultFetchInPrediction||p.payoutFetchInPrediction||!p.hardLockImmutable||p.liveAutoPromotion)throw new Error('LIVE_FREEZE_POLICY_INVALID');
console.log(JSON.stringify({status:'PASS',version:manifest.version,files:Object.keys(manifest.sha256).length,liveLogicUnchanged:true}));
