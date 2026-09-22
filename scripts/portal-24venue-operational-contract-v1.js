#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');

const portal=fs.readFileSync('portal.html','utf8');
const router=fs.readFileSync('github-live-data-v1.js','utf8');

assert.ok(portal.includes('24場すべて30日独立運用中'));
assert.ok(!portal.includes('8場は30日固定運用、残り16場'));
assert.ok(portal.includes('refreshCycleFleetSourceOfTruth'));
// OFFDAY_VISUAL_BOUNDARY: green .active is owned by today's calendar, not model operational state.
assert.ok(portal.includes(".venue.offday{border-color:#183753;box-shadow:none"));
assert.ok(portal.includes("btn.className='venue '+(active?'operational':building?'prep building':'prep')"));
assert.ok(portal.includes("if(cal.todayActive===true){"));
assert.ok(portal.includes("card.classList.add('operational','active')"));
assert.ok(portal.includes("card.classList.remove('active');\n      card.classList.add('offday');"));
assert.ok(portal.includes('venue-model-cycle-fleet-v1.json'));
// PROMOTION_APPROVAL_UI_BOUNDARY: owner only chooses yes/no after system gate says ready.
assert.ok(!portal.includes('async const promotionVariantLabel='));
assert.ok(portal.includes("const promotionVariantLabel={RANK6:'順位6点'"));
assert.ok(portal.includes("v.decision==='AWAITING_HUMAN_REVIEW'&&v.humanReviewPending===true"));
assert.ok(portal.includes('data-promotion-action="approve"'));
assert.ok(portal.includes('data-promotion-action="reject"'));
assert.ok(portal.includes("action:'venue_expansion_decision'"));
assert.ok(portal.includes('github-live-data-v1.js?v=3'));
assert.ok(portal.includes('venue-registry-v1.js?v=6'));
assert.ok(router.includes("venue-model-cycle-fleet-v1.json"));
assert.ok(router.includes("GITHUB-MAIN-DATA-ROUTER-V1.2"));

console.log('PORTAL_24_VENUE_OPERATIONAL_SOURCE_PASS');
