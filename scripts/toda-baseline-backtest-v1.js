#!/usr/bin/env node
'use strict';
const fs=require('fs');

const input=process.argv[2]||'toda-history-bootstrap-v1.json';
const output=process.argv[3]||'toda-baseline-backtest-v1.json';
const db=JSON.parse(fs.readFileSync(input,'utf8'));
if(db.venueCode!=='02')throw new Error('TODA_ONLY');
const rows=[...(db.races||[])].sort((a,b)=>String(a.d).localeCompare(String(b.d))||Number(a.r)-Number(b.r));
if(rows.length<300)throw new Error('INSUFFICIENT_HISTORY');

const CLASS={A1:3,A2:2,B1:1,B2:0};
const ORDERS=[];for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)if(a!==b&&a!==c&&b!==c)ORDERS.push(`${a}-${b}-${c}`);
const valid=x=>Array.isArray(x?.c)&&x.c.length===6&&x.c.every(c=>Object.hasOwn(CLASS,c))&&/^[1-6]-[1-6]-[1-6]$/.test(String(x.o||''));
function bucket(r){r=Number(r)||0;return r<=4?'EARLY':r<=8?'MIDDLE':'LATE'}
function typeGroup(s){s=String(s||'');if(/優勝/.test(s))return'FINAL';if(/準優/.test(s))return'SEMI';if(/ドリーム/.test(s))return'DREAM';if(/選抜/.test(s))return'SELECT';if(/特選|特賞/.test(s))return'SPECIAL';if(/予選/.test(s))return'QUALIFY';if(/一般/.test(s))return'GENERAL';return'UNKNOWN'}
function classDistance(a,b){
  let d=0;for(let i=0;i<6;i++)d+=(i<2?1.2:i<4?1:.9)*Math.abs(CLASS[a.c[i]]-CLASS[b.c[i]]);
  d+=Number(a.r)===Number(b.r)?0:(bucket(a.r)===bucket(b.r)?.4:.85);
  const x=typeGroup(a.t),y=typeGroup(b.t);if(x!=='UNKNOWN'&&y!=='UNKNOWN'&&x!==y)d+=.75;
  return d;
}
function empirical(target,history,cfg){
  const safe=history.filter(valid).slice(-cfg.recencyWindow);
  if(safe.length<120)return[];
  const first=Array(7).fill(cfg.laplace), pair=Array.from({length:7},()=>Array(7).fill(cfg.laplace)), third=Array(7).fill(cfg.laplace);
  for(const x of safe){const [a,b,c]=x.o.split('-').map(Number);first[a]++;pair[a][b]++;third[c]++}
  const classBoost=target.c.map(c=>Math.exp(cfg.classScale*CLASS[c]));
  const firstRaw=Array(7).fill(0);let firstDen=0;
  for(let a=1;a<=6;a++){firstRaw[a]=first[a]*classBoost[a-1];firstDen+=firstRaw[a]}
  const transition=new Map();
  for(let a=1;a<=6;a++){
    let den=0;const v=Array(7).fill(0);
    for(let b=1;b<=6;b++)if(b!==a){v[b]=pair[a][b]*Math.sqrt(classBoost[b-1]);den+=v[b]}
    transition.set(a,{v,den});
  }
  let thirdDen=0;const thirdRaw=Array(7).fill(0);
  for(let c=1;c<=6;c++){thirdRaw[c]=third[c]*Math.pow(classBoost[c-1],.35);thirdDen+=thirdRaw[c]}
  const base=new Map();
  for(const o of ORDERS){
    const [a,b,c]=o.split('-').map(Number),tr=transition.get(a);
    const p1=firstRaw[a]/firstDen,p2=tr.v[b]/tr.den;
    let remDen=thirdDen-thirdRaw[a]-thirdRaw[b];
    const p3=remDen>0?thirdRaw[c]/remDen:0;
    base.set(o,p1*p2*p3);
  }
  const neighbors=safe.map(x=>({x,d:classDistance(target,x)})).sort((a,b)=>a.d-b.d).slice(0,cfg.neighborLimit);
  const local=new Map();let mass=0;
  for(const n of neighbors){const w=Math.exp(-cfg.decay*n.d);local.set(n.x.o,(local.get(n.x.o)||0)+w);mass+=w}
  const rowsOut=ORDERS.map(order=>{
    const localP=mass>0?(local.get(order)||0)/mass:0;
    return{order,p:(1-cfg.neighborMix)*(base.get(order)||0)+cfg.neighborMix*localP};
  });
  const sum=rowsOut.reduce((s,x)=>s+x.p,0)||1;
  return rowsOut.map(x=>({order:x.order,p:x.p/sum})).sort((a,b)=>b.p-a.p);
}
const configs=[];
for(const recencyWindow of [300,480])
for(const classScale of [.18,.28,.38])
for(const neighborMix of [.25,.45,.65])
configs.push({recencyWindow,classScale,neighborMix,neighborLimit:240,decay:.55,laplace:1});

