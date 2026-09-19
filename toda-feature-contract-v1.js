// BOAT COMMAND TODA feature contract v1
// Pure PRE-RACE feature extraction. No fetch, result, payout, prediction or bankroll access.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.BOAT_COMMAND_TODA_FEATURE_V1=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='TODA-FEATURE-CONTRACT-V1',CLASS_SCORE={A1:3,A2:2,B1:1,B2:0};
  const finite=v=>Number.isFinite(Number(v))?Number(v):null;
  function stValue(v){const s=String(v??'').trim();if(!s)return null;const m=s.match(/^(F)?\.?(\d{2})$/i);if(!m)return null;const n=Number(m[2])/100;return m[1]?1+n:n}
  function ranks(values,{lowerBetter=false}={}){const a=values.map(finite);return a.map(v=>{if(v==null)return null;const valid=a.filter(x=>x!=null),better=valid.filter(x=>lowerBetter?x<v:x>v).length;return 1+better})}
  function validProgram(p){if(!p||p.venue!=='TODA'||String(p.venueCode)!=='02')return false;if(p.resultEndpointsIncluded!==false||p.resultIncluded!==false||p.exhibitionIncluded!==false)return false;const b=Array.isArray(p.boats)?p.boats:[];return b.length===6&&b.every((x,i)=>Number(x.lane)===i+1&&Object.hasOwn(CLASS_SCORE,String(x.class)))}
  function validPre(pre,date,race){return !!pre&&pre.schema==='boat-command-toda-pre-race-pack-v1'&&pre.venue==='TODA'&&String(pre.venueCode)==='02'&&String(pre.date)===String(date)&&Number(pre.race)===Number(race)&&pre.resultEndpointsIncluded===false&&pre.payoutEndpointsIncluded===false&&pre.predictionEnabled===false&&pre.hardLockEnabled===false}
  function extract(program,pre=null){
    if(!validProgram(program))throw new Error('TODA_PROGRAM_INVALID');
    const boats=[...program.boats].sort((a,b)=>Number(a.lane)-Number(b.lane)),hasPre=validPre(pre,program.date,program.race),pb=hasPre?[...(pre.boats||[])].sort((a,b)=>Number(a.lane)-Number(b.lane)):[];
    const ex=pb.length===6?pb.map(b=>finite(b.exhibitionTime)):Array(6).fill(null),exRank=ranks(ex,{lowerBetter:true}),startMap=hasPre?Object.fromEntries((pre.startExhibition||[]).map(x=>[Number(x.course),stValue(x.st)])):{},st=Array.from({length:6},(_,i)=>startMap[i+1]??null),stRank=ranks(st,{lowerBetter:true});
    const lanes=boats.map((b,i)=>{const nw=finite(b.nationalWinRate),lw=finite(b.localWinRate),n2=finite(b.national2Rate),l2=finite(b.local2Rate),n3=finite(b.national3Rate),l3=finite(b.local3Rate),x=pb[i]||{};return{lane:i+1,class:String(b.class),classScore:CLASS_SCORE[String(b.class)],registration:finite(b.registration),fCount:finite(b.fCount),lCount:finite(b.lCount),avgST:finite(b.avgST),nationalWinRate:nw,localWinRate:lw,localVsNationalWinDelta:nw!=null&&lw!=null?lw-nw:null,national2Rate:n2,local2Rate:l2,localVsNational2Delta:n2!=null&&l2!=null?l2-n2:null,national3Rate:n3,local3Rate:l3,localVsNational3Delta:n3!=null&&l3!=null?l3-n3:null,motor2Rate:finite(b.motor2Rate),boat2Rate:finite(b.boat2Rate),exhibitionTime:ex[i],exhibitionRank:exRank[i],exhibitionST:st[i],exhibitionSTRank:stRank[i],tilt:finite(x.tilt)}});
    const water=hasPre?{airTempC:finite(pre.water?.airTempC),windSpeedMps:finite(pre.water?.windSpeedMps),waterTempC:finite(pre.water?.waterTempC),waveHeightCm:finite(pre.water?.waveHeightCm),windDirectionCode:pre.water?.windDirectionCode??null,weatherCode:pre.water?.weatherCode??null,weatherMappingStatus:pre.water?.weatherMappingStatus??null}:{airTempC:null,windSpeedMps:null,waterTempC:null,waveHeightCm:null,windDirectionCode:null,weatherCode:null,weatherMappingStatus:null};
    return{version:VERSION,venue:'TODA',venueCode:'02',date:String(program.date),race:Number(program.race),raceType:String(program.raceType||''),deadline:program.deadline||null,lanes,water,preRaceComplete:hasPre&&pre.boatMappingVerified===true&&pre.weatherMappingVerified===true,boundaries:{programResultFree:true,preRaceResultFree:hasPre?true:null,resultInput:false,payoutInput:false,predictionEnabled:false}};
  }
  return Object.freeze({version:VERSION,classScore:Object.freeze({...CLASS_SCORE}),stValue,ranks,validProgram,validPre,extract,predictionEnabled:false,resultInput:false,payoutInput:false});
});
