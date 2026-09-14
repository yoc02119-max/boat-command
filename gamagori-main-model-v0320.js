// BOAT COMMAND GAMAGORI program-structure model v0.32.0
// Pure PRE-RACE model. It accepts program/profile/odds inputs only and never fetches data.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.BOAT_COMMAND_MAIN_MODEL_V0320=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='GAMAGORI-MAIN-MODEL-V0.32.0';
  const CLASSES=['A1','A2','B1','B2'];
  const CLASS_SCORE={A1:3,A2:2,B1:1,B2:0};
  const LANE_PRIOR=[1.72,.42,.12,-.05,-.32,-.58];
  const LANE_DISTANCE=[1.35,1.2,1.1,1,.95,.9];

  function validPick(v){
    const s=String(v||'');
    return /^[1-6]-[1-6]-[1-6]$/.test(s)&&new Set(s.split('-')).size===3?s:null;
  }
  function allOrders(){
    const out=[];
    for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)if(a!==b&&a!==c&&b!==c)out.push(`${a}-${b}-${c}`);
    return out;
  }
  const ORDERS=allOrders();
  function cleanClasses(classes){
    if(!Array.isArray(classes)||classes.length!==6)return null;
    const c=classes.map(String);
    return c.every(x=>CLASSES.includes(x))?c:null;
  }
  function raceTypeGroup(v){
    const s=String(v||'');
    if(/優勝/.test(s))return 'FINAL';
    if(/準優/.test(s))return 'SEMI';
    if(/ドリーム/.test(s))return 'DREAM';
    if(/選抜/.test(s))return 'SELECT';
    if(/特選|特賞/.test(s))return 'SPECIAL';
    if(/予選/.test(s))return 'QUALIFY';
    if(/一般/.test(s))return 'GENERAL';
    return 'UNKNOWN';
  }
  function raceBucket(race){const r=Number(race)||0;return r<=4?'EARLY':r<=8?'MIDDLE':'LATE'}
  function feature(program){
    const classes=cleanClasses(program?.classes||program?.c);if(!classes)return null;
    const n=classes.map(x=>CLASS_SCORE[x]);
    const counts=Object.fromEntries(CLASSES.map(k=>[k,classes.filter(x=>x===k).length]));
    const inner=n.slice(0,3).reduce((a,b)=>a+b,0),outer=n.slice(3).reduce((a,b)=>a+b,0);
    const max=Math.max(...n);
    return {classes,n,counts,inner,outer,balance:inner-outer,strongLanes:n.map((x,i)=>x===max?i+1:null).filter(Boolean),race:Number(program.race||program.r)||0,raceBucket:raceBucket(program.race||program.r),typeGroup:raceTypeGroup(program.raceType||program.t)};
  }
  function relativeBoatScores(program){
    const f=feature(program);if(!f)return null;
    const profiles=Array.isArray(program.profiles)?program.profiles:[];
    return f.n.map((classScore,i)=>{
      const p=profiles[i]||{};
      const course=Number(p.courseWinRate),motor=Number(p.motor2Rate),racer=Number(p.racerWinRate);
      let score=LANE_PRIOR[i]+.54*classScore;
      if(Number.isFinite(course))score+=1.25*(course-.16);
      if(Number.isFinite(motor))score+=.7*(motor-.35);
      if(Number.isFinite(racer))score+=.55*(racer-.5);
      return score;
    });
  }
  function structureDistance(target,row){
    const a=feature(target),b=feature(row);if(!a||!b)return Infinity;
    let d=0;
    for(let i=0;i<6;i++)d+=LANE_DISTANCE[i]*Math.abs(a.n[i]-b.n[i]);
    for(const k of CLASSES)d+=.34*Math.abs(a.counts[k]-b.counts[k]);
    d+=.18*Math.abs(a.inner-b.inner)+.14*Math.abs(a.outer-b.outer)+.22*Math.abs(a.balance-b.balance);
    d+=a.race===b.race?0:(a.raceBucket===b.raceBucket?.55:1.05);
    if(a.typeGroup!=='UNKNOWN'&&b.typeGroup!=='UNKNOWN')d+=a.typeGroup===b.typeGroup?0:1.15;
    return d;
  }
  function plackettLuce(scores){
    const raw=new Map();let total=0;
    for(const order of ORDERS){
      const lanes=order.split('-').map(x=>Number(x)-1),remaining=[0,1,2,3,4,5];let p=1;
      for(const lane of lanes){
        const den=remaining.reduce((s,i)=>s+Math.exp(scores[i]),0);
        p*=Math.exp(scores[lane])/den;
        remaining.splice(remaining.indexOf(lane),1);
      }
      raw.set(order,p);total+=p;
    }
    return new Map([...raw].map(([k,v])=>[k,v/total]));
  }
  function probabilities(program,history,{targetDate,neighborLimit=480,priorMass=42,decay=.58}={}){
    const scores=relativeBoatScores(program);if(!scores)throw new Error('PROGRAM_CLASSES_INVALID');
    const safe=(history||[]).filter(r=>cleanClasses(r.c||r.classes)&&validPick(r.o)&&(!targetDate||String(r.d)<String(targetDate)));
    const nearest=safe.map(r=>({r,d:structureDistance(program,r)})).filter(x=>Number.isFinite(x.d)).sort((a,b)=>a.d-b.d).slice(0,neighborLimit);
    const prior=plackettLuce(scores),observed=new Map(ORDERS.map(x=>[x,0]));let observedMass=0;
    for(const x of nearest){const w=Math.exp(-decay*x.d);observed.set(x.r.o,observed.get(x.r.o)+w);observedMass+=w}
    const den=observedMass+priorMass;
    const rows=ORDERS.map(order=>({order,probability:(observed.get(order)+priorMass*prior.get(order))/den})).sort((a,b)=>b.probability-a.probability);
    const sum=rows.reduce((s,x)=>s+x.probability,0);
    for(const x of rows)x.probability/=sum;
    return {version:VERSION,rows,sum:rows.reduce((s,x)=>s+x.probability,0),historyRows:safe.length,neighbors:nearest.length,nearestDistance:nearest[0]?.d??null,features:feature(program),boatScores:scores};
  }
  function decimalOdds(odds,order){
    const v=Number(odds instanceof Map?odds.get(order):odds?.[order]);
    return Number.isFinite(v)&&v>1?v:null;
  }
  function select(distribution,{odds=null,count=4,mode='PROBABILITY',minProbability=0}={}){
    const max=Math.max(1,Math.min(6,Number(count)||4));
    const ranked=distribution.rows.map(x=>{
      const o=decimalOdds(odds,x.order),ev=o==null?null:x.probability*o;
      return {...x,odds:o,expectedValue:ev};
    }).filter(x=>x.probability>=minProbability);
    if(mode==='EXPECTED_VALUE'&&odds)ranked.sort((a,b)=>(b.expectedValue??-Infinity)-(a.expectedValue??-Infinity)||b.probability-a.probability);
    else ranked.sort((a,b)=>b.probability-a.probability);
    return ranked.slice(0,max);
  }
  function variableCount(distribution,{odds=null,maxCount=6,minCoverage=.32,minEdge=1.02}={}){
    const ranked=select(distribution,{odds,count:maxCount,mode:odds?'EXPECTED_VALUE':'PROBABILITY'});
    if(odds){const positive=ranked.filter(x=>x.expectedValue!=null&&x.expectedValue>=minEdge);return Math.max(1,Math.min(maxCount,positive.length||1))}
    let coverage=0,count=0;for(const x of ranked){coverage+=x.probability;count++;if(coverage>=minCoverage)break}return Math.max(1,Math.min(maxCount,count));
  }
  return {version:VERSION,classes:CLASSES,orders:ORDERS,validPick,feature,raceTypeGroup,relativeBoatScores,structureDistance,probabilities,select,variableCount};
});
