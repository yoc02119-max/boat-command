#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');

const portal=fs.readFileSync('portal.html','utf8');
assert.ok(portal.includes('const finishedHtml=finished.map'));
assert.ok(portal.includes("const state=voided?'void':z.hit===true?'hit':'miss'"));
assert.ok(portal.includes("const label=voided?'返還':z.hit===true?'的中':'不的中'"));
assert.ok(portal.includes("const profitText=voided?'±¥0':signed(profit)"));
assert.ok(portal.includes('class="try-result"'));
assert.ok(portal.includes('class="try-result-detail"'));
assert.ok(portal.includes("pendingHtml+resultWaitingHtml+finishedHtml"));
assert.ok(portal.includes('.try-live-chip.settled.hit'));
assert.ok(portal.includes('.try-live-chip.settled.miss'));
assert.ok(portal.includes('.try-live-chip.settled.void'));
console.log('TRY_SETTLED_INLINE_RESULT_CONTRACT_PASS');
