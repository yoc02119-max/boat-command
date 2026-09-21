#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const VERSION='VENUE-MODEL-CYCLE-V1';
const CYCLE_DAYS=30;
const DEFAULT_MIN_RACES=60;
const STAKE_PER_PICK_YEN=100;

function arg(name,fallback=null){
  const i=process.argv.indexOf('--'+name);
  return i>=0&&process.argv[i+1]!=null?process.argv[i+1]:fallback;
}
const ACTION=String(arg('action','refresh')).toLowerCase();
const ONLY=arg('venue',null);
const CANDIDATE=arg('candidate',null);
const EFFECTIVE_DATE=arg('date',new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
const OUTPUT_ROOT=arg('output-root',ROOT);
const DRY_RUN=process.argv.includes('--dry-run');

function readJson(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}}
function writeJson(p,x){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n')}
function isoNow(){return new Date().toISOString()}
function dateOk(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||''))}
function shiftDate(date,days){
  if(!dateOk(date))throw new Error('MODEL_CYCLE_DATE_INVALID '+date);
  const [y,m,d]=date.split('-').map(Number);
  return new Date(Date.UTC(y,m-1,d+Number(days||0))).toISOString().slice(0,10);
}
function daysBetween(a,b){
  if(!dateOk(a)||!dateOk(b))return null;
  return Math.floor((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);
}
function registry(){
  const text=fs.readFileSync(path.join(ROOT,'venue-registry-v1.js'),'utf8');
  const out=[...text.matchAll(/\['(\d{2})','([^']+)','([^']+)','([^']+)'\]/g)].map(m=>({code:m[1],name:m[2],slug:m[3],key:m[4]}));
  if(out.length!==24||new Set(out.map(x=>x.code)).size!==24||new Set(out.map(x=>x.slug)).size!==24)throw new Error('MODEL_CYCLE_REGISTRY_24_REQUIRED');
  return out;
}
function validPrediction(o){
  return !!o&&typeof o==='object'&&Array.isArray(o.picks)&&o.picks.length>0&&
    o.picks.every(x=>/^[1-6]-[1-6]-[1-6]$/.test(String(x)))&&typeof o.modelVersion==='string'&&o.modelVersion.length>0;
}
function rowMetric(pred,row,date){
  if(!validPrediction(pred)||!row||!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
  const actual=String(row.actual||'');
  if(!/^[1-6]-[1-6]-[1-6]$/.test(actual))return null;
  const payout100=Number(row.payout100);
  if(!Number.isFinite(payout100)||payout100<0)return null;
  const picks=pred.picks.map(String);
  const hit=pred.hit===true||picks.includes(actual);
  const stake=picks.length*STAKE_PER_PICK_YEN;
  const returns=hit?payout100:0;
  return {date,race:Number(row.race),modelVersion:String(pred.modelVersion),picks,actual,payout100,hit,stake,returns,profit:returns-stake};
}
function aggregate(rows){
  const a=(rows||[]).filter(Boolean);
  const races=a.length,hits=a.filter(x=>x.hit).length,stake=a.reduce((s,x)=>s+x.stake,0),returns=a.reduce((s,x)=>s+x.returns,0);
  return {races,hits,hitRate:races?hits/races:null,stakeYenAt100PerPick:stake,returnYenAt100PerPick:returns,profitYenAt100PerPick:returns-stake,roi:stake?returns/stake:null,observedDays:new Set(a.map(x=>x.date)).size};
}
function metricDelta(candidate,main){
  return {
    hitRateDelta:Number.isFinite(candidate.hitRate)&&Number.isFinite(main.hitRate)?candidate.hitRate-main.hitRate:null,
    roiDelta:Number.isFinite(candidate.roi)&&Number.isFinite(main.roi)?candidate.roi-main.roi:null
  };
}
function evaluationDocs(slug,start,end){
  const base=path.join(ROOT,'live',slug);
  if(!fs.existsSync(base))return [];
  const dates=fs.readdirSync(base).filter(dateOk).sort().filter(d=>(!start||d>=start)&&(!end||d<=end));
  return dates.map(date=>({date,doc:readJson(path.join(base,date,'research-evaluation-v1.json'))})).filter(x=>x.doc&&Array.isArray(x.doc.rows));
}
function discoverEvidence(slug,start,end){
  const docs=evaluationDocs(slug,start,end);
  const main=[],candidateMap=new Map(),mainByRace=new Map();
  for(const {date,doc} of docs){
    for(const row of doc.rows){
      const race=Number(row?.race),key=date+':'+race;
      const m=rowMetric(row?.programOnly,row,date);
      if(m){main.push(m);mainByRace.set(key,m)}
      for(const [mode,pred] of Object.entries(row||{})){
        if(['race','actual','payout100','classBaseline','programOnly'].includes(mode)||!validPrediction(pred))continue;
        const cm=rowMetric(pred,row,date);if(!cm)continue;
        const id=mode+':'+pred.modelVersion;
        if(!candidateMap.has(id))candidateMap.set(id,{id,mode,modelVersion:pred.modelVersion,rows:[]});
        candidateMap.get(id).rows.push(cm);
      }
    }
  }
  const candidates=[...candidateMap.values()].map(c=>{
    const pairedCandidate=[],pairedMain=[];
    for(const r of c.rows){
      const m=mainByRace.get(r.date+':'+r.race);
      if(m){pairedCandidate.push(r);pairedMain.push(m)}
    }
    const cm=aggregate(pairedCandidate),mm=aggregate(pairedMain);
    return {...c,evaluation:cm,pairedMain:mm,pairedRaces:pairedCandidate.length,deltas:metricDelta(cm,mm)};
  });
  const versions=[...new Set(main.map(x=>x.modelVersion))];
  return {mainRows:main,main:aggregate(main),mainModelVersions:versions,candidates,dates:docs.map(x=>x.date)};
}
function candidateRegistry(slug){
  const x=readJson(path.join(ROOT,'venues',slug,'model-candidates-v1.json'));
  return Array.isArray(x?.candidates)?x.candidates:[];
}
function attachCandidatePolicy(slug,candidates,config){
  const registered=candidateRegistry(slug);
  const p=config?.promotionPolicy||{};
  const minPaired=Number(p.minimumPairedForwardRaces||p.targetReviewRaces||DEFAULT_MIN_RACES);
  const maxHitRegression=Number.isFinite(Number(p.maxAllowedHitRateRegression))?Number(p.maxAllowedHitRateRegression):0;
  const maxRoiRegression=Number.isFinite(Number(p.maxAllowedResearchRoiRegression))?Number(p.maxAllowedResearchRoiRegression):0;
  return candidates.map(c=>{
    const reg=registered.find(x=>x&&((x.id&&x.id===c.id)||(x.mode===c.mode&&x.modelVersion===c.modelVersion)))||null;
    const hist=reg?.historicalValidation||null;
    const enough=c.pairedRaces>=minPaired;
    const hitOk=c.deltas.hitRateDelta!=null&&c.deltas.hitRateDelta>=-maxHitRegression;
    const roiOk=c.deltas.roiDelta!=null&&c.deltas.roiDelta>=-maxRoiRegression;
    const improved=(c.deltas.hitRateDelta!=null&&c.deltas.hitRateDelta>0)||(c.deltas.roiDelta!=null&&c.deltas.roiDelta>0);
    const historicalRequired=p.requireStrictWalkForwardHoldout!==false;
    const historicalOk=!historicalRequired||hist?.passed===true;
    const forwardEligible=enough&&hitOk&&roiOk&&improved;
    const eligible=forwardEligible&&historicalOk&&reg?.status!=='BLOCKED';
    const reasons=[];
    if(!enough)reasons.push('PAIRED_FORWARD_RACES_'+minPaired+'_NOT_READY');
    if(c.deltas.hitRateDelta==null||!hitOk)reasons.push('HIT_RATE_REGRESSION_GATE');
    if(c.deltas.roiDelta==null||!roiOk)reasons.push('ROI_REGRESSION_GATE');
    if(!improved)reasons.push('NO_FORWARD_METRIC_IMPROVEMENT');
    if(historicalRequired&&!historicalOk)reasons.push('HISTORICAL_VALIDATION_NOT_REGISTERED_OR_FAILED');
    if(!reg)reasons.push('CANDIDATE_NOT_REGISTERED');
    return {
      id:c.id,mode:c.mode,modelVersion:c.modelVersion,registered:!!reg,registry:reg?{status:reg.status||'SHADOW',artifact:reg.artifact||null,activationEvidencePath:reg.activationEvidencePath||null}:null,
      evaluation:c.evaluation,pairedMain:c.pairedMain,pairedRaces:c.pairedRaces,deltas:c.deltas,
      gates:{minimumPairedRaces:minPaired,maxAllowedHitRateRegression:maxHitRegression,maxAllowedRoiRegression:maxRoiRegression,forwardEligible,historicalRequired,historicalOk,eligible,reasons}
    };
  }).sort((a,b)=>(Number(b.gates.eligible)-Number(a.gates.eligible))||((b.deltas.roiDelta??-999)-(a.deltas.roiDelta??-999))||((b.deltas.hitRateDelta??-999)-(a.deltas.hitRateDelta??-999)));
}
function earliestEvidenceDate(slug){
  const docs=evaluationDocs(slug,null,null);
  const usable=docs.filter(({doc})=>doc.rows.some(r=>validPrediction(r?.programOnly))).map(x=>x.date);
  return usable[0]||null;
}
function earliestEvidenceDateForModel(slug,modelVersion){
  if(!modelVersion)return null;
  const docs=evaluationDocs(slug,null,null);
  for(const {date,doc} of docs){
    if(doc.rows.some(r=>validPrediction(r?.programOnly)&&String(r.programOnly.modelVersion)===String(modelVersion)))return date;
  }
  return null;
}
function latestProgramOnlyModelVersion(slug){
  const docs=evaluationDocs(slug,null,null).reverse();
  for(const {doc} of docs){
    for(const row of [...doc.rows].reverse())if(validPrediction(row?.programOnly))return String(row.programOnly.modelVersion);
  }
  const base=path.join(ROOT,'live',slug);
  if(!fs.existsSync(base))return null;
  const dates=fs.readdirSync(base).filter(dateOk).sort().reverse();
  for(const d of dates){
    const dir=path.join(base,d,'shadow','program-only');if(!fs.existsSync(dir))continue;
    for(const f of fs.readdirSync(dir).filter(x=>/^race-\d+\.json$/.test(x)).sort().reverse()){
      const x=readJson(path.join(dir,f));if(x?.modelVersion)return String(x.modelVersion);
    }
  }
  return null;
}
function gamagoriInfo(){
  const policy=readJson(path.join(ROOT,'gamagori-forward-validation-policy-v0346.json'));
  const status=readJson(path.join(ROOT,'live','gamagori','forward-status-v0347.json'));
  const starts=[];
  for(const m of Object.values(status?.methods||{}))if(dateOk(m?.cycleStartDate))starts.push(m.cycleStartDate);
  const start=starts.sort()[0]||policy?.effectiveDate||null;
  const methods=Object.values(status?.methods||{}).map(m=>({method:m.method,label:m.label,cycleStartDate:m.cycleStartDate,observedDays:Number(m.observedDays||0),settledMatchedRaces:Number(m.settledMatchedRaces||0),hits:Number(m.hits||0),hitRate:m.hitRate??null,stakeYen:Number(m.stakeYen||0),returnYen:Number(m.returnYen||0),profitYen:Number(m.profitYen||0),roi:m.roi??null,cycleStatus:m.cycleStatus||null}));
  return {policy,status,start,methods};
}
function isActiveConfig(config){
  const mode=String(config?.operationPolicy?.mode||'');
  return config?.state==='LIVE_SIMULATION'||mode==='30_DAY_VIRTUAL_OPERATION'||mode.includes('30_DAY_VIRTUAL_OPERATION')&&config?.modelEnabled===true;
}
function cycleOutputPath(slug){return path.join(OUTPUT_ROOT,'venues',slug,'model-cycle-v1.json')}
function repoCyclePath(slug){return path.join(ROOT,'venues',slug,'model-cycle-v1.json')}
function archivePath(slug,cycleId){return path.join(OUTPUT_ROOT,'venues',slug,'model-cycle-history',cycleId+'.json')}
function baseIsolation(e){return {scope:'VENUE_ONLY',venueCode:e.code,slug:e.slug,crossVenueTraining:false,crossVenueWeightReuse:false,crossVenuePromotion:false,independentClock:true}}
function currentCycleNumber(prev){return Number(prev?.cycleNumber||0)||1}
function newCycleId(e,n,start){return e.slug+'-cycle-'+String(n).padStart(3,'0')+'-'+start}
function deriveStart(e,config,prev){
  const op=config?.operationPolicy||{};
  const configuredModel=op.mainModelVersion||null;
  if(prev?.startDate&&dateOk(prev.startDate)&&prev?.mainline?.integrity!=='DRIFT_DETECTED')return prev.startDate;
  if(dateOk(op.operationStartDate))return op.operationStartDate;
  const modelStart=earliestEvidenceDateForModel(e.slug,configuredModel);
  if(modelStart)return modelStart;
  if(prev?.startDate&&dateOk(prev.startDate))return prev.startDate;
  return earliestEvidenceDate(e.slug)||EFFECTIVE_DATE;
}
function reviewTemplate(){return {required:true,humanDecision:'PENDING',candidateId:null,decidedAt:null,decidedBy:null,note:null}}
function readPrev(slug){return readJson(repoCyclePath(slug))}
function selection(candidates){
  const eligible=candidates.filter(x=>x.gates.eligible);
  return eligible[0]||null;
}
function standardState(e,config,readiness,prev){
  const active=isActiveConfig(config);
  if(!active){
    return {
      schema:'boat-command-venue-model-cycle-v1',version:VERSION,venue:e.key,venueName:e.name,venueCode:e.code,slug:e.slug,
      generatedAt:isoNow(),cycleNumber:currentCycleNumber(prev),cycleId:prev?.cycleId||null,cycleDays:CYCLE_DAYS,
      phase:'WAITING_FOR_MAINLINE',startDate:null,endDate:null,cycleDay:0,daysRemaining:CYCLE_DAYS,
      isolation:baseIsolation(e),mainline:{modelVersion:latestProgramOnlyModelVersion(e.slug)||config?.operationPolicy?.mainModelVersion||null,frozen:true,integrity:'NOT_ACTIVE',evaluation:aggregate([])},
      candidates:[],recommendation:{state:'WAITING_FOR_MAINLINE',candidateId:null,reasons:['VENUE_NOT_IN_30_DAY_VIRTUAL_OPERATION']},
      review:prev?.review||reviewTemplate(),
      promotion:{humanReviewRequired:true,autoPromotion:false,autoTryEnable:false,realMoneyEnable:false,activationRequiresEvidence:true},
      source:{configPath:'venues/'+e.slug+'/config-v1.json',readinessPath:'venues/'+e.slug+'/readiness-v1.json'},
      retention:{sourceDataPreserved:true,cycleHistoryPreserved:true}
    };
  }
  const n=currentCycleNumber(prev),start=deriveStart(e,config,prev),end=shiftDate(start,CYCLE_DAYS-1);
  const cycleId=newCycleId(e,n,start);
  const previousPhase=prev?.cycleId===cycleId?prev?.phase:null;
  const previousEvidenceThrough=prev?.cycleId===cycleId&&dateOk(prev?.mainline?.evidenceThroughDate)
    ? prev.mainline.evidenceThroughDate
    : null;
  const reviewSnapshotFrozen=previousEvidenceThrough&&['REVIEW_READY','APPROVED_PENDING_DEPLOYMENT','REVIEW_BLOCKED'].includes(previousPhase);
  const evidenceThrough=reviewSnapshotFrozen
    ? previousEvidenceThrough
    : previousPhase==='EVIDENCE_EXTENSION'
      ? EFFECTIVE_DATE
      : (EFFECTIVE_DATE<end?EFFECTIVE_DATE:end);
  const evidence=discoverEvidence(e.slug,start,evidenceThrough);
  const candidates=attachCandidatePolicy(e.slug,evidence.candidates,config);
  const selected=selection(candidates);
  const elapsed=Math.max(0,(daysBetween(start,EFFECTIVE_DATE)||0)+1),day=Math.min(CYCLE_DAYS,elapsed),daysRemaining=Math.max(0,CYCLE_DAYS-day);
  const p=config?.promotionPolicy||{},minMain=Number(p.targetReviewRaces||DEFAULT_MIN_RACES);
  const configuredVersion=config?.operationPolicy?.mainModelVersion||null;
  const previousLockedVersion=prev?.cycleId===cycleId&&prev?.startDate===start&&prev?.mainline?.frozen===true
    ? (prev.mainline.modelVersion||null)
    : null;
  const lockedVersion=previousLockedVersion||configuredVersion||evidence.mainModelVersions.at(-1)||latestProgramOnlyModelVersion(e.slug)||null;
  const currentRows=lockedVersion?evidence.mainRows.filter(x=>x.modelVersion===lockedVersion):evidence.mainRows;
  const mainEvaluation=aggregate(currentRows);
  const mainEnough=mainEvaluation.races>=minMain;
  const versionSet=[...new Set(currentRows.map(x=>x.modelVersion))];
  const effectiveVersion=lockedVersion||versionSet.at(-1)||latestProgramOnlyModelVersion(e.slug)||null;
  const ordered=evidence.mainRows;
  const firstCurrent=lockedVersion?ordered.findIndex(x=>x.modelVersion===lockedVersion):-1;
  const drift=lockedVersion
    ? (firstCurrent>=0&&ordered.slice(firstCurrent).some(x=>x.modelVersion!==lockedVersion))
    : evidence.mainModelVersions.length>1;
  let phase=elapsed<CYCLE_DAYS?'ACTIVE':'REVIEW_READY';
  let rec={state:'WAIT',candidateId:null,reasons:['CYCLE_IN_PROGRESS']};
  if(elapsed>=CYCLE_DAYS&&!mainEnough){phase='EVIDENCE_EXTENSION';rec={state:'EXTEND_EVIDENCE',candidateId:null,reasons:['MAINLINE_'+minMain+'_RACES_NOT_READY']}}
  else if(elapsed>=CYCLE_DAYS&&drift){phase='REVIEW_BLOCKED';rec={state:'BLOCKED',candidateId:null,reasons:['MAINLINE_MODEL_DRIFT_DETECTED']}}
  else if(elapsed>=CYCLE_DAYS&&selected){rec={state:'CANDIDATE_ELIGIBLE',candidateId:selected.id,reasons:[]}}
  else if(elapsed>=CYCLE_DAYS){rec={state:'KEEP_CURRENT',candidateId:null,reasons:['NO_REGISTERED_CANDIDATE_PASSED_ALL_GATES']}}
  const review=prev?.cycleId===cycleId?(prev.review||reviewTemplate()):reviewTemplate();
  if(review.humanDecision==='APPROVE_CANDIDATE')phase='APPROVED_PENDING_DEPLOYMENT';
  return {
    schema:'boat-command-venue-model-cycle-v1',version:VERSION,venue:e.key,venueName:e.name,venueCode:e.code,slug:e.slug,
    generatedAt:isoNow(),cycleNumber:n,cycleId,cycleDays:CYCLE_DAYS,phase,startDate:start,endDate:end,cycleDay:day,daysRemaining,
    isolation:baseIsolation(e),
    mainline:{modelVersion:effectiveVersion,frozen:true,integrity:drift?'DRIFT_DETECTED':'OK',versionsObserved:versionSet,evaluation:mainEvaluation,minimumReviewRaces:minMain,evidenceReady:mainEnough,evidenceThroughDate:evidenceThrough},
    candidates,recommendation:rec,review,
    promotion:{humanReviewRequired:true,autoPromotion:false,autoTryEnable:false,realMoneyEnable:false,activationRequiresEvidence:true},
    source:{configPath:'venues/'+e.slug+'/config-v1.json',readinessPath:'venues/'+e.slug+'/readiness-v1.json',latestReadinessPhase:readiness?.phase||null},
    retention:{sourceDataPreserved:true,cycleHistoryPreserved:true}
  };
}
function gamagoriState(e,prev){
  const g=gamagoriInfo(),start=prev?.startDate||g.start||EFFECTIVE_DATE,n=currentCycleNumber(prev),end=shiftDate(start,CYCLE_DAYS-1);
  const elapsed=Math.max(0,(daysBetween(start,EFFECTIVE_DATE)||0)+1),day=Math.min(CYCLE_DAYS,elapsed),daysRemaining=Math.max(0,CYCLE_DAYS-day);
  const methods=g.methods,settled=methods.reduce((s,m)=>s+m.settledMatchedRaces,0);
  const review=prev?.cycleId===newCycleId(e,n,start)?(prev.review||reviewTemplate()):reviewTemplate();
  let phase=elapsed<CYCLE_DAYS?'ACTIVE':'REVIEW_READY';
  let rec=elapsed<CYCLE_DAYS?{state:'WAIT',candidateId:null,reasons:['CYCLE_IN_PROGRESS']}:
    settled===0?{state:'EXTEND_EVIDENCE',candidateId:null,reasons:['NO_SETTLED_FORWARD_MATCHES']}:
    {state:'HUMAN_REVIEW',candidateId:null,reasons:['EXISTING_GAMAGORI_FORWARD_POLICY_REQUIRES_REVIEW']};
  if(review.humanDecision==='APPROVE_CANDIDATE')phase='APPROVED_PENDING_DEPLOYMENT';
  return {
    schema:'boat-command-venue-model-cycle-v1',version:VERSION,venue:e.key,venueName:e.name,venueCode:e.code,slug:e.slug,
    generatedAt:isoNow(),cycleNumber:n,cycleId:newCycleId(e,n,start),cycleDays:CYCLE_DAYS,phase,startDate:start,endDate:end,cycleDay:day,daysRemaining,
    isolation:baseIsolation(e),
    mainline:{modelVersion:'GAMAGORI-CURRENT-MAIN',frozen:true,integrity:'EXTERNAL_FORWARD_POLICY',evaluation:{methods}},
    candidates:[],recommendation:rec,review,
    promotion:{humanReviewRequired:true,autoPromotion:false,autoTryEnable:false,realMoneyEnable:false,activationRequiresEvidence:true},
    source:{policyPath:'gamagori-forward-validation-policy-v0346.json',statusPath:'live/gamagori/forward-status-v0347.json',cycleType:g.policy?.evaluation?.cycleType||'FIXED_CALENDAR_WINDOW'},
    retention:{sourceDataPreserved:true,cycleHistoryPreserved:true}
  };
}
function build(e){
  const config=readJson(path.join(ROOT,'venues',e.slug,'config-v1.json'));
  const readiness=readJson(path.join(ROOT,'venues',e.slug,'readiness-v1.json'));
  const prev=readPrev(e.slug);
  return e.slug==='gamagori'?gamagoriState(e,prev):standardState(e,config,readiness,prev);
}
function verifyActivation(e,state,candidateId){
  if(state.review?.humanDecision!=='APPROVE_CANDIDATE'||state.review?.candidateId!==candidateId)throw new Error('MODEL_CYCLE_ACTIVATION_NOT_APPROVED '+e.slug);
  const c=(state.candidates||[]).find(x=>x.id===candidateId);
  if(!c)throw new Error('MODEL_CYCLE_CANDIDATE_NOT_FOUND '+candidateId);
  if(c.gates?.eligible!==true)throw new Error('MODEL_CYCLE_CANDIDATE_NOT_ELIGIBLE '+candidateId);
  const liveVersion=latestProgramOnlyModelVersion(e.slug);
  let verified=liveVersion===c.modelVersion;
  if(!verified&&c.registry?.activationEvidencePath){
    const p=path.join(ROOT,c.registry.activationEvidencePath);
    verified=fs.existsSync(p)&&fs.readFileSync(p,'utf8').includes(c.modelVersion);
  }
  if(!verified)throw new Error('MODEL_CYCLE_DEPLOYMENT_EVIDENCE_MISSING expected='+c.modelVersion+' actual='+(liveVersion||'NONE'));
  return c;
}
function archive(state,decision){
  const out={...state,archivedAt:isoNow(),finalDecision:decision};
  if(!DRY_RUN)writeJson(archivePath(state.slug,state.cycleId),out);
}
function applyAction(e,state){
  if(ACTION==='refresh')return state;
  if(!ONLY||e.slug!==ONLY)return state;
  if(!['approve','reject','continue','activate'].includes(ACTION))throw new Error('MODEL_CYCLE_ACTION_INVALID '+ACTION);
  if(ACTION==='approve'){
    if(state.phase!=='REVIEW_READY')throw new Error('MODEL_CYCLE_NOT_REVIEW_READY '+state.phase);
    if(!CANDIDATE)throw new Error('MODEL_CYCLE_CANDIDATE_REQUIRED');
    const c=(state.candidates||[]).find(x=>x.id===CANDIDATE);
    if(!c||c.gates?.eligible!==true)throw new Error('MODEL_CYCLE_APPROVE_GATE_FAILED '+CANDIDATE);
    return {...state,phase:'APPROVED_PENDING_DEPLOYMENT',review:{required:true,humanDecision:'APPROVE_CANDIDATE',candidateId:CANDIDATE,decidedAt:isoNow(),decidedBy:'HUMAN_WORKFLOW',note:'Candidate approved; production activation still requires deployment evidence.'}};
  }
  if(ACTION==='activate'){
    if(state.phase!=='APPROVED_PENDING_DEPLOYMENT')throw new Error('MODEL_CYCLE_NOT_APPROVED_FOR_DEPLOYMENT '+state.phase);
    if(!CANDIDATE)throw new Error('MODEL_CYCLE_CANDIDATE_REQUIRED');
    const c=verifyActivation(e,state,CANDIDATE);archive(state,{action:'ACTIVATE',candidateId:CANDIDATE,modelVersion:c.modelVersion});
    const nextNumber=state.cycleNumber+1,start=EFFECTIVE_DATE;
    return {...state,generatedAt:isoNow(),cycleNumber:nextNumber,cycleId:newCycleId(e,nextNumber,start),phase:'ACTIVE',startDate:start,endDate:shiftDate(start,CYCLE_DAYS-1),cycleDay:1,daysRemaining:CYCLE_DAYS-1,
      mainline:{modelVersion:c.modelVersion,frozen:true,integrity:'ACTIVATION_VERIFIED',versionsObserved:[c.modelVersion],evaluation:aggregate([]),minimumReviewRaces:state.mainline?.minimumReviewRaces||DEFAULT_MIN_RACES,evidenceReady:false},
      candidates:[],recommendation:{state:'WAIT',candidateId:null,reasons:['NEW_CYCLE_STARTED']},review:reviewTemplate()};
  }
  if(!['REVIEW_READY','REVIEW_BLOCKED','EVIDENCE_EXTENSION','APPROVED_PENDING_DEPLOYMENT'].includes(state.phase))throw new Error('MODEL_CYCLE_DECISION_TOO_EARLY '+state.phase);
  archive(state,{action:ACTION.toUpperCase(),candidateId:null});
  const nextNumber=state.cycleNumber+1,start=EFFECTIVE_DATE;
  return {...state,generatedAt:isoNow(),cycleNumber:nextNumber,cycleId:newCycleId(e,nextNumber,start),phase:state.phase==='WAITING_FOR_MAINLINE'?'WAITING_FOR_MAINLINE':'ACTIVE',
    startDate:state.phase==='WAITING_FOR_MAINLINE'?null:start,endDate:state.phase==='WAITING_FOR_MAINLINE'?null:shiftDate(start,CYCLE_DAYS-1),cycleDay:state.phase==='WAITING_FOR_MAINLINE'?0:1,daysRemaining:state.phase==='WAITING_FOR_MAINLINE'?CYCLE_DAYS:CYCLE_DAYS-1,
    candidates:[],recommendation:{state:'WAIT',candidateId:null,reasons:[ACTION==='reject'?'CANDIDATE_REJECTED_NEW_CYCLE':'CURRENT_MODEL_CONTINUED_NEW_CYCLE']},review:reviewTemplate()};
}
function validateState(x){
  if(x.schema!=='boat-command-venue-model-cycle-v1'||x.version!==VERSION)throw new Error('MODEL_CYCLE_SCHEMA');
  if(x.cycleDays!==30||x.isolation?.scope!=='VENUE_ONLY'||x.isolation?.crossVenueTraining!==false||x.isolation?.crossVenueWeightReuse!==false||x.isolation?.crossVenuePromotion!==false)throw new Error('MODEL_CYCLE_ISOLATION');
  if(x.promotion?.autoPromotion!==false||x.promotion?.realMoneyEnable!==false||x.promotion?.humanReviewRequired!==true)throw new Error('MODEL_CYCLE_PROMOTION_SAFETY');
  if(x.retention?.sourceDataPreserved!==true||x.retention?.cycleHistoryPreserved!==true)throw new Error('MODEL_CYCLE_RETENTION');
  if(x.phase==='ACTIVE'&&x.mainline?.modelVersion&&x.mainline?.integrity==='DRIFT_DETECTED')throw new Error('MODEL_CYCLE_ACTIVE_MAINLINE_DRIFT '+x.slug);
}
function main(){
  if(!dateOk(EFFECTIVE_DATE))throw new Error('MODEL_CYCLE_EFFECTIVE_DATE_INVALID');
  const entries=registry();
  if(ONLY&&!entries.some(x=>x.slug===ONLY))throw new Error('MODEL_CYCLE_UNKNOWN_VENUE '+ONLY);
  const results=[];
  for(const e of entries){
    const preserveOtherVenue=ACTION!=='refresh'&&ONLY&&e.slug!==ONLY;
    let state=preserveOtherVenue?(readPrev(e.slug)||build(e)):build(e);
    state=applyAction(e,state);
    validateState(state);
    results.push(state);
    if(!DRY_RUN)writeJson(cycleOutputPath(e.slug),state);
  }
  const summary={schema:'boat-command-model-cycle-fleet-v1',version:VERSION,generatedAt:isoNow(),effectiveDate:EFFECTIVE_DATE,venues:results.length,active:results.filter(x=>x.phase==='ACTIVE').length,reviewReady:results.filter(x=>x.phase==='REVIEW_READY').length,waiting:results.filter(x=>x.phase==='WAITING_FOR_MAINLINE').length,blocked:results.filter(x=>['REVIEW_BLOCKED','EVIDENCE_EXTENSION','APPROVED_PENDING_DEPLOYMENT'].includes(x.phase)).length,venueStates:results.map(x=>({code:x.venueCode,slug:x.slug,cycleId:x.cycleId,phase:x.phase,day:x.cycleDay,daysRemaining:x.daysRemaining,modelVersion:x.mainline?.modelVersion||null,recommendation:x.recommendation?.state||null}))};
  if(!DRY_RUN)writeJson(path.join(OUTPUT_ROOT,'venue-model-cycle-fleet-v1.json'),summary);
  console.log(JSON.stringify(summary,null,2));
  console.log('VENUE_MODEL_CYCLE_24_INDEPENDENT_PASS');
}
main();
