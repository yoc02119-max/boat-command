'use strict';
const fs=require('fs');

const PRED='gamagori-replay-predictions-v0333.json';
const RESULT='gamagori-replay-results-v0333.json';
const COMBO='gamagori-win-pattern-combo-v0339.json';
const OUT=process.argv[2]||'gamagori-roi-gate-analysis-v0340.json';

const predictions=JSON.parse(fs.readFileSync(PRED,'utf8'));
if(predictions.resultsIncluded!==false||predictions.payoutsIncluded!==false||predictions.exhibitionIncluded!==false||predictions.futureDataIncluded!==false)throw new Error('PRED_BOUNDARY_INVALID');
const combo=JSON.parse(fs.readFileSync(COMBO,'utf8'));
if(combo.decision!=='SHADOW_ONLY'||combo.liveImported!==false)throw new Error('COMBO_BOUNDARY_INVALID');
const selected=(combo.selectedBeforeTest||[]).map((x,i)=>({rank:i+1,kind:x.kind,label:x.label,parts:x.parts}));
if(!selected.length)throw new Error('NO_PRETEST_SELECTION');

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

// Freeze prediction structure before opening RESULT. Candidate order comes from v0.33.9 pre-test selection.
const locked=(predictions.races||[]).map(x=>({id:`${x.d}|${x.r}`,date:String(x.d),race:Number(x.r),picks:[...(x.f||[])],f:features(x)}));
const trainSet=new Set(combo.split?.trainDates||[]), validationSet=new Set(combo.split?.validationDates||[]), testSet=new Set(combo.split?.testDates||[]);
if(!trainSet.size||!validationSet.size||!testSet.size)throw new Error('SPLIT_MISSING');

const result=JSON.parse(fs.readFileSync(RESULT,'utf8'));
if(result.predictionInputsIncluded!==false)throw new Error('RESULT_BOUNDARY_INVALID');
const byResult=new Map((result.races||[]).map(x=>[`${x.d}|${x.r}`,x]));
const rows=[];
for(const x of locked){
 const y=byResult.get(x.id);if(!y)continue;
 const payoutOdds=Number(y.x);
 const outcome=String(y.o||'');
 if(!outcome||!Number.isFinite(payoutOdds)||payoutOdds<0)continue;
 rows.push({...x,outcome,payoutOdds,exactHit:x.picks.includes(outcome),pickCount:x.picks.length});
}

const splitOf=x=>trainSet.has(x.date)?'train':validationSet.has(x.date)?'validation':testSet.has(x.date)?'test':null;
for(const x of rows)x.split=splitOf(x);
const usable=rows.filter(x=>x.split);
const splitRows={train:usable.filter(x=>x.split==='train'),validation:usable.filter(x=>x.split==='validation'),test:usable.filter(x=>x.split==='test')};

function moneyStats(rs,totalRaces){
 const tickets=rs.reduce((s,x)=>s+x.pickCount,0);
 const hits=rs.filter(x=>x.exactHit);
 const returnUnits=hits.reduce((s,x)=>s+x.payoutOdds,0);
 const stakeUnits=tickets;
 return {
  races:rs.length,
  raceCoverage:totalRaces?rs.length/totalRaces:0,
  tickets,
  stakeYenAt100PerTicket:stakeUnits*100,
  exactHits:hits.length,
  exactHitRate:rs.length?hits.length/rs.length:0,
  returnYenAt100PerTicket:Math.round(returnUnits*100),
  roi:stakeUnits?returnUnits/stakeUnits:0,
  profitYenAt100PerTicket:Math.round((returnUnits-stakeUnits)*100),
  averagePayoutOddsOnHit:hits.length?returnUnits/hits.length:0
 };
}
function matches(def,x){return (def.parts||[]).every(p=>String(x.f[p.name])===String(p.value));}
function evaluate(def){
 const out={rank:def.rank,kind:def.kind,label:def.label,parts:def.parts};
 for(const s of ['train','validation','test']){
  const base=splitRows[s];
  out[s]=moneyStats(base.filter(x=>matches(def,x)),base.length);
 }
 return out;
}

const baseline={};for(const s of ['train','validation','test'])baseline[s]=moneyStats(splitRows[s],splitRows[s].length);
const gates=selected.map(evaluate); // preserve pre-test rank; never sort on payout/TEST.
const primary=gates[0];
const report={
 schema:'boat-command-gamagori-roi-gate-analysis-v0340',analysisOnly:true,liveImported:false,decision:'SHADOW_ONLY',
 boundary:'Prediction picks and v0.33.9 candidate ordering are fixed before payout/result evaluation. Gates are not reordered by ROI or TEST. Equal 100-yen stake per frozen pick is used only as a neutral historical comparison.',
 sources:{predictions:PRED,results:RESULT,pretestSelection:COMBO},
 assumptions:{ticketStakeYen:100,payoutOddsField:'x',returnFormula:'100 yen * x only when the frozen exact order is in the frozen picks',stakeFormula:'100 yen * frozen pick count'},
 baseline,primaryPretestGate:primary,allPretestSelectedGates:gates,
 promotionRule:'Do not import into LIVE from this historical ROI report. Promotion requires fresh forward race-days with the gate frozen before race start.',
 note:'The final historical TEST was not used to create or rank the v0.33.9 candidates, but it has now been observed. Treat future race-days as the only pristine forward evidence.'
};
fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({baseline,primaryPretestGate:primary,gateCount:gates.length,decision:report.decision},null,2));
