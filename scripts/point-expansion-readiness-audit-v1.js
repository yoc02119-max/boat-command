#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');

const generic=[
  ['kiryu','KIRYU','01','venue-shadow-batch-a-v1.yml'],
  ['tamagawa','TAMAGAWA','05','venue-shadow-batch-a-v1.yml'],
  ['hamanako','HAMANAKO','06','venue-shadow-batch-a-v1.yml'],
  ['suminoe','SUMINOE','12','venue-shadow-batch-a-v1.yml'],
  ['amagasaki','AMAGASAKI','13','venue-shadow-batch-b-v1.yml'],
  ['marugame','MARUGAME','15','venue-shadow-batch-b-v1.yml'],
  ['kojima','KOJIMA','16','venue-shadow-batch-b-v1.yml'],
  ['miyajima','MIYAJIMA','17','venue-shadow-batch-b-v1.yml'],
  ['omura','OMURA','24','venue-shadow-batch-c-v1.yml'],
  ['heiwajima','HEIWAJIMA','04','venue-shadow-batch-c-v1.yml'],
  ['tokoname','TOKONAME','08','venue-shadow-batch-c-v1.yml'],
  ['tsu','TSU','09','venue-shadow-batch-c-v1.yml'],
  ['biwako','BIWAKO','11','venue-shadow-batch-d-v1.yml'],
  ['shimonoseki','SHIMONOSEKI','19','venue-shadow-batch-d-v1.yml'],
  ['wakamatsu','WAKAMATSU','20','venue-shadow-batch-d-v1.yml'],
  ['fukuoka','FUKUOKA','22','venue-shadow-batch-d-v1.yml']
];
const specialized=[
  ['toda','TODA','02'],['edogawa','EDOGAWA','03'],['mikuni','MIKUNI','10'],
  ['naruto','NARUTO','14'],['tokuyama','TOKUYAMA','18'],['ashiya','ASHIYA','21'],['karatsu','KARATSU','23']
];
const expected=new Map([...generic.map(x=>[x[0],x[2]]),...specialized.map(x=>[x[0],x[2]]),['gamagori','07']]);
function fail(message){throw new Error(message)}
function file(rel){const p=path.join(root,rel);if(!fs.existsSync(p))fail(`MISSING_FILE:${rel}`);return fs.readFileSync(p,'utf8')}
function must(text,needle,label){if(!text.includes(needle))fail(`MISSING_CONTRACT:${label}:${needle}`)}
function inputs(slug){for(const rel of [`${slug}-research-model-v1.js`,`${slug}-history-bootstrap-v1.json`,`${slug}-baseline-backtest-v1.json`])file(rel)}

const core=file('scripts/point-expansion-shadow-v1.js');
for(const needle of ["researchOnly:true","productionEnabled:false","tryEnabled:false","realMoney:false","automaticPromotion:false","selectionUsesResults:false"]) must(core,needle,'point-expansion-core');
const report=file('scripts/point-expansion-report-v1.js');
for(const [slug] of expected) must(report,`'${slug}'`,'report-venue-registry');
must(report,'ALL_VARIANTS_PER_VENUE_NO_AUTOMATIC_WINNER','report-selection-policy');

const genericWriter=file('scripts/venue-shadow-research-v1.js');
must(genericWriter,"require('./point-expansion-shadow-v1.js').capture(d,picks,mode)",'generic-writer-capture');
must(genericWriter,'productionEnabled:false','generic-writer-production-boundary');
must(genericWriter,'tryEnabled:false','generic-writer-try-boundary');

const rows=[];
for(const [slug,key,code,wfName] of generic){
  inputs(slug);
  const wf=file(`.github/workflows/${wfName}`);
  must(wf,`code: '${code}'`,'generic-workflow-code');
  must(wf,`key: ${key}`,'generic-workflow-key');
  must(wf,`slug: ${slug}`,'generic-workflow-slug');
  must(wf,'node scripts/venue-shadow-research-v1.js','generic-workflow-writer');
  rows.push({slug,venue:key,venueCode:code,mode:'GENERIC_16',wired:true});
}
for(const [slug,key,code] of specialized){
  inputs(slug);
  const writer=file(`scripts/${slug}-shadow-research-v1.js`);
  must(writer,"require('./point-expansion-shadow-v1.js').capture",'specialized-writer-capture');
  must(writer,'productionEnabled:false','specialized-writer-production-boundary');
  must(writer,'tryEnabled:false','specialized-writer-try-boundary');
  rows.push({slug,venue:key,venueCode:code,mode:'SPECIALIZED_7',wired:true});
}
const ga=file('scripts/gamagori-point-expansion-adapter-v1.js');
const gat=file('scripts/gamagori-point-expansion-adapter-test-v1.js');
const gaw=file('.github/workflows/gamagori-point-expansion-shadow-v1.yml');
for(const needle of ["capture(dist,base,'PROGRAM_ONLY')",'productionEnabled:false','tryEnabled:false','cashNeutral:true','productionBaselineUnchanged:true','selectionUsesResults:false']) must(ga,needle,'gamagori-adapter');
must(gat,'GAMAGORI_POINT_EXPANSION_ADAPTER_PASS','gamagori-adapter-test');
must(gaw,'Enforce research-only write boundary','gamagori-workflow-boundary');
must(gaw,'git add live/gamagori/*/shadow/program-only/','gamagori-workflow-write-scope');
rows.push({slug:'gamagori',venue:'GAMAGORI',venueCode:'07',mode:'GAMAGORI_ADAPTER_1',wired:true});

if(rows.length!==24||new Set(rows.map(x=>x.slug)).size!==24)fail(`VENUE_COUNT_INVALID:${rows.length}`);
for(const row of rows) if(expected.get(row.slug)!==row.venueCode)fail(`VENUE_CODE_MISMATCH:${row.slug}`);
const result={
  schema:'boat-command-point-expansion-readiness-audit-v1',
  version:'POINT-EXPANSION-READINESS-AUDIT-V1',
  generatedAt:new Date().toISOString(),
  status:'PASS',
  venues:24,
  generic:generic.length,
  specialized:specialized.length,
  gamagoriAdapter:1,
  productionChanged:false,
  uiChanged:false,
  tryChanged:false,
  bankrollChanged:false,
  rows
};
const out=process.argv[2];
if(out){const p=path.resolve(out);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(result,null,2)+'\n')}
console.log(JSON.stringify(result));
