#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'daily-lab');
function arg(name,fallback=null){const i=process.argv.indexOf('--'+name);return i>=0&&process.argv[i+1]!=null?process.argv[i+1]:fallback}
const action=String(arg('action','')).toUpperCase(),venue=String(arg('venue','')),variant=String(arg('variant',''));
if(!['APPROVE','REJECT'].includes(action))throw Error('EXPANSION_DECISION_ACTION_INVALID');
const gate=JSON.parse(fs.readFileSync(path.join(dir,'forward-gate-v1.json'),'utf8'));
if(gate.schema!=='boat-command-daily-lab-forward-gate-v1'||gate.researchOnly!==true||gate.automaticPromotion!==false)throw Error('EXPANSION_DECISION_GATE_INVALID');
const row=gate.venues.find(v=>v.code===venue||v.slug===venue);
if(!row||row.mode!=='EXPANSION_CANDIDATE')throw Error('EXPANSION_DECISION_VENUE_INVALID');
if(row.reviewEligible!==true||row.status!=='REVIEW_READY')throw Error('EXPANSION_DECISION_TOO_EARLY');
if(variant&&variant!==row.variant)throw Error('EXPANSION_DECISION_VARIANT_MISMATCH');
const file=path.join(dir,'venue-expansion-decisions-v1.json');
const ledger=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{schema:'boat-command-venue-expansion-decisions-v1',version:'VENUE-EXPANSION-DECISIONS-V1',decisions:[]};
if(ledger.schema!=='boat-command-venue-expansion-decisions-v1'||!Array.isArray(ledger.decisions))throw Error('EXPANSION_DECISION_LEDGER_INVALID');
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const [y,m,d]=today.split('-').map(Number),effectiveDate=new Date(Date.UTC(y,m-1,d+1)).toISOString().slice(0,10);
const entry={code:row.code,slug:row.slug,name:row.name,candidateVersion:gate.candidateVersion,variant:row.variant,decision:action,decidedAt:new Date().toISOString(),decidedBy:'OWNER_APP',effectiveDate:action==='APPROVE'?effectiveDate:today,forwardEvidence:{races:row.forwardRaces,hitRateDelta:row.hitRateDelta,roiDelta:row.roiDelta,addedHits:row.addedHits,recent:row.recent,robustness:row.robustness}};
ledger.decisions=ledger.decisions.filter(x=>!(x.code===row.code&&x.candidateVersion===gate.candidateVersion&&x.variant===row.variant));
ledger.decisions.push(entry);
fs.writeFileSync(file,JSON.stringify(ledger,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',action,venue:row.slug,variant:row.variant,effectiveDate:entry.effectiveDate}));
