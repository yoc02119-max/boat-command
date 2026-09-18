// BOAT COMMAND EDOGAWA feature contract v1
// Pure PRE-RACE feature extraction. No fetch, result, payout, prediction or bankroll access.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.BOAT_COMMAND_EDOGAWA_FEATURE_V1=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='EDOGAWA-FEATURE-CONTRACT-V1';
  const CLASS_SCORE={A1:3,A2:2,B1:1,B2:0};

  const finite=v=>Number.isFinite(Number(v))?Number(v):null;
  function stValue(v){
    const s=String(v??'').trim();
    if(!s)return null;
    const m=s.match(/^(F)?\.?(\d{2})$/i);
    if(!m)return null;
    const n=Number(m[2])/100;
    return m[1]?-n:n;
  }
  function ranks(values,{lowerBetter=false}={}){
    const a=values.map(finite);
    return a.map((v,i)=>{
      if(v==null)return null;
      const valid=a.filter(x=>x!=null);
      if(!valid.length)return null;
      const better=valid.filter(x=>lowerBetter?x<v:x>v).length;
      return 1+better;
    });
  }
  function validProgram(program){
    if(!program||program.venue!=='EDOGAWA'||String(program.venueCode)!=='03')return false;
    if(program.resultEndpointsIncluded!==false||program.resultIncluded!==false||program.exhibitionIncluded!==false)return false;
    const boats=Array.isArray(program.boats)?program.boats:[];
    return boats.length===6&&boats.every((b,i)=>Number(b.lane)===i+1&&Object.hasOwn(CLASS_SCORE,String(b.class)));
  }
  function validPre(pre,date,race){
    if(!pre)return false;
    return pre.schema==='boat-command-edogawa-pre-race-pack-v1'&&
      pre.venue==='EDOGAWA'&&String(pre.venueCode)==='03'&&
      String(pre.date)===String(date)&&Number(pre.race)===Number(race)&&
      pre.resultEndpointsIncluded===false&&pre.payoutEndpointsIncluded===false&&
      pre.predictionEnabled===false&&pre.hardLockEnabled===false;
  }
  function extract(program,pre=null){
    if(!validProgram(program))throw new Error('EDOGAWA_PROGRAM_INVALID');
    const boats=[...program.boats].sort((a,b)=>Number(a.lane)-Number(b.lane));
    const hasPre=validPre(pre,program.date,program.race);
    const preBoats=hasPre?[...(pre.boats||[])].sort((a,b)=>Number(a.lane)-Number(b.lane)):[];
    const exhibitions=preBoats.length===6?preBoats.map(b=>finite(b.exhibitionTime)):Array(6).fill(null);
    const exhibitionRanks=ranks(exhibitions,{lowerBetter:true});
    const startMap=hasPre?Object.fromEntries((pre.startExhibition||[]).map(x=>[Number(x.course),stValue(x.st)])):{};
    const startValues=Array.from({length:6},(_,i)=>startMap[i+1]??null);
    const startRanks=ranks(startValues,{lowerBetter:true});

    const lanes=boats.map((b,i)=>{
      const nationalWin=finite(b.nationalWinRate),localWin=finite(b.localWinRate);
      const national2=finite(b.national2Rate),local2=finite(b.local2Rate);
      const national3=finite(b.national3Rate),local3=finite(b.local3Rate);
      const pb=preBoats[i]||{};
      return {
        lane:i+1,
        class:String(b.class),
        classScore:CLASS_SCORE[String(b.class)],
        registration:finite(b.registration),
        fCount:finite(b.fCount),
        lCount:finite(b.lCount),
        avgST:finite(b.avgST),
        nationalWinRate:nationalWin,
        localWinRate:localWin,
        localVsNationalWinDelta:nationalWin!=null&&localWin!=null?localWin-nationalWin:null,
        national2Rate:national2,
        local2Rate:local2,
        localVsNational2Delta:national2!=null&&local2!=null?local2-national2:null,
        national3Rate:national3,
        local3Rate:local3,
        localVsNational3Delta:national3!=null&&local3!=null?local3-national3:null,
        motor2Rate:finite(b.motor2Rate),
        boat2Rate:finite(b.boat2Rate),
        exhibitionTime:exhibitions[i],
        exhibitionRank:exhibitionRanks[i],
        exhibitionST:startValues[i],
        exhibitionSTRank:startRanks[i],
        tilt:finite(pb.tilt)
      };
    });

    const water=hasPre?{
      airTempC:finite(pre.water?.airTempC),
      windSpeedMps:finite(pre.water?.windSpeedMps),
      waterTempC:finite(pre.water?.waterTempC),
      waveHeightCm:finite(pre.water?.waveHeightCm),
      windDirectionCode:pre.water?.windDirectionCode??null,
      tideDirection:pre.water?.tideDirection??null,
      tideStrength:pre.water?.tideStrength??null,
      flowSpeed:finite(pre.water?.flowSpeed),
      tideMappingStatus:pre.water?.tideMappingStatus??null
    }:{
      airTempC:null,windSpeedMps:null,waterTempC:null,waveHeightCm:null,
      windDirectionCode:null,tideDirection:null,tideStrength:null,flowSpeed:null,tideMappingStatus:null
    };

    return {
      version:VERSION,
      venue:'EDOGAWA',venueCode:'03',
      date:String(program.date),race:Number(program.race),
      raceType:String(program.raceType||''),
      deadline:program.deadline||null,
      lanes,water,
      preRaceComplete:hasPre&&pre.boatMappingVerified===true&&pre.weatherMappingVerified===true,
      boundaries:{
        programResultFree:true,
        preRaceResultFree:hasPre?true:null,
        resultInput:false,
        payoutInput:false,
        predictionEnabled:false
      }
    };
  }
  return Object.freeze({
    version:VERSION,
    classScore:Object.freeze({...CLASS_SCORE}),
    stValue,ranks,validProgram,validPre,extract,
    predictionEnabled:false,
    resultInput:false,
    payoutInput:false
  });
});
