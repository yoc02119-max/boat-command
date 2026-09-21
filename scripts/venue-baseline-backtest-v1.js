#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');

const args=Object.fromEntries(process.argv.slice(2).map(x=>x.split('=')));
const slug=args.slug,code=args.code,key=args.key;
if(!slug||!code||!key)throw new Error('USAGE slug=... code=.. key=...');
const model=require(path.join('..',slug+'-research-model-v1.js'));
const input=args.input||`${slug}-history-bootstrap-v1.json`;
const output=args.output||`${slug}-baseline-backtest-v1.json`;
const db=JSON.parse(fs.readFileSync(input,'utf8'));
if(String(db.venueCode)!==code)throw new Error('VENUE_ONLY');
const rows=[...(db.races||[])].sort((a,b)=>String(a.d).localeCompare(String(b.d))||Number(a.r)-Number(b.r));
if(rows.length<300)throw new Error('INSUFFICIENT_HISTORY');
const configs=[];for(const classScale of [.18,.28,.38])for(const neighborMix of [.25,.45,.65])configs.push({recencyWindow:300,classScale,neighborMix,neighborLimit:240,decay:.55,laplace:1});
function programFrom(t){return{venue:key,venueCode:code,date:t.d,race:Number(t.r),raceType:String(t.t||''),boats:t.c.map((c,i)=>({lane:i+1,class:c})),resultEndpointsIncluded:false,resultIncluded:false,exhibitionIncluded:false}}
function evaluate(cfg,targets,mode){
  const ids=new Set(targets.map(x=>x.id)),rec=[];let history=[],day=null,dayRows=[];
  const flush=()=>{if(!dayRows.length)return;if(history.length>=300){for(const t of dayRows)if(ids.has(t.id)){const d=model.distribution(programFrom(t),history,{targetDate:t.d,config:cfg,mode});rec.push({id:t.id,d:t.d,r:t.r,actual:t.o,payout:Number(t.p)||0,picks:model.select(d,{count:6}).map(x=>x.order)})}}history=history.concat(dayRows);dayRows=[]};
  for(const row of rows){if(day!==null&&row.d!==day)flush();day=row.d;dayRows.push(row)}flush();return rec;
}
function metrics(rec,count){let hits=0,returns=0;for(const x of rec)if(x.picks.slice(0,count).includes(x.actual)){hits++;returns+=x.payout}const stake=rec.length*count*100;return{races:rec.length,hits,hitRate:rec.length?hits/rec.length:0,stake,returns,roi:stake?returns/stake:0}}
const dates=[...new Set(rows.map(x=>x.d))].sort(),cut=Math.max(1,Math.floor(dates.length*.7)),calEnd=dates[cut-1],holdStart=dates[cut];
const calibrationTargets=rows.filter(x=>x.d<=calEnd),holdoutTargets=rows.filter(x=>x.d>=holdStart);
const calibration=configs.map(cfg=>{const rec=evaluate(cfg,calibrationTargets,'PROGRAM_ONLY'),m4=metrics(rec,4);return{cfg,m4,score:.7*m4.hitRate+.3*Math.min(m4.roi,2)}}).sort((a,b)=>b.score-a.score||b.m4.hitRate-a.m4.hitRate||b.m4.roi-a.m4.roi);
if(!calibration.length||!calibration[0].m4.races)throw new Error('CALIBRATION_EMPTY');
const best=calibration[0],programHold=evaluate(best.cfg,holdoutTargets,'PROGRAM_ONLY'),classHold=evaluate(best.cfg,holdoutTargets,'CLASS_BASELINE');
const p4=metrics(programHold,4),c4=metrics(classHold,4),hitDelta=p4.hitRate-c4.hitRate,roiDelta=p4.roi-c4.roi;
const report={schema:`boat-command-${slug}-baseline-backtest-v1`,version:`${key}-BASELINE-BACKTEST-V1`,venue:key,venueCode:code,source:input,
  strictWalkForward:true,sameDayRowsExcluded:true,resultBlockedUntilPrediction:true,crossVenueWeightsReused:false,primaryRecencyWindowRaces:300,
  baselineArchitecture:`${key}_CLASS_NEIGHBOR_BASELINE`,candidateArchitecture:`${key}_EMPIRICAL_FIRST_SECOND_TRANSITION_PLUS_CLASS_NEIGHBORS`,
  calibration:{lastDate:calEnd,dateCount:cut,selected:best.cfg,candidates:calibration.map(x=>({config:x.cfg,metrics4:x.m4,score:x.score}))},
  holdout:{firstDate:holdStart,dateCount:dates.length-cut,classBaseline4:c4,programOnly4:p4,hitRateDelta:hitDelta,roiDelta,candidateUplift:hitDelta>=0&&roiDelta>0},
  productionEnabled:false,tryEnabled:false,promotionEligible:false,
  promotionBlockers:[`${key}_FORWARD_36_RACES_NOT_READY`,`${key}_FORWARD_60_RACES_NOT_READY`,`${key}_FORWARD_MODEL_UPLIFT_NOT_READY`]};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({venue:key,selected:best.cfg,classBaseline4:c4,programOnly4:p4,hitRateDelta:hitDelta,roiDelta,candidateUplift:report.holdout.candidateUplift},null,2));
