'use strict';

const fs=require('fs');
const path=require('path');
const registry=require('../venue-registry-v1.js');
const core=require('../venue-agent-core-v1.js');

const root=path.resolve(__dirname,'..');
const exists=p=>!!p&&fs.existsSync(path.resolve(root,String(p).replace(/^\.\//,'')));
const rootExists=p=>!!p&&fs.existsSync(path.resolve(root,String(p).replace(/^\.\//,'')));

const rows=registry.list().map(v=>{
  const agent=core.createAgent(v.code);
  const config=v.configPath||`./venues/${v.slug}/config-v1.json`;
  const readiness=v.readinessPath||`./venues/${v.slug}/readiness-v1.json`;
  const model=v.model?.script||null;
  const dataRoot=v.dataRoot||`./live/${v.slug}`;
  const signals={
    config:exists(config),
    readiness:exists(readiness),
    model:model?exists(model):false,
    dataRoot:rootExists(dataRoot),
    shadowCapability:v.capabilities?.shadow===true
  };
  const score=Object.values(signals).filter(Boolean).length;
  return {
    code:v.code,
    venue:v.name,
    slug:v.slug,
    agentId:agent.state.agentId,
    runtime:v.runtime,
    state:v.state,
    signals,
    readiness:score>=4?'AGENT_RESEARCH_READY':score>=2?'PARTIAL_BOOTSTRAP':'BOOTSTRAP_NEEDED'
  };
});

const summary={
  schema:'boat-command-venue-agent-audit-v1',
  generatedAt:new Date().toISOString(),
  agents:rows.length,
  ready:rows.filter(x=>x.readiness==='AGENT_RESEARCH_READY').length,
  partial:rows.filter(x=>x.readiness==='PARTIAL_BOOTSTRAP').length,
  bootstrap:rows.filter(x=>x.readiness==='BOOTSTRAP_NEEDED').length,
  rows
};

if(rows.length!==24)throw new Error('AGENT_COUNT_NOT_24');
process.stdout.write(JSON.stringify(summary,null,2)+'\n');
