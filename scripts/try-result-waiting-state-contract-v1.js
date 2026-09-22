#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');

const portal=fs.readFileSync('portal.html','utf8');

for(const id of ['trySelectedCount','tryBeforeDeadlineCount','tryResultWaitingCount','tryFinishedCount']){
  assert.ok(portal.includes('id="'+id+'"'), id);
}
assert.ok(portal.includes('const beforeDeadline=pending.filter'));
assert.ok(portal.includes('const resultWaiting=pending.filter'));
assert.ok(portal.includes('ms==null||ms>now'));
assert.ok(portal.includes('ms!=null&&ms<=now'));
assert.ok(portal.includes('const resultWaitingHtml=resultWaiting.map'));
assert.ok(portal.includes('class="try-live-chip result-waiting"'));
assert.ok(portal.includes('締切前 '));
assert.ok(portal.includes('結果待ち '));
assert.ok(portal.includes('pendingHtml+resultWaitingHtml+finishedHtml'));
assert.ok(portal.includes('.try-progress-chip.waiting'));
assert.ok(portal.includes('.try-live-chip.result-waiting'));

console.log('TRY_RESULT_WAITING_STATE_CONTRACT_PASS');
