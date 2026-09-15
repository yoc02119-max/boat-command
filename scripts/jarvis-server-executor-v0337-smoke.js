const fs=require('fs');
const api=fs.readFileSync('api/jarvis/development.js','utf8');
const bridge=fs.readFileSync('boat-jarvis-development-bridge-v0336.js','utf8');
function ok(x,m){if(!x)throw new Error(m)}
ok(api.includes("JARVIS_GITHUB_EXECUTOR_TOKEN"),'server credential gate missing');
ok(api.includes("noResultLeakToPreRace")&&api.includes("noHardLockRewrite"),'guardrails missing');
ok(!bridge.includes('github.com/')&&!bridge.includes('api.github.com'),'browser must not call GitHub directly');
ok(bridge.includes("fetch('/api/jarvis/development'"),'same-origin executor endpoint missing');
ok(bridge.includes('boat-jarvis-development-result'),'result return event missing');
console.log('JARVIS_SERVER_EXECUTOR_BOUNDARY_PASS');
