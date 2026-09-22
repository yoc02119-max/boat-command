#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.join(__dirname,'..');
const CONFIG_PATH=path.join(ROOT,'shared-try-config-v1.json');
const OUTPUT_PATH=path.join(ROOT,'shared-try-portfolio-v1.json');
const EXPANSION_POLICY_PATH=path.join(ROOT,'daily-lab','venue-expansion-policy-v1.json');
const config=JSON.parse(fs.readFileSync(CONFIG_PATH,'utf8'));
const JST_OFFSET=9*60*60*1000;
const NOW_MS=process.env.BOAT_COMMAND_NOW_ISO?Date.parse(process.env.BOAT_COMMAND_NOW_ISO):Date.now();
if(!Number.isFinite(NOW_MS))throw new Error('INVALID_NOW_OVERRIDE');

const read=p=>{try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return null}};
const exists=p=>{try{return fs.existsSync(p)}catch{return false}};
const sha256=s=>crypto.createHash('sha256').update(s).digest('hex');
const validPick=v=>/^[1-6]-[1-6]-[1-6]$/.test(String(v||''))&&new Set(String(v).split('-')).size===3;
const jstDate=d=>new Date((d||Date.now())+JST_OFFSET).toISOString().slice(0,10);
const expansionPolicy=read(EXPANSION_POLICY_PATH);
function activeExpansion(venueCode,date){
  const row=(expansionPolicy?.venues||[]).find(v=>String(v.code).padStart(2,'0')===String(venueCode).padStart(2,'0'));
  if(!row||row.productionEnabled!==true||row.applyToPrediction!==true||!row.candidateVariant)return null;
  const effective=String(row.approval?.effectiveDate||'');
  if(effective&&String(date)<effective)return null;
  return row;
}
const requestedDate=process.argv[2]||jstDate(NOW_MS);
if(Number(config.startingBankrollYen)!==100000)throw new Error('SHARED_BANKROLL_MUST_BE_100000');
if(config.fundingScope!=='ALL_24_VENUES_SHARED')throw new Error('SHARED_BANKROLL_SCOPE_INVALID');
if(config.resetPolicy!=='NEVER_AUTOMATICALLY_RESET'||config.preserveSettledHistory!==true)throw new Error('SHARED_BANKROLL_RESET_POLICY_INVALID');

