#!/usr/bin/env node
'use strict';
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html'),scripts=[...html.matchAll(/<script src="([^"?]+)/g)].map(x=>x[1]);
for(const f of scripts)if(!fs.existsSync(path.join(root,f)))throw new Error(`MISSING_ASSET:${f}`);
const legacy=scripts.filter(x=>/live-(predictor|two-stage|autopoll|skip-gate|autofill|lock-guard)-v0/.test(x));
if(legacy.length)throw new Error(`LEGACY_EXHIBITION_STACK:${legacy.join(',')}`);
const loaded=scripts.map(read).join('\n');
for(const symbol of ['sweepVerifiedLiveRelays','loadVerifiedLiveRace','beforeinfo','startExhibition'])if(loaded.includes(symbol))throw new Error(`EXHIBITION_FETCH_SYMBOL:${symbol}`);
const frozen=fs.readFileSync(path.join(root,'baseline/live-two-stage-v0260-frozen.js'));
const frozenHash=crypto.createHash('sha256').update(frozen).digest('hex');
if(frozenHash!=='4b566de78d6d68fe302befb2ce830be8836895fd7e16f597ac763f444fa06847')throw new Error('FROZEN_BASELINE_MUTATED');
const model=require('../gamagori-main-model-v0320.js');
if(model.orders.length!==120||new Set(model.orders).size!==120)throw new Error('ORDER_SPACE_INVALID');
const sample={classes:['A1','A2','B1','B2','B1','A2'],race:7,raceType:'予選'};
const p=model.probabilities(sample,[],{targetDate:'2026-01-01'});
if(Math.abs(p.sum-1)>1e-12||p.rows.some(x=>x.probability<0))throw new Error('PROBABILITY_NORMALIZATION_FAILED');
const historyPath=path.join(root,process.argv[2]||'gamagori-main-history-v0320.json');
if(fs.existsSync(historyPath)){
  const db=JSON.parse(fs.readFileSync(historyPath,'utf8'));
  if(db.schema!=='boat-command-program-history-v2'||db.exhibitionIncluded!==false||db.races.length!==4071)throw new Error('HISTORY_CONTRACT_INVALID');
  if(db.races.some(x=>String(x.d)>String(db.cutoff)))throw new Error('FUTURE_HISTORY_ROW');
}
console.log(JSON.stringify({contract:'PASS',loadedScripts:scripts.length,legacyExhibitionScripts:0,exhibitionFetchSymbols:0,frozenBaseline:true,orders:120,probabilitySum:p.sum}));
