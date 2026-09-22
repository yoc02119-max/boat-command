#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');

const portal=fs.readFileSync('portal.html','utf8');

assert.ok(portal.includes('30日TRY成績'));
for(const stat of ['hit','roi','tries','profit']){
  assert.ok(portal.includes(`data-stat="${stat}"`), stat);
}
assert.ok(portal.includes('function renderVenue30dStats(portfolio)'));
assert.ok(portal.includes('Number(v.hitRate)*100'));
assert.ok(portal.includes('Number(v.roi)*100'));
assert.ok(portal.includes('Number(v?.tries)||0'));
assert.ok(portal.includes('Number(v?.profitYen)||0'));
assert.ok(portal.includes('renderVenue30dStats(x)'));
console.log('VENUE_30D_USER_STATS_CONTRACT_PASS');
