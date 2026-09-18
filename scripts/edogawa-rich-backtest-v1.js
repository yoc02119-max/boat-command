#!/usr/bin/env node
'use strict';
const fs=require('fs');

const input=process.argv[2]||'edogawa-rich-history-v1.json';
const output=process.argv[3]||'edogawa-rich-backtest-v1.json';
const db=JSON.parse(fs.readFileSync(input,'utf8'));
if(db.venueCode!=='03')throw new Error('EDOGAWA_ONLY');
const rows=[...(db.races||[])].sort((a,b)=>String(a.d).localeCompare(String(b.d))||Number(a.r)-Number(b.r));
if(rows.length<500)throw new Error('RICH_HISTORY_INSUFFICIENT');

const CLASS={A1:3,A2:2,B1:1,B2:0};
const laneW=[1.28,1.16,1.08,1,.94,.9];
const validO=x=>/^[1-6]-[1-6]-[1-6]$/.test(String(x||''))&&new Set(String(x).split('-')).size===3;
const typeGroup=s=>{
 s=String(s||'');
 if(/優勝/.test(s))return'FINAL';if(/準優/.test(s))return'SEMI';if(/ドリーム/.test(s))return'DREAM';
 if(/選抜|記者選抜/.test(s))return'SELECT';if(/特選|特賞/.test(s))return'SPECIAL';
 if(/予選/.test(s))return'QUALIFY';if(/一般/.test(s))return'GENERAL';return'UNKNOWN';
};
const num=v=>Number.isFinite(Number(v))?Number(v):null;
function validRow(r){
 return r&&Array.isArray(r.boats)&&r.boats.length===6&&validO(r.o)&&r.boats.every((b,i)=>
  Number(b.lane)===i+1&&Object.hasOwn(CLASS,String(b.class))&&
  ['nationalWinRate','national2Rate','localWinRate','local2Rate','motor2Rate','boat2Rate'].every(k=>num(b[k])!=null)
 );
}
function ndiff(a,b,scale){return Math.abs(a-b)/scale}
function distance(a,b,p){
 let d=0;
 for(let i=0;i<6;i++){
  const x=a.boats[i],y=b.boats[i],lw=laneW[i];
  d+=lw*p.classW*Math.abs(CLASS[x.class]-CLASS[y.class]);
  d+=lw*p.abilityW*ndiff(x.nationalWinRate,y.nationalWinRate,3);
  d+=lw*p.abilityW*.8*ndiff(x.national2Rate,y.national2Rate,.4);
  d+=lw*p.localW*ndiff(x.localWinRate,y.localWinRate,3);
  d+=lw*p.localW*.9*ndiff(x.local2Rate,y.local2Rate,.4);
  const xdw=(x.localWinRate-x.nationalWinRate),ydw=(y.localWinRate-y.nationalWinRate);
  const xd2=(x.local2Rate-x.national2Rate),yd2=(y.local2Rate-y.national2Rate);
  d+=lw*p.localW*.35*ndiff(xdw,ydw,3);
  d+=lw*p.localW*.35*ndiff(xd2,yd2,.4);
  d+=lw*p.motorW*ndiff(x.motor2Rate,y.motor2Rate,.4);
  d+=lw*p.boatW*ndiff(x.boat2Rate,y.boat2Rate,.4);
 }
 if(Number(a.r)!==Number(b.r))d+=p.racePenalty;
 if(typeGroup(a.t)!==typeGroup(b.t))d+=p.typePenalty;
 return d;
}
function add(m,k,w){m.set(k,(m.get(k)||0)+w)}
function distribution(target,history,p){
 const safe=history.filter(x=>validRow(x)&&String(x.d)<String(target.d));
 if(safe.length<120)return[];
 const global=new Map();
 for(const x of safe)add(global,x.o,1);
 const nearest=safe.map(x=>({x,d:distance(target,x,p)})).sort((a,b)=>a.d-b.d).slice(0,p.neighbors);
 const score=new Map();
 const gt=safe.length||1;
 for(const [o,n] of global)add(score,o,p.globalMass*n/gt);
 for(const n of nearest)add(score,n.x.o,Math.exp(-p.decay*n.d));
 const total=[...score.values()].reduce((a,b)=>a+b,0);
 return [...score.entries()].map(([order,v])=>({order,p:v/total})).sort((a,b)=>b.p-a.p);
}
function walk(p,targetRows){
 const ids=new Set(targetRows.map(x=>x.id));let history=[],day=null,buf=[],rec=[];
 const flush=()=>{
  if(!buf.length)return;
  if(history.length>=120){
   for(const t of buf){
    if(!ids.has(t.id))continue;
    const d=distribution(t,history,p);
    rec.push({id:t.id,d:t.d,r:t.r,actual:t.o,payout:Number(t.p)||0,picks:d.slice(0,8).map(x=>x.order)});
   }
  }
  history=history.concat(buf);buf=[];
 };
 for(const r of rows){if(day!==null&&r.d!==day)flush();day=r.d;buf.push(r)}flush();
 return rec;
}
function metrics(rec,n){
 let hits=0,ret=0;
 for(const x of rec){if(x.picks.slice(0,n).includes(x.actual)){hits++;ret+=x.payout}}
 const stake=rec.length*n*100;
 return{races:rec.length,hits,hitRate:rec.length?hits/rec.length:0,stake,returns:ret,roi:stake?ret/stake:0};
}
const dates=[...new Set(rows.map(x=>x.d))].sort();
const cut=Math.floor(dates.length*.7),calEnd=dates[cut-1],holdStart=dates[cut];
const cal=rows.filter(x=>x.d<=calEnd),hold=rows.filter(x=>x.d>=holdStart);

