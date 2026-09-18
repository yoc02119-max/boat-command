// BOAT COMMAND EDOGAWA rich research model v2
// Backtest-compatible rich program-only model. No result/payout/fetch/bankroll access.
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.BOAT_COMMAND_EDOGAWA_RICH_MODEL_V2=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const VERSION='EDOGAWA-RICH-MODEL-V2';
 const CLASS={A1:3,A2:2,B1:1,B2:0};
 const laneW=[1.28,1.16,1.08,1,.94,.9];
 const ORDERS=[];
 for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)if(a!==b&&a!==c&&b!==c)ORDERS.push(`${a}-${b}-${c}`);
 const finite=v=>Number.isFinite(Number(v))?Number(v):null;
 const typeGroup=s=>{
  s=String(s||'');
  if(/優勝/.test(s))return'FINAL';if(/準優/.test(s))return'SEMI';if(/ドリーム/.test(s))return'DREAM';
  if(/選抜|記者選抜/.test(s))return'SELECT';if(/特選|特賞/.test(s))return'SPECIAL';
  if(/予選/.test(s))return'QUALIFY';if(/一般/.test(s))return'GENERAL';return'UNKNOWN';
 };
 function target(program){
  if(!program||program.venue!=='EDOGAWA'||String(program.venueCode)!=='03')throw new Error('EDOGAWA_ONLY');
  if(program.resultEndpointsIncluded!==false||program.resultIncluded!==false||program.exhibitionIncluded!==false)throw new Error('PROGRAM_BOUNDARY');
  const boats=[...(program.boats||[])].sort((a,b)=>Number(a.lane)-Number(b.lane));
  if(boats.length!==6)throw new Error('PROGRAM_BOATS');
  const rich=boats.map((b,i)=>{
   const x={
    lane:i+1,class:String(b.class),
    nationalWinRate:finite(b.nationalWinRate),national2Rate:finite(b.national2Rate),
    localWinRate:finite(b.localWinRate),local2Rate:finite(b.local2Rate),
    motor2Rate:finite(b.motor2Rate),boat2Rate:finite(b.boat2Rate)
   };
   if(Number(b.lane)!==i+1||!Object.hasOwn(CLASS,x.class))throw new Error('PROGRAM_LANE');
   for(const k of ['nationalWinRate','national2Rate','localWinRate','local2Rate','motor2Rate','boat2Rate'])if(x[k]==null)throw new Error('PROGRAM_RICH_FEATURE_'+k);
   return x;
  });
  return{d:String(program.date),r:Number(program.race),t:String(program.raceType||''),boats:rich};
 }
 const nd=(a,b,s)=>Math.abs(a-b)/s;
 function distance(a,b,p){
  let d=0;
  for(let i=0;i<6;i++){
   const x=a.boats[i],y=b.boats[i],lw=laneW[i];
   d+=lw*p.classW*Math.abs(CLASS[x.class]-CLASS[y.class]);
   d+=lw*p.abilityW*nd(x.nationalWinRate,y.nationalWinRate,3);
   d+=lw*p.abilityW*.8*nd(x.national2Rate,y.national2Rate,.4);
   d+=lw*p.localW*nd(x.localWinRate,y.localWinRate,3);
   d+=lw*p.localW*.9*nd(x.local2Rate,y.local2Rate,.4);
   d+=lw*p.localW*.35*nd(x.localWinRate-x.nationalWinRate,y.localWinRate-y.nationalWinRate,3);
   d+=lw*p.localW*.35*nd(x.local2Rate-x.national2Rate,y.local2Rate-y.national2Rate,.4);
   d+=lw*p.motorW*nd(x.motor2Rate,y.motor2Rate,.4);
   d+=lw*p.boatW*nd(x.boat2Rate,y.boat2Rate,.4);
  }
  if(Number(a.r)!==Number(b.r))d+=p.racePenalty;
  if(typeGroup(a.t)!==typeGroup(b.t))d+=p.typePenalty;
  return d;
 }
 function validHist(r){
  return r&&Array.isArray(r.boats)&&r.boats.length===6&&/^[1-6]-[1-6]-[1-6]$/.test(String(r.o||''))&&
   r.boats.every((b,i)=>Number(b.lane)===i+1&&Object.hasOwn(CLASS,String(b.class))&&
    ['nationalWinRate','national2Rate','localWinRate','local2Rate','motor2Rate','boat2Rate'].every(k=>finite(b[k])!=null));
 }
 function distribution(program,history,config){
  const t=target(program);
  if(!config)throw new Error('RICH_CONFIG_REQUIRED');
  const safe=(history||[]).filter(r=>validHist(r)&&String(r.d)<t.d);
  if(safe.length<300)throw new Error('RICH_HISTORY_MIN_300');
  const global=new Map();
  for(const x of safe)global.set(x.o,(global.get(x.o)||0)+1);
  const score=new Map();
  for(const [o,n] of global)score.set(o,(config.globalMass||18)*n/safe.length);
  const nearest=safe.map(x=>({x,d:distance(t,x,config)})).sort((a,b)=>a.d-b.d).slice(0,config.neighbors||120);
  for(const n of nearest)score.set(n.x.o,(score.get(n.x.o)||0)+Math.exp(-(config.decay||.5)*n.d));
  const total=[...score.values()].reduce((a,b)=>a+b,0);
  const rows=[...score.entries()].map(([order,v])=>({order,probability:v/total})).sort((a,b)=>b.probability-a.probability);
  const sum=rows.reduce((a,x)=>a+x.probability,0);
  return{
   version:VERSION,mode:'RICH_PROGRAM',rows,sum,historyRows:safe.length,
   nearestDistance:nearest[0]?.d??null,
   resultInput:false,payoutInput:false,exhibitionUsed:false,waterUsed:false,tideUsed:false,
   researchOnly:true,productionEnabled:false,tryEnabled:false
  };
 }
 const select=(d,count=4)=>d.rows.slice(0,Math.max(1,Math.min(8,Number(count)||4)));
 return Object.freeze({version:VERSION,target,distance,distribution,select,orders:ORDERS,researchOnly:true,productionEnabled:false,tryEnabled:false});
});
