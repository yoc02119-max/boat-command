#!/usr/bin/env node
'use strict';
const fs=require('fs');

const input=process.argv[2]||'toda-history-bootstrap-v1.json';
const output=process.argv[3]||'toda-history-analysis-v1.json';
const db=JSON.parse(fs.readFileSync(input,'utf8'));
if(db.venueCode!=='02')throw new Error('TODA_HISTORY_TARGET_INVALID');
const rows=[...(db.races||[])].sort((a,b)=>String(a.d).localeCompare(String(b.d))||Number(a.r)-Number(b.r));
if(rows.length<300)throw new Error('TODA_HISTORY_MIN_300_REQUIRED');

const first=Array(7).fill(0),second=Array(7).fill(0),third=Array(7).fill(0);
const pair=Array.from({length:7},()=>Array(7).fill(0));
const orders=new Map(),byRace=new Map(),byType=new Map();
const payouts=[];
function validOrder(v){const s=String(v||'');return /^[1-6]-[1-6]-[1-6]$/.test(s)&&new Set(s.split('-')).size===3}
function bucket(map,key){
  if(!map.has(key))map.set(key,{races:0,first:Array(7).fill(0),payoutSum:0});
  return map.get(key);
}
for(const x of rows){
  if(!validOrder(x.o))throw new Error('INVALID_ORDER '+x.id);
  const [a,b,c]=String(x.o).split('-').map(Number),p=Number(x.p)||0;
  first[a]++;second[b]++;third[c]++;pair[a][b]++;orders.set(x.o,(orders.get(x.o)||0)+1);payouts.push(p);
  for(const [m,k] of [[byRace,String(x.r)],[byType,String(x.t||'UNKNOWN')]]){
    const z=bucket(m,k);z.races++;z.first[a]++;z.payoutSum+=p;
  }
}
const rate=a=>Object.fromEntries(Array.from({length:6},(_,i)=>[String(i+1),a[i+1]/rows.length]));
const pairRates={};
for(let a=1;a<=6;a++){
  const den=pair[a].reduce((x,y)=>x+y,0)||1;
  pairRates[String(a)]=Object.fromEntries(Array.from({length:6},(_,i)=>[String(i+1),i+1===a?0:pair[a][i+1]/den]));
}
function mapSummary(m){
  return Object.fromEntries([...m.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'ja',{numeric:true})).map(([k,v])=>[k,{
    races:v.races,
    lane1FirstRate:v.first[1]/v.races,
    lane2FirstRate:v.first[2]/v.races,
    centerFirstRate:(v.first[3]+v.first[4])/v.races,
    outerFirstRate:(v.first[5]+v.first[6])/v.races,
    averagePayout:v.payoutSum/v.races
  }]));
}
const probs=[...orders.values()].map(n=>n/rows.length);
const entropy=-probs.reduce((s,p)=>s+(p>0?p*Math.log2(p):0),0);
const days=new Set(rows.map(x=>x.d));
const report={
  schema:'boat-command-toda-history-analysis-v1',
  version:'TODA-HISTORY-ANALYSIS-V1',
  venue:'TODA',venueCode:'02',
  source:input,cutoff:db.cutoff||null,races:rows.length,raceDays:days.size,
  lane:{
    first:rate(first),second:rate(second),third:rate(third),
    lane1FirstRate:first[1]/rows.length,
    lane2FirstRate:first[2]/rows.length,
    insideFirstRate:(first[1]+first[2])/rows.length,
    centerFirstRate:(first[3]+first[4])/rows.length,
    outerFirstRate:(first[5]+first[6])/rows.length
  },
  firstToSecond:pairRates,
  byRaceNumber:mapSummary(byRace),
  byRaceType:mapSummary(byType),
  trifecta:{
    uniqueOrders:orders.size,
    entropyBits:entropy,
    top30:[...orders.entries()].sort((a,b)=>b[1]-a[1]).slice(0,30).map(([order,count])=>({order,count,rate:count/rows.length}))
  },
  payout:{
    average:payouts.reduce((a,b)=>a+b,0)/payouts.length,
    over10000Rate:payouts.filter(x=>x>=10000).length/payouts.length
  },
  modelPolicy:{
    productionEnabled:false,
    crossVenueWeightsReused:false,
    primaryRecencyWindowRaces:300,
    architecture:'TODA_EMPIRICAL_FIRST_SECOND_TRANSITION_PLUS_CLASS_NEIGHBORS',
    nextStage:'STRICT_TODA_WALK_FORWARD_BASELINE'
  }
};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({races:report.races,raceDays:report.raceDays,lane1:report.lane.lane1FirstRate,lane2:report.lane.lane2FirstRate,inside:report.lane.insideFirstRate,center:report.lane.centerFirstRate,outer:report.lane.outerFirstRate,entropyBits:report.trifecta.entropyBits},null,2));
