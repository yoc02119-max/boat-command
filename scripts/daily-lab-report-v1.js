#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const outPath=path.join(root,'daily-lab-v1.json');
const VARIANTS=['BASE4','RANK6','RANK8','HEAD6','SECOND6','THIRD6'];
const VENUES=[
  ['01','kiryu','桐生'],['02','toda','戸田'],['03','edogawa','江戸川'],['04','heiwajima','平和島'],
  ['05','tamagawa','多摩川'],['06','hamanako','浜名湖'],['07','gamagori','蒲郡'],['08','tokoname','常滑'],
  ['09','tsu','津'],['10','mikuni','三国'],['11','biwako','びわこ'],['12','suminoe','住之江'],
  ['13','amagasaki','尼崎'],['14','naruto','鳴門'],['15','marugame','丸亀'],['16','kojima','児島'],
  ['17','miyajima','宮島'],['18','tokuyama','徳山'],['19','shimonoseki','下関'],['20','wakamatsu','若松'],
  ['21','ashiya','芦屋'],['22','fukuoka','福岡'],['23','karatsu','唐津'],['24','omura','大村']
];
function todayJst(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function read(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function validPick(v){return /^[1-6]-[1-6]-[1-6]$/.test(String(v||''))&&new Set(String(v).split('-')).size===3}
function cleanPicks(v){return Array.isArray(v)?v.map(String).filter(validPick):[]}
function metric(){return {races:0,hits:0,addedHits:0,stake100:0,payoutOnlyReturn100:0}}
function pct(hit,n){return n?hit/n:null}
function roi(ret,stake){return stake?ret/stake:null}
function summarizeVariant(m){return {...m,hitRate:pct(m.hits,m.races),payoutOnlyRoi:roi(m.payoutOnlyReturn100,m.stake100)}}

const date=process.argv[2]||todayJst();
if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('DAILY_LAB_DATE_INVALID');
const venues=[];
for(const [code,slug,name] of VENUES){
  const stats=Object.fromEntries(VARIANTS.map(k=>[k,metric()]));
  const races=[];
  let captured=0,evaluated=0,pending=0,invalid=0;
  for(let race=1;race<=12;race++){
    const shadowPath=path.join(root,'live',slug,date,'shadow','program-only',`race-${race}.json`);
    const s=read(shadowPath);
    if(!s?.pointExpansion||s.pointExpansion.status!=='FROZEN_WITH_BASELINE')continue;
    const variants={};
    let variantOk=true;
    for(const key of VARIANTS){
      const picks=cleanPicks(s.pointExpansion?.variants?.[key]);
      if(!picks.length||(key==='BASE4'&&picks.length!==4)){variantOk=false;break}
      if(key!=='BASE4'&&picks.slice(0,4).join('|')!==cleanPicks(s.pointExpansion?.variants?.BASE4).join('|')){variantOk=false;break}
      variants[key]=picks;
    }
    if(!variantOk){invalid++;continue}
    captured++;
    const result=read(path.join(root,'live',slug,date,'post',`race-${race}-result.json`));
    const actual=validPick(result?.trifecta)?String(result.trifecta):null;
    const payout=Number(result?.payout100);
    const hasResult=!!actual&&Number.isFinite(payout)&&payout>=0;
    if(!hasResult){pending++;races.push({race,status:'PENDING',base:variants.BASE4,variants});continue}
    evaluated++;
    const row={race,status:'SETTLED',actual,payout100:payout,base:variants.BASE4,variants:{},baselineMiss:null,actualRank:null};
    const ranked=(s.pointExpansion?.ranked||[]).map(x=>String(x?.order||''));
    row.actualRank=ranked.indexOf(actual)>=0?ranked.indexOf(actual)+1:null;
    const baseHit=variants.BASE4.includes(actual);
    row.baselineMiss=baseHit?'HIT':!variants.BASE4.some(x=>x[0]===actual[0])?'HEAD':!variants.BASE4.some(x=>x.slice(0,3)===actual.slice(0,3))?'SECOND':'THIRD';
    for(const key of VARIANTS){
      const picks=variants[key],hit=picks.includes(actual),added=picks.slice(4),addedHit=added.includes(actual);
      const m=stats[key];m.races++;m.hits+=Number(hit);m.addedHits+=Number(addedHit);m.stake100+=picks.length*100;m.payoutOnlyReturn100+=hit?payout:0;
      row.variants[key]={picks,hit,addedHit,added};
    }
    races.push(row);
  }
  const summary=Object.fromEntries(VARIANTS.map(k=>[k,summarizeVariant(stats[k])]));
  const baseHits=summary.BASE4.hits;
  const observations=VARIANTS.filter(k=>k!=='BASE4').map(k=>({
    key:k,hits:summary[k].hits,addedHits:summary[k].addedHits,deltaHits:summary[k].hits-baseHits,
    hitRate:summary[k].hitRate,payoutOnlyRoi:summary[k].payoutOnlyRoi
  }));
  observations.sort((a,b)=>b.deltaHits-a.deltaHits||b.addedHits-a.addedHits||VARIANTS.indexOf(a.key)-VARIANTS.indexOf(b.key));
  venues.push({
    code,slug,name,date,captured,evaluated,pending,invalid,
    status:captured?'COLLECTING':'NO_CAPTURE',
    observationOnly:true,automaticPromotion:false,productionChanged:false,
    summary,observations,races
  });
}
const totals={
  venues:24,
  venuesCaptured:venues.filter(v=>v.captured>0).length,
  capturedRaces:venues.reduce((s,v)=>s+v.captured,0),
  evaluatedRaces:venues.reduce((s,v)=>s+v.evaluated,0),
  pendingRaces:venues.reduce((s,v)=>s+v.pending,0),
  baseHits:venues.reduce((s,v)=>s+v.summary.BASE4.hits,0),
  rank6Hits:venues.reduce((s,v)=>s+v.summary.RANK6.hits,0),
  rank8Hits:venues.reduce((s,v)=>s+v.summary.RANK8.hits,0)
};
const output={
  schema:'boat-command-daily-lab-v1',version:'DAILY-LAB-V1',date,
  researchOnly:true,resultBlindSelection:true,automaticPromotion:false,
  productionChanged:false,tryChanged:false,bankrollChanged:false,
  accounting:'PAYOUT_ONLY_REFUNDS_NOT_ACCOUNTED_NOT_SETTLED_ROI',
  variants:{
    BASE4:'現行4点',RANK6:'順位6点',RANK8:'順位8点',HEAD6:'1着筋拡張6点',SECOND6:'2着筋拡張6点',THIRD6:'3着筋拡張6点'
  },
  totals,venues
};
if(output.venues.length!==24)throw new Error('DAILY_LAB_24_VENUES_REQUIRED');
if(output.venues.some(v=>v.code.length!==2||v.automaticPromotion!==false||v.productionChanged!==false))throw new Error('DAILY_LAB_BOUNDARY_INVALID');
const next=JSON.stringify(output,null,2)+'\n';
const prev=fs.existsSync(outPath)?fs.readFileSync(outPath,'utf8'):null;
if(prev!==next)fs.writeFileSync(outPath,next);
console.log(JSON.stringify({status:'PASS',date,...totals,changed:prev!==next}));
