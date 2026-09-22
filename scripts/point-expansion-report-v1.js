#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const {evaluate,VERSION}=require('./point-expansion-shadow-v1.js');
const root=path.resolve(__dirname,'..');
const slugs=['kiryu','toda','edogawa','heiwajima','tamagawa','hamanako','gamagori','tokoname','tsu','mikuni','biwako','suminoe','amagasaki','naruto','marugame','kojima','miyajima','tokuyama','shimonoseki','wakamatsu','ashiya','fukuoka','karatsu','omura'];
function read(p){return JSON.parse(fs.readFileSync(p,'utf8'))}
const report={version:VERSION,generatedAt:new Date().toISOString(),researchOnly:true,
  automaticPromotion:false,realMoney:false,selectionPolicy:'ALL_VARIANTS_PER_VENUE_NO_AUTOMATIC_WINNER',
  accounting:'PAYOUT_ONLY_REFUNDS_NOT_ACCOUNTED_NOT_SETTLED_ROI',venues:[],errors:[]};
for(const slug of slugs){
  const dir=path.join(root,'live',slug),groups=new Map();
  let legacy=0,pending=0,invalid=0,captured=0;
  for(const date of fs.existsSync(dir)?fs.readdirSync(dir).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort():[]){
    for(let race=1;race<=12;race++){
      const p=path.join(dir,date,'shadow','program-only',`race-${race}.json`);
      if(!fs.existsSync(p))continue;
      try{
        const s=read(p);
        if(!s.pointExpansion){legacy++;continue;}
        if(s.pointExpansion.status!=='FROZEN_WITH_BASELINE'){invalid++;continue;}
        captured++;
        const resultPath=path.join(dir,date,'post',`race-${race}-result.json`);
        if(!fs.existsSync(resultPath)){pending++;continue;}
        const row=evaluate(s,read(resultPath));
        if(!row){invalid++;continue;}
        const key=`${row.modelVersion}:${row.configHash}`;
        if(!groups.has(key))groups.set(key,{modelVersion:row.modelVersion,configHash:row.configHash,rows:[]});
        groups.get(key).rows.push(row);
      }catch(e){invalid++;report.errors.push({slug,date,race,message:e.message});}
    }
  }
  const cohorts=[...groups.values()].map(g=>{
    const summary={};
    for(const row of g.rows)for(const [key,v]of Object.entries(row.variants)){
      const s=summary[key]||(summary[key]={races:0,hits:0,addedHits:0,stake100:0,payoutOnlyReturn100:0,addedStake100:0,addedPayoutOnlyReturn100:0,fixedBudgetStake:0,fixedBudgetPayoutOnlyReturn:0});
      s.races++;s.hits+=Number(v.hit);s.addedHits+=Number(v.addedHit);
      for(const k of ['stake100','payoutOnlyReturn100','addedStake100','addedPayoutOnlyReturn100','fixedBudgetStake','fixedBudgetPayoutOnlyReturn'])s[k]+=v[k];
    }
    return {...g,days:new Set(g.rows.map(r=>r.date)).size,summary,
      decision:'OBSERVATION_ONLY_REQUIRES_SEPARATE_HOLDOUT_AND_FORWARD_REVIEW'};
  });
  report.venues.push({slug,captured,legacyExcluded:legacy,pending,invalid,
    status:captured?'FORWARD_COLLECTION':'WAITING_FOR_NEW_PRE_RACE_CAPTURE',cohorts});
}
const out=process.argv[2];
if(!out)throw Error('OUTPUT_PATH_REQUIRED');
fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({venues:report.venues.length,captured:report.venues.reduce((s,v)=>s+v.captured,0),errors:report.errors.length}));
