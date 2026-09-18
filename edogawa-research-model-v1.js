// BOAT COMMAND EDOGAWA research model v1
// Research-only. Pure inputs. No fetch, result, payout, bankroll or live-bet access.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.BOAT_COMMAND_EDOGAWA_RESEARCH_MODEL_V1=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='EDOGAWA-RESEARCH-MODEL-V1';
  const CLASS={A1:3,A2:2,B1:1,B2:0};
  const ORDERS=[];
  for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)if(a!==b&&a!==c&&b!==c)ORDERS.push(`${a}-${b}-${c}`);

  const finite=v=>Number.isFinite(Number(v))?Number(v):null;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function raceTypeGroup(s){
    s=String(s||'');
    if(/優勝/.test(s))return'FINAL';
    if(/準優/.test(s))return'SEMI';
    if(/ドリーム/.test(s))return'DREAM';
    if(/選抜/.test(s))return'SELECT';
    if(/特選|特賞/.test(s))return'SPECIAL';
    if(/予選/.test(s))return'QUALIFY';
    if(/一般/.test(s))return'GENERAL';
    return'UNKNOWN';
  }
  function raceBucket(r){r=Number(r)||0;return r<=4?'EARLY':r<=8?'MIDDLE':'LATE'}
  function validOrder(v){const s=String(v||'');return /^[1-6]-[1-6]-[1-6]$/.test(s)&&new Set(s.split('-')).size===3}
  function classes(program){
    const b=Array.isArray(program?.boats)?[...program.boats].sort((a,b)=>Number(a.lane)-Number(b.lane)):[];
    if(b.length!==6||!b.every((x,i)=>Number(x.lane)===i+1&&Object.hasOwn(CLASS,String(x.class))))throw new Error('EDOGAWA_PROGRAM_INVALID');
    return b.map(x=>String(x.class));
  }
  function historyDistance(program,row){
    const c=classes(program),rc=Array.isArray(row?.c)?row.c.map(String):[];
    if(rc.length!==6||!rc.every(x=>Object.hasOwn(CLASS,x)))return Infinity;
    const laneW=[1.28,1.17,1.08,1.0,.94,.9];
    let d=0;
    for(let i=0;i<6;i++)d+=laneW[i]*Math.abs(CLASS[c[i]]-CLASS[rc[i]]);
    const r=Number(program.race)||0,rr=Number(row.r)||0;
    d+=r===rr?0:(raceBucket(r)===raceBucket(rr)?.45:.9);
    const a=raceTypeGroup(program.raceType),b=raceTypeGroup(row.t);
    if(a!=='UNKNOWN'&&b!=='UNKNOWN'&&a!==b)d+=.85;
    return d;
  }
  function currentScores(program,feature=null,{fullPreRace=false}={}){
    const b=[...program.boats].sort((a,b)=>Number(a.lane)-Number(b.lane));
    // These are RESEARCH priors only. Production promotion remains false until forward validation.
    const lanePrior=[.72,.24,.08,-.05,-.18,-.27];
    const lanes=feature?.lanes||[];
    return b.map((x,i)=>{
      let s=lanePrior[i]+.36*CLASS[String(x.class)];
      const nat=finite(x.nationalWinRate),loc=finite(x.localWinRate);
      const nat2=finite(x.national2Rate),loc2=finite(x.local2Rate);
      const motor=finite(x.motor2Rate),boat=finite(x.boat2Rate),avgST=finite(x.avgST);
      if(nat!=null)s+=.12*(nat-5);
      if(loc!=null)s+=.17*(loc-5);
      if(nat!=null&&loc!=null)s+=.08*clamp(loc-nat,-3,3);
      if(nat2!=null)s+=.42*(nat2-.30);
      if(loc2!=null)s+=.58*(loc2-.30);
      if(motor!=null)s+=.42*(motor-.35);
      if(boat!=null)s+=.18*(boat-.35);
      if(avgST!=null)s+=.75*(.18-avgST);

      if(fullPreRace){
        const f=lanes[i]||{};
        const er=finite(f.exhibitionRank),sr=finite(f.exhibitionSTRank);
        if(er!=null)s+=.10*(3.5-er);
        if(sr!=null)s+=.07*(3.5-sr);
        const est=finite(f.exhibitionST);
        if(est!=null)s+=.20*(.15-est);
      }
      return s;
    });
  }
  function pl(scores){
    const raw=new Map();let sum=0;
    for(const order of ORDERS){
      const lanes=order.split('-').map(x=>Number(x)-1),remaining=[0,1,2,3,4,5];let p=1;
      for(const lane of lanes){
        const den=remaining.reduce((a,i)=>a+Math.exp(scores[i]),0);
        p*=Math.exp(scores[lane])/den;
        remaining.splice(remaining.indexOf(lane),1);
      }
      raw.set(order,p);sum+=p;
    }
    return new Map([...raw].map(([k,v])=>[k,v/sum]));
  }
  function distribution(program,history,feature=null,{mode='PROGRAM_ONLY',targetDate=null,neighborLimit=360,decay=.55,priorMass=36}={}){
    if(program?.venue!=='EDOGAWA'||String(program?.venueCode)!=='03')throw new Error('EDOGAWA_ONLY');
    if(program.resultEndpointsIncluded!==false||program.resultIncluded!==false||program.exhibitionIncluded!==false)throw new Error('PROGRAM_BOUNDARY_INVALID');
    const safe=(history||[]).filter(r=>validOrder(r.o)&&Array.isArray(r.c)&&r.c.length===6&&(!targetDate||String(r.d)<String(targetDate)));
    if(safe.length<300)throw new Error('EDOGAWA_HISTORY_MIN_300_REQUIRED');

    const full=mode==='FULL_PRE_RACE';
    if(full&&!feature?.preRaceComplete)throw new Error('FULL_PRE_RACE_NOT_READY');
    const scores=currentScores(program,feature,{fullPreRace:full});
    const prior=pl(scores);
    const nearest=safe.map(r=>({r,d:historyDistance(program,r)})).filter(x=>Number.isFinite(x.d)).sort((a,b)=>a.d-b.d).slice(0,neighborLimit);
    const obs=new Map(ORDERS.map(o=>[o,0]));let mass=0;
    for(const x of nearest){const w=Math.exp(-decay*x.d);obs.set(x.r.o,obs.get(x.r.o)+w);mass+=w}
    const den=mass+priorMass;
    const rows=ORDERS.map(order=>({order,probability:(obs.get(order)+priorMass*prior.get(order))/den})).sort((a,b)=>b.probability-a.probability);
    const total=rows.reduce((a,x)=>a+x.probability,0);
    for(const x of rows)x.probability/=total;
    return{
      version:VERSION,mode,
      rows,sum:rows.reduce((a,x)=>a+x.probability,0),
      historyRows:safe.length,neighbors:nearest.length,nearestDistance:nearest[0]?.d??null,
      laneScores:scores,
      waterUsed:false,tideUsed:false,resultInput:false,payoutInput:false,
      researchOnly:true,productionEnabled:false,tryEnabled:false
    };
  }
  function select(d,{count=4}={}){
    const n=Math.max(1,Math.min(8,Number(count)||4));
    return d.rows.slice(0,n);
  }
  return Object.freeze({
    version:VERSION,orders:ORDERS,validOrder,raceTypeGroup,historyDistance,currentScores,distribution,select,
    researchOnly:true,productionEnabled:false,tryEnabled:false,resultInput:false,payoutInput:false
  });
});
