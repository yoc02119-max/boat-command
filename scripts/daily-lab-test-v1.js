'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {execFileSync}=require('child_process');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'daily-lab-test-'));
try{
 fs.mkdirSync(path.join(temp,'scripts'));
 for(const file of ['daily-lab-report-v1.js','daily-lab-history-v1.js','daily-lab-historical-replay-v1.js','point-expansion-shadow-v1.js'])fs.copyFileSync(path.join(__dirname,file),path.join(temp,'scripts',file));
 const {build}=require(path.join(temp,'scripts/point-expansion-shadow-v1.js'));
 const {buildReport}=require(path.join(temp,'scripts/daily-lab-report-v1.js'));
 const orders=[];for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)if(new Set([a,b,c]).size===3)orders.push(`${a}-${b}-${c}`);
 const rows=orders.map(order=>({order,probability:1/120})),picks=orders.slice(0,4);
 const snapshot={date:'2026-09-23',venue:'TODA',venueCode:'02',race:1,deadline:'10:47',generatedAt:'2026-09-23T01:00:00Z',mode:'PROGRAM_ONLY',resultInput:false,payoutInput:false,researchOnly:true,productionEnabled:false,tryEnabled:false,immutableAfterFirstWrite:true,picks,pointExpansion:build({rows},picks)};
 const result={date:snapshot.date,venue:'TODA',venueCode:'02',race:1,trifecta:orders[4],payout100:1500,preRaceDataIncluded:false,resultEndpointsIncluded:true};
 const put=(rel,x)=>{const p=path.join(temp,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(x))};

 // Strict historical replay fixture: the config cutoff and every training row precede the target day.
 const replayOrders=orders.map((order,i)=>({order,probability:(120-i)/7260}));
 fs.writeFileSync(path.join(temp,'toda-research-model-v1.js'),`'use strict';module.exports={distribution(){return {rows:${JSON.stringify(replayOrders)},config:{fixture:true}}},select(d,o){return d.rows.slice(0,o.count)}};`);
 const histRows=[];
 for(let i=0;i<300;i++)histRows.push({d:'2026-08-'+String(1+Math.floor(i/12)).padStart(2,'0'),r:i%12+1,c:['B1','B1','A2','B1','A1','B1'],o:'1-2-3',p:1000,t:'予選',id:'h'+i});
 histRows.push({d:'2026-09-22',r:1,c:['B1','A1','A2','B1','B1','A1'],o:orders[4],p:1500,t:'予選',id:'target'});
 put('toda-history-bootstrap-v1.json',{venueCode:'02',races:histRows});
 put('toda-baseline-backtest-v1.json',{venue:'TODA',venueCode:'02',calibration:{lastDate:'2026-08-20',selected:{fixture:true}}});
 const {buildHistoricalReplay}=require(path.join(temp,'scripts/daily-lab-historical-replay-v1.js'));
 const replayReport=buildHistoricalReplay('2026-09-22');
 assert.equal(replayReport.sourceMode,'STRICT_HISTORICAL_REPLAY_V1');assert.equal(replayReport.venues[1].evaluated,1);
 assert.equal(replayReport.venues[1].races[0].replayEvidence.historyStrictlyBeforeDate,true);
 assert.equal(replayReport.venues[1].races[0].replayEvidence.configCutoff,'2026-08-20');
 put('toda-baseline-backtest-v1.json',{venue:'TODA',venueCode:'02',calibration:{lastDate:'2026-09-22',selected:{fixture:true}}});
 assert.equal(buildHistoricalReplay('2026-09-22').venues[1].status,'REPLAY_CONFIG_NOT_PRIOR');
 put('toda-baseline-backtest-v1.json',{venue:'TODA',venueCode:'02',calibration:{lastDate:'2026-08-20',selected:{fixture:true}}});
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
 console.log('DAILY_LAB_TEST_PASS: live capture boundaries, strict historical replay, no future-config leakage, history totals and missing data');
}finally{fs.rmSync(temp,{recursive:true,force:true})}
