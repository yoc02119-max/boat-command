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
 console.log('B_AUTO_TRY_BOUNDARY_PASS: next-day only, venue isolation, evidence hash, same rule, no missing-proof adoption');
}finally{fs.rmSync(root,{recursive:true,force:true})}
