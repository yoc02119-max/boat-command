#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ready=JSON.parse(fs.readFileSync('venues/toda/readiness-v1.json','utf8'));
if(ready.venueCode!=='02'||ready.phase!=='SHADOW_VALIDATION')throw new Error('TODA_READINESS');
const date=ready.latestDate;
if(!date)throw new Error('TODA_DATE');
for(let race=1;race<=12;race++){
  const program=JSON.parse(fs.readFileSync(path.join('live','toda',date,'program',`race-${race}.json`),'utf8'));
  const venue=JSON.parse(fs.readFileSync(path.join('live','toda',date,'shadow','program-only',`race-${race}.json`),'utf8'));
  const base=JSON.parse(fs.readFileSync(path.join('live','toda',date,'shadow','class-baseline',`race-${race}.json`),'utf8'));
  if(program.venueCode!=='02'||program.resultIncluded!==false||program.exhibitionIncluded!==false)throw new Error('PROGRAM_BOUNDARY '+race);
  if(venue.mode!=='PROGRAM_ONLY'||base.mode!=='CLASS_BASELINE')throw new Error('MODE '+race);
  for(const x of [venue,base]){
    if(x.venueCode!=='02'||x.resultInput!==false||x.payoutInput!==false||x.tryEnabled!==false||x.productionEnabled!==false||x.cashNeutral!==true||x.immutableAfterFirstWrite!==true)throw new Error('SHADOW_BOUNDARY '+race);
    if(!Array.isArray(x.picks)||x.picks.length!==4||new Set(x.picks).size!==4)throw new Error('PICKS '+race);
  }
}
console.log('TODA_12R_VIEW_CONTRACT_PASS',date,'12/12');
