#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');

const portal=fs.readFileSync('portal.html','utf8');
assert.ok(portal.includes('function tryDeadlineMs(date,deadline)'));
assert.ok(portal.includes("+09:00"));
assert.ok(portal.includes('function tryCountdownText(deadlineMs)'));
assert.ok(portal.includes('function refreshTryCountdowns()'));
assert.ok(portal.includes('data-try-deadline-ms='));
assert.ok(portal.includes('data-try-deadline-label='));
assert.ok(portal.includes("setInterval(refreshTryCountdowns,30000)"));
assert.ok(portal.includes("diff>0&&diff<=5"));
assert.ok(portal.includes("diff>5&&diff<=15"));
console.log('TRY_DEADLINE_COUNTDOWN_CONTRACT_PASS');
