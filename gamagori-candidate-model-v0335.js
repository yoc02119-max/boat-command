// BOAT COMMAND GAMAGORI Candidate V2.1 v0.33.5
// SHADOW ONLY. Pure PRE-RACE model: no fetch, no result access, no exhibition.
// Single frozen hypothesis: slightly reduce national-win-rate weight (0.68 -> 0.63).
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.BOAT_COMMAND_GAMAGORI_CANDIDATE_V0335=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='GAMAGORI-CANDIDATE-V2.1-SHADOW-V0.33.5';
const BASELINE='GAMAGORI-CANDIDATE-V0.33.4';
const HYPOTHESIS='National win-rate relative differences are slightly overweighted; reduce only that coefficient from 0.68 to 0.63.';
const CLASS_SCORE={A1:3,A2:2,B1:1,B2:0};
const LANE_PRIOR=[1.48,.40,.14,-.03,-.29,-.53];
const ORDERS=[];for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)if(a!==b&&a!==c&&b!==c)ORDERS.push(`${a}-${b}-${c}`);
const finite=v=>Number.isFinite(Number(v));
const num=(v,d=0)=>finite(v)?Number(v):d;
function normalizeProgram(program){
 const classes=program?.classes||program?.c;
 if(!Array.isArray(classes)||classes.length!==6||classes.some(x=>!(x in CLASS_SCORE)))throw new Error('PROGRAM_CLASSES_INVALID');
 const profiles=Array.isArray(program.profiles)?program.profiles:Array(6).fill({});
 return {classes,profiles};
}
function fieldMean(rows,key,fallback){const xs=rows.map(x=>Number(x?.[key])).filter(Number.isFinite);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:fallback}
function relativeBoatScores(program){
 const {classes,profiles}=normalizeProgram(program);
 const natMean=fieldMean(profiles,'racerWinRate',.5),localMean=fieldMean(profiles,'localWinRate',natMean),motorMean=fieldMean(profiles,'motor2Rate',.35),stMean=fieldMean(profiles,'averageST',.16),courseMean=fieldMean(profiles,'courseWinRate',.16);
 const cls=classes.map(x=>CLASS_SCORE[x]),clsMean=cls.reduce((a,b)=>a+b,0)/6;
 return profiles.map((p,i)=>{
   let score=LANE_PRIOR[i];
   score+=.48*(cls[i]-clsMean);
   if(finite(p.courseWinRate))score+=1.05*(num(p.courseWinRate)-courseMean);
   if(finite(p.racerWinRate))score+=.63*(num(p.racerWinRate)-natMean);
   if(finite(p.localWinRate))score+=.22*(num(p.localWinRate)-localMean);
   if(finite(p.motor2Rate))score+=.48*(num(p.motor2Rate)-motorMean);
   if(finite(p.averageST))score+=2.2*(stMean-num(p.averageST));
   return score;
 });
}
function distribution(scores){
 const rows=[];let total=0;
 for(const order of ORDERS){const lanes=order.split('-').map(x=>Number(x)-1),remain=[0,1,2,3,4,5];let p=1;for(const lane of lanes){const den=remain.reduce((s,i)=>s+Math.exp(scores[i]),0);p*=Math.exp(scores[lane])/den;remain.splice(remain.indexOf(lane),1)}rows.push({order,probability:p});total+=p}
 rows.forEach(x=>x.probability/=total);rows.sort((a,b)=>b.probability-a.probability);return rows;
}
function predict(program,{count=4}={}){
 const scores=relativeBoatScores(program),rows=distribution(scores),n=Math.max(1,Math.min(6,Number(count)||4)),fixed=rows.slice(0,n);
 const top1=rows[0]?.probability||0,top4=rows.slice(0,4).reduce((s,x)=>s+x.probability,0),gap=top1-(rows[1]?.probability||0);
 return {version:VERSION,baseline:BASELINE,hypothesis:HYPOTHESIS,shadowOnly:true,exhibitionUsed:false,resultDataUsed:false,boatScores:scores,rows,fixed,confidence:{top1,top4,gap}};
}
return {version:VERSION,baseline:BASELINE,hypothesis:HYPOTHESIS,orders:ORDERS,relativeBoatScores,predict};
});
