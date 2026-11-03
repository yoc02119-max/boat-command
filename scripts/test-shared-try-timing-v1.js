'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),assert=require('node:assert/strict');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'boat-try-timing-'));
const write=(p,x)=>{p=path.join(root,p);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(x));};
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const run=(date,clock)=>JSON.parse(cp.execFileSync(process.execPath,['scripts/shared-try-portfolio-v1.js',date],{cwd:root,env:{...process.env,BOAT_COMMAND_NOW_ISO:clock},encoding:'utf8',stdio:['ignore','pipe','pipe']}));
try{
 fs.mkdirSync(path.join(root,'scripts'));fs.copyFileSync('scripts/shared-try-portfolio-v1.js',path.join(root,'scripts/shared-try-portfolio-v1.js'));
 const cfg=JSON.parse(fs.readFileSync('shared-try-config-v1.json'));assert.equal(cfg.selectionTiming.notBeforeJst,'07:30');assert.equal(cfg.selectionTiming.effectiveDate,'2026-11-04');write('shared-try-config-v1.json',cfg);
 const date='2026-11-04',sel=`live/portfolio/${date}/try-selection-v1.json`,picks=['1-2-3','1-2-4','1-3-2','1-3-4'];
 const prediction=(a,day,prob=.1)=>write(`live/${a.slug}/${day}/shadow/program-only/race-1.json`,{venueCode:a.venueCode,venue:a.venue,date:day,race:1,generatedAt:`${day}T01:00:00+09:00`,deadline:'13:00',picks,probabilities:picks.map(order=>({order,probability:prob})),resultInput:false,payoutInput:false,immutableAfterFirstWrite:true});
 // Real failure mode: an early event with only one venue ready must not freeze.
 prediction(cfg.activeAdapters[0],date,.01);
 for(const clock of [`${date}T02:00:00+09:00`,'2026-11-03T22:29:59.999Z']){
  assert.equal(run(date,clock).selectionStatus,'WAITING_DAILY_SELECTION_TIME');assert.equal(fs.existsSync(path.join(root,sel)),false);
 }
 // The rest of the venues can arrive before the first eligible morning run.
 for(const a of cfg.activeAdapters.slice(1))prediction(a,date,.15);
 assert.equal(run(date,`${date}T07:30:00+09:00`).selectionStatus,'TRY_FROZEN');
 const s=read(sel),frozen=fs.readFileSync(path.join(root,sel),'utf8');assert.equal(s.candidateCount,24);assert.equal(s.selected[0].venueCode,'02');assert.equal(s.policy.selectionNotBeforeJst,'07:30');assert.ok(s.totalCommittedStakeYen<=s.riskBudget.dailyLimitYen);
 // Later candidates and an earlier test clock cannot rewrite a HARD LOCK.
 prediction(cfg.activeAdapters[0],date,.2);run(date,`${date}T02:00:00+09:00`);assert.equal(fs.readFileSync(path.join(root,sel),'utf8'),frozen);
 const x=s.selected[0];write(`live/${x.slug}/${date}/post/race-1-result.json`,{venueCode:x.venueCode,date,race:1,trifecta:x.picks[0],payout100:1000,preRaceDataIncluded:false,resultEndpointsIncluded:true});
 const next='2026-11-05';assert.equal(run(next,`${next}T02:00:00+09:00`).selectionStatus,'WAITING_DAILY_SELECTION_TIME');assert.equal(fs.readFileSync(path.join(root,sel),'utf8'),frozen);assert.equal(fs.existsSync(path.join(root,`live/portfolio/${next}/try-selection-v1.json`)),false);
 const p=read('shared-try-portfolio-v1.json');assert.equal(p.settledTries,1);assert.equal(p.returnYen,x.stakePerPickYen*10);assert.equal(p.confirmedBankrollYen,100000+p.profitYen);assert.equal(p.availableBankrollYen,p.confirmedBankrollYen-p.pendingStakeYen);
 // Post-opening empty days remain retryable, and malformed configuration fails.
 assert.equal(run(next,`${next}T07:30:00+09:00`).selectionStatus,'NO_ELIGIBLE_PRE_RACE_CANDIDATES');assert.equal(fs.existsSync(path.join(root,`live/portfolio/${next}/try-selection-v1.json`)),false);
 cfg.selectionTiming.notBeforeJst='24:00';write('shared-try-config-v1.json',cfg);assert.throws(()=>run(next,`${next}T08:00:00+09:00`));
 // The future-only gate does not change behavior before its effective date.
 cfg.selectionTiming.notBeforeJst='07:30';write('shared-try-config-v1.json',cfg);const old='2026-11-03';prediction(cfg.activeAdapters[0],old);assert.equal(run(old,`${old}T06:00:00+09:00`).selectionStatus,'TRY_FROZEN');
 console.log('PASS: overnight non-freeze, JST boundary, 24-venue morning pool, immutable history, overnight POST settlement, unchanged risk/capital, empty retry, invalid config, future-only activation');
}finally{fs.rmSync(root,{recursive:true,force:true});}