const profiles=[
 {name:'BALANCED',classW:1.0,abilityW:.5,localW:.75,motorW:.45,boatW:.2},
 {name:'LOCAL_HEAVY',classW:.8,abilityW:.35,localW:1.25,motorW:.4,boatW:.15},
 {name:'MOTOR_HEAVY',classW:.85,abilityW:.4,localW:.75,motorW:.9,boatW:.3},
 {name:'CLASS_HEAVY',classW:1.45,abilityW:.3,localW:.5,motorW:.3,boatW:.12},
 {name:'ABILITY_HEAVY',classW:.8,abilityW:.95,localW:.55,motorW:.3,boatW:.12},
 {name:'LOCAL_MOTOR',classW:.75,abilityW:.35,localW:1.05,motorW:.75,boatW:.2}
];
const configs=[];
for(const z of profiles)
 for(const neighbors of [60,120,240])
  for(const decay of [.3,.5,.75])
   configs.push({...z,neighbors,decay,racePenalty:.5,typePenalty:.65,globalMass:18});

const tested=[];
for(const p of configs){
 const rec=walk(p,cal),m4=metrics(rec,4),m6=metrics(rec,6);
 const score=.62*m4.hitRate+.25*Math.min(m4.roi,1.5)+.13*m6.hitRate;
 tested.push({config:p,m4,m6,score});
}
tested.sort((a,b)=>b.score-a.score||b.m4.hitRate-a.m4.hitRate||b.m4.roi-a.m4.roi);
const best=tested[0];
const holdRec=walk(best.config,hold),allRec=walk(best.config,rows);
const pointCounts=rec=>Object.fromEntries(Array.from({length:8},(_,i)=>[String(i+1),metrics(rec,i+1)]));
const baseline=fs.existsSync('edogawa-baseline-backtest-v1.json')?JSON.parse(fs.readFileSync('edogawa-baseline-backtest-v1.json','utf8')):null;
const base4=baseline?.holdout?.pointCounts?.['4']||baseline?.holdout?.metrics4||null;
const rich4=pointCounts(holdRec)['4'];

const out={
 schema:'boat-command-edogawa-rich-backtest-v1',
 venue:'EDOGAWA',venueCode:'03',source:input,
 strictWalkForward:true,sameDayRowsExcluded:true,resultBlockedUntilPrediction:true,
 featureScope:['laneClass','nationalWinRate','national2Rate','localWinRate','local2Rate','localVsNationalDelta','motor2Rate','boat2Rate','raceNumber','raceType'],
 calibration:{lastDate:calEnd,dateCount:cut,selected:best.config,selected4:best.m4,selected6:best.m6,topCandidates:tested.slice(0,20)},
 holdout:{firstDate:holdStart,dateCount:dates.length-cut,pointCounts:pointCounts(holdRec)},
 allWalkForward:{pointCounts:pointCounts(allRec)},
 comparisonToClassBaseline:{
  baseline4:base4,
  rich4,
  hitRateDelta:base4?rich4.hitRate-base4.hitRate:null,
  roiDelta:base4?rich4.roi-base4.roi:null,
  beatsBaselineOnHitRate:base4?rich4.hitRate>base4.hitRate:null,
  beatsBaselineOnRoi:base4?rich4.roi>base4.roi:null
 },
 productionEnabled:false,tryEnabled:false,promotionEligible:false,
 promotionBlockers:['EXHIBITION_HISTORY_NOT_AVAILABLE','WATER_FORWARD_VALIDATION_REQUIRED','TIDE_FORWARD_VALIDATION_REQUIRED']
};
fs.writeFileSync(output,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({selected:best.config,holdout4:rich4,comparison:out.comparisonToClassBaseline},null,2));
