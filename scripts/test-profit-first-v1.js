'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),assert=require('node:assert/strict');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'boat-profit-'));
const write=(p,x)=>{p=path.join(root,p);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(x));};
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
const run=(p,...args)=>cp.execFileSync(process.execPath,[p,...args],{cwd:root,env:{...process.env,BOAT_COMMAND_NOW_ISO:'2026-10-28T06:00:00+09:00'},stdio:'pipe'});
try{
 fs.mkdirSync(path.join(root,'scripts'));
 for(const p of ['daily-lab-forward-gate-v1.js','venue-expansion-policy-v1.js','shared-try-portfolio-v1.js'])fs.copyFileSync('scripts/'+p,path.join(root,'scripts',p));
 const base=['1-2-3','1-2-4','1-3-2','1-3-4'],expanded=[...base,'2-1-3','2-1-4','3-1-2','3-1-4'];
 const candidates={schema:'boat-command-daily-lab-forward-candidates-v1',version:'TEST',researchOnly:true,automaticPromotion:false,forwardStartDate:'2026-09-23',forwardTargetRacesPerVenue:120,venues:Array.from({length:24},(_,i)=>({code:String(i+1).padStart(2,'0'),slug:'venue'+i,name:'Test',variant:'RANK8',mode:'EXPANSION_CANDIDATE'}))};
 write('daily-lab/forward-candidates-v1.json',candidates);
 const report=(date,payout,spike=false)=>({date,sourceMode:'LIVE_PRE_RACE_CAPTURE',researchOnly:true,automaticPromotion:false,productionChanged:false,tryChanged:false,bankrollChanged:false,totals:{evaluatedRaces:240},venues:candidates.venues.map(v=>({code:v.code,races:Array.from({length:10},(_,i)=>({race:i+1,status:'SETTLED',actual:'2-1-3',payout100:spike?(date==='2026-10-28'&&i===0?200000:0):payout,variants:{BASE4:{picks:base},RANK8:{picks:expanded}}}))}))});
 const dates=Array.from({length:12},(_,i)=>new Date(Date.UTC(2026,9,28+i)).toISOString().slice(0,10));
 const build=()=>{run('scripts/daily-lab-forward-gate-v1.js');return read('daily-lab/forward-gate-v1.json').venues[0];};
 for(let i=0;i<12;i++)write(`daily-lab/2026-10-${String(i+1).padStart(2,'0')}.json`,report(`2026-10-${String(i+1).padStart(2,'0')}`,1600));
 let v=build();assert.equal(v.profitability.base.races,0);assert.equal(v.reviewEligible,false,'old profitable data cannot pass new validation');
 for(const date of dates)write(`daily-lab/${date}.json`,report(date,400));
 v=build();assert.ok(v.hitRateDelta>0);assert.equal(v.profitability.gates.absoluteProfitReady,false);assert.equal(v.reviewEligible,false,'more hits with losses cannot promote');
 for(const date of dates)write(`daily-lab/${date}.json`,report(date,0,true));
 v=build();assert.ok(v.profitability.candidate.roi>1);assert.equal(v.profitability.gates.largestReturnStressReady,false);assert.equal(v.reviewEligible,false,'one jackpot cannot promote');
 for(const date of dates)write(`daily-lab/${date}.json`,report(date,1600));
 v=build();assert.equal(v.reviewEligible,true);assert.equal(v.profitability.candidate.stakeYen,v.profitability.base.stakeYen);assert.equal(v.profitability.candidate.roi,2);
 const gate=read('daily-lab/forward-gate-v1.json');gate.venues[0].reviewEligible=false;write('daily-lab/forward-gate-v1.json',gate);
 const ledger={schema:'boat-command-venue-expansion-decisions-v1',decisions:[{code:'01',candidateVersion:'TEST',variant:'RANK8',decision:'APPROVE',effectiveDate:'2099-01-01'}]};
 write('daily-lab/venue-expansion-decisions-v1.json',ledger);run('scripts/venue-expansion-policy-v1.js');
 const policy=read('daily-lab/venue-expansion-policy-v1.json');assert.equal(policy.venues[0].decision,'APPROVED_SUSPENDED_GATE');assert.equal(policy.venues[0].productionEnabled,false);assert.deepEqual(read('daily-lab/venue-expansion-decisions-v1.json'),ledger);
 const cfg=JSON.parse(fs.readFileSync('shared-try-config-v1.json'));write('shared-try-config-v1.json',cfg);
 const date='2026-10-28';
 for(const a of cfg.activeAdapters)write(`live/${a.slug}/${date}/shadow/program-only/race-1.json`,{venueCode:a.venueCode,venue:a.venue,date,race:1,generatedAt:date+'T05:00:00+09:00',deadline:'13:00',picks:base,pointExpansion:{ranked:expanded.map(order=>({order,probability:0.1})),variants:{RANK8:expanded,RANK6:expanded.slice(0,6)}},resultInput:false,payoutInput:false,immutableAfterFirstWrite:true});
 // Fixture for an independently approved expansion; this is not production evidence.
 write('daily-lab/venue-expansion-policy-v1.json',{venues:[{code:'01',productionEnabled:true,applyToPrediction:true,candidateVariant:'RANK8',approval:{effectiveDate:date}},{code:'02',productionEnabled:true,applyToPrediction:true,candidateVariant:'RANK6',approval:{effectiveDate:date}}]});
 run('scripts/shared-try-portfolio-v1.js',date);const selPath=`live/portfolio/${date}/try-selection-v1.json`,selection=read(selPath),frozen=fs.readFileSync(path.join(root,selPath),'utf8');
 assert.equal(selection.candidateCount,24);assert.equal(selection.riskBudget.dailyLimitYen,5000);assert.ok(selection.totalCommittedStakeYen<=5000);assert.equal(selection.selected[0].picks.length,8);assert.equal(selection.selected[0].stakeYen,1600);assert.equal(selection.selected[1].picks.length,6);assert.equal(selection.selected[1].stakeYen,1800);
 for(const x of selection.selected){assert.ok(x.stakeYen<=2000);assert.equal(x.stakePerPickYen%100,0);assert.equal(x.stakeYen,x.picks.length*x.stakePerPickYen);}
 const x=selection.selected[0];write(`live/${x.slug}/${date}/post/race-1-result.json`,{venueCode:x.venueCode,date,race:1,trifecta:x.picks[0],payout100:1000,preRaceDataIncluded:false,resultEndpointsIncluded:true});
 run('scripts/shared-try-portfolio-v1.js',date);assert.equal(fs.readFileSync(path.join(root,selPath),'utf8'),frozen);
 const portfolio=read('shared-try-portfolio-v1.json');assert.equal(portfolio.returnYen,x.stakePerPickYen*10);assert.equal(portfolio.confirmedBankrollYen,100000+portfolio.profitYen);assert.equal(portfolio.availableBankrollYen,portfolio.confirmedBankrollYen-portfolio.pendingStakeYen);
 const workflow=fs.readFileSync('.github/workflows/shared-try-portfolio-v1.yml','utf8');
 const audit=workflow.split('- name: Boundary audit')[1].split("node - <<'NODE'\n")[1].split('          NODE')[0].split('\n').map(line=>line.slice(10)).join('\n');
 cp.execFileSync(process.execPath,['-e',audit],{cwd:root,stdio:'pipe'});
 const corrupted=read('shared-try-portfolio-v1.json');corrupted.ledger[0].stakeYen+=100;write('shared-try-portfolio-v1.json',corrupted);
 assert.throws(()=>cp.execFileSync(process.execPath,['-e',audit],{cwd:root,stdio:'pipe'}),'workflow rejects changed locked stake');
 fs.rmSync(path.join(root,'live','portfolio'),{recursive:true});write('shared-try-portfolio-v1.json',{availableBankrollYen:1000});run('scripts/shared-try-portfolio-v1.js',date);assert.equal(fs.existsSync(path.join(root,selPath)),false,'budget below minimum permits zero TRY');
 console.log('PROFIT_FIRST_PASS: new window, red-profit rejection, jackpot stress, equal budget, approval retention, 24 venues, 4/6/8 pick risk limits, variable-stake settlement, HARD LOCK, zero TRY');
}finally{fs.rmSync(root,{recursive:true,force:true});}
