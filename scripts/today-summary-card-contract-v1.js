#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');

const portal=fs.readFileSync('portal.html','utf8');
for(const id of ['todaySummaryDate','todaySummaryVenues','todaySummaryPredictions','todaySummaryTry','todaySummaryPending','todaySummaryProfit']){
  assert.ok(portal.includes('id="'+id+'"'), id);
}
assert.ok(portal.includes('function renderTodaySummary()'));
assert.ok(portal.includes('todaySummaryState.activeVenueCodes'));
assert.ok(portal.includes('todaySummaryState.predictionCountByCode'));
assert.ok(portal.includes('todaySummaryState.tryCount=rows.length'));
assert.ok(portal.includes('todaySummaryState.pendingCount=pending.length'));
assert.ok(portal.includes('todaySummaryState.profit=dayProfit'));
assert.ok(portal.includes("todayActive===true"));
console.log('TODAY_SUMMARY_CARD_CONTRACT_PASS');
