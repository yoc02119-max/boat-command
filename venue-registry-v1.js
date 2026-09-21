// BOAT COMMAND venue registry v1
// Central source of truth for venue routing. Prediction logic stays venue-specific.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.BOAT_COMMAND_VENUE_REGISTRY=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const RAW=[
    ['01','桐生','kiryu','KIRYU'],['02','戸田','toda','TODA'],['03','江戸川','edogawa','EDOGAWA'],
    ['04','平和島','heiwajima','HEIWAJIMA'],['05','多摩川','tamagawa','TAMAGAWA'],['06','浜名湖','hamanako','HAMANAKO'],
    ['07','蒲郡','gamagori','GAMAGORI'],['08','常滑','tokoname','TOKONAME'],['09','津','tsu','TSU'],
    ['10','三国','mikuni','MIKUNI'],['11','びわこ','biwako','BIWAKO'],['12','住之江','suminoe','SUMINOE'],
    ['13','尼崎','amagasaki','AMAGASAKI'],['14','鳴門','naruto','NARUTO'],['15','丸亀','marugame','MARUGAME'],
    ['16','児島','kojima','KOJIMA'],['17','宮島','miyajima','MIYAJIMA'],['18','徳山','tokuyama','TOKUYAMA'],
    ['19','下関','shimonoseki','SHIMONOSEKI'],['20','若松','wakamatsu','WAKAMATSU'],['21','芦屋','ashiya','ASHIYA'],
    ['22','福岡','fukuoka','FUKUOKA'],['23','唐津','karatsu','KARATSU'],['24','大村','omura','OMURA']
  ];

  const overrides={
    '01':{
      state:'BUILDING',
      runtime:'RESEARCH',
      model:null,
      configPath:'./venues/kiryu/config-v1.json',
      readinessPath:'./venues/kiryu/readiness-v1.json',
      dataRoot:'./live/kiryu',
      capabilities:{predictionUi:false,shadow:false,try:false,bankroll:true,postResultInput:false,realMoney:false}
    },
    '04':{
      state:'BUILDING',
      runtime:'RESEARCH',
      model:null,
      configPath:'./venues/heiwajima/config-v1.json',
      readinessPath:'./venues/heiwajima/readiness-v1.json',
      dataRoot:'./live/heiwajima',
      capabilities:{predictionUi:false,shadow:false,try:false,bankroll:true,postResultInput:false,realMoney:false}
    },
    '05':{
      state:'BUILDING',
      runtime:'RESEARCH',
      model:null,
      configPath:'./venues/tamagawa/config-v1.json',
      readinessPath:'./venues/tamagawa/readiness-v1.json',
      dataRoot:'./live/tamagawa',
      capabilities:{predictionUi:false,shadow:false,try:false,bankroll:true,postResultInput:false,realMoney:false}
    },
    '06':{
      state:'BUILDING',
      runtime:'RESEARCH',
      model:null,
      configPath:'./venues/hamanako/config-v1.json',
      readinessPath:'./venues/hamanako/readiness-v1.json',
      dataRoot:'./live/hamanako',
      capabilities:{predictionUi:false,shadow:false,try:false,bankroll:true,postResultInput:false,realMoney:false}
    },
    '08':{
      state:'BUILDING',
      runtime:'RESEARCH',
      model:null,
      configPath:'./venues/tokoname/config-v1.json',
      readinessPath:'./venues/tokoname/readiness-v1.json',
      dataRoot:'./live/tokoname',
      capabilities:{predictionUi:false,shadow:false,try:false,bankroll:true,postResultInput:false,realMoney:false}
    },
    '09':{
      state:'BUILDING',
      runtime:'RESEARCH',
      model:null,
      configPath:'./venues/tsu/config-v1.json',
      readinessPath:'./venues/tsu/readiness-v1.json',
      dataRoot:'./live/tsu',
      capabilities:{predictionUi:false,shadow:false,try:false,bankroll:true,postResultInput:false,realMoney:false}
    },
    '11':{
      state:'BUILDING',
      runtime:'RESEARCH',
      model:null,
      configPath:'./venues/biwako/config-v1.json',
      readinessPath:'./venues/biwako/readiness-v1.json',
      dataRoot:'./live/biwako',
      capabilities:{predictionUi:false,shadow:false,try:false,bankroll:true,postResultInput:false,realMoney:false}
    },
    '12':{
      state:'BUILDING',
      runtime:'RESEARCH',
      model:null,
      configPath:'./venues/suminoe/config-v1.json',
      readinessPath:'./venues/suminoe/readiness-v1.json',
      dataRoot:'./live/suminoe',
      capabilities:{predictionUi:false,shadow:false,try:false,bankroll:true,postResultInput:false,realMoney:false}
    },
    '13':{
      state:'BUILDING',
      runtime:'RESEARCH',
      model:null,
      configPath:'./venues/amagasaki/config-v1.json',
      readinessPath:'./venues/amagasaki/readiness-v1.json',
      dataRoot:'./live/amagasaki',
      capabilities:{predictionUi:false,shadow:false,try:false,bankroll:true,postResultInput:false,realMoney:false}
    },
    '15':{
      state:'BUILDING',
      runtime:'RESEARCH',
      model:null,
      configPath:'./venues/marugame/config-v1.json',
      readinessPath:'./venues/marugame/readiness-v1.json',
      dataRoot:'./live/marugame',
      capabilities:{predictionUi:false,shadow:false,try:false,bankroll:true,postResultInput:false,realMoney:false}
    },
    '16':{
      state:'BUILDING',
      runtime:'RESEARCH',
      model:null,
      configPath:'./venues/kojima/config-v1.json',
      readinessPath:'./venues/kojima/readiness-v1.json',
      dataRoot:'./live/kojima',
      capabilities:{predictionUi:false,shadow:false,try:false,bankroll:true,postResultInput:false,realMoney:false}
    },
    '17':{
      state:'BUILDING',
      runtime:'RESEARCH',
      model:null,
      configPath:'./venues/miyajima/config-v1.json',
      readinessPath:'./venues/miyajima/readiness-v1.json',
      dataRoot:'./live/miyajima',
      capabilities:{predictionUi:false,shadow:false,try:false,bankroll:true,postResultInput:false,realMoney:false}
    },
    '19':{
      state:'BUILDING',
      runtime:'RESEARCH',
      model:null,
      configPath:'./venues/shimonoseki/config-v1.json',
      readinessPath:'./venues/shimonoseki/readiness-v1.json',
      dataRoot:'./live/shimonoseki',
      capabilities:{predictionUi:false,shadow:false,try:false,bankroll:true,postResultInput:false,realMoney:false}
    },
    '20':{
      state:'BUILDING',
      runtime:'RESEARCH',
      model:null,
      configPath:'./venues/wakamatsu/config-v1.json',
      readinessPath:'./venues/wakamatsu/readiness-v1.json',
      dataRoot:'./live/wakamatsu',
      capabilities:{predictionUi:false,shadow:false,try:false,bankroll:true,postResultInput:false,realMoney:false}
    },
    '22':{
      state:'BUILDING',
      runtime:'RESEARCH',
      model:null,
      configPath:'./venues/fukuoka/config-v1.json',
      readinessPath:'./venues/fukuoka/readiness-v1.json',
      dataRoot:'./live/fukuoka',
      capabilities:{predictionUi:false,shadow:false,try:false,bankroll:true,postResultInput:false,realMoney:false}
    },
    '24':{
      state:'BUILDING',
      runtime:'RESEARCH',
      model:null,
      configPath:'./venues/omura/config-v1.json',
      readinessPath:'./venues/omura/readiness-v1.json',
      dataRoot:'./live/omura',
      capabilities:{predictionUi:false,shadow:false,try:false,bankroll:true,postResultInput:false,realMoney:false}
    },
    '02':{
      state:'LIVE_SIMULATION',
      runtime:'RESEARCH',
      model:{
        script:'./toda-research-model-v1.js',
        global:'BOAT_COMMAND_TODA_RESEARCH_MODEL_V1',
        version:'TODA-RESEARCH-MODEL-V1'
      },
      configPath:'./venues/toda/config-v1.json',
      readinessPath:'./venues/toda/readiness-v1.json',
      dataRoot:'./live/toda',
      capabilities:{predictionUi:true,shadow:true,try:true,bankroll:true,postResultInput:true,realMoney:false}
    },
    '03':{
      state:'LIVE_SIMULATION',
      runtime:'RESEARCH',
      model:{
        script:'./edogawa-research-model-v2.js',
        global:'BOAT_COMMAND_EDOGAWA_RESEARCH_MODEL_V2',
        version:'EDOGAWA-RESEARCH-MODEL-V2'
      },
      configPath:'./venues/edogawa/config-v1.json',
      readinessPath:'./venues/edogawa/readiness-v1.json',
      dataRoot:'./live/edogawa',
      capabilities:{predictionUi:true,shadow:true,try:true,bankroll:true,postResultInput:true,realMoney:false}
    },
    '10':{
      state:'LIVE_SIMULATION',
      runtime:'RESEARCH',
      model:{
        script:'./mikuni-research-model-v1.js',
        global:'BOAT_COMMAND_MIKUNI_RESEARCH_MODEL_V1',
        version:'MIKUNI-RESEARCH-MODEL-V1'
      },
      configPath:'./venues/mikuni/config-v1.json',
      readinessPath:'./venues/mikuni/readiness-v1.json',
      dataRoot:'./live/mikuni',
      capabilities:{predictionUi:true,shadow:true,try:true,bankroll:true,postResultInput:true,realMoney:false}
    },
    '14':{
      state:'LIVE_SIMULATION',
      runtime:'RESEARCH',
      model:{
        script:'./naruto-research-model-v1.js',
        global:'BOAT_COMMAND_NARUTO_RESEARCH_MODEL_V1',
        version:'NARUTO-RESEARCH-MODEL-V1'
      },
      configPath:'./venues/naruto/config-v1.json',
      readinessPath:'./venues/naruto/readiness-v1.json',
      dataRoot:'./live/naruto',
      capabilities:{predictionUi:true,shadow:true,try:true,bankroll:true,postResultInput:true,realMoney:false}
    },
    '18':{
      state:'LIVE_SIMULATION',
      runtime:'RESEARCH',
      model:{
        script:'./tokuyama-research-model-v1.js',
        global:'BOAT_COMMAND_TOKUYAMA_RESEARCH_MODEL_V1',
        version:'TOKUYAMA-RESEARCH-MODEL-V1'
      },
      configPath:'./venues/tokuyama/config-v1.json',
      readinessPath:'./venues/tokuyama/readiness-v1.json',
      dataRoot:'./live/tokuyama',
      capabilities:{predictionUi:true,shadow:true,try:true,bankroll:true,postResultInput:true,realMoney:false}
    },
    '21':{
      state:'LIVE_SIMULATION',
      runtime:'RESEARCH',
      model:{
        script:'./ashiya-research-model-v1.js',
        global:'BOAT_COMMAND_ASHIYA_RESEARCH_MODEL_V1',
        version:'ASHIYA-RESEARCH-MODEL-V1'
      },
      configPath:'./venues/ashiya/config-v1.json',
      readinessPath:'./venues/ashiya/readiness-v1.json',
      dataRoot:'./live/ashiya',
      capabilities:{predictionUi:true,shadow:true,try:true,bankroll:true,postResultInput:true,realMoney:false}
    },
    '23':{
      state:'LIVE_SIMULATION',
      runtime:'RESEARCH',
      model:{
        script:'./karatsu-research-model-v1.js',
        global:'BOAT_COMMAND_KARATSU_RESEARCH_MODEL_V1',
        version:'KARATSU-RESEARCH-MODEL-V1'
      },
      configPath:'./venues/karatsu/config-v1.json',
      readinessPath:'./venues/karatsu/readiness-v1.json',
      dataRoot:'./live/karatsu',
      capabilities:{predictionUi:true,shadow:true,try:true,bankroll:true,postResultInput:true,realMoney:false}
    },
    '07':{
      state:'LIVE',
      runtime:'PRODUCTION',
      model:{
        script:'./gamagori-main-model-v0320.js',
        global:'BOAT_COMMAND_MAIN_MODEL_V0320',
        version:'GAMAGORI-MAIN-MODEL-V0.32.0'
      },
      dataRoot:'./live/gamagori',
      capabilities:{predictionUi:true,shadow:true,try:true,bankroll:true,postResultInput:true}
    }
  };

  const venues=RAW.map(([code,name,slug,key])=>Object.freeze({
    code,name,slug,key,
    state:'ENTRY_OPEN',
    runtime:'ENTRY_ONLY',
    model:null,
    configPath:null,
    readinessPath:null,
    dataRoot:null,
    capabilities:{predictionUi:false,shadow:false,try:false,bankroll:false,postResultInput:false},
    ...(overrides[code]||{})
  }));

  const byCode=new Map(venues.map(v=>[v.code,v]));
  const bySlug=new Map(venues.map(v=>[v.slug,v]));

  function normalizeCode(v){
    const s=String(v??'').trim();
    return /^\d{1,2}$/.test(s)?s.padStart(2,'0'):null;
  }
  function resolve(input){
    if(input&&typeof input==='object'){
      if(input.code&&byCode.has(normalizeCode(input.code)))return byCode.get(normalizeCode(input.code));
      if(input.slug&&bySlug.has(String(input.slug).toLowerCase()))return bySlug.get(String(input.slug).toLowerCase());
    }
    const code=normalizeCode(input);
    if(code&&byCode.has(code))return byCode.get(code);
    const slug=String(input??'').trim().toLowerCase();
    return bySlug.get(slug)||null;
  }
  function routeFor(input){
    const v=resolve(input);
    if(!v)return './portal.html';
    return v.code==='07'?'./?venue=gamagori':`./venue.html?jcd=${encodeURIComponent(v.code)}&shell=4`;
  }
  function list(){return venues.slice()}
  return Object.freeze({version:'VENUE-REGISTRY-V1',list,resolve,routeFor});
});
