// BOAT COMMAND GAMAGORI SHADOW COMPARE v0.33.4
// Evaluation only. Prediction files are loaded before results; Candidate V2 never receives results/odds.
(()=>{'use strict';
const VERSION='GAMAGORI-SHADOW-COMPARE-V0.33.4';
const PRED='./gamagori-replay-predictions-v0333.json?v=333';
const RESULT='./gamagori-replay-results-v0333.json?v=333';
const CAND='./gamagori-candidate-model-v0334.js?v=334';
const key=x=>`${x.d}|${x.r}`;
const pct=x=>`${(100*x).toFixed(1)}%`;
async function get(url){const r=await fetch(url,{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw new Error(`HTTP_${r.status}`);return r.json()}
async function ensureCandidate(){if(globalThis.BOAT_COMMAND_GAMAGORI_CANDIDATE_V0334)return globalThis.BOAT_COMMAND_GAMAGORI_CANDIDATE_V0334;await new Promise((ok,no)=>{const s=document.createElement('script');s.src=CAND;s.onload=ok;s.onerror=()=>no(new Error('CANDIDATE_LOAD_FAILED'));document.head.appendChild(s)});return globalThis.BOAT_COMMAND_GAMAGORI_CANDIDATE_V0334}
function metrics(rows,name){
 let hits=0,stake=0,ret=0,firstLane1=0,allLane1=0,totalPicks=0,highN=0,highHits=0,highStake=0,highRet=0;
 for(const x of rows){const picks=x[name];const hit=picks.includes(x.result);hits+=hit;stake+=picks.length;totalPicks+=picks.length;allLane1+=picks.filter(v=>v.startsWith('1-')).length;firstLane1+=picks[0]?.startsWith('1-')?1:0;if(hit)ret+=x.odds;
  if(x.high){highN++;const hh=hit;highHits+=hh;highStake+=picks.length;if(hh)highRet+=x.odds;}
 }
 return {races:rows.length,hits,hitRate:hits/rows.length,roi:stake?ret/stake:0,firstLane1Rate:firstLane1/rows.length,lane1PickRate:totalPicks?allLane1/totalPicks:0,high:{races:highN,hits:highHits,hitRate:highN?highHits/highN:0,roi:highStake?highRet/highStake:0}};
}
async function run(){
 // Boundary 1: load only PRE-RACE predictions and build both prediction sets.
 const [p,cand]=await Promise.all([get(PRED),ensureCandidate()]);
 if(p.resultsIncluded!==false||p.payoutsIncluded!==false||p.exhibitionIncluded!==false||p.futureDataIncluded!==false)throw new Error('PRE_RACE_BOUNDARY_INVALID');
 const locked=p.races.map(x=>{const v2=cand.predict({classes:x.c},{count:4});return {id:key(x),date:x.d,race:x.r,v1:[...x.f],v2:v2.fixed.map(z=>z.order),confidence:v2.confidence};});
 if(locked.length!==360)throw new Error(`EXPECTED_360_GOT_${locked.length}`);
 // Boundary 2: only after all 360 prediction sets are frozen do we fetch outcomes.
 const r=await get(RESULT);if(r.predictionInputsIncluded!==false)throw new Error('RESULT_BOUNDARY_INVALID');const by=new Map(r.races.map(x=>[key(x),x]));
 const scored=locked.map(x=>{const y=by.get(x.id);if(!y)throw new Error(`RESULT_MISSING_${x.id}`);return {...x,result:y.o,odds:Number(y.x),high:x.confidence.top4>=.35};});
 const report={schema:'boat-command-shadow-compare-v0334',version:VERSION,modelA:p.modelVersion,modelB:cand.version,highRule:'Candidate V2 top4 probability >= 0.35',leakageGuard:'All 360 V1/V2 predictions frozen before result fetch',v1:metrics(scored,'v1'),v2:metrics(scored,'v2')};
 report.delta={hitRate:report.v2.hitRate-report.v1.hitRate,roi:report.v2.roi-report.v1.roi,firstLane1Rate:report.v2.firstLane1Rate-report.v1.firstLane1Rate,lane1PickRate:report.v2.lane1PickRate-report.v1.lane1PickRate,highHitRate:report.v2.high.hitRate-report.v1.high.hitRate,highRoi:report.v2.high.roi-report.v1.high.roi};
 return report;
}
function text(r){const line=(n,x)=>`${n}｜4点的中 ${x.hits}/${x.races} (${pct(x.hitRate)})｜回収率 ${pct(x.roi)}｜1頭率 ${pct(x.firstLane1Rate)}｜4点内1頭比率 ${pct(x.lane1PickRate)}｜HIGH ${x.high.hits}/${x.high.races} (${pct(x.high.hitRate)}) ROI ${pct(x.high.roi)}`;return [line('現行',r.v1),line('V2',r.v2),`差分 V2-現行｜的中 ${pct(r.delta.hitRate)}｜ROI ${pct(r.delta.roi)}｜1頭率 ${pct(r.delta.firstLane1Rate)}｜HIGH的中 ${pct(r.delta.highHitRate)}`].join('\n')}
globalThis.BOAT_COMMAND_SHADOW_COMPARE_V0334=Object.freeze({version:VERSION,run,text});
})();
