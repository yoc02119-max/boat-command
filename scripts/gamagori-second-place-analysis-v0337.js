// BOAT COMMAND GAMAGORI second-place diagnostic v0.33.7
// ANALYSIS ONLY. Never imported by LIVE.
// Purpose: preserve the frozen first-place/head logic and measure where the tail fails.
'use strict';
const fs=require('fs');
const PRE='gamagori-shadow-pre-v0330.json';
const PRED='gamagori-replay-predictions-v0333.json';
const RESULT='gamagori-replay-results-v0333.json';
const OUT=process.argv[2]||'gamagori-second-place-analysis-v0337.json';
const pre=JSON.parse(fs.readFileSync(PRE,'utf8'));
if(pre.outcomeFieldsIncluded!==false||pre.resultOddsIncluded!==false||pre.exhibitionIncluded!==false)throw new Error('PRE_BOUNDARY_INVALID');
const predictions=JSON.parse(fs.readFileSync(PRED,'utf8'));
if(predictions.resultsIncluded!==false||predictions.payoutsIncluded!==false||predictions.exhibitionIncluded!==false||predictions.futureDataIncluded!==false)throw new Error('PRED_BOUNDARY_INVALID');
// Freeze every prediction before opening RESULT. No tuning or rewriting is permitted below this line.
const locked=(predictions.races||[]).map(x=>({id:`${x.d}|${x.r}`,date:x.d,race:Number(x.r),title:x.t||null,classes:x.c||[],picks:[...(x.f||[])]}));
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
 rows.push({...x,result:String(y.o),odds:Number(y.x)||0,winner,runnerUp,firstHeads,headCorrect,secondCandidates,secondHitGivenHead:headCorrect&&secondCandidates.includes(runnerUp),exactHit:x.picks.includes(String(y.o))});
}
const rate=(a,b)=>b?a/b:0;
const summarize=rs=>{const head=rs.filter(x=>x.headCorrect),second=head.filter(x=>x.secondHitGivenHead);return {races:rs.length,headCorrect:head.length,headRate:rate(head.length,rs.length),secondHitGivenHead:second.length,conditionalSecondRate:rate(second.length,head.length),exactHits:rs.filter(x=>x.exactHit).length,exactHitRate:rate(rs.filter(x=>x.exactHit).length,rs.length)};};
const byLane={};for(let lane=1;lane<=6;lane++)byLane[lane]=summarize(rows.filter(x=>x.winner===String(lane)));
const byRace={};for(let r=1;r<=12;r++)byRace[r]=summarize(rows.filter(x=>x.race===r));
const byTitle={};for(const t of [...new Set(rows.map(x=>x.title||'UNKNOWN'))])byTitle[t]=summarize(rows.filter(x=>(x.title||'UNKNOWN')===t));
const split=Math.floor(rows.length/2),design=rows.slice(0,split),holdout=rows.slice(split);
const report={schema:'boat-command-gamagori-second-place-analysis-v0337',analysisOnly:true,liveImported:false,boundary:'Predictions frozen before result file read. No exhibition, outcome, payout, same-race or future result data may enter prediction.',all:summarize(rows),design:summarize(design),holdout:summarize(holdout),byWinningLane:byLane,byRaceNumber:byRace,byProgramTitle:byTitle,secondMisses:rows.filter(x=>x.headCorrect&&!x.secondHitGivenHead).map(x=>({id:x.id,title:x.title,classes:x.classes,winner:x.winner,actualSecond:x.runnerUp,candidates:x.secondCandidates,picks:x.picks}))};
fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
