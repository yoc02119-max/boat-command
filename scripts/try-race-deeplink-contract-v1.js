#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');

const portal=fs.readFileSync('portal.html','utf8');
const venue=fs.readFileSync('venue.html','utf8');
const browser=fs.readFileSync('browser-controls-v1.js','utf8');
const deep=fs.readFileSync('try-race-deeplink-v1.js','utf8');

assert.ok(portal.includes('data-try-code='));
assert.ok(portal.includes('data-try-race='));
assert.ok(portal.includes("activeTryList')?.addEventListener('click'"));
assert.ok(portal.includes("routeFor?.(meta)"));
assert.ok(portal.includes("base.includes('?')"));

assert.ok(venue.includes('try-race-deeplink-v1.js?v=2'));
assert.ok(browser.includes('focusGamagoriRaceDeepLink'));
assert.ok(browser.includes('#predictionList .race-card[data-race='));

assert.ok(deep.includes("q.get('race')"));
assert.ok(deep.includes('#researchBoard .rrb-card[data-race='));
assert.ok(deep.includes("window.__BC_VENUE_ACTIVATE('races')"));
assert.ok(deep.includes("scrollIntoView({behavior:'smooth',block:'center'})"));

console.log('TRY_RACE_DEEPLINK_CONTRACT_PASS');
