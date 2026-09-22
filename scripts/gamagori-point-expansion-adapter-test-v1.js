#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const a=require('./gamagori-point-expansion-adapter-v1.js');
const root=path.resolve(__dirname,'..');
const expected={
  1:['1-2-3','1-3-2','1-3-4','1-2-4'],
  2:['1-2-3','1-3-2','1-3-4','1-2-4'],
  3:['1-2-3','1-3-2','1-2-4','1-3-4'],
  4:['1-2-3','1-3-2','1-2-4','1-3-4'],
  5:['1-2-3','1-3-2','1-3-4','1-3-5'],
  6:['1-2-3','1-3-2','1-3-4','1-2-5'],
  7:['1-2-3','1-3-2','1-3-4','1-2-4'],
  8:['1-2-3','1-3-2','1-3-4','1-2-4'],
  9:['1-2-3','1-3-2','1-3-4','1-3-5'],
  10:['1-2-3','1-3-2','1-3-4','1-2-4'],
  11:['1-2-3','1-3-2','1-3-4','1-2-4'],
  12:['1-2-3','1-3-2','1-3-4','1-3-5']
};
for(let race=1;race<=12;race++){
  const file=path.join(root,'live','gamagori','2026-09-18','program',`race-${race}.json`);
  const p=JSON.parse(fs.readFileSync(file,'utf8')),classes=a.programClasses(p),dist=a.distribution(classes,race,p.date);
  assert.equal(dist.rows.length,120);
  assert.equal(new Set(dist.rows.map(x=>x.order)).size,120);
  assert.ok(Math.abs(dist.rows.reduce((s,x)=>s+x.probability,0)-1)<1e-8);
  assert.deepEqual(dist.rows.slice(0,4).map(x=>x.order),expected[race]);
  assert.deepEqual(a.productionPicks(classes,race,p.date),expected[race]);
}
const sample=JSON.parse(fs.readFileSync(path.join(root,'live','gamagori','2026-09-18','program','race-7.json'),'utf8'));
const d=a.distribution(a.programClasses(sample),7,sample.date);
const {capture}=require('./point-expansion-shadow-v1.js');
const e=capture(d,expected[7],'PROGRAM_ONLY');
assert.equal(e.status,'FROZEN_WITH_BASELINE');
assert.deepEqual(e.variants.BASE4,expected[7]);
assert.equal(e.variants.RANK6.length,6);
assert.equal(e.variants.RANK8.length,8);
assert.deepEqual(e.variants.RANK8.slice(0,4),expected[7]);
assert.equal(e.productionEnabled,false);
assert.equal(e.selectionUsesResults,false);
console.log('GAMAGORI_POINT_EXPANSION_ADAPTER_PASS: frozen baseline prefix preserved for all 12 regression races; 120-order ranking valid; SHADOW only');
