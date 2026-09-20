#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const assert=require('node:assert/strict');

const cfg=JSON.parse(fs.readFileSync('shared-try-config-v1.json','utf8'));
const adapters=Array.isArray(cfg.activeAdapters)?cfg.activeAdapters:[];

function read(p){
  assert.ok(fs.existsSync(p),`MISSING:${p}`);
  return fs.readFileSync(p,'utf8');
}
function uniq(xs){return [...new Set(xs)]}

const checked=[];
for(const a of adapters){
  const code=String(a.venueCode||'').padStart(2,'0');
  const slug=String(a.slug||'');
  if(!/^\d{2}$/.test(code)||!slug)continue;
  if(code==='07')continue; // Gamagori uses its older dedicated collector stack.

  const programPath=`.github/workflows/${slug}-program-snapshot-v1.yml`;
  const resultPath=`.github/workflows/${slug}-result-collector-v1.yml`;
  const historyPath=`.github/workflows/${slug}-history-bootstrap-v1.yml`;
  const program=read(programPath),result=read(resultPath),history=read(historyPath);

  const programJcd=uniq([...program.matchAll(/jcd=(\d{2})/g)].map(m=>m[1]));
  const resultJcd=uniq([...result.matchAll(/jcd=(\d{2})/g)].map(m=>m[1]));
  assert.deepEqual(programJcd,[code],`${slug}: PROGRAM_JCD_LEAK ${programJcd}`);
  assert.deepEqual(resultJcd,[code],`${slug}: RESULT_JCD_LEAK ${resultJcd}`);
  assert.ok(history.includes(`--venue ${code}`),`${slug}: HISTORY_VENUE_MISMATCH`);
  assert.ok(history.includes(`out/${code}`),`${slug}: HISTORY_OUTPUT_DIR_MISMATCH`);

  const wrongProgram=programJcd.some(x=>x!==code);
  const wrongResult=resultJcd.some(x=>x!==code);
  assert.equal(wrongProgram||wrongResult,false,`${slug}: CROSS_VENUE_SOURCE_DETECTED`);
  checked.push({slug,code});
}

assert.ok(checked.length>=1,'NO_GENERIC_VENUES_CHECKED');
console.log('VENUE_COLLECTOR_BOUNDARY_PASS',checked);
