'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),assert=require('node:assert/strict');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'boat-continuous-'));
try{
 fs.mkdirSync(path.join(root,'scripts'));
 fs.copyFileSync('scripts/shared-try-portfolio-v1.js',path.join(root,'scripts/shared-try-portfolio-v1.js'));
 const cfg=JSON.parse(fs.readFileSync('shared-try-config-v1.json'));
 assert.equal(cfg.activeAdapters.length,24);
 const write=(p,x)=>{p=path.join(root,p);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(x));};
 write('shared-try-config-v1.json',cfg);
 const date='2026-10-27', sel=`live/portfolio/${date}/try-selection-v1.json`;
 const run=(day=date)=>cp.execFileSync(process.execPath,['scripts/shared-try-portfolio-v1.js',day],{cwd:root,env:{...process.env,BOAT_COMMAND_NOW_ISO:`${date}T06:00:00+09:00`},stdio:'pipe'});
 run();assert.equal(fs.existsSync(path.join(root,sel)),false,'empty morning must remain retryable');
 for(const a of cfg.activeAdapters)write(`live/${a.slug}/${date}/shadow/program-only/race-1.json`,{venueCode:a.venueCode,venue:a.venue,date,race:1,generatedAt:`${date}T05:00:00+09:00`,deadline:'13:00',picks:['1-2-3','1-2-4','1-3-2','1-3-4'],probabilities:['1-2-3','1-2-4','1-3-2','1-3-4'].map(order=>({order,probability:0.1})),resultInput:false,payoutInput:false,immutableAfterFirstWrite:true});
 run();const first=fs.readFileSync(path.join(root,sel),'utf8'),s=JSON.parse(first);
 assert.equal(s.candidateCount,24);assert.equal(s.selectedCount,6);
 assert.equal(s.resultInput,false);assert.equal(s.payoutInput,false);
 run();assert.equal(fs.readFileSync(path.join(root,sel),'utf8'),first,'HARD LOCK unchanged');
 const p=JSON.parse(fs.readFileSync(path.join(root,'shared-try-portfolio-v1.json')));
 assert.equal(p.confirmedBankrollYen,100000);assert.equal(p.availableBankrollYen,88000);
 assert.throws(()=>run('2026-10-28'),'future selection prohibited');
 assert.throws(()=>run('2026-10-25'),'historical new selection prohibited');
 console.log('PASS continuous window, 24 venues, retry empty morning, immutable freeze, shared capital, no retro/future selection');
}finally{fs.rmSync(root,{recursive:true,force:true});}
