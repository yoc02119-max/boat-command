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
    '03':{
      state:'SHADOW_VALIDATION',
      runtime:'RESEARCH',
      model:{
        script:'./edogawa-research-model-v2.js',
        global:'BOAT_COMMAND_EDOGAWA_RESEARCH_MODEL_V2',
        version:'EDOGAWA-RESEARCH-MODEL-V2'
      },
      configPath:'./venues/edogawa/config-v1.json',
      readinessPath:'./venues/edogawa/readiness-v1.json',
      dataRoot:'./live/edogawa',
      capabilities:{predictionUi:false,shadow:true,try:false,bankroll:false,postResultInput:false}
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
    return v.code==='07'?'./?venue=gamagori':`./venue.html?jcd=${encodeURIComponent(v.code)}`;
  }
  function list(){return venues.slice()}
  return Object.freeze({version:'VENUE-REGISTRY-V1',list,resolve,routeFor});
});
