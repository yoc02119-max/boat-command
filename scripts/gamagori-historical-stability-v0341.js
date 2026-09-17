'use strict';
const fs=require('fs');

const INPUT='gamagori-roi-gate-analysis-v0340.json';
const OUT=process.argv[2]||'gamagori-historical-stability-v0341.json';
const src=JSON.parse(fs.readFileSync(INPUT,'utf8'));
if(src.decision!=='SHADOW_ONLY'||src.liveImported!==false)throw new Error('ROI_BOUNDARY_INVALID');
const gates=src.allPretestSelectedGates||[];
if(!gates.length)throw new Error('NO_GATES');

const segs=['train','validation','test'];
const combine=g=>{
 let stake=0,ret=0,races=0,hits=0;
 for(const s of segs){const x=g[s]||{};stake+=Number(x.stakeYenAt100PerTicket)||0;ret+=Number(x.returnYenAt100PerTicket)||0;races+=Number(x.races)||0;hits+=Number(x.exactHits)||0;}
 return {races,hits,stakeYenAt100PerTicket:stake,returnYenAt100PerTicket:ret,roi:stake?ret/stake:0,profitYenAt100PerTicket:ret-stake};
};
const tier=g=>{
 const r=segs.map(s=>Number(g[s]?.roi)||0),avg=r.reduce((a,b)=>a+b,0)/r.length,min=Math.min(...r),profitable=r.filter(x=>x>=1).length;
 if(min>=1)return 'A_ALL_SEGMENTS_PROFITABLE';
 if(min>=.9&&avg>=1)return 'B_NEAR_STABLE';
 if(min>=.8&&avg>=.95)return 'C_WATCH';
 return 'D_UNSTABLE';
};
const rows=gates.map(g=>({
 rank:g.rank,label:g.label,kind:g.kind,parts:g.parts,
 train:g.train,validation:g.validation,test:g.test,
 segmentRoi:{train:g.train.roi,validation:g.validation.roi,test:g.test.roi},
 minSegmentRoi:Math.min(g.train.roi,g.validation.roi,g.test.roi),
 averageSegmentRoi:(g.train.roi+g.validation.roi+g.test.roi)/3,
 profitableSegments:[g.train.roi,g.validation.roi,g.test.roi].filter(x=>x>=1).length,
 combined:combine(g),tier:tier(g)
}));
const counts=rows.reduce((a,x)=>(a[x.tier]=(a[x.tier]||0)+1,a),{});
const report={
 schema:'boat-command-gamagori-historical-stability-v0341',analysisOnly:true,liveImported:false,decision:'SHADOW_ONLY',
 source:INPUT,
 boundary:'This audit only summarizes gates already selected before TEST in v0.33.9. It does not create, reorder, promote, or import a LIVE betting rule.',
 tierRules:{A:'ROI >= 1.00 in TRAIN, VALIDATION and TEST',B:'minimum segment ROI >= 0.90 and unweighted mean segment ROI >= 1.00',C:'minimum segment ROI >= 0.80 and unweighted mean segment ROI >= 0.95',D:'everything else'},
 primaryGateLabel:src.primaryPretestGate?.label||null,
 tierCounts:counts,
 rows,
 promotionPolicy:{historicalDataCanPromote:false,freshForwardEvidenceRequired:true,minimumForwardMatchedRaces:30,minimumForwardObservationDays:10,liveStakeChangeAllowed:false},
 note:'The tier labels are diagnostics, not betting recommendations. Future forward matches must be frozen pre-race and accumulated separately before any LIVE promotion decision.'
};
fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({primaryGateLabel:report.primaryGateLabel,tierCounts:counts,topPretestRows:rows.slice(0,10).map(x=>({rank:x.rank,label:x.label,tier:x.tier,roi:x.segmentRoi,combinedRoi:x.combined.roi}))},null,2));
