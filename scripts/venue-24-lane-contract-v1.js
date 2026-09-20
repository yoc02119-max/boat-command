#!/usr/bin/env node
'use strict';
const fs=require('fs');
const assert=require('node:assert/strict');
const REG=require('../venue-registry-v1.js');

const venues=REG.list();
assert.equal(venues.length,24,'VENUE_COUNT_MUST_BE_24');
assert.equal(new Set(venues.map(v=>v.code)).size,24,'VENUE_CODE_DUPLICATE');
assert.equal(new Set(venues.map(v=>v.slug)).size,24,'VENUE_SLUG_DUPLICATE');

const roots=[];
for(const v of venues){
  assert.match(v.code,/^\\d{2}$/);
  assert.ok(v.name&&v.slug&&v.key,'VENUE_META_MISSING:'+v.code);
  if(v.code==='07'){
    assert.equal(v.state,'LIVE');
    assert.equal(v.runtime,'PRODUCTION');
    continue;
  }
  assert.ok(v.configPath,'CONFIG_PATH_MISSING:'+v.code);
  assert.ok(v.readinessPath,'READINESS_PATH_MISSING:'+v.code);
  assert.ok(v.dataRoot,'DATA_ROOT_MISSING:'+v.code);
  roots.push(v.dataRoot);
  const cp=v.configPath.replace(/^\\.\\//,'');
  const rp=v.readinessPath.replace(/^\\.\\//,'');
  assert.ok(fs.existsSync(cp),'CONFIG_FILE_MISSING:'+v.code+':'+cp);
  assert.ok(fs.existsSync(rp),'READINESS_FILE_MISSING:'+v.code+':'+rp);
  const c=JSON.parse(fs.readFileSync(cp,'utf8'));
  const r=JSON.parse(fs.readFileSync(rp,'utf8'));
  assert.equal(String(c.venueCode).padStart(2,'0'),v.code,'CONFIG_CODE_MISMATCH:'+v.code);
  assert.equal(String(r.venueCode).padStart(2,'0'),v.code,'READINESS_CODE_MISMATCH:'+v.code);
  assert.equal(c.slug,v.slug,'CONFIG_SLUG_MISMATCH:'+v.code);
  assert.equal(c.realMoneyEnabled,false,'REAL_MONEY_FORBIDDEN:'+v.code);
  assert.equal(c.predictionPolicy?.crossVenueModelFallback,false,'CROSS_MODEL_FORBIDDEN:'+v.code);
  assert.equal(c.predictionPolicy?.crossVenueHistoryMixing,false,'CROSS_HISTORY_FORBIDDEN:'+v.code);
}
assert.equal(new Set(roots).size,roots.length,'DATA_ROOT_DUPLICATE');

const active=venues.filter(v=>v.state==='LIVE'||v.state==='LIVE_SIMULATION');
const building=venues.filter(v=>v.state==='BUILDING');
assert.equal(active.length,8,'ACTIVE_VENUE_COUNT_EXPECTED_8');
assert.equal(building.length,16,'BUILDING_VENUE_COUNT_EXPECTED_16');
console.log('VENUE_24_LANE_CONTRACT_PASS',{total:venues.length,active:active.length,building:building.length});
