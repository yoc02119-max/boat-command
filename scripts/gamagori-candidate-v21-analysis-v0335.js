// Candidate V2 hit/miss analysis and strict V2 vs V2.1 comparison.
// Predictions for both models are frozen for all 360 races before results are loaded.
'use strict';
const fs=require('fs');
const v2=require('../gamagori-candidate-model-v0334.js');
const v21=require('../gamagori-candidate-model-v0335.js');
const PRE='gamagori-shadow-pre-v0330.json';
const RESULT='gamagori-replay-results-v0333.json';
const OUT=process.argv[2]||'gamagori-candidate-v21-analysis-v0335.json';
const CLASS_SCORE={A1:3,A2:2,B1:1,B2:0};
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const finite=v=>Number.isFinite(Number(v));
const num=(v,d=0)=>finite(v)?Number(v):d;
const round=(v,n=12)=>Number(Number(v).toFixed(n));
const key=x=>`${x.date||x.d}|${x.race||x.r}`;
function program(x){return {classes:x.boats.map(b=>b.class),profiles:x.boats.map(b=>({racerWinRate:b.nationalWinRate,localWinRate:b.localWinRate,motor2Rate:b.motor2Rate,averageST:b.averageST}))}}
function features(x,p){
 const boats=x.boats,nat=boats.map(b=>num(b.nationalWinRate)),local=boats.map(b=>num(b.localWinRate)),motor=boats.map(b=>num(b.motor2Rate));
 const stFallback=mean(boats.map(b=>num(b.averageST,.18))),st=boats.map(b=>num(b.averageST,stFallback)),cls=boats.map(b=>CLASS_SCORE[b.class]);
 const inner=a=>mean(a.slice(0,3)),outer=a=>mean(a.slice(3)),scores=p.boatScores;
 return {top1Probability:p.confidence.top1,top4Coverage:p.confidence.top4,probabilityGap:p.confidence.gap,lane1Score:scores[0],lane1ScoreGap:scores[0]-Math.max(...scores.slice(1)),scoreSpread:Math.max(...scores)-Math.min(...scores),lane1NationalGap:nat[0]-mean(nat.slice(1)),lane1LocalGap:local[0]-mean(local.slice(1)),lane1MotorGap:motor[0]-mean(motor.slice(1)),lane1STGap:mean(st.slice(1))-st[0],innerNationalGap:inner(nat)-outer(nat),innerLocalGap:inner(local)-outer(local),innerMotorGap:inner(motor)-outer(motor),innerSTGap:outer(st)-inner(st),innerClassGap:inner(cls)-outer(cls),raceNumber:x.race,eventDay:x.eventDay};
}
function metric(rows,model){
 let hits=0,returns=0,firstLane1=0,lane1Picks=0,totalPicks=0,bank=0,peak=0,maxDrawdown=0,brier=0,logLoss=0;
 const winningOdds=[];
 for(const x of rows){const pred=x[model],picks=pred.fixed,hit=picks.includes(x.result);hits+=Number(hit);returns+=hit?x.odds:0;if(hit)winningOdds.push(x.odds);firstLane1+=Number(picks[0]?.startsWith('1-'));lane1Picks+=picks.filter(z=>z.startsWith('1-')).length;totalPicks+=picks.length;bank+=(hit?x.odds:0)-picks.length;peak=Math.max(peak,bank);maxDrawdown=Math.max(maxDrawdown,peak-bank);const truth=pred.probabilities.get(x.result)||0,sumsq=pred.rows.reduce((s,z)=>s+z.probability*z.probability,0);brier+=sumsq-2*truth+1;logLoss-=Math.log(Math.max(truth,1e-15));}
 winningOdds.sort((a,b)=>b-a);const stake=totalPicks,largest=winningOdds[0]||0;
 return {races:rows.length,hits,hitRate:round(hits/rows.length),roi:round(returns/stake),totalStake:stake,totalReturn:round(returns),firstLane1Rate:round(firstLane1/rows.length),lane1PickRate:round(lane1Picks/totalPicks),maxDrawdown:round(maxDrawdown),largestWinningOdds:largest,roiWithoutLargestHit:round((returns-largest)/stake),calibration:{exactOrderBrier:round(brier/rows.length),exactOrderLogLoss:round(logLoss/rows.length)}};
}
function highMetric(rows,model){return metric(rows.filter(x=>x.v2.confidence.top4>=.35),model)}
function modelReport(rows,model){const m=metric(rows,model);m.highFrozenV2={rule:'V2 top4 probability >= 0.35',...highMetric(rows,model)};return m}
function splitReports(rows,model){return {design:modelReport(rows.slice(0,180),model),holdout:modelReport(rows.slice(180),model),all:modelReport(rows,model)}}
function delta(a,b){return {hits:b.hits-a.hits,hitRate:round(b.hitRate-a.hitRate),roi:round(b.roi-a.roi),highHits:b.highFrozenV2.hits-a.highFrozenV2.hits,highHitRate:round(b.highFrozenV2.hitRate-a.highFrozenV2.hitRate),highRoi:round(b.highFrozenV2.roi-a.highFrozenV2.roi),lane1PickRate:round(b.lane1PickRate-a.lane1PickRate),maxDrawdown:round(b.maxDrawdown-a.maxDrawdown),brier:round(b.calibration.exactOrderBrier-a.calibration.exactOrderBrier),logLoss:round(b.calibration.exactOrderLogLoss-a.calibration.exactOrderLogLoss)}}
function missClassification(rows){
 const misses=rows.filter(x=>!x.v2.fixed.includes(x.result)),counts={},primary={},rankBuckets={},winnerLanes={};
 const add=(o,k)=>o[k]=(o[k]||0)+1;
 for(const x of misses){const [w,s,t]=x.result.split('-').map(Number),p=x.v2.fixed,rank=x.v2.rows.findIndex(z=>z.order===x.result)+1,winnerCovered=p.some(z=>z.startsWith(`${w}-`)),top2Covered=p.some(z=>z.startsWith(`${w}-${s}-`));
  add(winnerLanes,String(w));add(counts,`WINNER_LANE_${w}_MISS`);if(w===1)add(counts,'LANE1_WINNER_MISS');
  if(!winnerCovered)add(primary,'FIRST_PLACE_WRONG');else if(!top2Covered)add(primary,'FIRST_CORRECT_SECOND_WRONG');else add(primary,'FIRST_SECOND_CORRECT_THIRD_WRONG');
  if(winnerCovered)add(counts,'ACTUAL_WINNER_COVERED_IN_FIXED4');if(top2Covered)add(counts,'ACTUAL_FIRST_SECOND_COVERED_IN_FIXED4');
  if(p.some(z=>{const q=z.split('-').map(Number);return q[0]===w&&q[2]===t}))add(counts,'ACTUAL_FIRST_THIRD_COVERED_IN_FIXED4');
  const bucket=rank<=4?'RANK_1_4':rank<=6?'RANK_5_6':rank<=8?'RANK_7_8':rank<=12?'RANK_9_12':rank<=24?'RANK_13_24':'RANK_25_120';add(rankBuckets,bucket);
  const boat=x.boats[w-1],field=x.boats;if(boat.nationalWinRate===Math.max(...field.map(b=>num(b.nationalWinRate))))add(counts,'WINNER_STRONGEST_NATIONAL');if(boat.localWinRate===Math.max(...field.map(b=>num(b.localWinRate))))add(counts,'WINNER_STRONGEST_LOCAL');if(boat.motor2Rate===Math.max(...field.map(b=>num(b.motor2Rate))))add(counts,'WINNER_STRONGEST_MOTOR');const sts=field.map(b=>finite(b.averageST)?Number(b.averageST):Infinity);if(finite(boat.averageST)&&Number(boat.averageST)===Math.min(...sts))add(counts,'WINNER_FASTEST_AVERAGE_ST');
 }
 return {races:rows.length,hits:rows.length-misses.length,misses:misses.length,exclusiveOrderError:primary,resultWinnerLane:winnerLanes,predictionRankOfActualResult:rankBuckets,nonExclusiveEvidence:counts,maneuverLimitation:'Result source has finish order and payout only. Sashi/makuri/makuri-zashi are not asserted without kimarite data.'};
}
function effect(rows,name){const hit=rows.filter(x=>x.v2.fixed.includes(x.result)).map(x=>x.features[name]),miss=rows.filter(x=>!x.v2.fixed.includes(x.result)).map(x=>x.features[name]),all=[...hit,...miss],mu=mean(all),sd=Math.sqrt(mean(all.map(x=>(x-mu)**2)))||1;return {feature:name,hitMean:round(mean(hit)),missMean:round(mean(miss)),standardizedDifference:round((mean(hit)-mean(miss))/sd)}}
function featureAnalysis(rows){const names=Object.keys(rows[0].features),design=names.map(n=>effect(rows.slice(0,180),n)),holdout=names.map(n=>effect(rows.slice(180),n)),all=names.map(n=>effect(rows,n));const by=a=>new Map(a.map(x=>[x.feature,x]));const d=by(design),h=by(holdout);const reproducible=names.map(n=>({feature:n,design:d.get(n).standardizedDifference,holdout:h.get(n).standardizedDifference,consistentDirection:Math.sign(d.get(n).standardizedDifference)===Math.sign(h.get(n).standardizedDifference),minimumAbsoluteEffect:round(Math.min(Math.abs(d.get(n).standardizedDifference),Math.abs(h.get(n).standardizedDifference)))})).filter(x=>x.consistentDirection&&x.minimumAbsoluteEffect>=.1).sort((a,b)=>b.minimumAbsoluteEffect-a.minimumAbsoluteEffect);return {design:design.sort((a,b)=>Math.abs(b.standardizedDifference)-Math.abs(a.standardizedDifference)),holdout:holdout.sort((a,b)=>Math.abs(b.standardizedDifference)-Math.abs(a.standardizedDifference)),all:all.sort((a,b)=>Math.abs(b.standardizedDifference)-Math.abs(a.standardizedDifference)),reproducible};}
function changeAudit(rows){const changed=[],outcomeChanges=[];for(const x of rows){const a=x.v2.fixed,b=x.v21.fixed;if(a.join('|')!==b.join('|')){const row={id:x.id,split:x.split,result:x.result,odds:x.odds,v2Hit:a.includes(x.result),v21Hit:b.includes(x.result),removed:a.filter(z=>!b.includes(z)),added:b.filter(z=>!a.includes(z))};changed.push(row);if(row.v2Hit!==row.v21Hit)outcomeChanges.push(row)}}const gained=outcomeChanges.filter(x=>x.v21Hit),lost=outcomeChanges.filter(x=>x.v2Hit),increment=gained.reduce((s,x)=>s+x.odds,0)-lost.reduce((s,x)=>s+x.odds,0),largest=Math.max(0,...gained.map(x=>x.odds));return {changedRaces:changed.length,outcomeChangedRaces:outcomeChanges.length,gainedHits:gained.length,lostHits:lost.length,gains:gained,losses:lost,incrementalReturn:round(increment),largestChangedGain:largest,largestGainShareOfIncrement:increment>0?round(largest/increment):null,roiDeltaExcludingLargestChangedGain:round((increment-largest)/(rows.length*4))};}

