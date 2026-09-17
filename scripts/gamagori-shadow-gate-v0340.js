'use strict';
const fs=require('fs');
const input=process.argv[2];
const output=process.argv[3];
if(!input)throw new Error('USAGE: node scripts/gamagori-shadow-gate-v0340.js <pre-race-pack.json> [output.json]');
const pack=JSON.parse(fs.readFileSync(input,'utf8'));
if(pack.resultEndpointsIncluded!==false)throw new Error('RESULT_BOUNDARY_INVALID');
if(pack.venue!=='GAMAGORI'&&pack.venueCode!=='07')throw new Error('VENUE_INVALID');
const classes=(pack.boats||[]).map(x=>String(x.class||'UNKNOWN').toUpperCase());
const aClassCount=classes.filter(c=>c==='A1'||c==='A2').length;
const race=Number(pack.race);
const primaryMatched=race===7&&aClassCount===3;
const report={
 schema:'boat-command-gamagori-shadow-gate-v0340',
 shadowOnly:true,
 liveBettingEnabled:false,
 resultDataRead:false,
 venue:'GAMAGORI',venueCode:'07',date:pack.date,race,
 sourcePreRacePack:input,
 sourceFetchedAt:pack.fetchedAt||null,
 deadline:pack.deadline||null,
 classes,aClassCount,
 primaryGate:{label:'race=7 & aClassCount=3',matched:primaryMatched,historicalStatus:'candidate-only',promotionStatus:'NOT_PROMOTED'},
 decision:primaryMatched?'FORWARD_SHADOW_TRACK':'FORWARD_SHADOW_SKIP',
 note:'This gate records eligibility only. It must not alter LIVE predictions, stakes, or hard locks. No result or payout endpoint is read.'
};
const out=output||input.replace(/\.json$/,'-shadow-gate-v0340.json');
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
