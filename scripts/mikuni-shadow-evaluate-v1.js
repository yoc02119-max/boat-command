#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const date=process.argv[2]||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),root=path.join(__dirname,'..','live','mikuni',date);
function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function lane(x,race,mode){if(!x||x.schema!=='boat-command-mikuni-shadow-research-v1'||x.venueCode!=='10'||Number(x.race)!==race||x.mode!==mode||x.resultInput!==false||x.payoutInput!==false||x.immutableAfterFirstWrite!==true||!Array.isArray(x.picks)||x.picks.length!==4)return null;return x}
const rows=[];
for(let race=1;race<=12;race++){
  const result=read(path.join(root,'post',`race-${race}-result.json`));if(!result||result.venue!=='MIKUNI'||result.venueCode!=='10'||result.preRaceDataIncluded!==false||result.resultEndpointsIncluded!==true)continue;
  const actual=String(result.trifecta||'');if(!/^[1-6]-[1-6]-[1-6]$/.test(actual))continue;
  const z=lane(read(path.join(root,'shadow','class-baseline',`race-${race}.json`)),race,'CLASS_BASELINE');
  const a=lane(read(path.join(root,'shadow','program-only',`race-${race}.json`)),race,'PROGRAM_ONLY');
  const pack=x=>x?{generatedAt:x.generatedAt,picks:x.picks,hit:x.picks.includes(actual),modelVersion:x.modelVersion,source:x.sources||null}:null;
  if(z||a)rows.push({race,actual,payout100:Number(result.payout100)||0,classBaseline:pack(z),programOnly:pack(a)});
}
function stats(key){const x=rows.filter(r=>r[key]),hits=x.filter(r=>r[key].hit).length,stake=x.length*400,returns=x.filter(r=>r[key].hit).reduce((s,r)=>s+r.payout100,0);return{evaluated:x.length,hits,hitRate:x.length?hits/x.length:null,stake,returns,roi:stake?returns/stake:null}}
const c=stats('classBaseline'),p=stats('programOnly'),paired=rows.filter(r=>r.classBaseline&&r.programOnly);
const out={schema:'boat-command-mikuni-shadow-day-evaluation-v1',venue:'MIKUNI',venueCode:'10',date,generatedAt:new Date().toISOString(),rows,summary:{classBaseline:c,programOnly:p,paired:paired.length,hitRateDelta:paired.length?p.hitRate-c.hitRate:null,roiDelta:paired.length?p.roi-c.roi:null},fundingScope:'NONE_RESEARCH_ONLY',bankrollAffected:false,tryAffected:false,productionAffected:false};
fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'research-evaluation-v1.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out.summary));
