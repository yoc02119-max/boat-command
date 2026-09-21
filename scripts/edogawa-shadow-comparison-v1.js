#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');

const date=process.argv[2]||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const root=path.join(__dirname,'..','live','edogawa',date);
function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function valid(x,mode,race){
  return x&&x.schema==='boat-command-edogawa-shadow-research-v1'&&x.venueCode==='03'&&
    x.date===date&&Number(x.race)===race&&x.mode===mode&&x.resultInput===false&&
    x.payoutInput===false&&x.researchOnly===true&&Array.isArray(x.picks)&&x.picks.length===4;
}
function compare(a,b){
  const overlap=a.picks.filter(x=>b.picks.includes(x)).length;
  return{
    overlap,
    setChanged:overlap<4,
    rankingChanged:JSON.stringify(a.picks)!==JSON.stringify(b.picks),
    topPickChanged:a.picks[0]!==b.picks[0],
    aTop:a.picks[0],bTop:b.picks[0],
    aPicks:a.picks,bPicks:b.picks
  };
}
const rows=[];
for(let race=1;race<=12;race++){
  const z=read(path.join(root,'shadow','class-baseline',`race-${race}.json`));
  const a=read(path.join(root,'shadow','program-only',`race-${race}.json`));
  const b=read(path.join(root,'shadow','full-pre',`race-${race}.json`));
  rows.push({
    race,
    classVsProgram:valid(z,'CLASS_BASELINE',race)&&valid(a,'PROGRAM_ONLY',race)?compare(z,a):null,
    programVsFull:valid(a,'PROGRAM_ONLY',race)&&valid(b,'FULL_PRE_RACE',race)?compare(a,b):null
  });
}
function stats(key){
  const xs=rows.map(r=>r[key]).filter(Boolean);
  return{
    paired:xs.length,
    setChanged:xs.filter(x=>x.setChanged).length,
    rankingChanged:xs.filter(x=>x.rankingChanged).length,
    topPickChanged:xs.filter(x=>x.topPickChanged).length,
    averageOverlap:xs.length?xs.reduce((s,x)=>s+x.overlap,0)/xs.length:null
  };
}
const out={
  schema:'boat-command-edogawa-shadow-comparison-v1',
  venue:'EDOGAWA',venueCode:'03',date,
  generatedAt:null,
  rows,
  summary:{
    classVsProgram:stats('classVsProgram'),
    programVsFull:stats('programVsFull')
  },
  resultInput:false,
  payoutInput:false,
  researchOnly:true,
  productionAffected:false,
  bankrollAffected:false
};
const output=path.join(root,'shadow-comparison-v1.json');
const previous=read(output),before=previous?{...previous}:null,after={...out};
if(before)delete before.generatedAt;delete after.generatedAt;
out.generatedAt=before&&JSON.stringify(before)===JSON.stringify(after)?(previous.generatedAt||new Date().toISOString()):new Date().toISOString();
fs.writeFileSync(output,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out.summary));
