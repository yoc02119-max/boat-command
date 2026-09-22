#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');

const portal=fs.readFileSync('portal.html','utf8');
const router=fs.readFileSync('github-live-data-v1.js','utf8');

assert.ok(portal.includes('24場すべて30日独立運用中'));
assert.ok(!portal.includes('8場は30日固定運用、残り16場'));
assert.ok(portal.includes('refreshCycleFleetSourceOfTruth'));
assert.ok(portal.includes('venue-model-cycle-fleet-v1.json'));
assert.ok(portal.includes('github-live-data-v1.js?v=3'));
assert.ok(portal.includes('venue-registry-v1.js?v=7'));
assert.ok(router.includes("venue-model-cycle-fleet-v1.json"));
assert.ok(router.includes("GITHUB-MAIN-DATA-ROUTER-V1.2"));

console.log('PORTAL_24_VENUE_OPERATIONAL_SOURCE_PASS');
