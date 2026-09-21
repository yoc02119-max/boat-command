#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');

const [slug,venue,code,dateArg]=process.argv.slice(2);
if(!slug||!venue||!/^\d{2}$/.test(String(code||'')))throw new Error('USAGE: venue-shadow-evaluation-v1.js <slug> <VENUE> <code> [date]');
const root=path.join(__dirname,'..'),liveRoot=path.join(root,'live',slug);
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function preserveGeneratedAt(out,file){
  const old=read(file),a=old?{...old}:null,b={...out};
  if(a)delete a.generatedAt;delete b.generatedAt;
  out.generatedAt=a&&JSON.stringify(a)===JSON.stringify(b)?(old.generatedAt||new Date().toISOString()):new Date().toISOString();
  return out;
}
function validShadow(x,race,mode,date){
  const generated=Date.parse(x?.generatedAt||'');
  const deadline=/^\d{2}:\d{2}$/.test(x?.deadline||'')?Date.parse(`${date}T${x.deadline}:00+09:00`):NaN;
  if(x?.date!==date||!Number.isFinite(generated)||!Number.isFinite(deadline)||generated>deadline-180000)return false;
  return !!x&&x.schema==='boat-command-venue-shadow-research-v1'&&x.venue===venue&&x.venueCode===code&&x.slug===slug&&
    Number(x.race)===race&&x.mode===mode&&x.resultInput===false&&x.payoutInput===false&&x.researchOnly===true&&
    x.productionEnabled===false&&x.tryEnabled===false&&x.immutableAfterFirstWrite===true&&Array.isArray(x.picks)&&x.picks.length===4;
}
function evaluateDay(date){
  const dayRoot=path.join(liveRoot,date),rows=[];
  for(let race=1;race<=12;race++){
    const result=read(path.join(dayRoot,'post','race-'+race+'-result.json'));
    if(!result||result.schema!=='boat-command-live-result-v1'||result.venue!==venue||result.venueCode!==code||result.preRaceDataIncluded!==false||result.resultEndpointsIncluded!==true)continue;
    if(result.evaluationEligible===false||result.date!==date||Number(result.race)!==race)continue;
    const actual=String(result.trifecta||'');if(!/^[1-6]-[1-6]-[1-6]$/.test(actual))continue;
    const c=read(path.join(dayRoot,'shadow','class-baseline','race-'+race+'.json'));
    const p=read(path.join(dayRoot,'shadow','program-only','race-'+race+'.json'));
    const cz=validShadow(c,race,'CLASS_BASELINE',date)?c:null,pa=validShadow(p,race,'PROGRAM_ONLY',date)?p:null;
    const pack=x=>x?{generatedAt:x.generatedAt,picks:x.picks,hit:x.picks.includes(actual),modelVersion:x.modelVersion,source:x.sources||null}:null;
    if(cz&&pa)rows.push({race,actual,payout100:Number(result.payout100)||0,classBaseline:pack(cz),programOnly:pack(pa)});
  }
  function stats(key){const x=rows.filter(r=>r[key]),hits=x.filter(r=>r[key].hit).length,stake=x.length*400,returns=x.filter(r=>r[key].hit).reduce((s,r)=>s+r.payout100,0);return{evaluated:x.length,hits,hitRate:x.length?hits/x.length:null,stake,returns,roi:stake?returns/stake:null}}
  const c=stats('classBaseline'),p=stats('programOnly');
  const out={
    schema:'boat-command-venue-shadow-day-evaluation-v1',venue,venueCode:code,slug,date,generatedAt:null,rows,
    summary:{classBaseline:c,programOnly:p,paired:rows.length,hitRateDelta:rows.length&&c.hitRate!=null&&p.hitRate!=null?p.hitRate-c.hitRate:null,roiDelta:rows.length&&c.roi!=null&&p.roi!=null?p.roi-c.roi:null},
    fundingScope:'NONE_RESEARCH_ONLY',bankrollAffected:false,tryAffected:false,productionAffected:false,realMoney:false
  };
  {const output=path.join(dayRoot,'research-evaluation-v1.json');fs.mkdirSync(dayRoot,{recursive:true});preserveGeneratedAt(out,output);fs.writeFileSync(output,JSON.stringify(out,null,2)+'\n')}
  return out;
}

const date=dateArg||today();
if(fs.existsSync(path.join(liveRoot,date)))evaluateDay(date);

const rows=[];
if(fs.existsSync(liveRoot)){
  for(const d of fs.readdirSync(liveRoot).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort()){
    const p=path.join(liveRoot,d,'research-evaluation-v1.json'),x=read(p);
    if(!x||x.venue!==venue||x.venueCode!==code||x.slug!==slug)continue;
    for(const r of x.rows||[])rows.push({date:d,...r});
  }
}
function stats(key){const x=rows.filter(r=>r[key]),hits=x.filter(r=>r[key].hit).length,stake=x.length*400,returns=x.filter(r=>r[key].hit).reduce((s,r)=>s+Number(r.payout100||0),0);return{evaluated:x.length,hits,hitRate:x.length?hits/x.length:null,stake,returns,roi:stake?returns/stake:null}}
const c=stats('classBaseline'),p=stats('programOnly');
const paired=rows.filter(r=>r.classBaseline&&r.programOnly);
const hitDelta=paired.length&&c.hitRate!=null&&p.hitRate!=null?p.hitRate-c.hitRate:null;
const roiDelta=paired.length&&c.roi!=null&&p.roi!=null?p.roi-c.roi:null;
const out={
  schema:'boat-command-venue-shadow-evaluation-v1',version:'VENUE-SHADOW-EVALUATION-V1',
  venue,venueCode:code,slug,generatedAt:null,
  evaluationDays:new Set(rows.map(x=>x.date)).size,classBaseline:c,programOnly:p,pairedRaces:paired.length,
  hitRateDelta:hitDelta,roiDelta,earlyReviewReady:p.evaluated>=36,targetReviewReady:p.evaluated>=60,
  forwardUpliftReady:paired.length>=60&&hitDelta>=0&&roiDelta>0,
  fundingScope:'NONE',cashNeutral:true,realMoney:false,boundaries:{predictionMutation:false,bankrollMutation:false,tryMutation:false}
};
const aggregateOutput=path.join(root,slug+'-shadow-evaluation-v1.json');
preserveGeneratedAt(out,aggregateOutput);
fs.writeFileSync(aggregateOutput,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({slug,pairedRaces:out.pairedRaces,hitRateDelta:hitDelta,roiDelta,forwardUpliftReady:out.forwardUpliftReady}));

