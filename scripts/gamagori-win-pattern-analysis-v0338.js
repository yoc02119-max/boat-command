'use strict';
const fs=require('fs');

const PRE='gamagori-shadow-pre-v0330.json';
const PRED='gamagori-replay-predictions-v0333.json';
const RESULT='gamagori-replay-results-v0333.json';
const OUT=process.argv[2]||'gamagori-win-pattern-analysis-v0338.json';

const pre=JSON.parse(fs.readFileSync(PRE,'utf8'));
if(pre.outcomeFieldsIncluded!==false||pre.resultOddsIncluded!==false||pre.exhibitionIncluded!==false)throw new Error('PRE_BOUNDARY_INVALID');
const predictions=JSON.parse(fs.readFileSync(PRED,'utf8'));
if(predictions.resultsIncluded!==false||predictions.payoutsIncluded!==false||predictions.exhibitionIncluded!==false||predictions.futureDataIncluded!==false)throw new Error('PRED_BOUNDARY_INVALID');

const safe=n=>Number.isFinite(Number(n))?Number(n):null;
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const q=(a,p)=>{const v=a.filter(Number.isFinite).slice().sort((x,y)=>x-y);return v.length?v[Math.floor((v.length-1)*p)]:null;};
const classRank=c=>({A1:4,A2:3,B1:2,B2:1}[String(c||'').toUpperCase()]||0);
const ratio=(a,b)=>b?a/b:0;

const preById=new Map();
for(const r of pre.races||[]){
 const keys=[r.id,r.date!=null&&r.race!=null?`${r.date}|${r.race}`:null,r.date!=null&&r.r!=null?`${r.date}|${r.r}`:null].filter(Boolean);
 for(const k of keys)preById.set(String(k),r);
}

function profile(preRow,classes,picks){
 const boats=preRow?.boats||[];
 const lane1=boats[0]||{};
 const outer=boats.slice(1);
 const vals=(key,set=boats)=>set.map(x=>safe(x?.[key])).filter(Number.isFinite);
 const min=(key,set=boats)=>{const v=vals(key,set);return v.length?Math.min(...v):null;};
 const max=(key,set=boats)=>{const v=vals(key,set);return v.length?Math.max(...v):null;};
 const av=(key,set=boats)=>avg(vals(key,set));
 const sub=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?a-b:null;
 const l1st=safe(lane1.averageST), l1n=safe(lane1.nationalWinRate), l1l=safe(lane1.localWinRate), l1m=safe(lane1.motor2Rate);
 const ranks=(classes||[]).map(classRank), outerRanks=ranks.slice(1);
 const heads=[...new Set((picks||[]).map(p=>String(p).split('-')[0]).filter(Boolean))];
 const secondsByHead={};
 for(const p of picks||[]){const z=String(p).split('-');if(z.length!==3)continue;(secondsByHead[z[0]]??=[]).push(z[1]);}
 const secondCounts=Object.values(secondsByHead).map(v=>new Set(v).size);
 return {
  enriched:Boolean(preRow&&boats.length),
  eventDay:safe(preRow?.eventDay),
  lane1AvgST:l1st,
  stOuterEdge:sub(l1st,min('averageST',outer)),
  stSpread:sub(max('averageST'),min('averageST')),
  lane1National:l1n,
  nationalOuterEdge:sub(max('nationalWinRate',outer),l1n),
  nationalSpread:sub(max('nationalWinRate'),min('nationalWinRate')),
  lane1Local:l1l,
  localOuterEdge:sub(max('localWinRate',outer),l1l),
  localSpread:sub(max('localWinRate'),min('localWinRate')),
  lane1Motor2:l1m,
  motorOuterEdge:sub(max('motor2Rate',outer),l1m),
  motorSpread:sub(max('motor2Rate'),min('motor2Rate')),
  fieldAvgST:av('averageST'),fieldNational:av('nationalWinRate'),fieldLocal:av('localWinRate'),fieldMotor2:av('motor2Rate'),
  lane1Class:String(classes?.[0]||'UNKNOWN'),
  lane1ClassRank:ranks[0]||0,
  lane1ClassGap:outerRanks.length?(ranks[0]||0)-Math.max(...outerRanks):null,
  a1Count:(classes||[]).filter(c=>String(c).toUpperCase()==='A1').length,
  aClassCount:(classes||[]).filter(c=>['A1','A2'].includes(String(c).toUpperCase())).length,
  headCount:heads.length,
  pickCount:(picks||[]).length,
  secondCandidateMin:secondCounts.length?Math.min(...secondCounts):0,
  secondCandidateMax:secondCounts.length?Math.max(...secondCounts):0
 };
}

