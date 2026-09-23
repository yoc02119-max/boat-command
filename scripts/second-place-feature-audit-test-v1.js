'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {build}=require('./point-expansion-shadow-v1.js');
const {pairCandidates,auditRace,buildReport}=require('./second-place-feature-audit-v1.js');
const orders=[];
for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)
  if(new Set([a,b,c]).size===3)orders.push(`${a}-${b}-${c}`);
const ranked=orders.map((order,i)=>({order,probability:(120-i)/7260}));
const picks=ranked.slice(0,4).map(x=>x.order);
const program={date:'2026-09-24',deadline:'10:47',fetchedAt:'2026-09-24T09:00:00+09:00',
  raceType:'予選',resultEndpointsIncluded:false,resultIncluded:false,exhibitionIncluded:false,
  boats:[1,2,3,4,5,6].map((lane)=>({lane,class:lane===3?'A1':'B1',avgST:lane===4?.11:.18,
    local2Rate:lane===5?.5:.2,motor2Rate:lane===2?.6:.3}))};
const generatedAt='2026-09-24T09:01:00+09:00';
const features=require('./pre-race-feature-freeze-v1.js').freeze(program,generatedAt);
const snapshot={date:program.date,race:1,venue:'TODA',venueCode:'02',mode:'PROGRAM_ONLY',
  deadline:program.deadline,generatedAt,sources:{programFetchedAt:program.fetchedAt},
  picks,pointExpansion:build({rows:ranked},picks),preRaceFeatures:features,
  resultInput:false,payoutInput:false,researchOnly:true,productionEnabled:false,
  tryEnabled:false,immutableAfterFirstWrite:true};
const result={date:program.date,race:1,venue:'TODA',venueCode:'02',
  trifecta:'1-3-4',payout100:1230,preRaceDataIncluded:false,resultEndpointsIncluded:true};
const prior=pairCandidates(snapshot);
assert.deepEqual(prior.CLASS,[3,2]);
assert.deepEqual(prior.AVG_ST,[4,2]);
assert.deepEqual(prior.LOCAL_2_RATE,[5,2]);
assert.deepEqual(prior.MOTOR_2_RATE,[2,3]);
assert.equal(auditRace(snapshot,result).actualSecond,3);
assert.equal(auditRace(snapshot,{...result,trifecta:'2-3-4'}).firstOne,false);
assert.deepEqual(pairCandidates(snapshot),prior);
assert.equal(auditRace(snapshot,{...result,preRaceDataIncluded:true}),null);
assert.equal(pairCandidates({...snapshot,sources:{programFetchedAt:'2026-09-24T09:05:00+09:00'}}),null);
assert.equal(pairCandidates({...snapshot,generatedAt:'2026-09-24T10:45:00+09:00'}),null);
assert.equal(pairCandidates({...snapshot,preRaceFeatures:null}),null);
assert.equal(buildReport('2026-09-24','/nonexistent-research-input').totals.verifiedResults,0);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'second-place-audit-'));
try{
  const dir=path.join(temp,'live','toda',program.date);
  for(const [relative,value] of [
    ['shadow/program-only/race-1.json',snapshot],
    ['post/race-1-result.json',result]
  ]){
    const target=path.join(dir,relative);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,JSON.stringify(value));
  }
  const report=buildReport(program.date,temp);
  assert.equal(report.totals.snapshotsWithFeatures,1);
  assert.equal(report.totals.verifiedResults,1);
  assert.equal(report.totals.firstOneRaces,1);
  assert.deepEqual(report.totals.methods.CLASS,{eligible:1,secondHits:1});
  assert.deepEqual(report.totals.methods.MOTOR_2_RATE,{eligible:1,secondHits:1});
  assert.equal(report.venues.find(v=>v.slug==='toda').firstOneRaces,1);
}finally{fs.rmSync(temp,{recursive:true,force:true})}
console.log('SECOND_PLACE_FEATURE_AUDIT_PASS');
