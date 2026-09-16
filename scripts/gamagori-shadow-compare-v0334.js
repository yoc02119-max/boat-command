// BOAT COMMAND GAMAGORI SHADOW COMPARE v0.33.4 (Node reproducible report)
// Evaluation only. Uses the exact strict 360-race shadow target; predictions freeze before outcomes are read.
// CI rerun marker: strict-360-v2-20260916
'use strict';
const fs=require('fs');
const cand=require('../gamagori-candidate-model-v0334.js');
const PRED='gamagori-replay-predictions-v0333.json';
const RESULT='gamagori-replay-results-v0333.json';
const PRE='gamagori-shadow-pre-v0330.json';
const OUT=process.argv[2]||'gamagori-shadow-compare-v0334.json';
const key=x=>`${x.d}|${x.r}`;
function metrics(rows,name){
 let hits=0,stake=0,ret=0,firstLane1=0,allLane1=0,totalPicks=0,highN=0,highHits=0,highStake=0,highRet=0;
 for(const x of rows){const picks=x[name];const hit=picks.includes(x.result);hits+=Number(hit);stake+=picks.length;totalPicks+=picks.length;allLane1+=picks.filter(v=>v.startsWith('1-')).length;firstLane1+=Number(picks[0]?.startsWith('1-'));if(hit)ret+=x.odds;if(x.high){highN++;highHits+=Number(hit);highStake+=picks.length;if(hit)highRet+=x.odds;}}
 return {races:rows.length,hits,hitRate:hits/rows.length,roi:stake?ret/stake:0,firstLane1Rate:firstLane1/rows.length,lane1PickRate:totalPicks?allLane1/totalPicks:0,high:{races:highN,hits:highHits,hitRate:highN?highHits/highN:0,roi:highStake?highRet/highStake:0}};
}
const p=JSON.parse(fs.readFileSync(PRED,'utf8'));
const pre=JSON.parse(fs.readFileSync(PRE,'utf8'));
if(p.resultsIncluded!==false||p.payoutsIncluded!==false||p.exhibitionIncluded!==false||p.futureDataIncluded!==false)throw new Error('PRE_RACE_BOUNDARY_INVALID');
if(pre.outcomeFieldsIncluded!==false||pre.resultOddsIncluded!==false||pre.exhibitionIncluded!==false)throw new Error('SHADOW_PRE_BOUNDARY_INVALID');
const targets=[...(pre.races||[])].sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.race)-Number(b.race));
if(targets.length!==360)throw new Error(`TARGET_MUST_BE_360_GOT_${targets.length}`);
const predBy=new Map(p.races.map(x=>[key(x),x]));
// Freeze V1 and V2 for the exact same 360 target races before reading any outcome file.
const locked=targets.map(x=>{const id=`${x.date}|${x.race}`,v1=predBy.get(id);if(!v1)throw new Error(`V1_MISSING_${id}`);const program={classes:x.boats.map(b=>b.class),profiles:x.boats.map(b=>({racerWinRate:b.nationalWinRate,localWinRate:b.localWinRate,motor2Rate:b.motor2Rate,averageST:b.averageST}))};const v2=cand.predict(program,{count:4});return{id,v1:[...v1.f],v2:v2.fixed.map(z=>z.order),confidence:v2.confidence};});
const r=JSON.parse(fs.readFileSync(RESULT,'utf8'));
if(r.predictionInputsIncluded!==false)throw new Error('RESULT_BOUNDARY_INVALID');
const by=new Map(r.races.map(x=>[key(x),x]));
const scored=locked.map(x=>{const y=by.get(x.id);if(!y)throw new Error(`RESULT_MISSING_${x.id}`);return {...x,result:y.o,odds:Number(y.x),high:x.confidence.top4>=.35};});
const report={schema:'boat-command-shadow-compare-v0334',modelA:p.modelVersion,modelB:cand.version,races:locked.length,target:'exact strict 360-race shadow set',candidateInputs:'class + national/local win rate + motor2 + averageST; no exhibition',highRule:'Candidate V2 top4 probability >= 0.35',leakageGuard:'All 360 V1/V2 predictions frozen before result read',v1:metrics(scored,'v1'),v2:metrics(scored,'v2')};
report.delta={hitRate:report.v2.hitRate-report.v1.hitRate,roi:report.v2.roi-report.v1.roi,firstLane1Rate:report.v2.firstLane1Rate-report.v1.firstLane1Rate,lane1PickRate:report.v2.lane1PickRate-report.v1.lane1PickRate,highHitRate:report.v2.high.hitRate-report.v1.high.hitRate,highRoi:report.v2.high.roi-report.v1.high.roi};
fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
