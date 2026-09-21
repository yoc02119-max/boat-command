#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');

const portal=fs.readFileSync('portal.html','utf8');
for(const id of ['trySelectedCount','tryFinishedCount','tryPendingCount','tryRemainingCount']){
  assert.ok(portal.includes(`id="${id}"`), id);
}
assert.ok(portal.includes('const pending=rows.filter(z=>z.settled!==true),finished=rows.filter(z=>z.settled===true);'));
assert.ok(portal.includes('const now=Date.now(),remaining=pending.filter'));
assert.ok(portal.includes('ms==null||ms>now'));
assert.ok(portal.includes('selectedEl.textContent'));
assert.ok(portal.includes('finishedEl.textContent'));
assert.ok(portal.includes('pendingEl.textContent'));
assert.ok(portal.includes('remainingEl.textContent'));
console.log('TRY_PROGRESS_SUMMARY_CONTRACT_PASS');
