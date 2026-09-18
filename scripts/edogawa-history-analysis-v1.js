#!/usr/bin/env node
'use strict';
const fs=require('fs');

const input=process.argv[2]||'edogawa-history-bootstrap-v1.json';
const output=process.argv[3]||'edogawa-history-analysis-v1.json';
const db=JSON.parse(fs.readFileSync(input,'utf8'));
const rows=[...(db.races||[])].sort((a,b)=>String(a.d).localeCompare(String(b.d))||Number(a.r)-Number(b.r));
if(db.venueCode!=='03')throw new Error('EDOGAWA_HISTORY_TARGET_INVALID');
if(!rows.length)throw new Error('EDOGAWA_HISTORY_EMPTY');

const orders=new Map(), raceNo=new Map(), raceType=new Map(), aCount=new Map();
const first=[0,0,0,0,0,0,0],second=[0,0,0,0,0,0,0],third=[0,0,0,0,0,0,0];
const payouts=[];
const classWin={A1:0,A2:0,B1:0,B2:0};
const classStarts={A1:0,A2:0,B1:0,B2:0};

function bucket(map,key){
  if(!map.has(key))map.set(key,{races:0,lane1Wins:0,outerWins:0,payoutSum:0,payouts:[]});
  return map.get(key);
}
for(const x of rows){
  const parts=String(x.o||'').split('-').map(Number);
  if(parts.length!==3||new Set(parts).size!==3||parts.some(n=>n<1||n>6))throw new Error('INVALID_ORDER '+x.id);
  const p=Number(x.p)||0;if(p<0)throw new Error('INVALID_PAYOUT '+x.id);
  payouts.push(p);
  first[parts[0]]++;second[parts[1]]++;third[parts[2]]++;
  orders.set(x.o,(orders.get(x.o)||0)+1);

  const rn=bucket(raceNo,String(x.r));rn.races++;rn.lane1Wins+=parts[0]===1?1:0;rn.outerWins+=parts[0]>=4?1:0;rn.payoutSum+=p;rn.payouts.push(p);
  const rt=bucket(raceType,String(x.t||'UNKNOWN'));rt.races++;rt.lane1Wins+=parts[0]===1?1:0;rt.outerWins+=parts[0]>=4?1:0;rt.payoutSum+=p;rt.payouts.push(p);

  const cls=Array.isArray(x.c)?x.c:[];
  const ac=cls.filter(c=>c==='A1'||c==='A2').length;
  const ab=bucket(aCount,String(ac));ab.races++;ab.lane1Wins+=parts[0]===1?1:0;ab.outerWins+=parts[0]>=4?1:0;ab.payoutSum+=p;ab.payouts.push(p);
  for(const c of cls)if(classStarts[c]!=null)classStarts[c]++;
  const wc=cls[parts[0]-1];if(classWin[wc]!=null)classWin[wc]++;
}
const sortedP=[...payouts].sort((a,b)=>a-b);
const q=f=>sortedP[Math.min(sortedP.length-1,Math.max(0,Math.floor((sortedP.length-1)*f)))];
const summarize=m=>Object.fromEntries([...m.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'ja',{numeric:true})).map(([k,v])=>[k,{
  races:v.races,
  lane1WinRate:v.races?v.lane1Wins/v.races:0,
  outerFirstRate:v.races?v.outerWins/v.races:0,
  averagePayout:v.races?v.payoutSum/v.races:0,
  medianPayout:v.payouts.length?[...v.payouts].sort((a,b)=>a-b)[Math.floor((v.payouts.length-1)/2)]:0
}]));

const days=new Map();
for(const r of rows)days.set(r.d,(days.get(r.d)||0)+1);
const report={
  schema:'boat-command-edogawa-history-analysis-v1',
  venue:'EDOGAWA',venueCode:'03',
  source:input,
  cutoff:db.cutoff||null,
  races:rows.length,
  raceDays:days.size,
  partialOrCancelledDays:[...days.values()].filter(n=>n!==12).length,
  lane:{
    first:Object.fromEntries(Array.from({length:6},(_,i)=>[String(i+1),first[i+1]/rows.length])),
    second:Object.fromEntries(Array.from({length:6},(_,i)=>[String(i+1),second[i+1]/rows.length])),
    third:Object.fromEntries(Array.from({length:6},(_,i)=>[String(i+1),third[i+1]/rows.length])),
    lane1FirstRate:first[1]/rows.length,
    outerFirstRate:(first[4]+first[5]+first[6])/rows.length
  },
  payout:{
    average:payouts.reduce((a,b)=>a+b,0)/payouts.length,
    median:q(.5),p75:q(.75),p90:q(.9),p95:q(.95),
    over10000Rate:payouts.filter(x=>x>=10000).length/payouts.length,
    over50000Rate:payouts.filter(x=>x>=50000).length/payouts.length
  },
  topTrifecta:[...orders.entries()].sort((a,b)=>b[1]-a[1]).slice(0,30).map(([order,count])=>({order,count,rate:count/rows.length})),
  byRaceNumber:summarize(raceNo),
  byRaceType:summarize(raceType),
  byACount:summarize(aCount),
  winnerClassShare:Object.fromEntries(Object.keys(classWin).map(k=>[k,classWin[k]/rows.length])),
  classStartShare:Object.fromEntries(Object.keys(classStarts).map(k=>[k,classStarts[k]/(rows.length*6)])),
  modelPolicy:{
    productionEnabled:false,
    gamagoriWeightsReused:false,
    nextStage:'ADD_EDOGAWA_WATER_AND_LOCAL_EXPERIENCE_FEATURES'
  }
};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({races:report.races,raceDays:report.raceDays,lane1FirstRate:report.lane.lane1FirstRate,outerFirstRate:report.lane.outerFirstRate,medianPayout:report.payout.median,nextStage:report.modelPolicy.nextStage},null,2));
