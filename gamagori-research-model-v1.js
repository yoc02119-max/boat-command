// BOAT COMMAND GAMAGORI research model v1
// Venue-specific research only. Uses strictly past GAMAGORI history and never fetches results.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.BOAT_COMMAND_GAMAGORI_RESEARCH_MODEL_V1=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='GAMAGORI-RESEARCH-MODEL-V1';
  const CLASS={A1:3,A2:2,B1:1,B2:0};
  const ORDERS=[];for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)if(a!==b&&a!==c&&b!==c)ORDERS.push(`${a}-${b}-${c}`);
  const DEFAULT=Object.freeze({recencyWindow:300,classScale:.28,neighborMix:.45,neighborLimit:240,decay:.55,laplace:1});
  function validOrder(v){const s=String(v||'');return /^[1-6]-[1-6]-[1-6]$/.test(s)&&new Set(s.split('-')).size===3}
  function classes(program){
    const b=Array.isArray(program?.boats)?[...program.boats].sort((a,b)=>Number(a.lane)-Number(b.lane)):[];
    if(b.length!==6||!b.every((x,i)=>Number(x.lane)===i+1&&Object.hasOwn(CLASS,String(x.class))))throw new Error('GAMAGORI_PROGRAM_INVALID');
    return b.map(x=>String(x.class));
  }
  function bucket(r){r=Number(r)||0;return r<=4?'EARLY':r<=8?'MIDDLE':'LATE'}
  function typeGroup(s){s=String(s||'');if(/優勝/.test(s))return'FINAL';if(/準優/.test(s))return'SEMI';if(/ドリーム/.test(s))return'DREAM';if(/選抜/.test(s))return'SELECT';if(/特選|特賞/.test(s))return'SPECIAL';if(/予選/.test(s))return'QUALIFY';if(/一般/.test(s))return'GENERAL';return'UNKNOWN'}
  function distance(program,row){
    const c=classes(program),rc=Array.isArray(row?.c)?row.c.map(String):[];
    if(rc.length!==6||!rc.every(x=>Object.hasOwn(CLASS,x)))return Infinity;
    let d=0;for(let i=0;i<6;i++)d+=(i<2?1.2:i<4?1:.9)*Math.abs(CLASS[c[i]]-CLASS[rc[i]]);
    d+=Number(program.race)===Number(row.r)?0:(bucket(program.race)===bucket(row.r)?.4:.85);
    const a=typeGroup(program.raceType),b=typeGroup(row.t);if(a!=='UNKNOWN'&&b!=='UNKNOWN'&&a!==b)d+=.75;
    return d;
  }
  function distribution(program,history,{targetDate=null,config=null,mode='PROGRAM_ONLY'}={}){
    if(program?.venue!=='GAMAGORI'||String(program?.venueCode)!=='07')throw new Error('GAMAGORI_ONLY');
    if(program.resultEndpointsIncluded!==false||program.resultIncluded!==false||program.exhibitionIncluded!==false)throw new Error('GAMAGORI_PROGRAM_BOUNDARY');
    if(!['CLASS_BASELINE','PROGRAM_ONLY'].includes(mode))throw new Error('GAMAGORI_MODE_INVALID');
    const c=classes(program),cfg={...DEFAULT,...(config||{})};
    const safe=(history||[]).filter(x=>validOrder(x.o)&&Array.isArray(x.c)&&x.c.length===6&&(!targetDate||String(x.d)<String(targetDate))).slice(-300);
    if(safe.length<300)throw new Error('GAMAGORI_HISTORY_MIN_300_REQUIRED');

    const nearest=safe.map(x=>({x,d:distance(program,x)})).filter(x=>Number.isFinite(x.d)).sort((a,b)=>a.d-b.d).slice(0,Number(cfg.neighborLimit)||240);
    const local=new Map();let mass=0;
    for(const n of nearest){const w=Math.exp(-(Number(cfg.decay)||.55)*n.d);local.set(n.x.o,(local.get(n.x.o)||0)+w);mass+=w}
    if(!(mass>0))throw new Error('GAMAGORI_NEIGHBOR_MASS_EMPTY');

    let raw;
    let architecture;
    if(mode==='CLASS_BASELINE'){
      raw=ORDERS.map(order=>({order,probability:(local.get(order)||0)/mass}));
      architecture='GAMAGORI_CLASS_NEIGHBOR_BASELINE';
    }else{
      const first=Array(7).fill(cfg.laplace),pair=Array.from({length:7},()=>Array(7).fill(cfg.laplace)),third=Array(7).fill(cfg.laplace);
      for(const x of safe){const [a,b,z]=String(x.o).split('-').map(Number);first[a]++;pair[a][b]++;third[z]++}
      const boost=c.map(x=>Math.exp((Number(cfg.classScale)||0)*CLASS[x]));
      const f=Array(7).fill(0);let fd=0;for(let a=1;a<=6;a++){f[a]=first[a]*boost[a-1];fd+=f[a]}
      const trans=new Map();for(let a=1;a<=6;a++){const v=Array(7).fill(0);let den=0;for(let b=1;b<=6;b++)if(b!==a){v[b]=pair[a][b]*Math.sqrt(boost[b-1]);den+=v[b]}trans.set(a,{v,den})}
      const tr=Array(7).fill(0);let td=0;for(let z=1;z<=6;z++){tr[z]=third[z]*Math.pow(boost[z-1],.35);td+=tr[z]}
      const base=new Map();for(const o of ORDERS){const [a,b,z]=o.split('-').map(Number),p2=trans.get(a),rem=td-tr[a]-tr[b];base.set(o,(f[a]/fd)*(p2.v[b]/p2.den)*(rem>0?tr[z]/rem:0))}
      const mix=Math.max(0,Math.min(1,Number(cfg.neighborMix)||0));
      raw=ORDERS.map(order=>({order,probability:(1-mix)*(base.get(order)||0)+mix*((local.get(order)||0)/mass)}));
      architecture='GAMAGORI_EMPIRICAL_FIRST_SECOND_TRANSITION_PLUS_CLASS_NEIGHBORS';
    }
    const sum=raw.reduce((s,x)=>s+x.probability,0)||1;
    const rows=raw.map(x=>({order:x.order,probability:x.probability/sum})).sort((a,b)=>b.probability-a.probability);
    return{version:VERSION,mode,rows,sum:rows.reduce((s,x)=>s+x.probability,0),historyRows:safe.length,nearestDistance:nearest[0]?.d??null,config:cfg,architecture,resultInput:false,payoutInput:false,researchOnly:true,productionEnabled:false,tryEnabled:false};
  }
  function select(d,{count=4}={}){const n=Math.max(1,Math.min(8,Number(count)||4));return d.rows.slice(0,n)}
  return Object.freeze({version:VERSION,orders:ORDERS,validOrder,distribution,select,defaultConfig:DEFAULT,researchOnly:true,productionEnabled:false,tryEnabled:false,resultInput:false,payoutInput:false});
});
