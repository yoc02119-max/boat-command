// BOAT COMMAND GAMAGORI winning-pattern gate v0.33.7
// SHADOW evaluation only. Gate selection uses DESIGN outcomes only; HOLDOUT stays sealed until gate is frozen.
'use strict';
const fs=require('fs');
const model=require('../gamagori-candidate-model-v0335.js');
const PRE='gamagori-shadow-pre-v0330.json';
const RESULT='gamagori-replay-results-v0333.json';
const OUT=process.argv[2]||'gamagori-winning-pattern-gate-v0337.json';
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
const key=x=>`${x.date||x.d}|${x.race||x.r}`;
function program(x){return {classes:x.boats.map(b=>b.class),profiles:x.boats.map(b=>({racerWinRate:b.nationalWinRate,localWinRate:b.localWinRate,motor2Rate:b.motor2Rate,averageST:b.averageST}))}}
function features(x,p){const b=x.boats,n=b.map(z=>num(z.nationalWinRate)),l=b.map(z=>num(z.localWinRate)),m=b.map(z=>num(z.motor2Rate)),s=b.map(z=>num(z.averageST,.18)),orders=p.fixed.map(z=>z.order),heads=new Set(orders.map(z=>Number(z.split('-')[0]))),seconds=new Set(orders.map(z=>Number(z.split('-')[1])));return {top1:p.confidence.top1,top4:p.confidence.top4,gap:p.confidence.gap,lane1NationalGap:n[0]-mean(n.slice(1)),lane1LocalGap:l[0]-mean(l.slice(1)),lane1MotorGap:m[0]-mean(m.slice(1)),lane1STEdge:mean(s.slice(1))-s[0],innerNationalGap:mean(n.slice(0,3))-mean(n.slice(3)),innerLocalGap:mean(l.slice(0,3))-mean(l.slice(3)),innerMotorGap:mean(m.slice(0,3))-mean(m.slice(3)),innerSTEdge:mean(s.slice(3))-mean(s.slice(0,3)),uniqueHeads:heads.size,uniqueSeconds:seconds.size,lane1Tickets:orders.filter(z=>z.startsWith('1-')).length,raceNumber:Number(x.race)};}
function metrics(rows){let stake=0,ret=0,hits=0,peak=0,bank=0,maxDD=0,largest=0;for(const x of rows){stake+=4;bank-=4;if(x.hit){hits++;ret+=x.odds;bank+=x.odds;largest=Math.max(largest,x.odds)}peak=Math.max(peak,bank);maxDD=Math.max(maxDD,peak-bank)}return {races:rows.length,hits,hitRate:rows.length?hits/rows.length:0,stake,totalReturn:ret,roi:stake?ret/stake:0,maxDrawdown:maxDD,largestWinningOdds:largest,roiWithoutLargest:stake?(ret-largest)/stake:0};}
const pre=JSON.parse(fs.readFileSync(PRE,'utf8'));if(pre.outcomeFieldsIncluded!==false||pre.resultOddsIncluded!==false||pre.exhibitionIncluded!==false)throw new Error('PRE_BOUNDARY_INVALID');
const targets=[...pre.races].sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.race)-Number(b.race));if(targets.length!==360)throw new Error('TARGET_NOT_360');
// Freeze all predictions/features before any result file is opened.
const frozen=targets.map((x,i)=>{const p=model.predict(program(x),{count:4});return {id:key(x),split:i<180?'DESIGN':'HOLDOUT',tickets:p.fixed.map(z=>z.order),f:features(x,p)};});
const result=JSON.parse(fs.readFileSync(RESULT,'utf8'));if(result.predictionInputsIncluded!==false)throw new Error('RESULT_BOUNDARY_INVALID');const by=new Map(result.races.map(x=>[key(x),x]));
const scored=frozen.map(x=>{const y=by.get(x.id);if(!y)throw new Error(`RESULT_MISSING_${x.id}`);const order=String(y.o);return {...x,hit:x.tickets.includes(order),odds:num(y.x)}}),design=scored.filter(x=>x.split==='DESIGN'),holdout=scored.filter(x=>x.split==='HOLDOUT');
// Predeclared simple threshold grid. Search is DESIGN-only.
const rules=[];const add=(name,test)=>rules.push({name,test});
for(const t of [.30,.35,.40,.45,.50,.55,.60])add(`top4>=${t}`,x=>x.f.top4>=t);
for(const t of [.01,.02,.03,.04,.05])add(`gap>=${t}`,x=>x.f.gap>=t);
for(const t of [-1,0,1])add(`lane1NationalGap>=${t}`,x=>x.f.lane1NationalGap>=t);
for(const t of [-1,0,1])add(`innerNationalGap>=${t}`,x=>x.f.innerNationalGap>=t);
for(const t of [1,2,3,4])add(`lane1Tickets>=${t}`,x=>x.f.lane1Tickets>=t);
for(const t of [1,2,3])add(`uniqueHeads<=${t}`,x=>x.f.uniqueHeads<=t);
const candidates=[];for(let i=0;i<rules.length;i++){for(let j=i;j<rules.length;j++){const rs=i===j?[rules[i]]:[rules[i],rules[j]],rows=design.filter(x=>rs.every(r=>r.test(x)));if(rows.length<30)continue;const m=metrics(rows);candidates.push({name:rs.map(r=>r.name).join(' AND '),ruleIndexes:rs.map(r=>rules.indexOf(r)),...m});}}
// Robustness-first: require DESIGN ROI>1 and ROI excluding largest>1; then maximize hit rate, sample size, ROI.
const eligible=candidates.filter(x=>x.roi>1&&x.roiWithoutLargest>1).sort((a,b)=>b.hitRate-a.hitRate||b.races-a.races||b.roi-a.roi);
const chosen=eligible[0]||candidates.sort((a,b)=>b.hitRate-a.hitRate||b.races-a.races||b.roi-a.roi)[0];if(!chosen)throw new Error('NO_GATE_CANDIDATE');
const frozenRules=chosen.ruleIndexes.map(i=>rules[i]);const holdRows=holdout.filter(x=>frozenRules.every(r=>r.test(x)));const allRows=scored.filter(x=>frozenRules.every(r=>r.test(x)));
const report={schema:'boat-command-gamagori-winning-pattern-gate-v0337',status:'SHADOW_ONLY',boundary:'All V2.1 PRE-RACE predictions/features frozen before result read. Gate selected from DESIGN only, then frozen before HOLDOUT evaluation.',selectionPolicy:{designRaces:180,minDesignSample:30,criteria:'DESIGN ROI > 100% AND ROI excluding largest hit > 100%; maximize hit rate, then sample size, then ROI',grid:'predeclared simple one/two-condition thresholds'},baseline:{design:metrics(design),holdout:metrics(holdout),all:metrics(scored)},chosenGate:{name:chosen.name,design:metrics(design.filter(x=>frozenRules.every(r=>r.test(x)))),holdout:metrics(holdRows),all:metrics(allRows)},topDesignCandidates:eligible.slice(0,10).map(({ruleIndexes,...x})=>x),decision:{robustHoldout:Boolean(holdRows.length>=20&&metrics(holdRows).roi>1&&metrics(holdRows).roiWithoutLargest>1),promoteLive:false,note:'4000-race validation is allowed only after this gate is frozen; do not tune it on HOLDOUT or 4000-race outcomes.'}};
fs.writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));