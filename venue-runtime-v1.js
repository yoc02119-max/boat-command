// BOAT COMMAND venue runtime router v1
// Selects each venue's own model/data contract. It never falls back to another venue model.
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.BOAT_COMMAND_VENUE_RUNTIME=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';

  const scriptPromises=new Map();
  function registry(){
    const r=root.BOAT_COMMAND_VENUE_REGISTRY;
    if(!r?.resolve)throw new Error('VENUE_REGISTRY_NOT_READY');
    return r;
  }
  function fromLocation(){
    if(typeof location==='undefined')return null;
    const q=new URLSearchParams(location.search||'');
    return registry().resolve(q.get('jcd')||q.get('venue')||'');
  }
  function resolveVenue(input){return registry().resolve(input)||fromLocation()}
  async function fetchJson(path){
    if(!path||typeof fetch!=='function')return null;
    const sep=String(path).includes('?')?'&':'?';
    const r=await fetch(`${path}${sep}t=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`VENUE_JSON_HTTP_${r.status}`);
    return r.json();
  }
  async function loadModel(venue){
    if(!venue?.model?.script||!venue?.model?.global)return null;
    const expected=venue.model.global;
    if(root[expected])return root[expected];
    if(typeof document==='undefined')return null;
    if(!scriptPromises.has(venue.model.script)){
      scriptPromises.set(venue.model.script,new Promise((resolve,reject)=>{
        const s=document.createElement('script');
        s.src=venue.model.script;
        s.async=true;
        s.dataset.boatCommandVenueModel=venue.code;
        s.onload=()=>root[expected]?resolve(root[expected]):reject(new Error('VENUE_MODEL_GLOBAL_MISSING'));
        s.onerror=()=>reject(new Error('VENUE_MODEL_LOAD_FAILED'));
        document.head.appendChild(s);
      }));
    }
    await scriptPromises.get(venue.model.script);
    return root[expected]||null;
  }
  function capabilities(venue){
    return Object.freeze({
      venueCode:venue?.code||null,
      runtime:venue?.runtime||'ENTRY_ONLY',
      predictionUi:venue?.capabilities?.predictionUi===true,
      shadow:venue?.capabilities?.shadow===true,
      try:venue?.capabilities?.try===true,
      bankroll:venue?.capabilities?.bankroll===true,
      postResultInput:venue?.capabilities?.postResultInput===true
    });
  }
  async function boot(input,{loadModel:shouldLoadModel=true}={}){
    const venue=resolveVenue(input);
    if(!venue)throw new Error('VENUE_NOT_FOUND');
    const [config,readiness]=await Promise.all([
      venue.configPath?fetchJson(venue.configPath).catch(()=>null):Promise.resolve(null),
      venue.readinessPath?fetchJson(venue.readinessPath).catch(()=>null):Promise.resolve(null)
    ]);
    let model=null;
    if(shouldLoadModel&&venue.model?.script){
      model=await loadModel(venue);
      if(model?.version&&venue.model.version&&model.version!==venue.model.version){
        throw new Error('VENUE_MODEL_VERSION_MISMATCH');
      }
    }
    const ctx=Object.freeze({
      venue,
      config,
      readiness,
      model,
      capabilities:capabilities(venue),
      modelIsolation:true,
      crossVenueFallback:false,
      postResultFetched:false
    });
    root.BOAT_COMMAND_ACTIVE_VENUE_CONTEXT=ctx;
    return ctx;
  }
  return Object.freeze({version:'VENUE-RUNTIME-V1',resolveVenue,capabilities,loadModel,boot});
});
