#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const date=process.argv[2]||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const root=path.join(__dirname,'..','live','toda',date);
function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
const rows=[];
for(let race=1;race<=12;race++){
  const result=read(path.join(root,'post',`race-${race}-result.json`)),shadow=read(path.join(root,'shadow','program-only',`race-${race}.json`));
  if(!result||result.venue!=='TODA'||result.venueCode!=='02'||result.preRaceDataIncluded!==false||result.resultEndpointsIncluded!==true)continue;
  if(!shadow||shadow.schema!=='boat-command-toda-shadow-research-v1'||shadow.resultInput!==false||shadow.payoutInput!==false||shadow.immutableAfterFirstWrite!==true)continue;
  const actual=String(result.trifecta||''),picks=Array.isArray(shadow.picks)?shadow.picks:[];
  if(!/^[1-6]-[1-6]-[1-6]$/.test(actual)||picks.length!==4)continue;
  rows.push({race,actual,payout100:Number(result.payout100)||0,generatedAt:shadow.generatedAt,picks,hit:picks.includes(actual),modelVersion:shadow.modelVersion,source:shadow.sources||null});
}
const hits=rows.filter(x=>x.hit).length,stake=rows.length*400,returns=rows.filter(x=>x.hit).reduce((s,x)=>s+x.payout100,0);
const out={schema:'boat-command-toda-shadow-day-evaluation-v1',venue:'TODA',venueCode:'02',date,generatedAt:new Date().toISOString(),rows,summary:{evaluated:rows.length,hits,hitRate:rows.length?hits/rows.length:null,stake,returns,roi:stake?returns/stake:null},fundingScope:'NONE_RESEARCH_ONLY',bankrollAffected:false,tryAffected:false,productionAffected:false};
fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'research-evaluation-v1.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out.summary));
