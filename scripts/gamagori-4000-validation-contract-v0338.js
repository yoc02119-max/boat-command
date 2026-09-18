#!/usr/bin/env node
'use strict';
/*
 BOAT COMMAND · Gamagori frozen large-sample validation contract v0.33.8
 SHADOW/EVALUATION ONLY. This file deliberately contains no result fetcher.
 It defines what a reconstructed historical PRE row must contain before the
 frozen V2.1 model and Winning Pattern 01 may be evaluated.
*/
const VERSION='GAMAGORI-4000-VALIDATION-CONTRACT-V0.33.8';
const VENUE='GAMAGORI';
const VENUE_CODE='07';
const MODEL='GAMAGORI-CANDIDATE-V2.1-SHADOW-V0.33.5';
const PATTERN=Object.freeze({id:'WINNING-PATTERN-01',top4Min:0.60,gapMin:0.04});
const REQUIRED_BOAT_FIELDS=Object.freeze(['lane','class','nationalWinRate','localWinRate','motor2Rate','averageST']);
function finite(v){return Number.isFinite(Number(v));}
function assertPreDataset(data){
 if(!data||data.venue!==VENUE||String(data.venueCode).padStart(2,'0')!==VENUE_CODE)throw new Error('PRE_VENUE_INVALID');
 if(data.outcomeFieldsIncluded!==false)throw new Error('PRE_OUTCOME_BOUNDARY_INVALID');
 if(data.resultOddsIncluded!==false)throw new Error('PRE_RESULT_ODDS_BOUNDARY_INVALID');
 if(data.exhibitionIncluded!==false)throw new Error('PRE_EXHIBITION_BOUNDARY_INVALID');
 if(!Array.isArray(data.races)||!data.races.length)throw new Error('PRE_RACES_EMPTY');
 const ids=new Set();
 for(const race of data.races){
   if(!race.id||ids.has(race.id))throw new Error('PRE_RACE_ID_INVALID'); ids.add(race.id);
   if(!Array.isArray(race.boats)||race.boats.length!==6)throw new Error(`PRE_BOATS_INVALID:${race.id}`);
   race.boats.forEach((b,i)=>{
     if(Number(b.lane)!==i+1)throw new Error(`PRE_LANE_INVALID:${race.id}:${i+1}`);
     for(const key of REQUIRED_BOAT_FIELDS){
       if(!(key in b))throw new Error(`PRE_FIELD_MISSING:${race.id}:${i+1}:${key}`);
       if(key!=='class'&&key!=='lane'&&b[key]!==null&&!finite(b[key]))throw new Error(`PRE_FIELD_INVALID:${race.id}:${i+1}:${key}`);
     }
     if(!['A1','A2','B1','B2'].includes(b.class))throw new Error(`PRE_CLASS_INVALID:${race.id}:${i+1}`);
   });
 }
 return {version:VERSION,races:data.races.length,requiredBoatFields:[...REQUIRED_BOAT_FIELDS],model:MODEL,pattern:PATTERN};
}
function assertResultDataset(data,preIds){
 if(!data||data.venue!==VENUE||String(data.venueCode).padStart(2,'0')!==VENUE_CODE)throw new Error('RESULT_VENUE_INVALID');
 if(data.predictionInputsIncluded!==false)throw new Error('RESULT_INPUT_BOUNDARY_INVALID');
 if(!Array.isArray(data.races))throw new Error('RESULT_RACES_INVALID');
 const ids=new Set(preIds||[]);
 for(const r of data.races){
   if(!ids.has(r.id))throw new Error(`RESULT_WITHOUT_FROZEN_PRE:${r.id}`);
   if(!/^[1-6]-[1-6]-[1-6]$/.test(String(r.result||'')))throw new Error(`RESULT_ORDER_INVALID:${r.id}`);
   if(!finite(r.payout)||Number(r.payout)<=0)throw new Error(`RESULT_PAYOUT_INVALID:${r.id}`);
 }
 return true;
}
function qualifies(confidence){return finite(confidence?.top4)&&finite(confidence?.gap)&&Number(confidence.top4)>=PATTERN.top4Min&&Number(confidence.gap)>=PATTERN.gapMin;}
module.exports=Object.freeze({VERSION,VENUE,VENUE_CODE,MODEL,PATTERN,REQUIRED_BOAT_FIELDS,assertPreDataset,assertResultDataset,qualifies});
if(require.main===module){
 console.log(JSON.stringify({version:VERSION,venue:VENUE,model:MODEL,pattern:PATTERN,requiredBoatFields:REQUIRED_BOAT_FIELDS,policy:'FREEZE PRE + PREDICTIONS BEFORE OPENING RESULT; NEVER TUNE ON LARGE-SAMPLE RESULTS'},null,2));
}
