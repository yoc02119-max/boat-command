#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','live','toda'),rows=[];
if(fs.existsSync(root))for(const date of fs.readdirSync(root).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort()){const p=path.join(root,date,'research-evaluation-v1.json');if(!fs.existsSync(p))continue;try{const x=JSON.parse(fs.readFileSync(p,'utf8'));if(x.venueCode==='02')for(const r of x.rows||[])rows.push({date,...r})}catch{}}
const hits=rows.filter(x=>x.hit).length,stake=rows.length*400,returns=rows.filter(x=>x.hit).reduce((s,x)=>s+Number(x.payout100||0),0);
const out={schema:'boat-command-toda-shadow-evaluation-v1',venue:'TODA',venueCode:'02',generatedAt:new Date().toISOString(),evaluatedRows:rows.length,evaluationDays:new Set(rows.map(x=>x.date)).size,hits,hitRate:rows.length?hits/rows.length:null,stake,returns,roi:stake?returns/stake:null,earlyReviewReady:rows.length>=36,targetReviewReady:rows.length>=60,fundingScope:'NONE',cashNeutral:true,realMoney:false,boundaries:{predictionMutation:false,bankrollMutation:false,tryMutation:false}};
fs.writeFileSync(path.join(__dirname,'..','toda-shadow-evaluation-v1.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
