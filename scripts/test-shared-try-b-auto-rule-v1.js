'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),ruleFor=require('./shared-try-b-auto-rule-v1.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'b-auto-test-')),file=path.join(root,'research/b-over-a-active-rules-v1.json');
try{
 assert.strictEqual(ruleFor(root,'01','2026-11-08'),null);
 const rule={minMargin:.1,minCoverage:.2,ranking:'coverage'},decision={schema:'b-over-a-auto-decision-v1',venueCode:'01',experimentId:'test',evaluatedAt:'2026-11-07T10:00:00+09:00',modelChanged:false,realMoney:false,trial:{rule},outcome:{decision:'ADOPT'}};
 const dp='research/b-over-a-auto-history-v1/01/test-decision.json';fs.mkdirSync(path.dirname(path.join(root,dp)),{recursive:true});const raw=JSON.stringify(decision);fs.writeFileSync(path.join(root,dp),raw);
 const row={effectiveDate:'2026-11-08',rule,experimentId:'test',decisionPath:dp,decisionSha256:crypto.createHash('sha256').update(raw).digest('hex'),gatePass:true},p={schema:'b-over-a-active-rules-v1',enabled:true,venues:{'01':[row]}};
 fs.writeFileSync(file,JSON.stringify(p));const now=Date.parse('2026-11-07T11:00:00+09:00');assert.strictEqual(ruleFor(root,'01','2026-11-07',now),null);assert.strictEqual(ruleFor(root,'02','2026-11-08',now),null);assert.strictEqual(ruleFor(root,'01','2026-11-08',now).experimentId,'test');
 fs.writeFileSync(path.join(root,dp),raw+' ');assert.throws(()=>ruleFor(root,'01','2026-11-08',now),/EVIDENCE_CHANGED/);fs.writeFileSync(path.join(root,dp),raw);
 row.rule={...rule,minMargin:.3};fs.writeFileSync(file,JSON.stringify(p));assert.throws(()=>ruleFor(root,'01','2026-11-08',now),/RULE_INVALID/);
 row.rule=rule;row.effectiveDate='2026-11-07';fs.writeFileSync(file,JSON.stringify(p));assert.throws(()=>ruleFor(root,'01','2026-11-07',now),/BOUNDARY/);
 const choose=require('./shared-try-b-over-a-v1.js');
 const program={date:'2026-11-08',race:1,venueCode:'01',deadline:'12:00',fetchedAt:'2026-11-08T00:00:00Z',resultIncluded:false,resultEndpointsIncluded:false,boats:[1,2,3,4,5,6].map(lane=>({lane,class:lane===1?'B1':'A1'}))};
 const bytes=Buffer.from(JSON.stringify(program)),pre={...program,generatedAt:'2026-11-08T00:01:00Z',resultInput:false,payoutInput:false,immutableAfterFirstWrite:true,sources:{programSha256:crypto.createHash('sha256').update(bytes).digest('hex')},pointExpansion:{ranked:[]}};
 const weights=[.4,.3,.1,.08,.07,.05];for(let i=1;i<=6;i++)for(let j=1;j<=6;j++)for(let k=1;k<=6;k++)if(new Set([i,j,k]).size===3)pre.pointExpansion.ranked.push({order:`${i}-${j}-${k}`,probability:weights[i-1]/20});
 assert.strictEqual(choose(pre,bytes,{minMargin:0,minCoverage:1,ranking:'coverage',experimentId:'test'}),null);
 const chosen=choose(pre,bytes,{minMargin:0,minCoverage:0,ranking:'coverage',experimentId:'test'});assert.strictEqual(chosen.selectionExperimentId,'test');assert(Math.abs(chosen.autoRank-.08)<1e-9);assert(chosen.picks.every(x=>x[0]==='1'));
 console.log('B_AUTO_TRY_BOUNDARY_PASS: next-day only, venue isolation, evidence hash, same rule, no missing-proof adoption');
}finally{fs.rmSync(root,{recursive:true,force:true})}
