#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const model=require('../mikuni-research-model-v1.js');

const ROOT=path.join(__dirname,'..');
const LIVE=path.join(ROOT,'live','mikuni');
const HISTORY_PATH=path.join(ROOT,'mikuni-history-bootstrap-v1.json');
const REPORT_PATH=path.join(ROOT,'mikuni-second-place-concentration-guard-v2.json');
const FREEZE_MARGIN_MS=3*60*1000;

function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'))}
function writeJson(p,x){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n')}
function sha256(s){return crypto.createHash('sha256').update(s).digest('hex')}
function dateDirs(){
  return fs.existsSync(LIVE)
    ?fs.readdirSync(LIVE,{withFileTypes:true}).filter(x=>x.isDirectory()&&/^\d{4}-\d{2}-\d{2}$/.test(x.name)).map(x=>x.name).sort()
    :[];
}
function headOf(order){return String(order).split('-')[0]}
function secondOf(order){return String(order).split('-')[1]}
function uniq(xs){return [...new Set(xs)]}

function guardSelect(dist,cfg){
  const count=4,all=Array.isArray(dist?.rows)?dist.rows:[],base=all.slice(0,count);
  if(base.length<count)return base;
  const primaryHead=headOf(all[0].order);
  const headRows=all.filter(x=>headOf(x.order)===primaryHead);
  const headMass=headRows.reduce((s,x)=>s+Number(x.probability||0),0);
  if(headMass<Number(cfg.minHeadMass))return base;
  const basePrimary=base.filter(x=>headOf(x.order)===primaryHead);
  if(basePrimary.length<3)return base;
  const represented=uniq(basePrimary.map(x=>secondOf(x.order)));
  if(represented.length>Number(cfg.maxDistinctSeconds))return base;

  const altGroups=new Map();
  for(const x of headRows){
    const second=secondOf(x.order);
    if(represented.includes(second))continue;
    if(!altGroups.has(second))altGroups.set(second,{second,mass:0,best:x});
    const g=altGroups.get(second);
    g.mass+=Number(x.probability||0);
    if(Number(x.probability||0)>Number(g.best.probability||0))g.best=x;
  }
  const alts=[...altGroups.values()]
    .sort((a,b)=>b.mass-a.mass||Number(b.best.probability)-Number(a.best.probability))
    .map(x=>x.best);
  if(!alts.length)return base;

  const out=[...base];
  const replaceable=out.map((x,i)=>({x,i}))
    .filter(z=>headOf(z.x.order)===primaryHead)
    .sort((a,b)=>Number(a.x.probability)-Number(b.x.probability));

  let applied=0;
  for(const alt of alts){
    if(applied>=Number(cfg.replacements)||!replaceable.length)break;
    const target=replaceable.shift();
    if(out.some(x=>x.order===alt.order))continue;
    out[target.i]=alt;applied++;
  }
  return out.sort((a,b)=>Number(b.probability)-Number(a.probability));
}

function validateProgram(x,date,race){
  if(!x||x.programReady!==true)throw new Error('PROGRAM_NOT_READY');
  if((x.venue!=='MIKUNI'&&String(x.venueCode)!=='10')||String(x.date)!==date||Number(x.race)!==race)throw new Error('PROGRAM_IDENTITY_INVALID');
  if(x.resultEndpointsIncluded!==false||x.resultIncluded!==false||x.exhibitionIncluded!==false)throw new Error('PRE_BOUNDARY_INVALID');
  const boats=[...(x.boats||[])].sort((a,b)=>Number(a.lane)-Number(b.lane));
  if(boats.length!==6||boats.some((b,i)=>Number(b.lane)!==i+1))throw new Error('BOATS_INVALID');
  return boats;
}

const dates=dateDirs();
if(!dates.length)throw new Error('NO_LIVE_DATES');
const date=process.argv[2]||dates.at(-1);
const history=readJson(HISTORY_PATH);
if(history.venueCode!=='10')throw new Error('HISTORY_INVALID');

const report=readJson(REPORT_PATH);
if(report.schema!=='boat-command-mikuni-second-place-concentration-guard-v2')throw new Error('REPORT_INVALID');
if(Number(report?.holdout?.hitRateDelta)<0||Number(report?.holdout?.roiDelta)<=0||Number(report?.holdout?.secondCoverageDelta)<0)throw new Error('HOLDOUT_GATE_NOT_MET');
const cfg=report?.calibration?.selected;
if(!cfg)throw new Error('SELECTED_CONFIG_MISSING');

const now=Date.now(),summary={date,now:new Date(now).toISOString(),frozen:[],existing:[],skipped:[]};
for(let race=1;race<=12;race++){
  const programPath=path.join(LIVE,date,'program',`race-${race}.json`);
  if(!fs.existsSync(programPath)){summary.skipped.push({race,reason:'PROGRAM_MISSING'});continue}
  const outPath=path.join(LIVE,date,'shadow','second-place-concentration-guard-v2',`race-${race}.json`);
  if(fs.existsSync(outPath)){summary.existing.push(race);continue}

  const raw=fs.readFileSync(programPath,'utf8');
  const program=JSON.parse(raw);
  let boats;
  try{boats=validateProgram(program,date,race)}catch(e){summary.skipped.push({race,reason:e.message});continue}

  const deadline=String(program.deadline||'');
  if(!/^\d{2}:\d{2}$/.test(deadline)){summary.skipped.push({race,reason:'DEADLINE_MISSING'});continue}
  const deadlineMs=Date.parse(`${date}T${deadline}:00+09:00`);
  const freezeCutoffMs=deadlineMs-FREEZE_MARGIN_MS;
  const sourceMs=Date.parse(String(program.fetchedAt||''));
  if(!Number.isFinite(deadlineMs)||!Number.isFinite(sourceMs)){summary.skipped.push({race,reason:'TIME_INVALID'});continue}
  if(sourceMs>freezeCutoffMs){summary.skipped.push({race,reason:'SOURCE_TOO_LATE'});continue}
  if(now>freezeCutoffMs){summary.skipped.push({race,reason:'FREEZE_WINDOW_CLOSED'});continue}

  const dist=model.distribution(program,history.races||[],{
    targetDate:date,
    config:{recencyWindow:300,classScale:.28,neighborMix:.45,neighborLimit:240,decay:.55,laplace:1},
    mode:'PROGRAM_ONLY'
  });
  const baseline=model.select(dist,{count:4}).map(x=>x.order);
  const candidate=guardSelect(dist,cfg).map(x=>x.order);
  const frozen={
    schema:'boat-command-mikuni-second-place-concentration-forward-v2',
    version:'MIKUNI-SECOND-PLACE-CONCENTRATION-FORWARD-V2',
    venue:'MIKUNI',venueCode:'10',date,race,
    createdAt:new Date(now).toISOString(),
    deadline,
    freezeCutoff:new Date(freezeCutoffMs).toISOString(),
    sourceFetchedAt:program.fetchedAt,
    programSha256:sha256(raw),
    historySource:'mikuni-history-bootstrap-v1.json',
    historyCutoff:history.cutoff||null,
    modelVersion:model.version,
    analysisSource:'mikuni-second-place-concentration-guard-v2.json',
    selectedConfig:cfg,
    baselinePicks:baseline,
    candidatePicks:candidate,
    changed:baseline.join('|')!==candidate.join('|'),
    resultInput:false,
    payoutInput:false,
    exhibitionInput:false,
    postRaceRead:false,
    shadowOnly:true,
    tryEnabled:false,
    productionEnabled:false,
    realMoney:false,
    immutableAfterFirstWrite:true
  };
  writeJson(outPath,frozen);
  summary.frozen.push({race,changed:frozen.changed,baseline,candidate});
}
console.log(JSON.stringify(summary,null,2));
