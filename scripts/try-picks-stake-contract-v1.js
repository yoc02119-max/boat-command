#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');

const portal=fs.readFileSync('portal.html','utf8');
assert.ok(portal.includes('class="try-picks"'));
assert.ok(portal.includes('class="try-stake"'));
assert.ok(portal.includes("picks.join(' / ')"));
assert.ok(portal.includes('Math.round(stake/picks.length)'));
assert.ok(portal.includes('money(perPick)'));
assert.ok(portal.includes('money(stake)'));
console.log('TRY_PICKS_STAKE_CONTRACT_PASS');
