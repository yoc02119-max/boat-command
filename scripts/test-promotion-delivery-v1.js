'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const delivery=require('../promotion-delivery-v1.js');
const policy=JSON.parse(fs.readFileSync('daily-lab/venue-expansion-policy-v1.json'));
const rows=policy.venues.filter(v=>v.humanReviewPending===true);
assert.ok(rows.length>0);
for(const row of rows)for(const decision of ['approve','reject']){
 const u=new URL(delivery.issueUrl({...row,candidateVersion:policy.candidateVersion},decision));
 const event={action:'opened',repository:{full_name:'yoc02119-max/boat-command'},issue:{title:u.searchParams.get('title'),body:u.searchParams.get('body'),user:{login:'yoc02119-max'}},sender:{login:'yoc02119-max'}};
 const x=delivery.validateIssue(event,policy);assert.equal(x.decision,decision);assert.equal(x.venue,row.slug);
 const bad=mutate=>{const e=structuredClone(event);mutate(e);assert.throws(()=>delivery.validateIssue(e,policy));};
 bad(e=>e.sender.login='other');bad(e=>e.issue.user.login='other');bad(e=>e.repository.full_name='other/repo');bad(e=>e.action='edited');bad(e=>e.issue.body='invalid');bad(e=>e.issue.title+=' altered');
 for(const [k,v] of [['decision','approve\nINJECT=1'],['venue','unknown'],['variant','BASE4'],['candidateVersion','stale']])bad(e=>{const b=JSON.parse(e.issue.body);b[k]=v;e.issue.body=JSON.stringify(b);});
 const expired=structuredClone(policy);expired.venues.find(v=>v.slug===row.slug).humanReviewPending=false;assert.throws(()=>delivery.validateIssue(event,expired));
 // Execute the existing writer with actual gate evidence in an isolated directory.
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'boat-decision-'));
 try{
  fs.mkdirSync(path.join(temp,'scripts'));fs.mkdirSync(path.join(temp,'daily-lab'));
  fs.copyFileSync('scripts/venue-expansion-decision-v1.js',path.join(temp,'scripts/venue-expansion-decision-v1.js'));
  for(const f of ['forward-gate-v1.json','venue-expansion-decisions-v1.json'])fs.copyFileSync('daily-lab/'+f,path.join(temp,'daily-lab',f));
  cp.execFileSync(process.execPath,[path.join(temp,'scripts/venue-expansion-decision-v1.js'),'--action',x.decision,'--venue',x.venue,'--variant',x.variant]);
  const ledger=JSON.parse(fs.readFileSync(path.join(temp,'daily-lab/venue-expansion-decisions-v1.json')));
  const entry=ledger.decisions.find(v=>v.slug===row.slug&&v.variant===row.candidateVariant);assert.equal(entry.decision,decision.toUpperCase());
  assert.equal(entry.effectiveDate,new Date(Date.now()+9*3600000+(decision==='approve'?86400000:0)).toISOString().slice(0,10));
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
(async()=>{
 for(const file of ['portal.html','portal-design-preview.html']){
  const html=fs.readFileSync(file,'utf8');for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(m[1].trim())new vm.Script(m[1]);
  const fn=html.slice(html.indexOf('async function sendPromotionDecision'),html.indexOf('async function renderPromotionQueue'));
  let calls=0,clicks=0;const status={textContent:'',replaceChildren(...xs){this.children=xs;}};
  const buttons=[{},{}],card={querySelector:()=>status,querySelectorAll:()=>buttons};
  const ctx={location:{hostname:'yoc02119-max.github.io'},BoatPromotionDelivery:delivery,document:{createElement:()=>({click(){clicks++;}}),createTextNode:x=>x},fetch:async()=>{calls++;},setTimeout(){},renderPromotionQueue(){}};
  vm.createContext(ctx);vm.runInContext(fn,ctx);
  const row={...rows[0],candidateVersion:policy.candidateVersion};await ctx.sendPromotionDecision(row,'approve',card);assert.equal(calls,0);assert.equal(clicks,1);assert.match(status.children[0],/未送信/);
  ctx.location.hostname='example.vercel.app';ctx.fetch=async()=>({ok:false,json:async()=>({error:'DEVELOPER_AUTH_REQUIRED'})});await ctx.sendPromotionDecision(row,'approve',card);assert.match(status.textContent,/認証/);assert.equal(buttons[0].disabled,false);
  ctx.fetch=async()=>({ok:true,json:async()=>({ok:true,status:'QUEUED'})});await ctx.sendPromotionDecision(row,'approve',card);assert.match(status.textContent,/依頼/);assert.doesNotMatch(status.textContent,/承認しました/);
 }
 console.log('PROMOTION_DELIVERY_PASS: owner identity, stale/tampered requests, both real pending venues, approve/reject isolated ledger, Pages no-API route, API auth/queue, inline syntax');
})().catch(e=>{console.error(e);process.exitCode=1;});
