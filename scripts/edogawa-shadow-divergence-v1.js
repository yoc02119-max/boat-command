#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'..');
const date=process.argv[2]||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const base=path.join(root,'live','edogawa',date,'shadow');

function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function valid(x,mode,race){
  return x&&x.schema==='boat-command-edogawa-shadow-research-v1'&&x.venueCode==='03'&&x.date===date&&Number(x.race)===race&&x.mode===mode&&Array.isArray(x.picks)&&x.picks.length===4;
}
function compare(a,b){
  const rows=[];
  for(let race=1;race<=12;race++){
    const x=read(path.join(base,a.dir,`race-${race}.json`));
    const y=read(path.join(base,b.dir,`race-${race}.json`));
    if(!valid(x,a.mode,race)||!valid(y,b.mode,race))continue;
    const overlap=x.picks.filter(p=>y.picks.includes(p)).length;
    rows.push({
      race,
      topSame:x.picks[0]===y.picks[0],
      setSame:overlap===4,
      orderedSame:x.picks.join('|')===y.picks.join('|'),
      overlap,
      jaccard:overlap/(8-overlap),
      aTop:x.picks[0],bTop:y.picks[0]
    });
  }
  const n=rows.length;
  return {
    pairedRaces:n,
    topChanged:n?rows.filter(r=>!r.topSame).length:0,
    topChangeRate:n?rows.filter(r=>!r.topSame).length/n:null,
    setChanged:n?rows.filter(r=>!r.setSame).length:0,
    setChangeRate:n?rows.filter(r=>!r.setSame).length/n:null,
    orderedChanged:n?rows.filter(r=>!r.orderedSame).length:0,
    averageOverlap:n?rows.reduce((s,r)=>s+r.overlap,0)/n:null,
    averageJaccard:n?rows.reduce((s,r)=>s+r.jaccard,0)/n:null,
    rows
  };
}
const cp=compare({dir:'class-baseline',mode:'CLASS_BASELINE'},{dir:'program-only',mode:'PROGRAM_ONLY'});
const pf=compare({dir:'program-only',mode:'PROGRAM_ONLY'},{dir:'full-pre',mode:'FULL_PRE_RACE'});
const out={
  schema:'boat-command-edogawa-shadow-divergence-v1',
  version:'EDOGAWA-SHADOW-DIVERGENCE-V1',
  venue:'EDOGAWA',venueCode:'03',date,
  generatedAt:null,
  classBaselineVsProgramOnly:cp,
  programOnlyVsFullPre:pf,
  diagnosticOnly:true,
  resultInput:false,payoutInput:false,
  bankrollAffected:false,productionEnabled:false,tryEnabled:false
};
const outPath=path.join(root,'live','edogawa',date,'shadow-divergence-v1.json');
const _previous=read(outPath),_before=_previous?{..._previous}:null,_after={...out};
if(_before)delete _before.generatedAt;delete _after.generatedAt;
out.generatedAt=_before&&JSON.stringify(_before)===JSON.stringify(_after)?(_previous.generatedAt||new Date().toISOString()):new Date().toISOString();
fs.writeFileSync(outPath,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({
  classVsProgram:{paired:cp.pairedRaces,topChangeRate:cp.topChangeRate,setChangeRate:cp.setChangeRate,avgOverlap:cp.averageOverlap},
  programVsFull:{paired:pf.pairedRaces,topChangeRate:pf.topChangeRate,setChangeRate:pf.setChangeRate,avgOverlap:pf.averageOverlap}
},null,2));
