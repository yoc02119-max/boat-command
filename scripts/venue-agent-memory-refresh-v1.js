#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const registry=require('../venue-registry-v1.js');
const research=require('../venue-agent-research-v1.js');

const root=path.resolve(__dirname,'..');
const write=process.argv.includes('--write');

function json(pathname){
  if(!pathname)return null;
  const p=path.resolve(root,String(pathname).replace(/^\.\//,''));
  if(!fs.existsSync(p))return null;
  try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch{return null;}
}

function relExists(p){
  if(!p)return null;
  const clean=String(p).replace(/^\.\//,'');
  return fs.existsSync(path.resolve(root,clean))?clean:null;
}

function findRootFile(slug,kind,extra=[]){
  for(const p of extra){
    const hit=relExists(p);
    if(hit)return hit;
  }
  const names=fs.readdirSync(root)
    .filter(name=>name.startsWith(slug+'-')&&name.endsWith('.json'));
  const patterns={
    historyAnalysis:/history-analysis.*\.json$/i,
    historyAudit:/history-audit.*\.json$/i,
    shadowEvaluation:/shadow-evaluation.*\.json$/i,
    backtest:/(main-backtest|baseline-backtest).*\.json$/i
  };
  const re=patterns[kind];
  return names.filter(name=>re?.test(name)).sort().pop()||null;
}

function modelPathFor(v){
  const direct=relExists(v.model?.script);
  if(direct)return direct;
  const names=fs.readdirSync(root)
    .filter(name=>name.startsWith(v.slug+'-research-model-v')&&name.endsWith('.js'))
    .sort();
  return names.pop()||null;
}

function sourceSet(v){
  const readinessPath=relExists(v.readinessPath)||relExists(`venues/${v.slug}/readiness-v1.json`);
  const configPath=relExists(v.configPath)||relExists(`venues/${v.slug}/config-v1.json`);
  const historyAnalysisPath=findRootFile(v.slug,'historyAnalysis');
  const historyAuditPath=findRootFile(
    v.slug,
    'historyAudit',
    v.slug==='gamagori'?['gamagori-main-history-audit-v0320.json']:[]
  );
  const shadowEvaluationPath=findRootFile(
    v.slug,
    'shadowEvaluation',
    v.slug==='gamagori'?['gamagori-shadow-evaluation-v0333.json']:[]
  );
  const backtestPath=findRootFile(
    v.slug,
    'backtest',
    v.slug==='gamagori'?['gamagori-main-backtest-v0320.json']:[]
  );
  const modelPath=modelPathFor(v);
  return {
    paths:{
      config:configPath,
      readiness:readinessPath,
      historyAnalysis:historyAnalysisPath,
      historyAudit:historyAuditPath,
      shadowEvaluation:shadowEvaluationPath,
      backtest:backtestPath,
      model:modelPath
    },
    data:{
      config:json(configPath),
      readiness:json(readinessPath),
      historyAnalysis:json(historyAnalysisPath),
      historyAudit:json(historyAuditPath),
      shadowEvaluation:json(shadowEvaluationPath),
      backtest:json(backtestPath)
    }
  };
}

const now=new Date().toISOString();
const memories=[];

for(const venue of registry.list()){
  const outPath=path.join(root,'venue-agents',venue.slug,'memory-v1.json');
  const previous=fs.existsSync(outPath)?json(path.relative(root,outPath)):null;
  const src=sourceSet(venue);
  const memory=research.buildMemory({
    venueCode:venue.code,
    now,
    previous,
    readiness:src.data.readiness,
    historyAnalysis:src.data.historyAnalysis,
    historyAudit:src.data.historyAudit,
    shadowEvaluation:src.data.shadowEvaluation,
    backtest:src.data.backtest,
    sources:{
      config:src.data.config,
      readiness:src.data.readiness,
      historyAnalysis:src.data.historyAnalysis,
      historyAudit:src.data.historyAudit,
      shadowEvaluation:src.data.shadowEvaluation,
      backtest:src.data.backtest,
      model:src.paths.model
    },
    sourcePaths:src.paths
  });
  memories.push(memory);
  if(write){
    fs.mkdirSync(path.dirname(outPath),{recursive:true});
    fs.writeFileSync(outPath,JSON.stringify(memory,null,2)+'\n');
  }
}

const index=research.buildIndex(memories,now);
if(index.agents!==24)throw new Error('AGENT_MEMORY_COUNT_NOT_24');
if(new Set(index.rows.map(x=>x.agentId)).size!==24)throw new Error('AGENT_MEMORY_ID_NOT_UNIQUE');

if(write){
  fs.writeFileSync(
    path.join(root,'venue-agent-memory-index-v1.json'),
    JSON.stringify(index,null,2)+'\n'
  );
}

process.stdout.write(JSON.stringify({
  write,
  agents:index.agents,
  cycleDue:index.cycleDue,
  reviewCandidates:index.reviewCandidates,
  statuses:index.statuses,
  coverage:{
    historyAnalysis:index.rows.filter(x=>x.sourceCoverage.historyAnalysis).length,
    historyAudit:index.rows.filter(x=>x.sourceCoverage.historyAudit).length,
    shadowEvaluation:index.rows.filter(x=>x.sourceCoverage.shadowEvaluation).length,
    backtest:index.rows.filter(x=>x.sourceCoverage.backtest).length,
    model:index.rows.filter(x=>x.sourceCoverage.model).length
  }
},null,2)+'\n');
