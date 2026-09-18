#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');

const date=process.argv[2]||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const root=path.join(__dirname,'..','live','edogawa',date);
function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function validResult(x,race){
  return x&&x.schema==='boat-command-live-result-v1'&&x.venue==='EDOGAWA'&&x.venueCode==='03'&&
    x.date===date&&Number(x.race)===race&&x.preRaceDataIncluded===false&&x.resultEndpointsIncluded===true&&
    /^[1-6]-[1-6]-[1-6]$/.test(String(x.trifecta||''));
}
function validShadow(x,race,mode){
  return x&&x.schema==='boat-command-edogawa-shadow-research-v1'&&x.venue==='EDOGAWA'&&x.venueCode==='03'&&
    x.date===date&&Number(x.race)===race&&x.mode===mode&&x.resultInput===false&&x.payoutInput===false&&
    x.researchOnly===true&&x.productionEnabled===false&&x.tryEnabled===false&&x.cashNeutral===true&&
    x.immutableAfterFirstWrite===true&&Array.isArray(x.picks)&&x.picks.length===4;
}
const rows=[];
for(let race=1;race<=12;race++){
  const result=read(path.join(root,'post',`race-${race}-result.json`));
  if(!validResult(result,race))continue;
  const a=read(path.join(root,'shadow','program-only',`race-${race}.json`));
  const b=read(path.join(root,'shadow','full-pre',`race-${race}.json`));
  const actual=String(result.trifecta);
  rows.push({
    race,actual,payout100:Number(result.payout100)||0,
    programOnly:validShadow(a,race,'PROGRAM_ONLY')?{
      generatedAt:a.generatedAt,picks:a.picks,hit:a.picks.includes(actual)
    }:null,
    fullPre:validShadow(b,race,'FULL_PRE_RACE')?{
      generatedAt:b.generatedAt,picks:b.picks,hit:b.picks.includes(actual)
    }:null
  });
}
function stats(key){
  const x=rows.filter(r=>r[key]);
  const hits=x.filter(r=>r[key].hit).length;
  return {evaluated:x.length,hits,hitRate:x.length?hits/x.length:null};
}
const out={
  schema:'boat-command-edogawa-shadow-evaluation-v1',
  venue:'EDOGAWA',venueCode:'03',date,
  generatedAt:new Date().toISOString(),
  rows,
  summary:{programOnly:stats('programOnly'),fullPre:stats('fullPre')},
  fundingScope:'NONE_RESEARCH_ONLY',
  bankrollAffected:false,
  tryAffected:false,
  productionAffected:false
};
const outPath=path.join(root,'research-evaluation-v1.json');
fs.mkdirSync(root,{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out.summary));
