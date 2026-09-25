'use strict';
/* SHADOW ONLY. Frozen mapping for historical Gamagori PRE reconstruction from BOAT RACE official racelist.
   Never open odds, exhibition/beforeinfo, result, or payout pages in this stage. */
const VERSION='GAMAGORI-RACELIST-PRE-CONTRACT-V0.33.9';
const SOURCE='https://www.boatrace.jp/owpc/pc/race/racelist';
const JCD='07';
const FIELDS=Object.freeze({
  class:'registration/class column: class token',
  averageST:'F/L/averageST column: third displayed value',
  nationalWinRate:'national column: win-rate (first value)',
  localWinRate:'local column: win-rate (first value)',
  motor2Rate:'motor column: 2-rate (second value after motor No)'
});
function assertBoat(b){
  for(const k of ['lane','registration','class','averageST','nationalWinRate','localWinRate','motor2Rate']){
    if(!(k in b)) throw new Error(`MISSING:${k}`);
  }
  if(!['A1','A2','B1','B2'].includes(b.class)) throw new Error('BAD_CLASS');
  for(const k of ['averageST','nationalWinRate','localWinRate','motor2Rate']){
    if(!Number.isFinite(Number(b[k]))) throw new Error(`NON_NUMERIC:${k}`);
  }
}
module.exports=Object.freeze({VERSION,SOURCE,JCD,FIELDS,assertBoat,policy:Object.freeze({
  preOnly:true, outcomeFieldsIncluded:false,resultOddsIncluded:false,exhibitionIncluded:false,
  noImputation:true,noFieldSubstitution:true,failClosed:true,
  freezePredictionsBeforeOpeningResult:true
})});
if(require.main===module) console.log(JSON.stringify(module.exports,null,2));