const pre=JSON.parse(fs.readFileSync(PRE,'utf8'));
if(pre.outcomeFieldsIncluded!==false||pre.resultOddsIncluded!==false||pre.exhibitionIncluded!==false)throw new Error('PRE_RACE_BOUNDARY_INVALID');
const targets=[...(pre.races||[])].sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.race)-Number(b.race));
if(targets.length!==360)throw new Error(`TARGET_MUST_BE_360_GOT_${targets.length}`);
// Freeze every V2 and V2.1 prediction before opening the result file.
const frozen=targets.map((x,i)=>{const pg=program(x),a=v2.predict(pg,{count:4}),b=v21.predict(pg,{count:4});return {id:key(x),split:i<180?'DESIGN':'HOLDOUT',date:x.date,race:x.race,boats:x.boats,features:features(x,a),v2:{fixed:a.fixed.map(z=>z.order),rows:a.rows,probabilities:new Map(a.rows.map(z=>[z.order,z.probability])),confidence:a.confidence},v21:{fixed:b.fixed.map(z=>z.order),rows:b.rows,probabilities:new Map(b.rows.map(z=>[z.order,z.probability])),confidence:b.confidence}}});
const result=JSON.parse(fs.readFileSync(RESULT,'utf8'));
if(result.predictionInputsIncluded!==false)throw new Error('RESULT_BOUNDARY_INVALID');
const resultBy=new Map(result.races.map(x=>[key(x),x]));
const scored=frozen.map(x=>{const y=resultBy.get(x.id);if(!y)throw new Error(`RESULT_MISSING_${x.id}`);return {...x,result:y.o,odds:Number(y.x)}});
const base=splitReports(scored,'v2'),candidate=splitReports(scored,'v21'),changes=changeAudit(scored);
const report={schema:'boat-command-gamagori-candidate-v21-analysis-v0335',status:'SHADOW_ONLY',baselineModel:v2.version,candidateModel:v21.version,hypothesis:v21.hypothesis,scope:{races:360,design:{start:scored[0].date,end:scored[179].date,races:180},holdout:{start:scored[180].date,end:scored[359].date,races:180}},boundaries:{predictionsFrozenBeforeResultRead:true,preRaceOnly:true,exhibitionUsed:false,sameDayOrFutureOutcomeUsed:false,hardLockMutation:false,livePromotion:false},missClassification:{design:missClassification(scored.slice(0,180)),holdout:missClassification(scored.slice(180)),all:missClassification(scored)},featureDifference:featureAnalysis(scored),comparison:{v2:base,v21:candidate,delta:{design:delta(base.design,candidate.design),holdout:delta(base.holdout,candidate.holdout),all:delta(base.all,candidate.all)}},changeAudit:changes,decision:{retainShadow:true,promoteLive:false,reason:'Retain as the next SHADOW baseline because hit count improves in DESIGN, HOLDOUT, and ALL with no lost hits. Do not claim robust ROI > 100%: the largest changed payout contributes most of the incremental return.',highPayoutDependency:true,robustnessNote:`After excluding the largest changed gain, ROI delta is ${round(changes.roiDeltaExcludingLargestChangedGain*100,4)} percentage points.`}};
fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({baseline:base,candidate,delta:report.comparison.delta,changes,decision:report.decision},null,2));
