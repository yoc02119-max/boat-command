'use strict';
const fs=require('fs');

const PRED='gamagori-replay-predictions-v0333.json';
const RESULT='gamagori-replay-results-v0333.json';
const OUT=process.argv[2]||'gamagori-win-pattern-combo-v0339.json';

const predictions=JSON.parse(fs.readFileSync(PRED,'utf8'));
if(predictions.resultsIncluded!==false||predictions.payoutsIncluded!==false||predictions.exhibitionIncluded!==false||predictions.futureDataIncluded!==false)throw new Error('PRED_BOUNDARY_INVALID');
const ratio=(a,b)=>b?a/b:0;
const classRank=c=>({A1:4,A2:3,B1:2,B2:1}[String(c||'').toUpperCase()]||0);

function features(x){
 const race=Number(x.r),classes=[...(x.c||[])],picks=[...(x.f||[])];
 const heads=[...new Set(picks.map(p=>String(p).split('-')[0]).filter(Boolean))];
 return {
  race:String(race),
  raceBand:race<=4?'EARLY_1_4':race<=8?'MID_5_8':'LATE_9_12',
  title:String(x.t||'UNKNOWN'),
  lane1Class:String(classes[0]||'UNKNOWN').toUpperCase(),
  lane1ClassRank:String(classRank(classes[0])),
  a1Count:String(classes.filter(c=>String(c).toUpperCase()==='A1').length),
  aClassCount:String(classes.filter(c=>['A1','A2'].includes(String(c).toUpperCase())).length),
  headCount:String(heads.length),
  pickCount:String(picks.length)
 };
}

// Freeze prediction-derived structure before opening RESULT.
const locked=(predictions.races||[]).map(x=>({id:`${x.d}|${x.r}`,date:String(x.d),race:Number(x.r),title:String(x.t||'UNKNOWN'),classes:[...(x.c||[])],picks:[...(x.f||[])],f:features(x)}));
const dates=[...new Set(locked.map(x=>x.date))].sort();
const cut1=Math.floor(dates.length*.5),cut2=Math.floor(dates.length*.75);
const trainDates=dates.slice(0,cut1),validationDates=dates.slice(cut1,cut2),testDates=dates.slice(cut2);
const trainSet=new Set(trainDates),validationSet=new Set(validationDates),testSet=new Set(testDates);

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
 rows.push({...x,headCorrect,secondHitGivenHead:headCorrect&&secondCandidates.includes(runnerUp),exactHit:x.picks.includes(String(y.o))});
}
const train=rows.filter(x=>trainSet.has(x.date)),validation=rows.filter(x=>validationSet.has(x.date)),test=rows.filter(x=>testSet.has(x.date));

