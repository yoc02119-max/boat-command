#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');

const portal=fs.readFileSync('portal.html','utf8');
assert.ok(portal.includes('function tryPredictionReason(picks)'));
assert.ok(portal.includes('号艇1着軸'));
assert.ok(portal.includes('号艇1着中心'));
assert.ok(portal.includes('号艇2着固定'));
assert.ok(portal.includes('号艇2着厚め'));
assert.ok(portal.includes('class="try-reason"'));
assert.ok(portal.includes('<b>理由</b>'));
assert.ok(portal.includes('const reasonText=tryPredictionReason(picks)'));
console.log('TRY_REASON_LINE_CONTRACT_PASS');