// Freeze every prediction and all PRE-derived features before opening RESULT.
const locked=(predictions.races||[]).map(x=>{
 const id=`${x.d}|${x.r}`;
 const picks=[...(x.f||[])];
 const classes=[...(x.c||[])];
 const race=Number(x.r);
 const title=x.t||'UNKNOWN';
 const raceBand=race<=4?'EARLY_1_4':race<=8?'MID_5_8':'LATE_9_12';
 return {id,date:String(x.d),race,title,raceBand,classes,picks,...profile(preById.get(id),classes,picks)};
});

const result=JSON.parse(fs.readFileSync(RESULT,'utf8'));
if(result.predictionInputsIncluded!==false)throw new Error('RESULT_BOUNDARY_INVALID');
const byResult=new Map((result.races||[]).map(x=>[`${x.d}|${x.r}`,x]));
const rows=[];
for(const x of locked){
 const y=byResult.get(x.id);if(!y)continue;
 const actual=String(y.o||'').split('-');if(actual.length!==3)continue;
 const firstHeads=[...new Set(x.picks.map(p=>String(p).split('-')[0]).filter(Boolean))];
 const secondByHead={};
 for(const p of x.picks){const z=String(p).split('-');if(z.length!==3)continue;(secondByHead[z[0]]??=[]).push(z[1]);}
 for(const k of Object.keys(secondByHead))secondByHead[k]=[...new Set(secondByHead[k])];
 const winner=actual[0],runnerUp=actual[1],headCorrect=firstHeads.includes(winner),secondCandidates=secondByHead[winner]||[];
 const secondHit=headCorrect&&secondCandidates.includes(runnerUp),exactHit=x.picks.includes(String(y.o));
 rows.push({...x,winner,runnerUp,headCorrect,secondHitGivenHead:secondHit,exactHit});
}

function summarize(rs,total=rs.length){
 const head=rs.filter(x=>x.headCorrect), second=head.filter(x=>x.secondHitGivenHead), exact=rs.filter(x=>x.exactHit);
 return {races:rs.length,coverage:ratio(rs.length,total),headCorrect:head.length,headRate:ratio(head.length,rs.length),secondHitGivenHead:second.length,conditionalSecondRate:ratio(second.length,head.length),exactHits:exact.length,exactHitRate:ratio(exact.length,rs.length),exactGivenHeadAndSecond:ratio(exact.length,second.length)};
}
function dateSplit(rs){
 const dates=[...new Set(rs.map(x=>x.date))].sort();
 const cut=Math.floor(dates.length/2);
 const designDates=dates.slice(0,cut),holdoutDates=dates.slice(cut);
 const dset=new Set(designDates),hset=new Set(holdoutDates);
 return {designDates,holdoutDates,design:rs.filter(x=>dset.has(x.date)),holdout:rs.filter(x=>hset.has(x.date))};
}
function gateResult(scope,kind,label,test,design,holdout,baseDesign,baseHoldout){
 const ds=design.filter(test),hs=holdout.filter(test);
 return {scope,kind,label,design:summarize(ds,design.length),holdout:summarize(hs,holdout.length),designExactUplift:ratio(ds.filter(x=>x.exactHit).length,ds.length)-baseDesign.exactHitRate,holdoutExactUplift:ratio(hs.filter(x=>x.exactHit).length,hs.length)-baseHoldout.exactHitRate};
}

