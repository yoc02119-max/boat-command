#!/usr/bin/env node
'use strict';
const f=require('../toda-feature-contract-v1.js');
const program={schema:'boat-command-program-pack-v1',venue:'TODA',venueCode:'02',date:'2026-09-20',race:1,raceType:'予選',deadline:'10:47',resultEndpointsIncluded:false,resultIncluded:false,exhibitionIncluded:false,boats:Array.from({length:6},(_,i)=>({lane:i+1,registration:4200+i,class:i===0?'A1':'B1',fCount:0,lCount:0,avgST:.15+i*.01,nationalWinRate:5+i*.1,national2Rate:.3+i*.01,national3Rate:.45+i*.01,localWinRate:5.5+i*.1,local2Rate:.35+i*.01,local3Rate:.5+i*.01,motor2Rate:.33+i*.01,boat2Rate:.3+i*.01}))};
const pre={schema:'boat-command-toda-pre-race-pack-v1',venue:'TODA',venueCode:'02',date:'2026-09-20',race:1,resultEndpointsIncluded:false,payoutEndpointsIncluded:false,predictionEnabled:false,hardLockEnabled:false,boatMappingVerified:true,weatherMappingVerified:true,boats:Array.from({length:6},(_,i)=>({lane:i+1,exhibitionTime:6.8+i*.02,tilt:0})),startExhibition:Array.from({length:6},(_,i)=>({course:i+1,st:'.'+String(10+i).padStart(2,'0')})),water:{airTempC:26,windSpeedMps:4,waterTempC:25,waveHeightCm:3,windDirectionCode:'is-wind3',weatherCode:'is-weather1',weatherMappingStatus:'VERIFIED_OFFICIAL_BEFOREINFO'}};
const x=f.extract(program,pre);
if(x.venueCode!=='02'||x.lanes.length!==6||x.preRaceComplete!==true)throw new Error('TARGET');
if(x.boundaries.resultInput!==false||x.boundaries.payoutInput!==false||x.boundaries.predictionEnabled!==false)throw new Error('BOUNDARY');
if(x.lanes[0].localVsNationalWinDelta!==.5||x.lanes[0].exhibitionRank!==1||x.lanes[5].exhibitionRank!==6)throw new Error('FEATURES');
if(!(f.stValue('F.03')>f.stValue('.25')))throw new Error('F_MUST_RANK_WORSE');
console.log('TODA_FEATURE_CONTRACT_PASS');
