#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const {build}=require('./point-expansion-shadow-v1.js');
const {VARIANTS,VENUES}=require('./daily-lab-report-v1.js');
const root=path.resolve(__dirname,'..');

const validPick=v=>/^[1-6]-[1-6]-[1-6]$/.test(String(v||''))&&new Set(String(v).split('-')).size===3;
const metric=()=>({races:0,hits:0,addedHits:0,stake100:0,payoutOnlyReturn100:0});
const finish=m=>({...m,hitRate:m.races?m.hits/m.races:null,payoutOnlyRoi:m.stake100?m.payoutOnlyReturn100/m.stake100:null});
const read=p=>{try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}};
function emptyVenue(code,slug,name,date,status='NO_REPLAY_INPUT'){
  const summary=Object.fromEntries(VARIANTS.map(k=>[k,finish(metric())]));
  return {code,slug,name,date,captured:0,evaluated:0,pending:0,invalid:0,legacyExcluded:0,status,
    sourceMode:'STRICT_HISTORICAL_REPLAY_V1',observationOnly:true,automaticPromotion:false,productionChanged:false,
    summary,observations:VARIANTS.filter(k=>k!=='BASE4').map(key=>({key,hits:0,addedHits:0,deltaHits:0,hitRate:null,payoutOnlyRoi:null})),races:[]};
}
function programFrom(key,code,t){
  return {venue:key,venueCode:code,date:t.d,race:Number(t.r),raceType:String(t.t||''),
    boats:Array.isArray(t.c)?t.c.map((c,i)=>({lane:i+1,class:c})):[],
    resultEndpointsIncluded:false,resultIncluded:false,exhibitionIncluded:false};
}
function buildHistoricalReplay(date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('HISTORICAL_LAB_DATE_INVALID');
  const venues=[];
  for(const [code,slug,name] of VENUES){
    const historyPath=path.join(root,`${slug}-history-bootstrap-v1.json`);
    const baselinePath=path.join(root,`${slug}-baseline-backtest-v1.json`);
    const modelPath=path.join(root,`${slug}-research-model-v1.js`);
    const db=read(historyPath),baseline=read(baselinePath);
    if(!db||!baseline||!fs.existsSync(modelPath)){venues.push(emptyVenue(code,slug,name,date));continue}
    if(String(db.venueCode)!==code||String(baseline.venueCode)!==code){venues.push(emptyVenue(code,slug,name,date,'REPLAY_IDENTITY_BLOCK'));continue}
    const config=baseline?.calibration?.selected,configCutoff=String(baseline?.calibration?.lastDate||'');
    // A replay date may use only a configuration frozen strictly before that date.
    if(!config||!/^\d{4}-\d{2}-\d{2}$/.test(configCutoff)||configCutoff>=date){
      venues.push(emptyVenue(code,slug,name,date,'REPLAY_CONFIG_NOT_PRIOR'));continue;
    }
    const rows=[...(db.races||[])].sort((a,b)=>String(a.d).localeCompare(String(b.d))||Number(a.r)-Number(b.r));
    const prior=rows.filter(x=>String(x.d)<date),targets=rows.filter(x=>String(x.d)===date);
    if(prior.length<300||!targets.length){venues.push(emptyVenue(code,slug,name,date,targets.length?'REPLAY_HISTORY_SHORT':'NO_RACE_HISTORY'));continue}
    const model=require(modelPath);
    const stats=Object.fromEntries(VARIANTS.map(k=>[k,metric()])),races=[];
    let invalid=0;
    for(const t of targets){
      try{
        if(!Array.isArray(t.c)||t.c.length!==6||!validPick(t.o)||!Number.isFinite(Number(t.p))||Number(t.p)<0)throw Error('TARGET_INVALID');
        const program=programFrom(String(baseline.venue||'').toUpperCase(),code,t);
        const dist=model.distribution(program,prior,{targetDate:date,config,mode:'PROGRAM_ONLY'});
        const base=model.select(dist,{count:4}).map(x=>String(x.order));
        const expansion=build(dist,base),actual=String(t.o),payout=Number(t.p);
        const variants=expansion.variants,row={race:Number(t.r),status:'SETTLED_REPLAY',actual,payout100:payout,base:variants.BASE4,variants:{},
          baselineMiss:null,actualRank:expansion.ranked.findIndex(x=>x.order===actual)+1,
          replayEvidence:{historyStrictlyBeforeDate:true,historyRowsUsed:prior.length,configCutoff,resultReadAfterPrediction:true}};
        const baseHit=variants.BASE4.includes(actual);
        row.baselineMiss=baseHit?'HIT':!variants.BASE4.some(x=>x[0]===actual[0])?'HEAD':!variants.BASE4.some(x=>x.slice(0,3)===actual.slice(0,3))?'SECOND':'THIRD';
        for(const key of VARIANTS){
          const picks=variants[key],hit=picks.includes(actual),added=picks.slice(4),addedHit=added.includes(actual),m=stats[key];
          m.races++;m.hits+=Number(hit);m.addedHits+=Number(addedHit);m.stake100+=picks.length*100;m.payoutOnlyReturn100+=hit?payout:0;
          row.variants[key]={picks,hit,addedHit,added};
        }
        races.push(row);
      }catch(e){invalid++}
    }
    const summary=Object.fromEntries(VARIANTS.map(k=>[k,finish(stats[k])])),baseHits=summary.BASE4.hits;
    const observations=VARIANTS.filter(k=>k!=='BASE4').map(k=>({key:k,hits:summary[k].hits,addedHits:summary[k].addedHits,
      deltaHits:summary[k].hits-baseHits,hitRate:summary[k].hitRate,payoutOnlyRoi:summary[k].payoutOnlyRoi}))
      .sort((a,b)=>b.deltaHits-a.deltaHits||b.addedHits-a.addedHits||VARIANTS.indexOf(a.key)-VARIANTS.indexOf(b.key));
    venues.push({code,slug,name,date,captured:races.length,evaluated:races.length,pending:0,invalid,legacyExcluded:0,
      status:races.length?'REPLAY_EVALUATED':'NO_REPLAY_ROWS',sourceMode:'STRICT_HISTORICAL_REPLAY_V1',
      observationOnly:true,automaticPromotion:false,productionChanged:false,summary,observations,races,
      replayBoundary:{historyStrictlyBeforeDate:true,minimumPriorRows:300,configCutoff,resultReadAfterPrediction:true,crossVenueWeightsReused:false}});
  }
  const totals={venues:24,venuesCaptured:venues.filter(v=>v.captured>0).length,
    capturedRaces:venues.reduce((s,v)=>s+v.captured,0),evaluatedRaces:venues.reduce((s,v)=>s+v.evaluated,0),pendingRaces:0,
    baseHits:venues.reduce((s,v)=>s+v.summary.BASE4.hits,0),rank6Hits:venues.reduce((s,v)=>s+v.summary.RANK6.hits,0),rank8Hits:venues.reduce((s,v)=>s+v.summary.RANK8.hits,0)};
  return {schema:'boat-command-daily-lab-v1',version:'DAILY-LAB-STRICT-REPLAY-V1',date,sourceMode:'STRICT_HISTORICAL_REPLAY_V1',
    researchOnly:true,resultBlindSelection:true,strictWalkForward:true,sameDayRowsExcluded:true,automaticPromotion:false,
    productionChanged:false,tryChanged:false,bankrollChanged:false,accounting:'PAYOUT_ONLY_REFUNDS_NOT_ACCOUNTED_NOT_SETTLED_ROI',
    variants:{BASE4:'現行4点',RANK6:'順位6点',RANK8:'順位8点',HEAD6:'1着筋拡張6点',SECOND6:'2着筋拡張6点',THIRD6:'3着筋拡張6点'},
    totals,venues};
}
if(require.main===module){const x=buildHistoricalReplay(process.argv[2]);process.stdout.write(JSON.stringify(x,null,2)+'\n')}
module.exports={buildHistoricalReplay};
