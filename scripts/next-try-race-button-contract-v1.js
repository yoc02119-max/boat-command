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
  assert.ok(src.includes("rows.slice(here+1).find(z=>z.settled!==true)"));
  assert.ok(src.includes("routeFor?.(meta)"));
  assert.ok(src.includes("u.searchParams.set('race'"));
}
assert.ok(deep.includes("q.get('jcd')"));
assert.ok(browser.includes("q.get('venue')"));
assert.ok(browser.includes("'gamagori'"));

console.log('NEXT_TRY_RACE_BUTTON_CONTRACT_PASS');
