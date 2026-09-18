#!/usr/bin/env node
'use strict';

// Explicit-text-only Edogawa tide/wind mapper.
// Never infers a direction from an unknown image class or filename.
function textOf(source){
  const parts=[
    source?.visibleSourceExcerpt||'',
    ...(Array.isArray(source?.imageTokens)?source.imageTokens.flatMap(x=>[x?.alt||'',x?.src||'',x?.class||'']):[]),
    ...(Array.isArray(source?.strategyTips)?source.strategyTips:[])
  ];
  return parts.join(' ');
}
function one(text,patterns){
  for(const [value,re] of patterns)if(re.test(text))return value;
  return null;
}
function mapExplicit(source){
  const text=textOf(source);
  const tide=one(text,[
    ['UP_STOP',/上げ止まり/],
    ['DOWN_STOP',/下げ止まり/],
    ['UP',/上げ潮/],
    ['DOWN',/下げ潮/],
    ['STOP',/潮止まり|潮どまり/]
  ]);
  const wind=one(text,[
    ['HEAD',/向かい風/],
    ['TAIL',/追い風/],
    ['CALM',/無風/]
  ]);
  return {
    tideDirection:tide,
    windDirection:wind,
    mappingStatus:(tide||wind)?'EXPLICIT_TEXT_ONLY':'UNMAPPED_NO_EXPLICIT_TEXT',
    inferredFromImageCode:false,
    sourceTextEvidence:{
      tide:tide?text.match(/上げ止まり|下げ止まり|上げ潮|下げ潮|潮止まり|潮どまり/)?.[0]||null:null,
      wind:wind?text.match(/向かい風|追い風|無風/)?.[0]||null:null
    }
  };
}
if(require.main===module){
  const fs=require('fs');
  const input=process.argv[2];
  if(!input)throw new Error('INPUT_REQUIRED');
  const x=JSON.parse(fs.readFileSync(input,'utf8'));
  if(x.schema!=='boat-command-edogawa-tide-source-v1')throw new Error('SCHEMA');
  const mapped=mapExplicit(x);
  process.stdout.write(JSON.stringify(mapped,null,2)+'\n');
}
module.exports={mapExplicit};
