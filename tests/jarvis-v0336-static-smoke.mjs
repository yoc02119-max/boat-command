import fs from 'node:fs';
const must=['boat-command-agent-v0335.js','boat-jarvis-cloud-v0337.js','boat-jarvis-llm-client-v0336.js','boat-jarvis-conversation-v0336.js','boat-jarvis-core-v0336.js','boat-jarvis-app-controller-v0336.js','boat-jarvis-development-bridge-v0336.js','boat-jarvis-executor-contract-v0336.js','boat-jarvis-runtime-v0336.js','boat-jarvis-ui-v0336.js'];
const html=fs.readFileSync('index.html','utf8');
for(const f of must){if(!fs.existsSync(f))throw new Error(`MISSING_FILE:${f}`);if(!html.includes(`src="${f}?v=337"`))throw new Error(`NOT_LOADED:${f}`)}
let pos=-1;for(const f of must){const p=html.indexOf(`src="${f}?v=337"`);if(p<=pos)throw new Error(`LOAD_ORDER:${f}`);pos=p}
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]);const dup=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];if(dup.length)throw new Error(`DUPLICATE_IDS:${dup.join(',')}`);
const core=fs.readFileSync('boat-jarvis-core-v0336.js','utf8');for(const token of ['PREDICTION_WRITE','HARD_LOCK_WRITE','RESULT_WRITE','PAYOUT_WRITE','BANKROLL_WRITE'])if(!core.includes(token))throw new Error(`MISSING_GUARD:${token}`);
const executor=fs.readFileSync('boat-jarvis-executor-contract-v0336.js','utf8');if(!executor.includes("promotion:'NEVER_AUTO_MAIN'"))throw new Error('AUTO_MAIN_GUARD_MISSING');
const cloud=fs.readFileSync('boat-jarvis-cloud-v0337.js','utf8');if(!cloud.includes('serverSecretsOnly:true')||cloud.includes('sk-'))throw new Error('CLOUD_SECRET_BOUNDARY_MISSING');
console.log('JARVIS_V0336_STATIC_SMOKE_OK');
