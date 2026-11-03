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
  if(!fs.existsSync(`.github/workflows/${slug}-program-snapshot-v1.yml`)){
    const workflows=fs.readdirSync('.github/workflows');
    const entry=`code: '${code}', key: ${a.venue}, slug: ${slug}`;
    assert.ok(workflows.filter(x=>/^venue-program-batch-/.test(x)).some(x=>read('.github/workflows/'+x).includes(entry)),`${slug}: PROGRAM_BATCH_MISSING`);
    assert.ok(workflows.filter(x=>/^venue-shadow-batch-/.test(x)).some(x=>read('.github/workflows/'+x).includes(entry)),`${slug}: SHADOW_BATCH_MISSING`);
    assert.ok(read('.github/workflows/venue-result-batch-generic-v1.yml').includes(`${code}:${a.venue}:${slug}`),`${slug}: RESULT_BATCH_MISSING`);
    checked.push({slug,code});continue;
  }

  const programPath=`.github/workflows/${slug}-program-snapshot-v1.yml`;
  const resultPath=`.github/workflows/${slug}-result-collector-v1.yml`;
  const historyPath=`.github/workflows/${slug}-history-bootstrap-v1.yml`;
  const program=read(programPath),result=read(resultPath),history=read(historyPath);

  if(['mikuni','tokuyama','ashiya'].includes(slug)){
    assert.ok(program.includes('workflows: ["24 venue next-race calendar v1"]'),`${slug}: MORNING_CALENDAR_CHAIN_MISSING`);
    assert.ok(program.includes("github.event_name != 'workflow_run' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_branch == 'main')"),`${slug}: MORNING_CHAIN_MUST_BE_SUCCESSFUL_MAIN`);
    assert.ok(program.includes("cron: '1 0-8,19-23 * * *'"),`${slug}: EXISTING_EARLY_SCHEDULE_CHANGED`);
  }

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
