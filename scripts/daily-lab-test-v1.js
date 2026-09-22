'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {execFileSync}=require('child_process');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'daily-lab-test-'));
try{
 fs.mkdirSync(path.join(temp,'scripts'));
 for(const file of ['daily-lab-report-v1.js','daily-lab-history-v1.js','point-expansion-shadow-v1.js'])fs.copyFileSync(path.join(__dirname,file),path.join(temp,'scripts',file));
 const {build}=require(path.join(temp,'scripts/point-expansion-shadow-v1.js'));
 const {buildReport}=require(path.join(temp,'scripts/daily-lab-report-v1.js'));
 const orders=[];for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)if(new Set([a,b,c]).size===3)orders.push(`${a}-${b}-${c}`);
 const rows=orders.map(order=>({order,probability:1/120})),picks=orders.slice(0,4);
 const snapshot={date:'2026-09-23',venue:'TODA',venueCode:'02',race:1,deadline:'10:47',generatedAt:'2026-09-23T01:00:00Z',mode:'PROGRAM_ONLY',resultInput:false,payoutInput:false,researchOnly:true,productionEnabled:false,tryEnabled:false,immutableAfterFirstWrite:true,picks,pointExpansion:build({rows},picks)};
 const result={date:snapshot.date,venue:'TODA',venueCode:'02',race:1,trifecta:orders[4],payout100:1500,preRaceDataIncluded:false,resultEndpointsIncluded:true};
 const put=(rel,x)=>{const p=path.join(temp,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(x))};
 const sp='live/toda/2026-09-23/shadow/program-only/race-1.json',rp='live/toda/2026-09-23/post/race-1-result.json';
 assert.equal(buildReport(snapshot.date).venues.length,24);
 put(sp,snapshot);assert.equal(buildReport(snapshot.date).totals.pendingRaces,1);
 put(rp,result);let report=buildReport(snapshot.date);assert.equal(report.totals.rank6Hits,1);assert.equal(report.totals.baseHits,0);assert.equal(report.venues[1].summary.RANK6.stake100,600);
 for(const changed of [{date:'2026-09-22'},{race:2},{payout100:null},{evaluationEligible:false},{venueCode:'03'}]){put(rp,{...result,...changed});assert.equal(buildReport(snapshot.date).totals.evaluatedRaces,0)}
 put(rp,result);
 for(const changed of [{generatedAt:'2026-09-23T02:46:00Z'},{resultInput:true},{venueCode:'03'},{picks:[...picks].reverse()}]){put(sp,{...snapshot,...changed});assert.equal(buildReport(snapshot.date).totals.capturedRaces,0)}
 const dup=structuredClone(snapshot);dup.pointExpansion.variants.RANK6[5]=dup.pointExpansion.variants.RANK6[4];put(sp,dup);assert.equal(buildReport(snapshot.date).totals.capturedRaces,0);
 put(sp,snapshot);
 execFileSync(process.execPath,[path.join(temp,'scripts/daily-lab-history-v1.js'),'2026-09-23']);
 const index=JSON.parse(fs.readFileSync(path.join(temp,'daily-lab/index.json')));assert.equal(index.venues[1].summary.RANK6.hits,1);assert.equal(index.venues[1].summary.RANK6.payoutOnlyRoi,2.5);assert.equal(index.venues[0].summary.BASE4.hitRate,null);
 execFileSync('git',['init','-q'],{cwd:temp});execFileSync('git',['add','--','daily-lab-v1.json','daily-lab/'],{cwd:temp});
 const staged=execFileSync('git',['diff','--cached','--name-only'],{cwd:temp,encoding:'utf8'});assert(staged.includes('daily-lab-v1.json'));assert(staged.includes('daily-lab/index.json'));
 console.log('DAILY_LAB_TEST_PASS: first publication, matched results, late capture, duplicates, null payout, identity, history totals and missing data');
}finally{fs.rmSync(temp,{recursive:true,force:true})}
