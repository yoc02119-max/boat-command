#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict');
const registry=require('../venue-registry-v1.js');
const runtime=require('../venue-runtime-v1.js');

const venues=registry.list();
assert.equal(venues.length,24,'registry must expose exactly 24 venues');
assert.equal(new Set(venues.map(v=>v.code)).size,24,'venue codes must be unique');
assert.equal(new Set(venues.map(v=>v.slug)).size,24,'venue slugs must be unique');

for(const v of venues){
  assert.match(v.code,/^\d{2}$/);
  assert.ok(v.name);
  assert.ok(v.slug);
  assert.equal(registry.resolve(v.code)?.code,v.code);
  assert.equal(registry.resolve(v.slug)?.code,v.code);
}

const gamagori=registry.resolve('07');
const edogawa=registry.resolve('03');
const toda=registry.resolve('02');

assert.equal(gamagori.runtime,'PRODUCTION');
assert.equal(gamagori.model.global,'BOAT_COMMAND_MAIN_MODEL_V0320');
assert.equal(gamagori.capabilities.predictionUi,true);
assert.equal(gamagori.capabilities.try,true);

assert.equal(edogawa.runtime,'RESEARCH');
assert.equal(edogawa.model.global,'BOAT_COMMAND_EDOGAWA_RESEARCH_MODEL_V2');
assert.equal(edogawa.capabilities.predictionUi,false);
assert.equal(edogawa.capabilities.try,false);
assert.notEqual(edogawa.model.script,gamagori.model.script,'venue models must remain isolated');

assert.equal(toda.runtime,'ENTRY_ONLY');
assert.equal(toda.state,'DATA_COLLECTION');
assert.equal(toda.model,null,'unfinished venues must not inherit another venue model');
assert.equal(toda.configPath,'./venues/toda/config-v1.json');
assert.equal(toda.readinessPath,'./venues/toda/readiness-v1.json');
assert.equal(toda.dataRoot,'./live/toda');
assert.equal(toda.capabilities.try,false);
assert.equal(toda.capabilities.bankroll,false);

assert.equal(registry.routeFor('07'),'./?venue=gamagori');
assert.equal(registry.routeFor('03'),'./venue.html?jcd=03');
assert.equal(registry.routeFor('toda'),'./venue.html?jcd=02');

assert.equal(runtime.resolveVenue('03')?.code,'03');
assert.equal(runtime.resolveVenue('gamagori')?.code,'07');
assert.equal(runtime.capabilities(toda).predictionUi,false);
assert.equal(runtime.capabilities(toda).try,false);

for(const v of venues.filter(x=>x.runtime!=='ENTRY_ONLY')){
  assert.ok(v.model?.script,`${v.slug}: active runtime requires a model script`);
  assert.ok(v.model?.global,`${v.slug}: active runtime requires a model global`);
  assert.ok(v.dataRoot,`${v.slug}: active runtime requires a venue data root`);
}

console.log('venue-router-contract-v1: PASS');
console.log(JSON.stringify({
  venues:venues.length,
  production:venues.filter(v=>v.runtime==='PRODUCTION').map(v=>v.slug),
  research:venues.filter(v=>v.runtime==='RESEARCH').map(v=>v.slug),
  entryOnly:venues.filter(v=>v.runtime==='ENTRY_ONLY').length,
  crossVenueFallback:false
},null,2));
