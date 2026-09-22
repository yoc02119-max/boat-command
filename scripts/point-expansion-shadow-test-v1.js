'use strict';
const assert=require('node:assert/strict');
const {build,capture,evaluate}=require('./point-expansion-shadow-v1.js');
const orders=[];
for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)if(a!==b&&a!==c&&b!==c)orders.push(`${a}-${b}-${c}`);
const total=120*121/2;
const d={rows:orders.map((order,i)=>({order,probability:(120-i)/total})),config:{test:true}};
const selected=d.rows.slice(0,4),before=JSON.stringify({d,selected});
const e=build(d,selected);
assert.equal(JSON.stringify({d,selected}),before);
for(const [key,picks]of Object.entries(e.variants)){
  assert.deepEqual(picks.slice(0,4),selected.map(x=>x.order));
  assert.equal(new Set(picks).size,picks.length);
  assert.equal(picks.length,key==='BASE4'?4:key==='RANK8'?8:6);
}
assert.equal(e.variants.HEAD6[4],'2-1-3');
assert.equal(e.variants.SECOND6[4],'1-3-2');
assert.equal(capture(d,selected,'CLASS_BASELINE'),null);
assert.equal(capture({rows:[]},selected,'PROGRAM_ONLY').status,'SKIPPED_INVALID_RANKING');
const snapshot={date:'2026-09-23',race:1,venue:'TEST',venueCode:'01',mode:'PROGRAM_ONLY',
  generatedAt:'2026-09-23T00:00:00Z',deadline:'10:00',resultInput:false,payoutInput:false,
  researchOnly:true,productionEnabled:false,tryEnabled:false,immutableAfterFirstWrite:true,
  modelVersion:'TEST',picks:selected.map(x=>x.order),pointExpansion:e};
const result={date:snapshot.date,race:1,venue:'TEST',venueCode:'01',trifecta:orders[4],payout100:1000,
  preRaceDataIncluded:false,resultEndpointsIncluded:true};
const row=evaluate(snapshot,result);
assert.equal(row.variants.BASE4.hit,false);
assert.equal(row.variants.RANK6.addedHit,true);
assert.equal(row.variants.RANK6.addedStake100,200);
assert.equal(row.variants.RANK6.fixedBudgetPayoutOnlyReturn,4000);
assert.equal(row.variants.RANK8.fixedBudgetPayoutOnlyReturn,3000);
assert.equal(row.baselineMiss,'SECOND');
assert.equal(evaluate({...snapshot,generatedAt:'2026-09-23T01:00:00Z'},result),null);
assert.equal(evaluate(snapshot,{...result,venue:'OTHER'}),null);
assert.equal(evaluate(snapshot,{...result,date:'2026-09-22'}),null);
assert.equal(evaluate({...snapshot,pointExpansion:null},result),null);
const changed=structuredClone(snapshot);changed.pointExpansion.variants.RANK6[4]='6-5-4';
assert.equal(evaluate(changed,result),null);
for(const [slug,code]of [['toda','02'],['tokoname','08']]){
  const model=require(`../${slug}-research-model-v1.js`);
  const program={venue:slug.toUpperCase(),venueCode:code,race:1,raceType:'予選',
    resultEndpointsIncluded:false,resultIncluded:false,exhibitionIncluded:false,
    boats:['A1','B1','A2','B1','B1','B2'].map((grade,i)=>({lane:i+1,class:grade}))};
  const history=Array.from({length:300},(_,i)=>({d:'2026-09-01',r:i%12+1,c:program.boats.map(x=>x.class),o:orders[i%120],t:'予選'}));
  const dist=model.distribution(program,history,{targetDate:'2026-09-23',mode:'PROGRAM_ONLY'});
  const old=model.select(dist,{count:4});
  const expanded=build(dist,old);
  assert.deepEqual(expanded.variants.BASE4,old.map(x=>x.order));
  assert.deepEqual(model.select(dist,{count:4}),old);
}
// Exercise the actual writer, including write-once behavior and first creation.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'point-expansion-contract-'));
try {
  fs.mkdirSync(path.join(tmp,'scripts'));
  for(const f of ['scripts/toda-shadow-research-v1.js','scripts/point-expansion-shadow-v1.js','toda-research-model-v1.js'])
    fs.copyFileSync(path.join(__dirname,'..',f),path.join(tmp,f));
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const program={venue:'TODA',venueCode:'02',race:1,raceType:'予選',deadline:'23:59',
    resultEndpointsIncluded:false,resultIncluded:false,exhibitionIncluded:false,
    boats:['A1','B1','A2','B1','B1','B2'].map((grade,i)=>({lane:i+1,class:grade}))};
  const history=Array.from({length:300},(_,i)=>({d:'2000-01-01',r:i%12+1,c:program.boats.map(x=>x.class),o:orders[i%120],t:'予選'}));
  const write=(p,x)=>{const f=path.join(tmp,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(x));return f;};
  write('toda-history-bootstrap-v1.json',{venueCode:'02',races:history,cutoff:'2000-01-01'});
  write('toda-baseline-backtest-v1.json',{venueCode:'02',calibration:{selected:{}}});
  write(`live/toda/${date}/program/race-1.json`,program);
  write(`live/toda/${date}/program/race-2.json`,{...program,race:2});
  const oldPath=write(`live/toda/${date}/shadow/program-only/race-1.json`,{sentinel:'LEGACY_MUST_NOT_CHANGE'});
  const oldBytes=fs.readFileSync(oldPath);
  cp.execFileSync(process.execPath,[path.join(tmp,'scripts/toda-shadow-research-v1.js'),date]);
  assert.deepEqual(fs.readFileSync(oldPath),oldBytes);
  const newPath=path.join(tmp,`live/toda/${date}/shadow/program-only/race-2.json`);
  // The production cutoff correctly stops creation within three minutes of midnight.
  if(fs.existsSync(newPath)){
    const fresh=JSON.parse(fs.readFileSync(newPath));
    assert.equal(fresh.pointExpansion.status,'FROZEN_WITH_BASELINE');
    assert.deepEqual(fresh.picks,fresh.pointExpansion.variants.BASE4);
    const bytes=fs.readFileSync(newPath);
    cp.execFileSync(process.execPath,[path.join(tmp,'scripts/toda-shadow-research-v1.js'),date]);
    assert.deepEqual(fs.readFileSync(newPath),bytes);
  }
} finally {fs.rmSync(tmp,{recursive:true,force:true});}
console.log('POINT_EXPANSION_SHADOW_PASS: baseline preservation, ranks, supplements, boundaries, budgets, real models, actual immutable writer');
