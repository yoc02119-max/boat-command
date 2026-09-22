#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');

const deep=fs.readFileSync('try-race-deeplink-v1.js','utf8');
const browser=fs.readFileSync('browser-controls-v1.js','utf8');

for(const src of [deep,browser]){
  assert.ok(src.includes('bcNextTryRace'));
  assert.ok(src.includes('次のTRY →'));
  assert.ok(src.includes("shared-try-portfolio-v1.json"));
  assert.ok(src.includes("rows.slice(here+1).find(z=>{"));
  assert.ok(src.includes("routeFor?.(meta)"));
  assert.ok(src.includes("u.searchParams.set('race'"));
}
assert.ok(deep.includes("q.get('jcd')"));
assert.ok(browser.includes("q.get('venue')"));
assert.ok(browser.includes("'gamagori'"));

console.log('NEXT_TRY_RACE_BUTTON_CONTRACT_PASS');

// Execute both entry points against a deterministic ledger, without prediction state.
const vm=require('node:vm');
const registry=require('../venue-registry-v1.js');
async function exercise(source,code,search,expected,rows){
 const elements=new Map();
 const make=()=>({style:{},dataset:{},setAttribute(){},scrollIntoView(){},click(){}});
 const document={readyState:'complete',head:{appendChild(){}},body:{appendChild(el){elements.set(el.id,el)}},
  createElement:make,getElementById:id=>elements.get(id),querySelector:()=>null,querySelectorAll:()=>[]};
 const location={search,pathname:code==='07'?'/boat-command/':'/boat-command/venue.html',href:'https://example.test/boat-command/'+(code==='07'?'':'venue.html')+search};
 const RealDate=Date;
 class Clock extends RealDate{constructor(...a){super(...(a.length?a:['2026-09-22T03:00:00Z']))}static now(){return Date.parse('2026-09-22T03:00:00Z')}}
 const input=JSON.stringify(rows);
 vm.runInNewContext(source,{document,location,window:{BOAT_COMMAND_VENUE_REGISTRY:registry},URL,URLSearchParams,Date:Clock,Intl,
  setInterval(){return 1},clearInterval(){},setTimeout(){},fetch:async()=>({ok:true,json:async()=>({ledger:rows})})});
 await new Promise(resolve=>setImmediate(resolve));
 const button=elements.get('bcNextTryRace');
 if(expected){
  assert.equal(button?.style.display,'inline-flex');
  assert.equal(button.textContent,`次のTRY → ${registry.resolve(expected.code).name} ${expected.race}R`);
  button.onclick();const dest=new URL(location.href);
  assert.equal(dest.searchParams.get('race'),String(expected.race));
  assert.equal(dest.searchParams.get(expected.code==='07'?'venue':'jcd'),expected.code==='07'?'gamagori':expected.code);
 }else assert.ok(!button||button.style.display==='none');
 assert.equal(JSON.stringify(rows),input,'navigation must not mutate ledger');
}
(async()=>{
 for(const code of ['02','07']){
  const source=code==='07'?browser:deep,search=code==='07'?'?venue=gamagori&race=1':'?jcd=02&race=1';
  const row=(venueCode,race,deadline,extra={})=>({date:'2026-09-22',venueCode,race,deadline,settled:false,...extra});
  const here=row(code,1,'10:00');
  const target=code==='07'?'03':'07';
  const rows=[row(target,5,'14:00'),row('04',2,'11:59'),here,row('05',3,'12:30',{settled:true}),row('06',4,'13:00',{voided:true})];
  await exercise(source,code,search,{code:target,race:5},rows);
  await exercise(source,code,search,null,[here,row('04',2,'11:59')]);
  await exercise(source,code,search,null,[here,row(target,5,'',{date:'2026-09-21'})]);
  await exercise(source,code,search.replace('&race=1',''),null,rows);
 }
 const index=fs.readFileSync('index.html','utf8');
 assert.ok(index.indexOf('venue-registry-v1.js')<index.indexOf('browser-controls-v1.js'));
 console.log('NEXT_TRY_RACE_BEHAVIOR_PASS (both page types; expired/settled/void, routing, empty, invalid race, ledger unchanged)');
})().catch(e=>{console.error(e);process.exitCode=1});
