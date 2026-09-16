// BOAT COMMAND GAMAGORI Candidate V2 miss analysis v0.33.5
// Evaluation only. Freeze all predictions before reading outcomes. Never imported by LIVE.
'use strict';
const fs=require('fs');
const cand=require('../gamagori-candidate-model-v0334.js');
const PRE='gamagori-shadow-pre-v0330.json';
const RESULT='gamagori-replay-results-v0333.json';
const OUT=process.argv[2]||'gamagori-candidate-miss-analysis-v0335.json';
const pre=JSON.parse(fs.readFileSync(PRE,'utf8'));
if(pre.outcomeFieldsIncluded!==false||pre.resultOddsIncluded!==false||pre.exhibitionIncluded!==false) throw new Error('PRE_BOUNDARY_INVALID');
const targets=[...(pre.races||[])].sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.race)-Number(b.race));
if(targets.length!==360) throw new Error(`TARGET_MUST_BE_360_GOT_${targets.length}`);
const cls={A1:3,A2:2,B1:1,B2:0};
const avg=a=>a.reduce((s,v)=>s+v,0)/a.length;
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const buildProgram=x=>({classes:x.boats.map(b=>b.class),profiles:x.boats.map(b=>({racerWinRate:b.nationalWinRate,localWinRate:b.localWinRate,motor2Rate:b.motor2Rate,averageST:b.averageST}))});
const features=x=>{const b=x.boats;const lane1=b[0];const others=b.slice(1);return {lane1Class:cls[lane1.class]??0,classGap:(cls[lane1.class]??0)-avg(others.map(z=>cls[z.class]??0)),nationalGap:n(lane1.nationalWinRate)-avg(others.map(z=>n(z.nationalWinRate))),localGap:n(lane1.localWinRate)-avg(others.map(z=>n(z.localWinRate))),motorGap:n(lane1.motor2Rate)-avg(others.map(z=>n(z.motor2Rate))),stEdge:avg(others.map(z=>n(z.averageST)))-n(lane1.averageST)};};
// HARD evaluation boundary: every V2 prediction is frozen before RESULT is opened.
const locked=targets.map((x,i)=>{const p=cand.predict(buildProgram(x),{count:4});return {id:`${x.date}|${x.race}`,index:i,picks:p.fixed.map(z=>z.order),confidence:p.confidence,features:features(x)};});
const results=JSON.parse(fs.readFileSync(RESULT,'utf8'));
if(results.predictionInputsIncluded!==false) throw new Error('RESULT_BOUNDARY_INVALID');
const by=new Map(results.races.map(x=>[`${x.d}|${x.r}`,x]));
const rows=locked.map(x=>{const y=by.get(x.id);if(!y)throw new Error(`RESULT_MISSING_${x.id}`);const result=String(y.o), parts=result.split('-'), heads=[...new Set(x.picks.map(p=>p[0]))], hit=x.picks.includes(result), winner=parts[0];let missType='HIT';if(!hit){if(!heads.includes(winner)) missType='WINNER_HEAD_MISSED';else missType='HEAD_RIGHT_TAIL_WRONG';if(winner==='1'&&!heads.includes('1')) missType='LANE1_FALSE_NEGATIVE';if(winner!=='1'&&heads.length===1&&heads[0]==='1') missType='LANE1_FALSE_POSITIVE';}return {...x,result,odds:n(y.x),hit,winner,heads,missType};});
const summarize=rs=>({races:rs.length,hits:rs.filter(x=>x.hit).length,hitRate:rs.length?rs.filter(x=>x.hit).length/rs.length:0,avgTop1:rs.length?avg(rs.map(x=>n(x.confidence.top1))):0,avgTop4:rs.length?avg(rs.map(x=>n(x.confidence.top4))):0,features:Object.fromEntries(['lane1Class','classGap','nationalGap','localGap','motorGap','stEdge'].map(k=>[k,rs.length?avg(rs.map(x=>n(x.features[k]))):0]))});
const missCounts={};for(const x of rows.filter(x=>!x.hit)) missCounts[x.missType]=(missCounts[x.missType]||0)+1;
const winnerBuckets={};for(let w=1;w<=6;w++){const z=rows.filter(x=>x.winner===String(w));winnerBuckets[w]=summarize(z);}
const split=Math.floor(rows.length/2),design=rows.slice(0,split),holdout=rows.slice(split);
const report={schema:'boat-command-gamagori-candidate-miss-analysis-v0335',model:cand.version,races:rows.length,boundary:'All 360 Candidate V2 predictions frozen before result file read; PRE has no outcomes/odds/exhibition.',all:summarize(rows),hits:summarize(rows.filter(x=>x.hit)),misses:summarize(rows.filter(x=>!x.hit)),missTaxonomy:missCounts,winnerBuckets,design:summarize(design),holdout:summarize(holdout),designMissTaxonomy:Object.fromEntries(Object.entries(missCounts).map(([k])=>[k,design.filter(x=>!x.hit&&x.missType===k).length])),holdoutMissTaxonomy:Object.fromEntries(Object.entries(missCounts).map(([k])=>[k,holdout.filter(x=>!x.hit&&x.missType===k).length]))};
fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
