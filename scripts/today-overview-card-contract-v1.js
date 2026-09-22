#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');

const portal=fs.readFileSync('portal.html','utf8');
assert.ok(portal.includes('id="todayOverview"'));
for(const id of ['todayActiveVenues','todayCandidateRaces','todaySelectedRaces','todayPendingRaces','todaySettledRaces','todayOverviewProfit']){
  assert.ok(portal.includes('id="'+id+'"'), id);
}
assert.ok(portal.includes('async function renderTodayOverview()'));
assert.ok(portal.includes('venue-calendar-v1.json'));
assert.ok(portal.includes('shared-try-portfolio-v1.json'));
assert.ok(portal.includes('try-selection-v1.json'));
assert.ok(portal.includes('todayActive===true'));
assert.ok(portal.includes('candidateCount'));
assert.ok(portal.includes('renderTodayOverview();'));
console.log('TODAY_OVERVIEW_CARD_CONTRACT_PASS');
