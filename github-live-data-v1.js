// BOAT COMMAND GitHub main data router v1
// Keeps the static app on GitHub Pages while reading frequently updated runtime JSON
// directly from the repository's main branch. Prediction/result boundaries are unchanged.
(()=>{'use strict';
  if(typeof window==='undefined'||typeof window.fetch!=='function')return;
  if(window.BOAT_COMMAND_GITHUB_DATA_V1)return;

  const RAW_BASE='https://raw.githubusercontent.com/yoc02119-max/boat-command/main/';
  const nativeFetch=window.fetch.bind(window);

  function sourcePath(input){
    if(typeof input==='string')return input;
    if(input instanceof URL)return input.href;
    if(typeof Request!=='undefined'&&input instanceof Request)return input.url;
    return '';
  }

  function relativeRepoDataPath(input){
    const raw=sourcePath(input);
    if(!raw)return null;

    // Only reroute repository-owned mutable JSON/data paths.
    if(raw.startsWith('./')) {
      const rel=raw.slice(2);
      if(rel.startsWith('live/')||rel.startsWith('venues/')||rel==='shared-try-portfolio-v1.json'||rel.startsWith('shared-try-portfolio-v1.json?')||rel==='venue-calendar-v1.json'||rel.startsWith('venue-calendar-v1.json?'))return rel;
      return null;
    }

    // Some callers may omit "./".
    if(raw.startsWith('live/')||raw.startsWith('venues/')||raw.startsWith('shared-try-portfolio-v1.json')||raw.startsWith('venue-calendar-v1.json'))return raw;

    // If a same-origin absolute URL points at one of the mutable paths, normalize it too.
    try{
      const u=new URL(raw,location.href);
      if(u.origin!==location.origin)return null;
      const repoPrefix='/boat-command/';
      let p=u.pathname;
      const at=p.indexOf(repoPrefix);
      if(at>=0)p=p.slice(at+repoPrefix.length);
      else p=p.replace(/^\//,'');
      if(!(p.startsWith('live/')||p.startsWith('venues/')||p==='shared-try-portfolio-v1.json'||p==='venue-calendar-v1.json'))return null;
      return p+u.search;
    }catch{return null}
  }

  function rawUrl(input){
    const rel=relativeRepoDataPath(input);
    return rel?RAW_BASE+rel:null;
  }

  async function routedFetch(input,init){
    const target=rawUrl(input);
    if(!target)return nativeFetch(input,init);

    const reqMethod=(init?.method||(typeof Request!=='undefined'&&input instanceof Request?input.method:'GET')||'GET').toUpperCase();
    if(reqMethod!=='GET'&&reqMethod!=='HEAD')return nativeFetch(input,init);

    try{
      return await nativeFetch(target,{...(init||{}),cache:'no-store',credentials:'omit'});
    }catch(err){
      // Network/CORS failure only: preserve app availability via the Pages copy.
      return nativeFetch(input,init);
    }
  }

  window.fetch=routedFetch;
  window.BOAT_COMMAND_GITHUB_DATA_V1=Object.freeze({
    version:'GITHUB-MAIN-DATA-ROUTER-V1.1',
    rawBase:RAW_BASE,
    rawUrl
  });
})();