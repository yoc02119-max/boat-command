#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {evaluate}=require('./point-expansion-shadow-v1.js');
const root=path.resolve(__dirname,'..');
const VENUES=[
  ['01','kiryu'],['02','toda'],['03','edogawa'],['04','heiwajima'],
  ['05','tamagawa'],['06','hamanako'],['07','gamagori'],['08','tokoname'],
  ['09','tsu'],['10','mikuni'],['11','biwako'],['12','suminoe'],
  ['13','amagasaki'],['14','naruto'],['15','marugame'],['16','kojima'],
  ['17','miyajima'],['18','tokuyama'],['19','shimonoseki'],['20','wakamatsu'],
  ['21','ashiya'],['22','fukuoka'],['23','karatsu'],['24','omura']
];
const CLASS={A1:3,A2:2,B1:1,B2:0};
const METHODS=['MODEL_SECOND','CLASS','AVG_ST','LOCAL_2_RATE','MOTOR_2_RATE'];
const empty=()=>Object.fromEntries(METHODS.map(k=>[k,{eligible:0,secondHits:0}]));
const read=p=>{try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}};

function pairCandidates(snapshot){
  const f=snapshot?.preRaceFeatures,boats=f?.boats;
  if(f?.schema!=='boat-command-pre-race-feature-freeze-v1'||f.researchOnly!==true||
     f.resultInput!==false||f.payoutInput!==false||
     f.programFetchedAt!==snapshot?.sources?.programFetchedAt||
     !Array.isArray(boats)||boats.length!==6||
     boats.some((b,i)=>Number(b.lane)!==i+1))return null;
  const fetched=Date.parse(f.programFetchedAt),generated=Date.parse(snapshot.generatedAt);
  const deadline=Date.parse(`${snapshot.date}T${snapshot.deadline}:00+09:00`);
  if(!Number.isFinite(fetched)||!Number.isFinite(generated)||
     !Number.isFinite(deadline)||fetched>generated||generated>deadline-180000||
     snapshot.mode!=='PROGRAM_ONLY'||snapshot.resultInput!==false||snapshot.payoutInput!==false||
     snapshot.researchOnly!==true||snapshot.productionEnabled!==false||
     snapshot.tryEnabled!==false||snapshot.immutableAfterFirstWrite!==true)return null;
  const others=boats.slice(1);
  function topTwo(score){
    const values=others.map(b=>({lane:Number(b.lane),score:score(b)}));
    if(values.some(x=>!Number.isFinite(x.score)))return null;
    return values.sort((a,b)=>b.score-a.score||a.lane-b.lane).slice(0,2).map(x=>x.lane);
  }
  const ranked=snapshot.pointExpansion?.ranked;
  if(!Array.isArray(ranked)||ranked.length!==120)return null;
  const model=topTwo(b=>ranked.reduce((sum,x)=>{
    const order=String(x.order||'');
    return sum+(order[0]==='1'&&Number(order[2])===b.lane?Number(x.probability)||0:0);
  },0));
  return {
    MODEL_SECOND:model,
    CLASS:topTwo(b=>Object.hasOwn(CLASS,b.class)?CLASS[b.class]:NaN),
    AVG_ST:topTwo(b=>Number.isFinite(b.avgST)?-b.avgST:NaN),
    LOCAL_2_RATE:topTwo(b=>Number.isFinite(b.local2Rate)?b.local2Rate:NaN),
    MOTOR_2_RATE:topTwo(b=>Number.isFinite(b.motor2Rate)?b.motor2Rate:NaN)
  };
}

function auditRace(snapshot,result){
  // Pair selection consumes only immutable PRE-RACE fields, before result evaluation.
  const pairs=pairCandidates(snapshot);
  if(!pairs)return null;
  let checked=null;
  try{checked=evaluate(snapshot,result)}catch{return null}
  if(!checked)return null;
  if(String(checked.actual)[0]!=='1')return {firstOne:false,pairs};
  const actualSecond=Number(String(checked.actual)[2]);
  return {firstOne:true,pairs,actualSecond};
}

function todayJst(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function buildReport(date=todayJst(),base=root){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('AUDIT_DATE_INVALID');
  const from=new Date(Date.parse(`${date}T00:00:00Z`)-29*86400000).toISOString().slice(0,10);
  const totals={snapshotsWithFeatures:0,verifiedResults:0,firstOneRaces:0,methods:empty()};
  const venues=[];
  for(const [code,slug] of VENUES){
    const v={code,slug,snapshotsWithFeatures:0,verifiedResults:0,firstOneRaces:0,methods:empty()};
    const dir=path.join(base,'live',slug);
    const dates=fs.existsSync(dir)?fs.readdirSync(dir).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d>=from&&d<=date):[];
    for(const day of dates)for(let race=1;race<=12;race++){
      const s=read(path.join(dir,day,'shadow','program-only',`race-${race}.json`));
      if(!s?.preRaceFeatures)continue;
      v.snapshotsWithFeatures++;totals.snapshotsWithFeatures++;
      const result=read(path.join(dir,day,'post',`race-${race}-result.json`));
      if(!result)continue;
      const row=auditRace(s,result);
      if(!row)continue;
      v.verifiedResults++;totals.verifiedResults++;
      if(!row.firstOne)continue;
      v.firstOneRaces++;totals.firstOneRaces++;
      for(const method of METHODS){
        const pair=row.pairs[method];
        if(!pair)continue;
        for(const stats of [v.methods[method],totals.methods[method]]){
          stats.eligible++;
          stats.secondHits+=Number(pair.includes(row.actualSecond));
        }
      }
    }
    venues.push(v);
  }
  return {schema:'boat-command-second-place-feature-audit-v1',date,window:{from,to:date},
    source:'IMMUTABLE_PROGRAM_ONLY_FEATURES_AND_VERIFIED_POST_RESULT',
    researchOnly:true,productionChanged:false,bankrollChanged:false,
    selectionUsesResults:false,secondPlaceOnlyNotTicketRoi:true,totals,venues};
}
if(require.main===module){
  const report=buildReport(process.argv[2]||todayJst());
  const out=path.join(root,'daily-lab','second-place-feature-audit-v1.json');
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
  console.log('SECOND_PLACE_FEATURE_AUDIT',report.date,report.totals);
}
module.exports={pairCandidates,auditRace,buildReport};
