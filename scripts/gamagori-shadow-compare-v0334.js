// BOAT COMMAND GAMAGORI SHADOW COMPARE v0.33.4 (Node reproducible report)
// Evaluation only. Both model prediction sets are frozen before outcomes are read.
'use strict';
const fs=require('fs');
const cand=require('../gamagori-candidate-model-v0334.js');
const PRED='gamagori-replay-predictions-v0333.json';
const RESULT='gamagori-replay-results-v0333.json';
const OUT=process.argv[2]||'gamagori-shadow-compare-v0334.json';
const key=x=>`${x.d}|${x.r}`;
function metrics(rows,name){
 let hits=0,stake=0,ret=0,firstLane1=0,allLane1=0,totalPicks=0,highN=0,highHits=0,highStake=0,highRet=0;
 for(const x of rows){const picks=x[name];const hit=picks.includes(x.result);hits+=Number(hit);stake+=picks.length;totalPicks+=picks.length;allLane1+=picks.filter(v=>v.startsWith('1-')).length;firstLane1+=Number(picks[0]?.startsWith('1-'));if(hit)ret+=x.odds;if(x.high){highN++;highHits+=Number(hit);highStake+=picks.length;if(hit)highRet+=x.odds;}}
 return {races:rows.length,hits,hitRate:hits/rows.length,roi:stake?ret/stake:0,firstLane1Rate:firstLane1/rows.length,lane1PickRate:totalPicks?allLane1/totalPicks:0,high:{races:highN,hits:highHits,hitRate:highN?highHits/highN:0,roi:highStake?highRet/highStake:0}};
}
const p=JSON.parse(fs.readFileSync(PRED,'utf8'));
if(p.resultsIncluded!==false||p.payoutsIncluded!==false||p.exhibitionIncluded!==false||p.futureDataIncluded!==false)throw new Error('PRE_RACE_BOUNDARY_INVALID');
const locked=p.races.map(x=>{const v2=cand.predict({classes:x.c},{count:4});return {id:key(x),v1:[...x.f],v2:v2.fixed.map(z=>z.order),confidence:v2.confidence};});
if(locked.length!==360)throw new Error(`EXPECTED_360_GOT_${locked.length}`);
// Outcomes are deliberately loaded only after all 360 V1/V2 predictions are frozen above.
const r=JSON.parse(fs.readFileSync(RESULT,'utf8'));
if(r.predictionInputsIncluded!==false)throw new Error('RESULT_BOUNDARY_INVALID');
const by=new Map(r.races.map(x=>[key(x),x]));
const scored=locked.map(x=>{const y=by.get(x.id);if(!y)throw new Error(`RESULT_MISSING_${x.id}`);return {...x,result:y.o,odds:Number(y.x),high:x.confidence.top4>=.35};});
const report={schema:'boat-command-shadow-compare-v0334',modelA:p.modelVersion,modelB:cand.version,races:locked.length,highRule:'Candidate V2 top4 probability >= 0.35',leakageGuard:'All 360 V1/V2 predictions frozen before result read',v1:metrics(scored,'v1'),v2:metrics(scored,'v2')};
report.delta={hitRate:report.v2.hitRate-report.v1.hitRate,roi:report.v2.roi-report.v1.roi,firstLane1Rate:report.v2.firstLane1Rate-report.v1.firstLane1Rate,lane1PickRate:report.v2.lane1PickRate-report.v1.lane1PickRate,highHitRate:report.v2.high.hitRate-report.v1.high.hitRate,highRoi:report.v2.high.roi-report.v1.high.roi};
fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
