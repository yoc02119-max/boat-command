#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {capture}=require('./point-expansion-shadow-v1.js');

const root=path.resolve(__dirname,'..');
const HISTORY_PATH=path.join(root,'gamagori-2026-base-v131.json');
const VERSION='GAMAGORI-POINT-EXPANSION-ADAPTER-V1';
const MODEL_VERSION='FROZEN_BASELINE_V0.29.1';
const LOCK_MARGIN_MS=3*60*1000;
const VALID_CLASSES=new Set(['A1','A2','B1','B2']);
const ORDERS=[];
for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)if(a!==b&&a!==c&&b!==c)ORDERS.push(`${a}-${b}-${c}`);
const validPick=v=>/^[1-6]-[1-6]-[1-6]$/.test(String(v||''))&&new Set(String(v).split('-')).size===3;
const history=(JSON.parse(fs.readFileSync(HISTORY_PATH,'utf8')).races||[]).filter(x=>validPick(x.o));

function sha256(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}
function jstDate(offsetDays=0){
  const d=new Date(Date.now()+offsetDays*86400000);
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
}
function programClasses(program){
  if(!program||program.schema!=='boat-command-program-pack-v1'||program.venue!=='GAMAGORI'||program.venueCode!=='07')throw Error('PROGRAM_CONTRACT_INVALID');
  if(program.exhibitionIncluded!==false||program.resultEndpointsIncluded!==false||program.resultIncluded!==false)throw Error('PROGRAM_BOUNDARY_INVALID');
  const boats=[...(program.boats||[])].sort((a,b)=>Number(a.lane)-Number(b.lane));
  if(boats.length!==6||boats.some((b,i)=>Number(b.lane)!==i+1||!VALID_CLASSES.has(String(b.class))))throw Error('PROGRAM_BOATS_INVALID');
  return boats.map(b=>String(b.class));
}
function scoreMap(classes,race,targetDate){
  const scores=new Map();
  for(const h of history){
    if(String(h.d)>=String(targetDate))continue;
    let sim=.06;
    if(Number(h.r)===Number(race))sim+=.18;
    if(h.c.join('-')===classes.join('-'))sim+=1.25;
    let same=0;
    for(let i=0;i<6;i++)if(h.c[i]===classes[i])same++;
    sim+=same*.34;
    if(same===6)sim+=2.5;
    scores.set(h.o,(scores.get(h.o)||0)+sim);
  }
  return scores;
}
function productionPicks(classes,race,targetDate){
  return [...scoreMap(classes,race,targetDate)].sort((a,b)=>b[1]-a[1]).slice(0,4).map(x=>x[0]);
}
function distribution(classes,race,targetDate){
  const scores=scoreMap(classes,race,targetDate);
  const observed=[...scores.entries()].map(([order,score],i)=>({order,score,firstSeen:i}))
    .sort((a,b)=>b.score-a.score||a.firstSeen-b.firstSeen);
  if(observed.length<4)throw Error('INSUFFICIENT_BASELINE_HISTORY');
  const unseen=ORDERS.filter(x=>!scores.has(x)).map((order,i)=>({order,score:0,firstSeen:1e9+i}));
  const ranked=[...observed,...unseen];
  if(ranked.length!==120||new Set(ranked.map(x=>x.order)).size!==120)throw Error('FULL_RANKING_INVALID');
  const total=ranked.reduce((s,x)=>s+x.score,0);
  if(!(total>0))throw Error('FULL_RANKING_ZERO_MASS');
  const rows=ranked.map(x=>({order:x.order,probability:x.score/total}));
  const base=productionPicks(classes,race,targetDate);
  if(JSON.stringify(base)!==JSON.stringify(rows.slice(0,4).map(x=>x.order)))throw Error('PRODUCTION_BASELINE_PREFIX_MISMATCH');
  return {rows,config:{adapter:VERSION,productionModel:MODEL_VERSION,historyFile:path.basename(HISTORY_PATH),historyRows:history.filter(x=>String(x.d)<String(targetDate)).length}};
}
function deadlineMs(date,hm){
  if(!/^\d{1,2}:\d{2}$/.test(String(hm||'')))return NaN;
  return Date.parse(`${date}T${hm}:00+09:00`);
}
function makeSnapshot(program,programPath,now=new Date()){
  const date=String(program.date),race=Number(program.race),classes=programClasses(program);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!(race>=1&&race<=12))throw Error('PROGRAM_TARGET_INVALID');
  const deadline=deadlineMs(date,program.deadline),generated=now.getTime(),fetched=Date.parse(String(program.fetchedAt||''));
  if(!Number.isFinite(deadline)||!Number.isFinite(fetched))throw Error('PROGRAM_TIMING_INVALID');
  if(fetched>deadline-LOCK_MARGIN_MS)throw Error('PROGRAM_SNAPSHOT_TOO_LATE');
  if(generated>deadline-LOCK_MARGIN_MS)throw Error('CAPTURE_WINDOW_CLOSED');
  const dist=distribution(classes,race,date),base=dist.rows.slice(0,4).map(x=>x.order);
  const pointExpansion=capture(dist,base,'PROGRAM_ONLY');
  if(pointExpansion?.status!=='FROZEN_WITH_BASELINE')throw Error(`POINT_EXPANSION_CAPTURE_FAILED_${pointExpansion?.reason||'UNKNOWN'}`);
  const safeHistory=history.filter(x=>String(x.d)<date);
  return {
    schema:'boat-command-gamagori-point-expansion-shadow-v1',
    version:VERSION,
    venue:'GAMAGORI',venueCode:'07',date,race,mode:'PROGRAM_ONLY',
    generatedAt:now.toISOString(),deadline:String(program.deadline),
    modelVersion:`${MODEL_VERSION}+POINT-EXPANSION-V1`,
    modelArchitecture:'GAMAGORI_FROZEN_BASELINE_FULL_RANKING',
    modelConfig:dist.config,
    historyRows:safeHistory.length,
    historyCutoff:safeHistory.length?safeHistory.at(-1).d:null,
    sources:{
      programPath:path.relative(root,programPath).replace(/\\/g,'/'),
      programSha256:sha256(programPath),
      programFetchedAt:program.fetchedAt||null,
      historyPath:path.relative(root,HISTORY_PATH).replace(/\\/g,'/')
    },
    picks:base,
    probabilities:dist.rows.slice(0,4),
    pointExpansion,
    probabilitySum:dist.rows.reduce((s,x)=>s+x.probability,0),
    resultInput:false,payoutInput:false,researchOnly:true,productionEnabled:false,tryEnabled:false,
    cashNeutral:true,immutableAfterFirstWrite:true,productionBaselineUnchanged:true,selectionUsesResults:false
  };
}
function targetDates(args){
  const explicit=args.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x));
  return explicit.length?explicit:[jstDate(0),jstDate(1)];
}
function run(args=process.argv.slice(2),now=new Date()){
  const summary={version:VERSION,dates:[],created:0,existing:0,skipped:0,errors:[]};
  for(const date of targetDates(args)){
    const programDir=path.join(root,'live','gamagori',date,'program');
    if(!fs.existsSync(programDir)){summary.dates.push({date,status:'NO_PROGRAM_DIR'});continue}
    let dateCreated=0;
    for(let race=1;race<=12;race++){
      const programPath=path.join(programDir,`race-${race}.json`);
      if(!fs.existsSync(programPath)){summary.skipped++;continue}
      const out=path.join(root,'live','gamagori',date,'shadow','program-only',`race-${race}.json`);
      if(fs.existsSync(out)){summary.existing++;continue}
      try{
        const program=JSON.parse(fs.readFileSync(programPath,'utf8'));
        const snapshot=makeSnapshot(program,programPath,now);
        fs.mkdirSync(path.dirname(out),{recursive:true});
        try{fs.writeFileSync(out,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});summary.created++;dateCreated++}
        catch(e){if(e.code==='EEXIST')summary.existing++;else throw e}
      }catch(e){
        if(['CAPTURE_WINDOW_CLOSED','PROGRAM_SNAPSHOT_TOO_LATE'].includes(e.message)){summary.skipped++;continue}
        summary.errors.push({date,race,message:e.message});
      }
    }
    summary.dates.push({date,status:dateCreated?'CAPTURED':'NO_NEW_CAPTURE',created:dateCreated});
  }
  console.log(JSON.stringify(summary));
  if(summary.errors.length)process.exitCode=1;
  return summary;
}
if(require.main===module)run();
module.exports={VERSION,MODEL_VERSION,ORDERS,programClasses,scoreMap,productionPicks,distribution,deadlineMs,makeSnapshot,targetDates,run};
