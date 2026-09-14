#!/usr/bin/env node
'use strict';
const fs=require('fs');
const model=require('../gamagori-main-model-v0320.js');
const reportPath=process.argv[2]||'gamagori-shadow-evaluation-v0333.json';
const predictionsPath=process.argv[3]||'gamagori-replay-predictions-v0333.json';
const resultsPath=process.argv[4]||'gamagori-replay-results-v0333.json';
const historyDb=JSON.parse(fs.readFileSync('gamagori-main-history-v0320.json','utf8'));
const preDb=JSON.parse(fs.readFileSync('gamagori-shadow-pre-v0330.json','utf8'));
if(preDb.outcomeFieldsIncluded!==false||preDb.resultOddsIncluded!==false||preDb.exhibitionIncluded!==false)throw new Error('PRE_RACE_BOUNDARY_INVALID');
const history=[...(historyDb.races||[])].sort((a,b)=>String(a.d).localeCompare(String(b.d))||Number(a.r)-Number(b.r));
const preRows=[...(preDb.races||[])].sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.race)-Number(b.race));
if(preRows.length!==360)throw new Error('TARGET_MUST_BE_360');
const outcomes=new Map(history.map(x=>[x.id,x]));
const classScore={A1:3,A2:2,B1:1,B2:0},lanePrior=[1.45,.38,.12,-.06,-.3,-.52];
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
const sd=a=>{const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)))||0};
const quantile=(a,q)=>{const x=a.filter(Number.isFinite).sort((u,v)=>u-v);return x[Math.max(0,Math.min(x.length-1,Math.floor((x.length-1)*q)))]};
const num=v=>v===null||v===''?NaN:Number(v);
function imputedZ(values,invert=false){const raw=values.map(num),valid=raw.filter(Number.isFinite),m=mean(valid)||0,s=sd(valid)||1;return raw.map(v=>(invert?-1:1)*((Number.isFinite(v)?v:m)-m)/s)}
function entropy(rows){return-rows.reduce((s,x)=>s+(x.probability?x.probability*Math.log(x.probability):0),0)/Math.log(120)}
function winner(rows){const a=Array(6).fill(0);for(const x of rows)a[Number(x.order[0])-1]+=x.probability;return a.indexOf(Math.max(...a))+1}
function second(rows,first){const a=Array(6).fill(0);for(const x of rows)if(Number(x.order[0])===first)a[Number(x.order[1])-1]+=x.probability;return a.indexOf(Math.max(...a))+1}
function boatScores(pre){const b=pre.boats,n=imputedZ(b.map(x=>x.nationalWinRate)),l=imputedZ(b.map(x=>x.localWinRate)),st=imputedZ(b.map(x=>x.averageST),true),motor=imputedZ(b.map(x=>x.motor2Rate));return b.map((x,i)=>lanePrior[i]+.46*classScore[x.class]+.28*n[i]+.18*l[i]+.16*st[i]+.15*motor[i])}
function features(pre,dist){
 const b=pre.boats,scores=boatScores(pre),sorted=[...scores].sort((a,c)=>c-a),cls=b.map(x=>classScore[x.class]);
 const valid=(field,boats=b)=>boats.map(x=>num(x[field])).filter(Number.isFinite);
 const best=(field,boats=b.slice(1),low=false)=>{const x=valid(field,boats);return x.length?(low?Math.min(...x):Math.max(...x)):0};
 const lane1=(field,fallback)=>{const x=num(b[0][field]);return Number.isFinite(x)?x:fallback};
 return {eventDay:Number(pre.eventDay)||0,raceNumber:Number(pre.race),a1Count:b.filter(x=>x.class==='A1').length,a2Count:b.filter(x=>x.class==='A2').length,
  classInnerOuterGap:cls.slice(0,3).reduce((s,v)=>s+v,0)-cls.slice(3).reduce((s,v)=>s+v,0),
  lane1NationalGap:lane1('nationalWinRate',best('nationalWinRate'))-best('nationalWinRate'),lane1LocalGap:lane1('localWinRate',best('localWinRate'))-best('localWinRate'),
  lane1StAdvantage:best('averageST',b.slice(1),true)-lane1('averageST',best('averageST',b.slice(1),true)),lane1MotorGap:lane1('motor2Rate',best('motor2Rate'))-best('motor2Rate'),
  topBoatGap:sorted[0]-sorted[1],lane1VsBestOther:scores[0]-Math.max(...scores.slice(1)),abilityInnerOuterGap:scores.slice(0,3).reduce((s,v)=>s+v,0)-scores.slice(3).reduce((s,v)=>s+v,0),
  top1:dist.rows[0].probability,top4:dist.rows.slice(0,4).reduce((s,x)=>s+x.probability,0),margin45:dist.rows[3].probability-dist.rows[4].probability,entropy:entropy(dist.rows),nearestDistance:dist.nearestDistance,similarProgramCount:dist.neighbors};
}
const records=[];
for(const pre of preRows){
 const actual=outcomes.get(pre.id);if(!actual)throw new Error(`OUTCOME_MISSING ${pre.id}`);
 const program={classes:pre.boats.map(x=>x.class),race:pre.race,raceType:pre.raceType};
 const dist=model.probabilities(program,history,{targetDate:pre.date}),fixed4=model.select(dist,{count:4}).map(x=>x.order),variableCount=model.variableCount(dist,{maxCount:6}),variable=model.select(dist,{count:variableCount}).map(x=>x.order);
 const rank=dist.rows.findIndex(x=>x.order===actual.o)+1,lanes=actual.o.split('-').map(Number),predWinner=winner(dist.rows),predSecond=second(dist.rows,lanes[0]);
 const stage=predWinner!==lanes[0]?'WINNER_WRONG':predSecond!==lanes[1]?'SECOND_WRONG':'THIRD_WRONG';
 const primary=rank>=5&&rank<=8?'JUST_OUTSIDE_5_TO_8':rank>24?'MAJOR_MISREAD':stage;
 records.push({id:pre.id,date:pre.date,race:Number(pre.race),pre,actual:actual.o,payout:Number(actual.p)||0,resultOdds:(Number(actual.p)||0)/100,fixed4,variable,variableCount,rank,hit:fixed4.includes(actual.o),stage,primary,features:features(pre,dist),categories:{lane1Class:pre.boats[0].class,a1Count:String(pre.boats.filter(x=>x.class==='A1').length),raceBucket:pre.race<=4?'EARLY':pre.race<=8?'MIDDLE':'LATE',raceType:model.raceTypeGroup(pre.raceType),innerStrength:(pre.boats.slice(0,3).reduce((s,x)=>s+classScore[x.class],0)>=pre.boats.slice(3).reduce((s,x)=>s+classScore[x.class],0))?'INNER_GE_OUTER':'OUTER_GT_INNER'},probabilitySum:dist.sum});
}
const dates=[...new Set(records.map(x=>x.date))],splitDate=dates[15],design=records.filter(x=>x.date<splitDate),holdout=records.filter(x=>x.date>=splitDate);
const confidenceFields=['top4','top1','margin45','entropy','topBoatGap','nearestDistance'];
const scale=Object.fromEntries(confidenceFields.map(k=>[k,{m:mean(design.map(x=>x.features[k])),s:sd(design.map(x=>x.features[k]))||1}]));
function confidence(x){const z=k=>(x.features[k]-scale[k].m)/scale[k].s;return z('top4')+.6*z('top1')+.35*z('margin45')-z('entropy')+.3*z('topBoatGap')-.15*z('nearestDistance')}
records.forEach(x=>x.confidence=confidence(x));
const confidenceCut=quantile(design.map(x=>x.confidence),.5),highCut=quantile(design.map(x=>x.confidence),2/3),lowCut=quantile(design.map(x=>x.confidence),1/3),programCut=quantile(design.map(x=>x.features.nearestDistance),.5);
records.forEach(x=>x.confidenceBand=x.confidence>=highCut?'HIGH':x.confidence>=lowCut?'MEDIUM':'LOW');
function metrics(rows,filter=()=>true,pick='fixed4'){
 const bought=rows.filter(filter);let cash=0,peak=0,maxDrawdown=0,points=0,hits=0,payout=0,lane1=0;
 for(const x of rows){if(!filter(x))continue;const p=x[pick];points+=p.length;lane1+=p.filter(v=>v.startsWith('1-')).length;const hit=p.includes(x.actual);if(hit){hits++;payout+=x.payout}cash+=(hit?x.payout:0)-p.length*100;peak=Math.max(peak,cash);maxDrawdown=Math.max(maxDrawdown,peak-cash)}
 return {sampleRaces:rows.length,betRaces:bought.length,skipRaces:rows.length-bought.length,averagePoints:bought.length?points/bought.length:0,hits,hitRate:bought.length?hits/bought.length:null,totalInvestment:points*100,totalPayout:payout,roi:points?payout/(points*100):null,maxDrawdown,lane1PickShare:points?lane1/points:null};
}
const filters={all:()=>true,confidence:x=>x.confidence>=confidenceCut,program:x=>x.features.nearestDistance<=programCut,combined:x=>x.confidence>=confidenceCut&&x.features.nearestDistance<=programCut};
const strategies=Object.fromEntries(Object.entries(filters).map(([k,f])=>[k,{design:metrics(design,f),holdout:metrics(holdout,f),all360:metrics(records,f)}]));
function auc(rows,key){const p=rows.filter(x=>x.hit),n=rows.filter(x=>!x.hit);let w=0;for(const a of p)for(const b of n){const x=a.features[key],y=b.features[key];w+=x>y?1:x===y?.5:0}return p.length&&n.length?w/(p.length*n.length):.5}
function impact(rows,key){const a=auc(rows,key),h=rows.filter(x=>x.hit).map(x=>x.features[key]),m=rows.filter(x=>!x.hit).map(x=>x.features[key]),pool=Math.sqrt((sd(h)**2+sd(m)**2)/2)||1;return{auc:a,separationAuc:Math.max(a,1-a),standardizedDifference:(mean(h)-mean(m))/pool}}
const impactRanking=Object.keys(records[0].features).map(feature=>({feature,design:impact(design,feature),holdout:impact(holdout,feature)})).sort((a,b)=>b.design.separationAuc-a.design.separationAuc);
function groupStats(rows,key){return Object.fromEntries([...new Set(rows.map(x=>x.categories[key]))].sort().map(v=>[v,metrics(rows,x=>x.categories[key]===v)]))}
const programComposition=Object.fromEntries(Object.keys(records[0].categories).map(k=>[k,{design:groupStats(design,k),holdout:groupStats(holdout,k)}]));
const count=(rows,key,domain=null)=>Object.fromEntries((domain||[...new Set(rows.map(x=>x[key]))].sort()).map(v=>[v,rows.filter(x=>x[key]===v).length]));
function domainCause(x){if(x.hit)return'HIT';if(x.payout>=10000)return'HIGH_PAYOUT_UPSET';if(x.features.lane1NationalGap<=-1.5||x.features.lane1LocalGap<=-1.5)return'OUTER_PROFILE_EDGE';if(x.features.lane1MotorGap<=-.12)return'OUTER_MOTOR_EDGE';if(x.features.lane1StAdvantage<=-.04)return'OUTER_ST_EDGE';if(Math.abs(x.features.abilityInnerOuterGap)<=.5)return'BALANCED_FIELD';return'OTHER'}
const misses=records.filter(x=>!x.hit),domainCounts={};for(const x of records){const k=domainCause(x);domainCounts[k]=(domainCounts[k]||0)+1}
function bandStats(rows){return Object.fromEntries(['HIGH','MEDIUM','LOW'].map(b=>[b,metrics(rows,x=>x.confidenceBand===b)]))}
const report={schema:'boat-command-shadow-evaluation-v0333',model:model.version,scope:{raceDays:30,races:360,firstDate:dates[0],lastDate:dates.at(-1),hits:records.filter(x=>x.hit).length,misses:misses.length},
 boundaries:{shadowOnly:true,strictWalkForward:true,sameDayOutcomeExcluded:true,targetAndFutureOutcomeExcluded:true,exhibitionUsed:false,designDates:dates.slice(0,15),holdoutDates:dates.slice(15),thresholdsOutcomeOptimized:false},
 thresholds:{confidenceCut,highCut,lowCut,programNearestDistanceCut:programCut,source:'FIRST_15_DAYS_INPUT_DISTRIBUTION_ONLY'},strategies,confidenceBands:{design:bandStats(design),holdout:bandStats(holdout),all360:bandStats(records)},impactRanking,programComposition,
 missAnalysis:{misses:misses.length,primaryFiveClass:count(misses,'primary',['WINNER_WRONG','SECOND_WRONG','THIRD_WRONG','JUST_OUTSIDE_5_TO_8','MAJOR_MISREAD']),stage:count(misses,'stage',['WINNER_WRONG','SECOND_WRONG','THIRD_WRONG']),rankBands:{fiveToEight:misses.filter(x=>x.rank>=5&&x.rank<=8).length,nineToTwentyFour:misses.filter(x=>x.rank>=9&&x.rank<=24).length,overTwentyFour:misses.filter(x=>x.rank>24).length},domainCounts},
 pointComparison:{fixed4:metrics(records),variable:metrics(records,()=>true,'variable')},lane1Audit:{actualWinnerRate:records.filter(x=>x.actual.startsWith('1-')).length/records.length,fixed4PickShare:metrics(records).lane1PickShare,variablePickShare:metrics(records,()=>true,'variable').lane1PickShare},
 probabilityAudit:{orders:120,minSum:Math.min(...records.map(x=>x.probabilitySum)),maxSum:Math.max(...records.map(x=>x.probabilitySum)),pass:records.every(x=>Math.abs(x.probabilitySum-1)<=1e-12)},livePromotionEligible:false,decision:'STOP_FOR_USER_ADOPTION_DECISION'};
