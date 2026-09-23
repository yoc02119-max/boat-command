#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');

const portal=fs.readFileSync('portal.html','utf8');
const lab=fs.readFileSync('daily-lab.html','utf8');
const auth=fs.readFileSync('api/developer-auth.js','utf8');
const github=fs.readFileSync('api/jarvis/github.js','utf8');

assert.ok(portal.includes('id="developerBadge"'));
assert.ok(portal.includes('id="developerStatus"'));
assert.ok(portal.includes('id="developerToggle"'));
assert.ok(portal.includes('id="dailyLabNav" hidden'));
assert.ok(portal.includes("fetch('/api/developer-auth'"));
assert.ok(portal.includes("if(!developerAuthenticated){panel.hidden=true;list.innerHTML='';return;}"));
assert.ok(lab.includes("fetch('/api/developer-auth'"));
assert.ok(lab.includes("x.authenticated!==true"));
assert.ok(auth.includes('BOAT_COMMAND_DEVELOPER_PASSWORD'));
assert.ok(auth.includes('HttpOnly; Secure; SameSite=Strict'));
assert.ok(auth.includes('timingSafeEqual'));
assert.ok(github.includes("protectedActions=new Set(['dispatch_development','venue_expansion_decision','development_result'])"));
assert.ok(github.includes("DEVELOPER_AUTH_REQUIRED"));
console.log('DEVELOPER_MODE_CONTRACT_PASS');
