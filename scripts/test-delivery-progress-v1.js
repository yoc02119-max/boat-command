'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), cp=require('node:child_process');
const source=fs.readFileSync('delivery-progress-v1.js','utf8');
const original=JSON.parse(fs.readFileSync('docs/delivery-roadmap-v1.json','utf8'));
class El{
 constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.handlers={};this.textContent='';this.open=false;this.disabled=false;this.classList={add:()=>{},remove:()=>{}};}
 append(...x){this.children.push(...x);}replaceChildren(...x){this.children=x;}addEventListener(e,f){this.handlers[e]=f;}click(){this.handlers.click?.();}
 querySelectorAll(){return this.children.filter(x=>x.tag==='details'&&x.open);}
}
const ids=Object.fromEntries(['deliveryProgress','dpCurrent','dpVersion','dpUpdated','dpVerified','dpLastWork','dpLastWorkAt','dpNext','dpStages','dpHistory','dpOptional','dpEvidence','dpDownload','dpSync','dpHomeCurrent','dpHomeSync','dpLive','dpRefresh','dpDetails'].map(k=>[k,new El()]));
const events={},intervals=[],calls=[];let value=structuredClone(original),failPlan=false,failResearch=false;
const fixtures={'shared-try-portfolio-v1.json':{generatedAt:'2026-11-03T17:23:27Z',settledTries:176,pendingTries:0,confirmedBankrollYen:52870},'research/racer-period-second-forward-evaluation-v1.json':{summary:{pairedRaces:5860},promotionEligible:false},'AI-STATE.json':{lastVerifiedAt:'2026-11-03T17:36:09Z',deploymentState:{all24VenueEndToEndVerified:false,predictionImprovementVerified:false}}};
const sandbox={document:{getElementById:id=>ids[id],createElement:tag=>new El(tag),hidden:false,querySelectorAll:()=>[],addEventListener:(k,f)=>events[k]=f},window:{addEventListener:(k,f)=>events[k]=f},navigator:{onLine:true},Date,URL,Blob,AbortController,setTimeout:()=>0,clearTimeout:()=>{},setInterval:(f,n)=>intervals.push({f,n}),fetch:async(url,options)=>{calls.push({url,options});const path=url.split('/main/')[1].split('?')[0];if(failPlan&&path.startsWith('docs/'))throw Error('offline');if(failResearch&&path.startsWith('research/'))return{ok:false,status:503};return{ok:true,json:async()=>structuredClone(path.startsWith('docs/')?value:fixtures[path])};}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 vm.runInNewContext(source,sandbox);await tick();
 assert.equal(ids.dpVersion.textContent,'v'+original.version);assert.equal(ids.dpStages.children.length,6);assert.equal(intervals[0].n,30000);assert.match(ids.dpSync.textContent,/最新計画を取得/);assert.doesNotMatch(ids.dpSync.textContent,/未記録/);assert.match(ids.dpVerified.textContent,/2026/);
 assert.match(ids.dpLive.children[2].children[1].textContent,/24場の一連動作：未確認/);assert.match(ids.dpLive.children[1].children[1].textContent,/未確認/);
 assert.ok(calls.every(c=>c.url.startsWith('https://raw.githubusercontent.com/yoc02119-max/boat-command/main/')&&c.options.cache==='no-store'&&c.options.credentials==='omit'&&c.options.method===undefined));
 ids.dpStages.children[0].open=true;value.version='1.2';value.current='<img src=x onerror=alert(1)>';value.changelog.push({version:'1.2',at:'2026-11-04',summary:'更新テスト'});intervals[0].f();await tick();
 assert.equal(ids.dpVersion.textContent,'v1.2');assert.equal(ids.dpCurrent.textContent,value.current);assert.equal(ids.dpStages.children[0].open,true);assert.equal(ids.dpCurrent.children.length,0,'untrusted plan must remain plain text');
 failResearch=true;events.visibilitychange();await tick();assert.match(ids.dpLive.children[1].children[1].textContent,/取得失敗/);assert.match(ids.dpLive.children[0].children[1].textContent,/176R/,'partial failure must not erase other data');
 failPlan=true;ids.dpRefresh.click();await tick();assert.match(ids.dpSync.textContent,/取得失敗.*前回取得/);assert.equal(ids.dpVersion.textContent,'v1.2');
 failPlan=false;value.stages[0].checks[1].id=value.stages[0].checks[0].id;ids.dpRefresh.click();await tick();assert.match(ids.dpSync.textContent,/取得失敗/,'invalid schema must not overwrite valid display');assert.equal(ids.dpVersion.textContent,'v1.2');
 sandbox.navigator.onLine=false;events.offline();assert.match(ids.dpSync.textContent,/更新を確認できていません/);
 const before=cp.execFileSync('git',['show','HEAD:portal.html'],{encoding:'utf8'}),after=fs.readFileSync('portal.html','utf8');
 const inline=x=>[...x.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean);assert.deepEqual(inline(after),inline(before),'existing inline behavior unchanged');
 for(const m of before.matchAll(/\bid="([^"]+)"/g))assert.ok(after.includes(m[0]),'lost DOM id '+m[1]);
 const allids=[...after.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(allids).size,allids.length,'duplicate DOM IDs');
 console.log('PASS: live plan change, preserved expansion, evidence separation, partial/total failure, schema rejection, offline, text escaping, GET-only, original inline scripts and DOM IDs');
})().catch(e=>{console.error(e);process.exitCode=1;});