const enhanced=new Map(records.map(x=>[x.id,x])),templates=[];
const compactBoats=boats=>boats.map(x=>[x.lane,x.class,x.nationalWinRate,x.localWinRate,x.averageST,x.motor2Rate]);
for(const row of history){const x=enhanced.get(row.id);if(x)templates.push({d:x.date,r:x.race,t:x.pre.raceType,c:x.pre.boats.map(b=>b.class),s:{d:x.pre.eventDay,b:compactBoats(x.pre.boats)},f:x.fixed4,q:x.confidence,g:x.confidenceBand,k:filters.confidence(x)?'BET':'SKIP'});else{const dist=model.probabilities({classes:row.c,race:row.r,raceType:row.t},history,{targetDate:row.d});templates.push({d:row.d,r:Number(row.r),t:row.t,c:row.c,f:model.select(dist,{count:4}).map(v=>v.order),q:null,g:null,k:null})}}
const results=history.map(x=>({d:x.d,r:Number(x.r),o:x.o,x:Number(x.p)/100}));
fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
fs.writeFileSync(predictionsPath,JSON.stringify({schema:'boat-command-replay-predictions-v0333',modelVersion:model.version,resultsIncluded:false,payoutsIncluded:false,exhibitionIncluded:false,futureDataIncluded:false,races:templates}));
fs.writeFileSync(resultsPath,JSON.stringify({schema:'boat-command-replay-results-v0333',predictionInputsIncluded:false,races:results}));
console.log(JSON.stringify({scope:report.scope,strategies:report.strategies,missAnalysis:report.missAnalysis,lane1Audit:report.lane1Audit,decision:report.decision},null,2));
