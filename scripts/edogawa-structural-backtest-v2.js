#!/usr/bin/env node
'use strict';
const fs=require('fs');

const input=process.argv[2]||'edogawa-history-bootstrap-v1.json';
const output=process.argv[3]||'edogawa-structural-backtest-v2.json';
const db=JSON.parse(fs.readFileSync(input,'utf8'));
if(db.venueCode!=='03')throw new Error('EDOGAWA_ONLY');
const rows=[...(db.races||[])].sort((a,b)=>String(a.d).localeCompare(String(b.d))||Number(a.r)-Number(b.r));
if(rows.length<500)throw new Error('INSUFFICIENT_HISTORY');

const CLASS={A1:3,A2:2,B1:1,B2:0};
const validC=x=>Array.isArray(x)&&x.length===6&&x.every(v=>Object.hasOwn(CLASS,v));
const validO=x=>/^[1-6]-[1-6]-[1-6]$/.test(String(x||''))&&new Set(String(x).split('-')).size===3;
const typeGroup=s=>{
 s=String(s||'');if(/優勝/.test(s))return'FINAL';if(/準優/.test(s))return'SEMI';if(/ドリーム/.test(s))return'DREAM';
 if(/選抜/.test(s))return'SELECT';if(/特選|特賞/.test(s))return'SPECIAL';if(/予選/.test(s))return'QUALIFY';if(/一般/.test(s))return'GENERAL';return'UNKNOWN';
};
const aCount=c=>c.filter(x=>x==='A1'||x==='A2').length;
const dateNum=d=>Date.parse(d+'T00:00:00Z')/86400000;
const laneW=[1.25,1.15,1.08,1,.95,.9];

function distance(a,b,cfg){
 let d=0;
 for(let i=0;i<6;i++)d+=laneW[i]*Math.abs(CLASS[a.c[i]]-CLASS[b.c[i]]);
 if(Number(a.r)!==Number(b.r))d+=cfg.racePenalty;
 if(typeGroup(a.t)!==typeGroup(b.t))d+=cfg.typePenalty;
 d+=cfg.aCountPenalty*Math.abs(aCount(a.c)-aCount(b.c));
 return d;
}
function add(map,key,w){map.set(key,(map.get(key)||0)+w)}
function normalize(map){
 const total=[...map.values()].reduce((a,b)=>a+b,0);
 return total>0?[...map.entries()].map(([order,v])=>({order,p:v/total})).sort((a,b)=>b.p-a.p):[];
}
function dist(target,history,cfg){
 const safe=history.filter(x=>validC(x.c)&&validO(x.o)&&String(x.d)<String(target.d));
 const global=new Map(),race=new Map(),type=new Map(),ac=new Map();
 for(const x of safe){
   add(global,x.o,1);
   if(Number(x.r)===Number(target.r))add(race,x.o,1);
   if(typeGroup(x.t)===typeGroup(target.t))add(type,x.o,1);
   if(aCount(x.c)===aCount(target.c))add(ac,x.o,1);
 }
 const score=new Map();
 const addPrior=(m,mass)=>{
   const total=[...m.values()].reduce((a,b)=>a+b,0)||1;
   for(const [o,n] of m)add(score,o,mass*n/total);
 };
 addPrior(global,cfg.globalMass);
 addPrior(race,cfg.raceMass);
 addPrior(type,cfg.typeMass);
 addPrior(ac,cfg.aMass);

 const nearest=safe.map(x=>({x,d:distance(target,x,cfg)})).sort((a,b)=>a.d-b.d).slice(0,cfg.neighbors);
 const td=dateNum(target.d);
 for(const n of nearest){
   const age=Math.max(0,td-dateNum(n.x.d));
   const rec=cfg.halfLife?Math.pow(.5,age/cfg.halfLife):1;
   const w=Math.exp(-cfg.decay*n.d)*rec;
   add(score,n.x.o,w);
 }
 return normalize(score);
}
function walk(cfg,targetSet){
 const ids=new Set(targetSet.map(x=>x.id));let history=[],day=null,buf=[],rec=[];
 const flush=()=>{
   if(!buf.length)return;
   if(history.length>=120){
     for(const t of buf){
       if(!ids.has(t.id))continue;
       const d=dist(t,history,cfg),picks=d.slice(0,8).map(x=>x.order);
       rec.push({id:t.id,d:t.d,r:t.r,actual:t.o,payout:Number(t.p)||0,picks});
     }
   }
   history=history.concat(buf);buf=[];
 };
 for(const x of rows){if(day!==null&&x.d!==day)flush();day=x.d;buf.push(x)} flush();
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

const configs=[];
for(const neighbors of [120,240,480])
for(const decay of [.25,.4,.6])
for(const halfLife of [0,90,180])
for(const raceMass of [12,30])
configs.push({
 neighbors,decay,halfLife:halfLife||null,
 racePenalty:.65,typePenalty:.7,aCountPenalty:.35,
 globalMass:14,raceMass,typeMass:10,aMass:8
});

const tested=[];
for(const cfg of configs){
 const rec=walk(cfg,cal),m4=metrics(rec,4),m6=metrics(rec,6);
 const score=.62*m4.hitRate+.23*Math.min(m4.roi,1.5)+.15*m6.hitRate;
 tested.push({cfg,m4,m6,score});
}
tested.sort((a,b)=>b.score-a.score||b.m4.hitRate-a.m4.hitRate||b.m4.roi-a.m4.roi);
const best=tested[0];
const holdRec=walk(best.cfg,hold);
const allRec=walk(best.cfg,rows);
const pointCounts=rec=>Object.fromEntries(Array.from({length:8},(_,i)=>[String(i+1),metrics(rec,i+1)]));
const out={
 schema:'boat-command-edogawa-structural-backtest-v2',
 venue:'EDOGAWA',venueCode:'03',source:input,
 strictWalkForward:true,sameDayRowsExcluded:true,
 resultBlockedUntilPrediction:true,gamagoriWeightsReused:false,
 featureScope:['laneClassVector','raceNumber','raceTypeGroup','aCount','historicalRecency'],
 calibration:{lastDate:calEnd,dateCount:cut,tested:tested.slice(0,20),selected:best.cfg,selected4:best.m4,selected6:best.m6},
 holdout:{firstDate:holdStart,dateCount:dates.length-cut,pointCounts:pointCounts(holdRec)},
 allWalkForward:{pointCounts:pointCounts(allRec)},
 productionEnabled:false,tryEnabled:false,promotionEligible:false,
 promotionBlockers:['RICH_PRE_RACE_HISTORY_NOT_VALIDATED','WATER_NOT_VALIDATED','EXHIBITION_NOT_VALIDATED']
};
fs.writeFileSync(output,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({selected:best.cfg,cal4:best.m4,hold4:out.holdout.pointCounts['4'],hold6:out.holdout.pointCounts['6']},null,2));
