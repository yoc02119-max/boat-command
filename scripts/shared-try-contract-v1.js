#!/usr/bin/env node
'use strict';
const fs=require('fs');
const cp=require('child_process');

const env={...process.env,BOAT_COMMAND_NOW_ISO:'2026-09-20T06:00:00+09:00'};
cp.execFileSync(process.execPath,['scripts/shared-try-portfolio-v1.js','2026-09-20'],{stdio:'inherit',env});

const cfg=JSON.parse(fs.readFileSync('shared-try-config-v1.json','utf8'));
const sel=JSON.parse(fs.readFileSync('live/portfolio/2026-09-20/try-selection-v1.json','utf8'));
const p=JSON.parse(fs.readFileSync('shared-try-portfolio-v1.json','utf8'));

if(!Number.isFinite(Number(cfg.startingBankrollYen))||Number(cfg.startingBankrollYen)<=0)throw new Error('CONFIG_BANKROLL');
if(Number(cfg.startingBankrollYen)!==100000)throw new Error('SHARED_100K_LOCK');
if(cfg.fundingScope!=='ALL_24_VENUES_SHARED')throw new Error('FUNDING_SCOPE');
if(cfg.resetPolicy!=='NEVER_AUTOMATICALLY_RESET'||cfg.preserveSettledHistory!==true)throw new Error('RESET_POLICY');
if(cfg.operationStartDate!=='2026-09-20'||cfg.operationWindowDays!==30)throw new Error('WINDOW');
if(sel.resultInput!==false||sel.payoutInput!==false||sel.realMoney!==false||sel.immutableAfterFirstWrite!==true)throw new Error('SELECTION_BOUNDARY');
if(!(sel.selectedCount>0))throw new Error('NO_TRY_SELECTED');
if(sel.selectedCount>cfg.maxTryRacesPerDay)throw new Error('TRY_CAP');
for(const x of sel.selected){
  if(!['02','03','07','10','14','18','21','23'].includes(String(x.venueCode)))throw new Error('VENUE_SCOPE');
  if(!Array.isArray(x.picks)||x.picks.length!==4)throw new Error('PICKS');
  if(x.stakePerPickYen!==500||x.stakeYen!==2000)throw new Error('STAKE');
  if(x.resultInput!==false||x.payoutInput!==false)throw new Error('LEAKAGE');
}
if(p.startingBankrollYen!==Number(cfg.startingBankrollYen)||p.realMoney!==false)throw new Error('PORTFOLIO_BOUNDARY');
const expectedConfirmed=Number(cfg.startingBankrollYen)+Number(p.profitYen||0);
const expectedAvailable=expectedConfirmed-Number(p.pendingStakeYen||0);
if(Number(p.confirmedBankrollYen)!==expectedConfirmed)throw new Error('CONFIRMED_BANKROLL_IDENTITY');
if(Number(p.availableBankrollYen)!==expectedAvailable)throw new Error('AVAILABLE_BANKROLL_IDENTITY');
if(Number(p.bankrollYen)!==expectedAvailable)throw new Error('BANKROLL_ALIAS_IDENTITY');
if(p.capitalPolicy?.resetAllowed!==false||p.capitalPolicy?.settledProfitCarriedForward!==true)throw new Error('CAPITAL_RESET_POLICY');
const ledger=Array.isArray(p.ledger)?p.ledger:[];
const dayLedger=ledger.filter(x=>x.date==='2026-09-20');
if(dayLedger.length!==sel.selectedCount)throw new Error('TRY_COUNT_DATE');
if(Number(p.pendingTries||0)+Number(p.settledTries||0)!==ledger.length)throw new Error('TRY_COUNT');
if(p.boundaries?.resultInputForSelection!==false||p.boundaries?.payoutInputForSelection!==false)throw new Error('PORTFOLIO_LEAKAGE');
console.log('SHARED_TRY_CONTRACT_PASS',JSON.stringify({selected:sel.selectedCount,bankroll:p.bankrollYen,venues:[...new Set(sel.selected.map(x=>x.venueCode))]}));
