#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');

const portal=fs.readFileSync('portal.html','utf8');
assert.ok(portal.includes('class="virtual-mode-banner"'));
assert.ok(portal.includes('VIRTUAL TRY'));
assert.ok(portal.includes('仮想資金のみで集計中。実金投票は行いません。'));
assert.ok(portal.includes('class="virtual-mode-pill">実金なし'));
assert.ok(portal.includes('aria-label="仮想運用モード"'));
console.log('VIRTUAL_TRY_BANNER_CONTRACT_PASS');