function deadlineEpoch(date,hm){
  const m=String(hm||'').match(/^(\d{1,2}):(\d{2})$/);if(!m)return NaN;
  return Date.parse(`${date}T${String(m[1]).padStart(2,'0')}:${m[2]}:00+09:00`);
}
function median(xs){
  const a=xs.filter(Number.isFinite).slice().sort((x,y)=>x-y);
  if(!a.length)return 0;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function safeProgramShadow(adapter,date,race){
  const p=path.join(ROOT,'live',adapter.slug,date,'shadow',adapter.predictionDir,`race-${race}.json`);
  if(!exists(p))return null;
  const raw=fs.readFileSync(p,'utf8'),x=JSON.parse(raw);
  if(String(x.venueCode)!==adapter.venueCode||String(x.venue)!==adapter.venue)return null;
  if(String(x.date)!==date||Number(x.race)!==race)return null;
  if(x.resultInput!==false||x.payoutInput!==false||x.immutableAfterFirstWrite!==true)return null;
  const basePicks=Array.isArray(x.picks)?x.picks.filter(validPick):[];
  if(basePicks.length!==Number(config.picksPerTry||4))return null;
  let picks=basePicks,expansionVariant=null;
  const policy=activeExpansion(adapter.venueCode,date);
  if(policy){
    const expanded=x.pointExpansion?.variants?.[policy.candidateVariant];
    if(!Array.isArray(expanded)||![6,8].includes(expanded.length)||expanded.some(v=>!validPick(v)))return null;
    if(JSON.stringify(expanded.slice(0,basePicks.length))!==JSON.stringify(basePicks))return null;
    picks=[...expanded];expansionVariant=policy.candidateVariant;
  }
  const ranked=Array.isArray(x.pointExpansion?.ranked)?x.pointExpansion.ranked:(Array.isArray(x.probabilities)?x.probabilities:[]);
  const map=new Map(ranked.map(z=>[String(z.order),Number(z.probability)]));
  const pickProbs=picks.map(k=>map.get(k));
  if(pickProbs.some(v=>!Number.isFinite(v)||v<0))return null;
  const generated=Date.parse(x.generatedAt||''),ddl=deadlineEpoch(date,x.deadline);
  if(!Number.isFinite(generated)||!Number.isFinite(ddl)||generated>=ddl)return null;
  return {
    venueCode:adapter.venueCode,venue:adapter.venue,slug:adapter.slug,date,race,
    deadline:x.deadline,deadlineEpoch:ddl,generatedAt:x.generatedAt,
    predictionPath:path.relative(ROOT,p).replace(/\\/g,'/'),predictionSha256:sha256(raw),
    modelVersion:x.modelVersion||null,picks,expansionVariant,
    pickCoverage:pickProbs.reduce((s,v)=>s+v,0),topProbability:Math.max(...pickProbs),
    sourcePolicy:expansionVariant?'PROGRAM_ONLY_SHADOW_APPROVED_EXPANSION':'PROGRAM_ONLY_SHADOW',resultInput:false,payoutInput:false,immutableAfterFirstWrite:true
  };
}
function safeGamagoriGate(adapter,date){
  const p=path.join(ROOT,'live','gamagori',date,'shadow',adapter.gateFile);
  if(!exists(p))return [];
  const raw=fs.readFileSync(p,'utf8'),x=JSON.parse(raw);
  if(x.venueCode!=='07'||x.date!==date||x.shadowOnly!==true||x.tryOnly!==true)return [];
  if(x.targetResultsRead!==false||x.targetPayoutsRead!==false||x.liveBettingEnabled!==false)return [];
  const out=[];
  for(const r of x.races||[]){
    const picks=Array.isArray(r?.trifecta?.frozenPicks)?r.trifecta.frozenPicks.filter(validPick):[];
    if(r?.trifecta?.decision!=='FORWARD_SHADOW_TRY'||picks.length!==Number(config.picksPerTry||4))continue;
    const generated=Date.parse(r.sourceFetchedAt||''),ddl=deadlineEpoch(date,r.deadline);
    if(!Number.isFinite(generated)||!Number.isFinite(ddl)||generated>=ddl)continue;
    out.push({
      venueCode:'07',venue:'GAMAGORI',slug:'gamagori',date,race:Number(r.race),
      deadline:r.deadline,deadlineEpoch:ddl,generatedAt:r.sourceFetchedAt,
      predictionPath:path.relative(ROOT,p).replace(/\\/g,'/'),predictionSha256:sha256(raw),
      modelVersion:x.modelVersion||null,picks,pickCoverage:null,topProbability:null,
      venueMedianCoverage:null,relativeConfidence:1,
      sourcePolicy:'GAMAGORI_EXISTING_TRY_GATE',resultInput:false,payoutInput:false,immutableAfterFirstWrite:true
    });
  }
  return out;
}
function selectionPath(date){return path.join(ROOT,'live','portfolio',date,'try-selection-v1.json')}
function withinOperationWindow(date){
  const start=Date.parse(String(config.operationStartDate||'')+'T00:00:00+09:00');
  const target=Date.parse(String(date)+'T00:00:00+09:00');
  if(!Number.isFinite(start)||!Number.isFinite(target))return false;
  const day=Math.floor((target-start)/86400000);
  return day>=0&&day<Number(config.operationWindowDays||30);
}
function priorPortfolio(){
  const start=Number(config.startingBankrollYen)||100000;
  return read(OUTPUT_PATH)||{startingBankrollYen:start,confirmedBankrollYen:start,availableBankrollYen:start,bankrollYen:start};
}
function buildSelection(date,available){
  const outPath=selectionPath(date);
  if(exists(outPath)){
    const prior=read(outPath);
    if(prior?.immutableAfterFirstWrite===true)return prior;
    throw new Error('EXISTING_SELECTION_NOT_IMMUTABLE');
  }
  if(!withinOperationWindow(date)){
    const payload={schema:'boat-command-shared-try-selection-v1',version:'SHARED-TRY-SELECTION-V1',date,generatedAt:new Date(NOW_MS).toISOString(),selected:[],selectedCount:0,candidateCount:0,totalCommittedStakeYen:0,resultInput:false,payoutInput:false,realMoney:false,immutableAfterFirstWrite:true,status:'OUTSIDE_30_DAY_WINDOW'};
    fs.mkdirSync(path.dirname(outPath),{recursive:true});fs.writeFileSync(outPath,JSON.stringify(payload,null,2)+'\n');return payload;
  }
  const now=NOW_MS,safety=(Number(config.deadlineSafetyMinutes)||5)*60000,candidates=[];
  for(const a of config.activeAdapters||[]){
    if(a.type==='GAMAGORI_EXISTING_TRY_GATE'){
      for(const x of safeGamagoriGate(a,date))if(now<x.deadlineEpoch-safety)candidates.push(x);
      continue;
    }
    const venue=[];
    for(let race=1;race<=12;race++){
      const x=safeProgramShadow(a,date,race);if(!x)continue;
      if(now>=x.deadlineEpoch-safety)continue;
      venue.push(x);
    }
    const med=median(venue.map(x=>x.pickCoverage));
    for(const x of venue)candidates.push({...x,venueMedianCoverage:med,relativeConfidence:med>0?x.pickCoverage/med:0});
  }
  candidates.sort((a,b)=>b.relativeConfidence-a.relativeConfidence||(Number(b.pickCoverage)||0)-(Number(a.pickCoverage)||0)||a.venueCode.localeCompare(b.venueCode)||a.race-b.race);
  const fraction=Math.max(0,Math.min(1,Number(config.selectionFraction)||0.25));
  const desired=Math.min(Number(config.maxTryRacesPerDay)||8,Math.max(candidates.length?1:0,Math.ceil(candidates.length*fraction)));
  const stakePerPick=Number(config.stakePerPickYen)||500,picksPerTry=Number(config.picksPerTry)||4;
  const selected=[];let remaining=Math.max(0,Number(available)||0);
  for(const x of candidates){
    if(selected.length>=desired)break;
    const stakePerRace=stakePerPick*x.picks.length;
    if(stakePerRace>remaining)continue;
    selected.push({
      rank:selected.length+1,venueCode:x.venueCode,venue:x.venue,slug:x.slug,date:x.date,race:x.race,
      deadline:x.deadline,generatedAt:x.generatedAt,modelVersion:x.modelVersion,sourcePolicy:x.sourcePolicy,
      predictionPath:x.predictionPath,predictionSha256:x.predictionSha256,picks:x.picks,expansionVariant:x.expansionVariant||null,
      pickCoverage:x.pickCoverage,venueMedianCoverage:x.venueMedianCoverage,relativeConfidence:x.relativeConfidence,
      stakePerPickYen:stakePerPick,stakeYen:stakePerRace,resultInput:false,payoutInput:false
    });
    remaining-=stakePerRace;
  }
  const payload={
    schema:'boat-command-shared-try-selection-v1',version:'SHARED-TRY-SELECTION-V1',
    date,generatedAt:new Date(NOW_MS).toISOString(),
    startingBankrollYen:Number(config.startingBankrollYen)||100000,bankrollBeforeSelectionYen:available,
    policy:{selectionPolicy:config.selectionPolicy,selectionFraction:fraction,maxTryRacesPerDay:Number(config.maxTryRacesPerDay)||8,stakePerPickYen:stakePerPick,basePicksPerTry:picksPerTry,variablePicksByVenuePolicy:true,deadlineSafetyMinutes:Number(config.deadlineSafetyMinutes)||5},
    candidateCount:candidates.length,selectedCount:selected.length,selected,
    totalCommittedStakeYen:selected.reduce((s,x)=>s+x.stakeYen,0),
    resultInput:false,payoutInput:false,realMoney:false,immutableAfterFirstWrite:true,
    status:available<=0?'BANKRUPT_NO_NEW_TRY':selected.length?'TRY_FROZEN':'NO_ELIGIBLE_PRE_RACE_CANDIDATES'
  };
  fs.mkdirSync(path.dirname(outPath),{recursive:true});
  fs.writeFileSync(outPath,JSON.stringify(payload,null,2)+'\n');
  return payload;
}
function allSelections(){
  const root=path.join(ROOT,'live','portfolio');if(!exists(root))return [];
  const out=[];
  for(const date of fs.readdirSync(root).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort()){
    const s=read(selectionPath(date));if(!s||s.immutableAfterFirstWrite!==true)continue;
    for(const x of s.selected||[])out.push(x);
  }
  return out;
}
function resultFor(x){
  const p=path.join(ROOT,'live',x.slug,x.date,'post',`race-${x.race}-result.json`);
  const r=read(p);if(!r)return null;
  if(String(r.venueCode)!==x.venueCode||String(r.date)!==x.date||Number(r.race)!==Number(x.race))return null;
  if(r.preRaceDataIncluded!==false||r.resultEndpointsIncluded!==true||!validPick(r.trifecta))return null;
  return r;
}
function cancellationFor(x){
  const p=path.join(ROOT,'live',x.slug,x.date,'post','day-status.json');
  const s=read(p);if(!s)return null;
  if(s.schema!=='boat-command-day-status-v1'||String(s.venueCode)!==x.venueCode||String(s.date)!==x.date)return null;
  if(s.status!=='CANCELLED'||s.immutableAfterFirstWrite!==true||s.selectionMutation!==false)return null;
  return s;
}
function rebuildPortfolio(){
  const start=Number(config.startingBankrollYen)||100000;
  const rows=allSelections().sort((a,b)=>a.date.localeCompare(b.date)||String(a.deadline).localeCompare(String(b.deadline))||a.venueCode.localeCompare(b.venueCode)||a.race-b.race);
  let committed=0,settledStake=0,returns=0,hits=0,pending=0,voided=0,voidedStake=0,lossStreak=0,maxLossStreak=0;
  let curveBalance=start,peak=start,maxDrawdown=0;
  const byVenue={},ledger=[];
  for(const x of rows){
    const stake=Number(x.stakeYen)||0;committed+=stake;curveBalance-=stake;
    peak=Math.max(peak,curveBalance);maxDrawdown=Math.max(maxDrawdown,peak-curveBalance);
    const cancel=cancellationFor(x);
    const r=cancel?null:resultFor(x),hit=!!(r&&x.picks.includes(r.trifecta)),ret=hit?Number(r.payout100||0)*(Number(x.stakePerPickYen||500)/100):0;
    if(cancel){
      voided++;voidedStake+=stake;curveBalance+=stake;peak=Math.max(peak,curveBalance);maxDrawdown=Math.max(maxDrawdown,peak-curveBalance);
    }else if(r){
      settledStake+=stake;returns+=ret;if(hit){hits++;lossStreak=0}else{lossStreak++;maxLossStreak=Math.max(maxLossStreak,lossStreak)}
      curveBalance+=ret;peak=Math.max(peak,curveBalance);maxDrawdown=Math.max(maxDrawdown,peak-curveBalance);
    }else pending+=stake;
    const v=byVenue[x.venueCode]||(byVenue[x.venueCode]={venue:x.venue,tries:0,settled:0,voided:0,hits:0,stakeYen:0,settledStakeYen:0,voidedStakeYen:0,returnYen:0});
    v.tries++;v.stakeYen+=stake;
    if(cancel){v.voided++;v.voidedStakeYen+=stake}
    else if(r){v.settled++;v.settledStakeYen+=stake;v.returnYen+=ret;if(hit)v.hits++}
    ledger.push({date:x.date,venueCode:x.venueCode,venue:x.venue,race:x.race,deadline:x.deadline,picks:x.picks,expansionVariant:x.expansionVariant||null,stakeYen:stake,settled:!!(r||cancel),voided:!!cancel,settlementStatus:cancel?'VOID_CANCELLED':r?'RESULT':'PENDING',result:r?.trifecta||null,payout100:r?.payout100??null,hit:r?hit:null,returnYen:cancel?stake:r?ret:null});
  }
  for(const v of Object.values(byVenue)){
    v.profitYen=v.returnYen-v.settledStakeYen;
    v.roi=v.settledStakeYen?v.returnYen/v.settledStakeYen:null;
    v.hitRate=v.settled?v.hits/v.settled:null;
  }
  const confirmedProfit=returns-settledStake;
  const confirmedBankroll=start+confirmedProfit;
  const availableBankroll=confirmedBankroll-pending;
  const bankroll=availableBankroll;
  const settledTries=ledger.filter(x=>x.settled&&!x.voided).length;
  const pendingTries=ledger.filter(x=>!x.settled).length;
  const out={
    schema:'boat-command-shared-try-portfolio-v1',version:'SHARED-TRY-PORTFOLIO-V1',
    generatedAt:new Date(NOW_MS).toISOString(),realMoney:false,fundingScope:'ALL_24_VENUES_SHARED',
    operationWindowDays:Number(config.operationWindowDays)||30,
    startingBankrollYen:start,
    confirmedBankrollYen:confirmedBankroll,
    availableBankrollYen:availableBankroll,
    bankrollYen:bankroll,
    status:availableBankroll>0?'ACTIVE':'BANKRUPT_STOP_NEW_TRY',
    committedStakeYen:committed,settledStakeYen:settledStake,pendingStakeYen:pending,
    returnYen:returns,profitYen:confirmedProfit,settledTries,pendingTries,voidedTries:voided,voidedStakeYen:voidedStake,
    hits,hitRate:settledTries?hits/settledTries:null,roi:settledStake?returns/settledStake:null,
    maxDrawdownYen:maxDrawdown,maxConsecutiveLosses:maxLossStreak,byVenue,ledger,
    capitalPolicy:{fundingScope:'ALL_24_VENUES_SHARED',resetAllowed:false,settledProfitCarriedForward:true,pendingStakeReserved:true,cancelledRaceReservationReleased:true},
    boundaries:{resultInputForSelection:false,payoutInputForSelection:false,realMoney:false,bankruptcyStopsNewTry:true,approvedExpansionPolicyOnly:true}
  };
  fs.writeFileSync(OUTPUT_PATH,JSON.stringify(out,null,2)+'\n');
  return out;
}

let portfolio=priorPortfolio();
if(allSelections().length)portfolio=rebuildPortfolio();
const selection=buildSelection(requestedDate,Number(portfolio.availableBankrollYen??portfolio.bankrollYen??config.startingBankrollYen));
portfolio=rebuildPortfolio();
console.log(JSON.stringify({date:requestedDate,selectionStatus:selection.status,selectedCount:selection.selectedCount,bankrollYen:portfolio.bankrollYen,pendingTries:portfolio.pendingTries,settledTries:portfolio.settledTries},null,2));