const coreSplit=dateSplit(rows), coreBaseD=summarize(coreSplit.design), coreBaseH=summarize(coreSplit.holdout);
const candidates=[];
const addCore=(kind,label,test)=>{
 const c=gateResult('core',kind,label,test,coreSplit.design,coreSplit.holdout,coreBaseD,coreBaseH);
 if(c.design.races>=80&&c.holdout.races>=80)candidates.push(c);
};
for(let r=1;r<=12;r++)addCore('raceNumber',`race=${r}`,x=>x.race===r);
for(const b of ['EARLY_1_4','MID_5_8','LATE_9_12'])addCore('raceBand',`raceBand=${b}`,x=>x.raceBand===b);
for(const t of [...new Set(coreSplit.design.map(x=>x.title))])addCore('programTitle',`title=${t}`,x=>x.title===t);
for(const c of ['A1','A2','B1','B2','UNKNOWN'])addCore('lane1Class',`lane1Class=${c}`,x=>x.lane1Class===c);
for(const n of [...new Set(coreSplit.design.map(x=>x.a1Count))].sort((a,b)=>a-b))addCore('a1Count',`a1Count=${n}`,x=>x.a1Count===n);
for(const n of [...new Set(coreSplit.design.map(x=>x.aClassCount))].sort((a,b)=>a-b))addCore('aClassCount',`aClassCount=${n}`,x=>x.aClassCount===n);
for(const n of [...new Set(coreSplit.design.map(x=>x.headCount))].sort((a,b)=>a-b))addCore('headCount',`headCount=${n}`,x=>x.headCount===n);
for(const n of [...new Set(coreSplit.design.map(x=>x.pickCount))].sort((a,b)=>a-b))addCore('pickCount',`pickCount=${n}`,x=>x.pickCount===n);

const enriched=rows.filter(x=>x.enriched), enrichedSplit=dateSplit(enriched), enrichedBaseD=summarize(enrichedSplit.design), enrichedBaseH=summarize(enrichedSplit.holdout);
const numeric=['eventDay','lane1AvgST','stOuterEdge','stSpread','lane1National','nationalOuterEdge','nationalSpread','lane1Local','localOuterEdge','localSpread','lane1Motor2','motorOuterEdge','motorSpread','fieldAvgST','fieldNational','fieldLocal','fieldMotor2','lane1ClassRank','lane1ClassGap','secondCandidateMin','secondCandidateMax'];
for(const name of numeric){
 const values=enrichedSplit.design.map(x=>x[name]).filter(Number.isFinite);
 for(const pct of [.25,.5,.75]){
  const threshold=q(values,pct);if(threshold==null)continue;
  for(const dir of ['gte','lte']){
   const test=x=>Number.isFinite(x[name])&&(dir==='gte'?x[name]>=threshold:x[name]<=threshold);
   const c=gateResult('enriched',name,`${name} ${dir} ${threshold}`,test,enrichedSplit.design,enrichedSplit.holdout,enrichedBaseD,enrichedBaseH);
   if(c.design.races>=30&&c.holdout.races>=30)candidates.push(c);
  }
 }
}

for(const c of candidates)c.designScore=c.designExactUplift*Math.sqrt(c.design.races);
candidates.sort((a,b)=>(b.designScore-a.designScore)||(b.designExactUplift-a.designExactUplift));
const validated=candidates.filter(c=>c.designExactUplift>=0.03&&c.holdoutExactUplift>=0&&c.design.races>=(c.scope==='core'?80:30)&&c.holdout.races>=(c.scope==='core'?80:30));

const report={
 schema:'boat-command-gamagori-win-pattern-analysis-v0338',analysisOnly:true,liveImported:false,decision:'SHADOW_ONLY',
 boundary:'All predictions, program structure, class composition and PRE-derived features are frozen before RESULT is opened. Thresholds are selected from design data only; holdout is evaluation only.',
 sources:{pre:PRE,predictions:PRED,result:RESULT},
 core:{races:rows.length,designDates:coreSplit.designDates,holdoutDates:coreSplit.holdoutDates,baseline:{design:coreBaseD,holdout:coreBaseH}},
 enriched:{races:enriched.length,designDates:enrichedSplit.designDates,holdoutDates:enrichedSplit.holdoutDates,baseline:{design:enrichedBaseD,holdout:enrichedBaseH}},
 definitions:{exactGivenHeadAndSecond:'Exact-hit count divided by races where the actual winner and runner-up were both covered by the frozen picks.',designScore:'Design exact-hit-rate uplift multiplied by sqrt(design support). Used for ordering only; holdout is never used to fit thresholds or ordering.'},
 candidates:candidates.slice(0,60),validatedSignals:validated.slice(0,30),
 note:'Program title/class composition are observable pre-race structure proxies; this analysis does not claim organizer motive. No signal is imported into LIVE. Repeated forward validation is required before promotion.'
};
fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({core:report.core,enriched:report.enriched,topCandidates:report.candidates.slice(0,12),validatedSignals:report.validatedSignals.slice(0,12),decision:report.decision},null,2));