function evaluate(cfg,targets){
  const ids=new Set(targets.map(x=>x.id)),rec=[];let history=[],day=null,dayRows=[];
  const flush=()=>{if(!dayRows.length)return;if(history.length>=120){for(const t of dayRows)if(ids.has(t.id)){const d=empirical(t,history,cfg);rec.push({id:t.id,d:t.d,r:t.r,actual:t.o,payout:Number(t.p)||0,picks:d.slice(0,6).map(x=>x.order)})}}history=history.concat(dayRows);dayRows=[]};
  for(const row of rows){if(day!==null&&row.d!==day)flush();day=row.d;dayRows.push(row)}flush();return rec;
}
function metrics(rec,count){
  let hits=0,returns=0;for(const x of rec){if(x.picks.slice(0,count).includes(x.actual)){hits++;returns+=x.payout}}
  const stake=rec.length*count*100;return{races:rec.length,hits,hitRate:rec.length?hits/rec.length:0,stake,returns,roi:stake?returns/stake:0};
}
const dates=[...new Set(rows.map(x=>x.d))].sort(),cut=Math.max(1,Math.floor(dates.length*.7)),calEnd=dates[cut-1],holdStart=dates[cut];
const calibrationTargets=rows.filter(x=>x.d<=calEnd),holdoutTargets=rows.filter(x=>x.d>=holdStart);
const calibration=configs.map(cfg=>{const rec=evaluate(cfg,calibrationTargets),m4=metrics(rec,4);return{cfg,m4,score:.7*m4.hitRate+.3*Math.min(m4.roi,2)}}).sort((a,b)=>b.score-a.score||b.m4.hitRate-a.m4.hitRate);
const best=calibration[0],hold=evaluate(best.cfg,holdoutTargets),all=evaluate(best.cfg,rows);
const report={
  schema:'boat-command-toda-baseline-backtest-v1',version:'TODA-BASELINE-BACKTEST-V1',
  venue:'TODA',venueCode:'02',source:input,
  strictWalkForward:true,sameDayRowsExcluded:true,resultBlockedUntilPrediction:true,crossVenueWeightsReused:false,
  architecture:'TODA_EMPIRICAL_FIRST_SECOND_TRANSITION_PLUS_CLASS_NEIGHBORS',
  calibration:{lastDate:calEnd,dateCount:cut,selected:best.cfg,candidates:calibration.map(x=>({config:x.cfg,metrics4:x.m4,score:x.score}))},
  holdout:{firstDate:holdStart,dateCount:dates.length-cut,pointCounts:Object.fromEntries([1,2,3,4,5,6].map(n=>[String(n),metrics(hold,n)])),metrics4:metrics(hold,4)},
  allWalkForward:{pointCounts:Object.fromEntries([1,2,3,4,5,6].map(n=>[String(n),metrics(all,n)]))},
  productionEnabled:false,tryEnabled:false,promotionEligible:false,
  promotionBlockers:['TODA_FORWARD_36_RACES_NOT_READY','TODA_FORWARD_60_RACES_NOT_READY','TODA_VENUE_FEATURES_NOT_FORWARD_VALIDATED']
};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({selected:best.cfg,calibration4:best.m4,holdout4:report.holdout.metrics4},null,2));