function stats(rs,total=rs.length){
 const h=rs.filter(x=>x.headCorrect),s=h.filter(x=>x.secondHitGivenHead),e=rs.filter(x=>x.exactHit);
 return {races:rs.length,coverage:ratio(rs.length,total),headRate:ratio(h.length,rs.length),conditionalSecondRate:ratio(s.length,h.length),exactHitRate:ratio(e.length,rs.length),exactGivenHeadAndSecond:ratio(e.length,s.length)};
}
const base={train:stats(train),validation:stats(validation),test:stats(test)};
const featureNames=['race','raceBand','title','lane1Class','a1Count','aClassCount','headCount'];
const values={};
for(const name of featureNames)values[name]=[...new Set(train.map(x=>x.f[name]))].filter(v=>v!=='UNKNOWN');
const defs=[];
for(const name of featureNames)for(const value of values[name])defs.push({kind:'single',parts:[{name,value}],label:`${name}=${value}`});
for(let i=0;i<featureNames.length;i++)for(let j=i+1;j<featureNames.length;j++){
 const a=featureNames[i],b=featureNames[j];
 for(const av of values[a])for(const bv of values[b])defs.push({kind:'pair',parts:[{name:a,value:av},{name:b,value:bv}],label:`${a}=${av} & ${b}=${bv}`});
}
const testDef=(d,x)=>d.parts.every(p=>x.f[p.name]===p.value);
function evaluateDef(d){
 const tr=train.filter(x=>testDef(d,x)),va=validation.filter(x=>testDef(d,x)),te=test.filter(x=>testDef(d,x));
 const out={kind:d.kind,label:d.label,parts:d.parts,train:stats(tr,train.length),validation:stats(va,validation.length)};
 out.trainExactUplift=out.train.exactHitRate-base.train.exactHitRate;
 out.validationExactUplift=out.validation.exactHitRate-base.validation.exactHitRate;
 out.trainHeadUplift=out.train.headRate-base.train.headRate;
 out.validationHeadUplift=out.validation.headRate-base.validation.headRate;
 out.selectionScore=Math.min(out.trainExactUplift,out.validationExactUplift)*Math.sqrt(tr.length+va.length);
 out._testRows=te;
 return out;
}
const evaluated=defs.map(evaluateDef).filter(x=>x.train.races>=60&&x.validation.races>=30&&x._testRows.length>=30);
// Selection is completed using TRAIN + VALIDATION only. TEST is not consulted here.
const selected=evaluated.filter(x=>x.trainExactUplift>=.04&&x.validationExactUplift>=.03&&x.trainHeadUplift>=-.01&&x.validationHeadUplift>=-.01).sort((a,b)=>b.selectionScore-a.selectionScore).slice(0,25);
// Only after selection is fixed do we attach TEST evaluation.
for(const x of selected){x.test=stats(x._testRows,test.length);x.testExactUplift=x.test.exactHitRate-base.test.exactHitRate;x.testHeadUplift=x.test.headRate-base.test.headRate;delete x._testRows;}
for(const x of evaluated)delete x._testRows;
evaluated.sort((a,b)=>b.selectionScore-a.selectionScore);

function fixed(label,pred){
 const tr=train.filter(pred),va=validation.filter(pred),te=test.filter(pred);
 return {label,train:stats(tr,train.length),validation:stats(va,validation.length),test:stats(te,test.length),testExactUplift:stats(te,test.length).exactHitRate-base.test.exactHitRate};
}
const diagnostics=[
 fixed('race7_all',x=>x.race===7),
 fixed('race7_lane1A1',x=>x.race===7&&x.f.lane1Class==='A1'),
 fixed('race7_lane1NotA1',x=>x.race===7&&x.f.lane1Class!=='A1'),
 fixed('notRace7_lane1A1',x=>x.race!==7&&x.f.lane1Class==='A1'),
 fixed('late9to12_lane1A1',x=>x.race>=9&&x.f.lane1Class==='A1'),
 fixed('mid5to8_lane1A1',x=>x.race>=5&&x.race<=8&&x.f.lane1Class==='A1')
];

const report={
 schema:'boat-command-gamagori-win-pattern-combo-v0339',analysisOnly:true,liveImported:false,decision:'SHADOW_ONLY',
 boundary:'Prediction/program/class features are frozen before RESULT read. Candidate family is predefined. Candidates are selected using TRAIN+VALIDATION only; final TEST metrics are attached only after selection is fixed.',
 split:{trainDates,validationDates,testDates},baseline:base,
 selectionRule:{minTrainRaces:60,minValidationRaces:30,minTestRaces:30,minTrainExactUplift:.04,minValidationExactUplift:.03,minTrainHeadUplift:-.01,minValidationHeadUplift:-.01},
 selectedBeforeTest:selected,diagnostics,topTrainValidationCandidates:evaluated.slice(0,40),
 note:'This is still research/shadow only. Prior aggregate analyses have already viewed overlapping historical periods, so even the final TEST is not treated as pristine live-forward evidence. Future race-days remain the promotion gate.'
};
fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({baseline:base,selectedBeforeTest:selected,diagnostics,decision:report.decision},null,2));
