#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');

const portal=fs.readFileSync('portal.html','utf8');
for(const id of ['trySelectedCount','tryBeforeDeadlineCount','tryResultWaitingCount','tryFinishedCount']){
  assert.ok(portal.includes(`id="${id}"`), id);
}
assert.ok(portal.includes('const pending=rows.filter(z=>z.settled!==true),finished=rows.filter(z=>z.settled===true),now=Date.now();'));
assert.ok(portal.includes('const beforeDeadline=pending.filter'));
assert.ok(portal.includes('const resultWaiting=pending.filter'));
assert.ok(portal.includes('ms==null||ms>now'));
assert.ok(portal.includes('ms!=null&&ms<=now'));
assert.ok(portal.includes('selectedEl.textContent'));
assert.ok(portal.includes('beforeDeadlineEl.textContent'));
assert.ok(portal.includes('resultWaitingEl.textContent'));
assert.ok(portal.includes('finishedEl.textContent'));
console.log('TRY_PROGRESS_SUMMARY_CONTRACT_PASS');
