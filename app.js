const APP_KEY="boatCommand.v05";
const MIRROR_KEY="boatCommand.v05.mirror";
const SESSION_MIRROR_KEY="boatCommand.v05.sessionMirror";

const VERIFIED_BASELINES={
  "2025-12-15":{
    id:"BT-001",venue:"蒲郡",strategyVersion:"GAMAGORI-V1.0",
    races:9,hits:2,skipped:3,invested:18000,returned:9700,profit:-8300,
    hitRate:22.2,roi:53.9,
    note:"v0.14.0でSTRICT BACKTESTのHARD LOCK→結果解禁→精算まで完了した確定集計。"
  }
};
const START_BANKROLL=100000;
const PICK_PRICE=500;
const MAX_PICKS=4;

const BACKTEST_PACKS={
  "gamagori-2025-12-15":{
    id:"gamagori-2025-12-15",date:"2025-12-15",venue:"蒲郡",
    title:"蒲郡柑橘組合 蒲郡みかん杯・最終日",
    snapshotLevel:"1R+2R+4R-12R VERIFIED / 3R HOLD",
    note:"1R・2R・4R-12Rは公式直前情報を時刻監査済み。3Rは詳細取得未確認のため推測せずHOLD。",
    races:[
      {race:1,type:"一般戦",stableBoard:true,deadline:"15:21",
        boats:["清水紀克","加藤高史","村田 敦","宮本裕之","久保原秀人","早川颯太"],
        profiles:[
          {cls:"B1",avgST:0.18,natWin:3.97,localWin:3.79,motor:48,motor2:26.67,ex:6.60,tilt:"0.0",weight:"55.5",exST:0.18},
          {cls:"B2",avgST:0.22,natWin:6.04,localWin:4.31,motor:41,motor2:33.33,ex:6.62,tilt:"0.0",weight:"52.5",exST:0.07},
          {cls:"B1",avgST:0.15,natWin:3.48,localWin:4.04,motor:16,motor2:34.67,ex:6.71,tilt:"-0.5",weight:"61.0",exST:0.06},
          {cls:"B1",avgST:0.17,natWin:4.26,localWin:3.42,motor:20,motor2:27.94,ex:6.68,tilt:"0.0",weight:"52.0",exST:0.07},
          {cls:"B1",avgST:0.16,natWin:3.42,localWin:4.32,motor:45,motor2:20.45,ex:6.73,tilt:"0.0",weight:"54.6",exST:0.19},
          {cls:"B2",avgST:0.19,natWin:1.59,localWin:1.53,motor:51,motor2:21.28,ex:6.78,tilt:"0.0",weight:"52.2",exST:0.29}
        ],
        weather:null,
        weatherExcluded:{reason:"公式アーカイブの表示時刻が20:44で1R締切15:21より後のため、STRICT BLIND入力から除外",sourceTime:"20:44",deadline:"15:21"},
        integrity:{entry:"verified",exhibition:"verified",startExhibition:"verified",weather:"excluded_late"},
        result:"1-2-3",pay:880},
      {race:2,type:"一般戦",boats:["岩橋裕馬","中村駿平","小林一樹","永井亮次","坂口貴彦","中嶋誠一郎"],result:"1-4-2",pay:4430},
      {race:3,type:"一般戦",boats:["鈴木孝明","小林 泰","菊地敬介","齋藤真之","米本圭佑","中村守成"],result:"3-1-4",pay:21970},
      {race:4,type:"一般戦",boats:["岡 暢祐","前田聖文","金児隆太","渡邉英児","渡邊伸太郎","櫻井 隼"],result:"1-2-4",pay:920},
      {race:5,type:"一般戦",boats:["谷津幸宏","鈴木 猛","星野太郎","早川颯太","新出浩司","岡本慎治"],result:"1-3-2",pay:500},
      {race:6,type:"一般戦",boats:["鳥居塚孝博","宮本裕之","岩橋裕馬","中嶋誠一郎","竹田辰也","岡部 浩"],result:"1-5-2",pay:1090},
      {race:7,type:"一般戦",boats:["植田太一","久保原秀人","深川真二","小林 泰","永井亮次","米本圭佑"],result:"1-3-2",pay:1030},
      {race:8,type:"一般戦",boats:["里岡右貴","清水紀克","西舘 健","菊地敬介","櫻井 隼","藤田竜弘"],result:"1-6-4",pay:2750},
      {race:9,type:"一般特選",boats:["小林一樹","中村守成","山田竜一","加藤高史","星野太郎","前田聖文"],result:"1-4-3",pay:1560},
      {race:10,type:"選抜戦",boats:["竹田辰也","鈴木孝明","渡邉英児","中村駿平","谷津幸宏","金児隆太"],result:"1-2-6",pay:2010},
      {race:11,type:"選抜戦",boats:["深川真二","植田太一","里岡右貴","岡 暢祐","鳥居塚孝博","鈴木 猛"],result:"1-2-3",pay:600},
      {race:12,type:"優勝戦",boats:["重木輝彦","畑 竜生","楠 将太郎","末永由楽","三角哲男","川田正人"],result:"1-2-4",pay:1060}
    ]
  }
};


const VERIFIED_BEFOREINFO_20251215={
  2:{deadline:"15:48",stableBoard:true,weather:{label:"13:00時点",condition:"晴",temp:"10℃",water:"13℃",wind:"6m",wave:"3cm"},rows:[
    ["岩橋 裕馬","53.0","—","0.0","—"],["中村 駿平","52.0","—","0.0","—"],["小林 一樹","56.0","—","-0.5","—"],
    ["永井 亮次","52.7","—","-0.5","—"],["坂口 貴彦","55.0","—","-0.5","—"],["中嶋 誠一郎","52.3","—","0.0","—"]]},
  4:{deadline:"16:46",stableBoard:true,weather:{label:"3R時点",condition:"晴",temp:"9℃",water:"13℃",wind:"5m",wave:"3cm"},rows:[
    ["岡 暢祐","52.0","6.65","0.0",".06"],["前田 聖文","52.3","6.68","-0.5",".06"],["金児 隆太","52.0","6.67","0.0",".08"],
    ["渡邉 英児","52.8","6.75","0.0",".08"],["渡邊 伸太郎","52.5","6.70","0.0","F.02"],["櫻井 隼","51.5","6.68","0.0",".04"]]},
  5:{deadline:"17:15",stableBoard:true,weather:{label:"4R時点",condition:"晴",temp:"9℃",water:"13℃",wind:"4m",wave:"2cm"},rows:[
    ["谷津 幸宏","52.9","6.79","0.0","F.02"],["鈴木 猛","52.0","6.79","0.0",".11"],["星野 太郎","53.2","6.82","-0.5",".08"],
    ["早川 颯太","52.2","6.83","0.0",".01"],["新出 浩司","52.7","6.82","-0.5","F.03"],["岡本 慎治","52.0","6.72","-0.5",".00"]]},
  6:{deadline:"17:44",stableBoard:true,weather:{label:"4R時点",condition:"晴",temp:"9℃",water:"13℃",wind:"4m",wave:"2cm"},rows:[
    ["鳥居塚 孝博","51.5","—","-0.5","—"],["宮本 裕之","52.0","—","-0.5","—"],["岩橋 裕馬","53.0","—","0.0","—"],
    ["中嶋 誠一郎","52.3","—","0.0","—"],["竹田 辰也","52.0","—","-0.5","—"],["岡部 浩","52.2","—","-0.5","—"]]},
  7:{deadline:"18:11",stableBoard:true,fixedEntry:true,weather:{label:"6R時点",condition:"晴",temp:"8℃",water:"13℃",wind:"2m",wave:"1cm"},rows:[
    ["植田 太一","56.5","6.77","0.0",".14"],["久保原 秀人","54.6","6.85","0.0","F.05"],["深川 真二","51.0","6.83","-0.5","F.13"],
    ["小林 泰","54.0","6.80","-0.5",".08"],["永井 亮次","52.7","6.86","0.0",".12"],["米本 圭佑","52.0","6.81","-0.5",".12"]]},
  8:{deadline:"18:39",stableBoard:true,weather:{label:"7R時点",condition:"晴",temp:"8℃",water:"13℃",wind:"3m",wave:"1cm"},rows:[
    ["里岡 右貴","52.0","6.84","-0.5",".09"],["清水 紀克","55.5","6.82","-0.5",".19"],["西舘 健","53.0","6.87","0.0",".07"],
    ["菊地 敬介","55.9","6.86","0.0",".23"],["櫻井 隼","51.5","6.78","0.0",".24"],["藤田 竜弘","56.5","6.84","-0.5",".19"]]},
  9:{deadline:"19:09",stableBoard:true,weather:{label:"8R時点",condition:"晴",temp:"8℃",water:"13℃",wind:"2m",wave:"1cm"},rows:[
    ["小林 一樹","56.0","6.75","-0.5",".02"],["中村 守成","53.7","6.85","-0.5",".12"],["山田 竜一","52.0","6.78","0.5",".12"],
    ["加藤 高史","52.5","6.76","0.0",".12"],["星野 太郎","53.2","6.79","-0.5",".13"],["前田 聖文","52.3","6.78","-0.5",".11"]]},
  10:{deadline:"19:40",stableBoard:true,weather:{label:"9R時点",condition:"晴",temp:"7℃",water:"13℃",wind:"2m",wave:"1cm"},rows:[
    ["竹田 辰也","52.0","6.80","-0.5","F.03"],["鈴木 孝明","52.5","6.71","-0.5",".07"],["渡邉 英児","52.8","6.81","0.0","F.07"],
    ["中村 駿平","52.0","6.71","0.0",".13"],["谷津 幸宏","52.9","6.82","0.0",".04"],["金児 隆太","52.0","6.71","-0.5",".15"]]},
  11:{deadline:"20:10",stableBoard:true,weather:{label:"10R時点",condition:"晴",temp:"7℃",water:"13℃",wind:"2m",wave:"1cm"},rows:[
    ["深川 真二","51.0","6.79","-0.5",".17"],["植田 太一","56.5","6.76","0.0",".08"],["里岡 右貴","52.0","6.88","-0.5",".44"],
    ["岡 暢祐","52.0","6.73","0.0",".08"],["鳥居塚 孝博","51.5","6.78","-0.5",".16"],["鈴木 猛","52.0","6.81","0.0",".14"]]},
  12:{deadline:"20:40",stableBoard:true,weather:{label:"11R時点",condition:"晴",temp:"7℃",water:"13℃",wind:"2m",wave:"1cm"},rows:[
    ["重木 輝彦","52.0","6.73","0.0","F.10"],["畑 竜生","52.0","6.78","-0.5","F.02"],["楠 将太郎","52.0","6.74","0.0","F.02"],
    ["末永 由楽","52.0","6.76","-0.5",".05"],["三角 哲男","52.1","6.83","0.0","F.01"],["川田 正人","51.0","6.83","-0.5","F.06"]]}
};

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function dateISOInTokyo(d=new Date()){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
  const get=t=>parts.find(p=>p.type===t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
const todayISO=()=>dateISOInTokyo();
const money=n=>(n<0?"-":"")+"¥"+Math.abs(Math.round(n||0)).toLocaleString("ja-JP");
const pct=n=>Number.isFinite(n)?n.toFixed(1)+"%":"—";

function baseStore(){return {schema:5,venue:"蒲郡",startBankroll:START_BANKROLL,sessions:{},retestArchive:[]}}
function baseSession(date){return {date,venue:"蒲郡",mode:"STRICT",runType:"LIVE",strategyVersion:"GAMAGORI-V1.0",createdAt:new Date().toISOString(),races:Array.from({length:12},(_,i)=>({
  race:i+1,picks:["","","",""],locked:false,lockedAt:null,lockHash:null,stake:0,
  result:"",officialPayout100:0,refundAmount:0,settled:false,settledAt:null,returnAmount:0,profit:0,hit:false,rationale:"",missClass:""
}))}}

let store=loadStore();
if(!Array.isArray(store.retestArchive))store.retestArchive=[];
if(!store.liveMonitor)store.liveMonitor={last:null,history:[]};
function initialSessionDate(){
  const last=localStorage.getItem("boatCommand.lastDate");
  if(last&&store.sessions&&store.sessions[last])return last;
  const replayDates=Object.values(store.sessions||{})
    .filter(s=>s&&s.replayPackId&&!s.replayRevealed)
    .map(s=>s.date)
    .sort();
  return replayDates.length?replayDates[replayDates.length-1]:todayISO();
}
let currentDate=initialSessionDate();

function parseStored(raw){
  try{
    const x=JSON.parse(raw);
    if(x&&x.schema===5&&x.sessions)return x;
  }catch(e){}
  return null;
}
function storeRank(x){
  const rev=Number(x?._meta?.revision)||0;
  const t=Date.parse(x?._meta?.updatedAt||"")||0;
  return rev*10000000000000+t;
}
function loadStore(){
  const candidates=[];
  try{const x=parseStored(localStorage.getItem(APP_KEY));if(x)candidates.push(x)}catch(e){}
  try{const x=parseStored(localStorage.getItem(MIRROR_KEY));if(x)candidates.push(x)}catch(e){}
  try{const x=parseStored(sessionStorage.getItem(SESSION_MIRROR_KEY));if(x)candidates.push(x)}catch(e){}
  if(!candidates.length)return baseStore();
  candidates.sort((a,b)=>storeRank(b)-storeRank(a));
  const chosen=candidates[0];
  const raw=JSON.stringify(chosen);
  try{localStorage.setItem(APP_KEY,raw)}catch(e){}
  try{localStorage.setItem(MIRROR_KEY,raw)}catch(e){}
  try{sessionStorage.setItem(SESSION_MIRROR_KEY,raw)}catch(e){}
  return chosen;
}
function saveStore(){
  store._meta=store._meta||{};
  store._meta.revision=(Number(store._meta.revision)||0)+1;
  store._meta.updatedAt=new Date().toISOString();
  const raw=JSON.stringify(store);
  let ok=0;
  try{localStorage.setItem(APP_KEY,raw);ok++}catch(e){}
  try{localStorage.setItem(MIRROR_KEY,raw);ok++}catch(e){}
  try{sessionStorage.setItem(SESSION_MIRROR_KEY,raw);ok++}catch(e){}
  return ok>0;
}
function ensureSessionShape(s){
  if(s.replayPackId===undefined)s.replayPackId="";
  if(s.replayRevealed===undefined)s.replayRevealed=false;
  if(!s.runType)s.runType="LIVE";
  if(!s.strategyVersion||s.strategyVersion==="GAMAGORI-v0.6")s.strategyVersion="GAMAGORI-V1.0";
  for(const r of s.races){
    if(r.rationale===undefined)r.rationale="";
    if(r.missClass===undefined)r.missClass="";
    if(r.refundAmount===undefined)r.refundAmount=0;
  }
  return s;
}
function session(date=currentDate){
  if(!store.sessions[date]){store.sessions[date]=baseSession(date);saveStore()}
  const s=ensureSessionShape(store.sessions[date]);saveStore();return s;
}
function allSessions(){return Object.values(store.sessions).map(ensureSessionShape).sort((a,b)=>a.date.localeCompare(b.date))}
function lockedCount(s=session()){return s.races.filter(r=>r.locked).length}
function settledRaces(s=session()){return s.races.filter(r=>r.settled)}
function eligibleReplayRaces(s=session()){
  if(!activeReplayPack(s))return s.races;
  return s.races.filter(r=>replayPredictionGate(s,r).status!=="NO_PREDICTION");
}
function skippedReplayRaces(s=session()){
  if(!activeReplayPack(s))return [];
  return s.races.filter(r=>replayPredictionGate(s,r).status==="NO_PREDICTION");
}
function requiredReplayLocks(s=session()){return activeReplayPack(s)?eligibleReplayRaces(s).length:12}
function targetLockedCount(s=session()){
  const eligible=new Set(eligibleReplayRaces(s).map(r=>Number(r.race)));
  return s.races.filter(r=>r.locked&&eligible.has(Number(r.race))).length;
}
function isResultMode(s=session()){return targetLockedCount(s)===requiredReplayLocks(s)}
function normalizePick(v){
  const nums=(v||"").replace(/[^\d]/g,"").split("").slice(0,3);
  if(nums.length!==3)return v.trim();
  return nums.join("-");
}
function validPick(v){
  return /^[1-6]-[1-6]-[1-6]$/.test(v)&&new Set(v.split("-")).size===3;
}
async function digest(text){
  try{
    const data=new TextEncoder().encode(text),buf=await crypto.subtle.digest("SHA-256",data);
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,16);
  }catch(e){
    let h=2166136261; for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619)} return (h>>>0).toString(16);
  }
}
function sessionStats(s){
  const settled=settledRaces(s), investment=settled.reduce((a,r)=>a+r.stake,0), returns=settled.reduce((a,r)=>a+r.returnAmount,0);
  const hits=settled.filter(r=>r.hit).length, profit=returns-investment;
  return {races:settled.length,hits,investment,returns,profit,hitRate:settled.length?hits/settled.length*100:NaN,roi:investment?returns/investment*100:NaN};
}
function bankrollSeries(){
  let bal=store.startBankroll, out=[{label:"START",value:bal}];
  for(const s of allSessions().filter(s=>!s.retestMode)){
    for(const r of s.races.filter(x=>x.settled)){
      bal+=r.profit;out.push({label:`${s.date.slice(5)} ${r.race}R`,value:bal});
    }
  }
  return out;
}
function verifiedBacktestBaselines(){
  const rawOriginalDates=new Set(allSessions()
    .filter(s=>!s.retestMode&&s.runType==="BACKTEST"&&settledRaces(s).length)
    .map(s=>s.date));
  return Object.entries(VERIFIED_BASELINES)
    .filter(([date])=>!rawOriginalDates.has(date))
    .map(([date,b])=>({...b,date}));
}
function allStats(filterType=null){
  const formal=allSessions().filter(s=>!s.retestMode);
  const sessions=filterType?formal.filter(s=>s.runType===filterType):formal;
  const all=sessions.flatMap(s=>s.races.filter(r=>r.settled));
  let inv=all.reduce((a,r)=>a+r.stake,0),ret=all.reduce((a,r)=>a+r.returnAmount,0),hits=all.filter(r=>r.hit).length,races=all.length;
  // Lost raw ORIGINAL sessions can be restored from immutable VERIFIED_BASELINES for BACKTEST-only analytics.
  // Never add these summaries to unfiltered/LIVE totals, and never double count a date that has raw ORIGINAL data.
  if(filterType==="BACKTEST"){
    for(const b of verifiedBacktestBaselines()){
      races+=Number(b.races)||0;hits+=Number(b.hits)||0;inv+=Number(b.invested)||0;ret+=Number(b.returned)||0;
    }
  }
  const series=bankrollSeries(); let peak=series[0].value,maxdd=0;
  for(const p of series){peak=Math.max(peak,p.value);maxdd=Math.max(maxdd,peak-p.value)}
  return {races,hits,investment:inv,returns:ret,profit:ret-inv,hitRate:races?hits/races*100:NaN,roi:inv?ret/inv*100:NaN,maxdd,bankroll:series.at(-1).value};
}

const titles={home:"蒲郡コマンドセンター",predict:"蒲郡 12R予想・HARD LOCK",results:"結果・精算",analytics:"蒲郡データ分析",assistant:"蒲郡担当AIレポート",data:"データ管理"};
function showView(id){
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===id));
  $$(".nav").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
  $("#pageTitle").textContent=titles[id]||"BOAT COMMAND";
  renderAll();
}
$$(".nav").forEach(b=>b.onclick=()=>showView(b.dataset.view));
$$("[data-jump]").forEach(b=>b.onclick=()=>showView(b.dataset.jump));


function renderAll(){
  const s=session(),st=sessionStats(s),all=allStats(),lc=lockedCount(s),mode=isResultMode(s);
  const rt=$("#runType"),sv=$("#strategyVersion");
  if(rt){rt.value=s.runType||"LIVE";rt.disabled=lc>0||!!s.replayPackId}
  if(sv){sv.value=s.strategyVersion||"GAMAGORI-V1.0";sv.disabled=lc>0||!!s.replayPackId}
  if($("#sessionLockNote"))$("#sessionLockNote").textContent=lc>0?`🔒 ${s.runType} / ${s.strategyVersion} はこの日のLOCK記録として固定済み`:"1RでもLOCKすると区分と戦略バージョンは固定されます。";
  renderReplayControls(s);
  $("#kLocked").textContent=`${targetLockedCount(s)}/${requiredReplayLocks(s)}`;
  $("#kHits").textContent=st.races?`${st.hits}/${st.races}`:"—";
  $("#kHitRate").textContent=st.races?pct(st.hitRate):"未精算";
  $("#kRoi").textContent=st.races?pct(st.roi):"—";
  $("#kProfit").textContent=st.races?money(st.profit):"¥0";
  setSign($("#kProfit"),st.profit);
  $("#summarySub").textContent=st.races?`${st.races}R精算済み`:(lc?`${lc}R LOCK済み`:"未開始");
  $("#todayStatus").textContent=st.races===12?"COMPLETE":mode?"RESULT MODE":"OPEN";
  $("#todayStatus").classList.toggle("done",st.races===12);
  $("#guardNote").textContent=mode?"全12R LOCK済み。RESULT MODEが解禁されています。":"全12RをLOCKするまで、結果入力は開きません。";
  const state=appState(s);
  $("#modeBadge").className="badge "+(["RETEST_RESULT","ORIGINAL_RESULT","ARCHIVED_ORIGINAL"].includes(state.kind)?"result":"blind");
  $("#modeBadge").textContent=(["RETEST_RESULT","ORIGINAL_RESULT"].includes(state.kind)?"✓ ":"🔒 ")+stateLabel(s);
  $("#bankrollNow").textContent=money(all.bankroll);
  $("#allRecord").textContent=`${all.races}戦 ${all.hits}的中`;
  $("#allHitRate").textContent=pct(all.hitRate);
  $("#allRoi").textContent=pct(all.roi);
  $("#allDd").textContent=money(-all.maxdd);
  renderRaceStrip(s);renderPredictions(s);renderChart();renderAnalytics();renderReport();renderData();renderResults(s);
}
function setSign(el,n){el.classList.remove("positive","negative");if(n>0)el.classList.add("positive");if(n<0)el.classList.add("negative")}
function renderRaceStrip(s){
  $("#raceStrip").innerHTML=s.races.map(r=>{
    let c="race-chip",label="OPEN";
    if(r.settled){c+=" settled "+(r.hit?"hit":"miss");label=r.hit?"HIT":"MISS"}
    else if(activeReplayPack(s)&&replayPredictionGate(s,r).status==="NO_PREDICTION"){c+=" skipped";label="SKIP"}
    else if(r.locked){c+=" locked";label="LOCK"}
    return `<div class="${c}"><b>${r.race}R</b><small>${label}</small></div>`
  }).join("");
}

function activeReplayPack(s=session()){return s.replayPackId?BACKTEST_PACKS[s.replayPackId]||null:null}
function appState(s=session()){
  const pack=activeReplayPack(s);
  const baseline=VERIFIED_BASELINES[s.date]||null;
  const target=pack?eligibleReplayRaces(s).length:12;
  const locked=pack?targetLockedCount(s):lockedCount(s);
  const revealed=!!s.replayRevealed;
  const settled=settledRaces(s).length;
  if(s.retestMode&&pack){
    if(revealed||settled>0)return {kind:"RETEST_RESULT",pack,baseline,target,locked};
    if(locked===target)return {kind:"RETEST_LOCKED",pack,baseline,target,locked};
    return {kind:"RETEST_BLIND",pack,baseline,target,locked};
  }
  if(pack){
    if(revealed||settled>0)return {kind:"ORIGINAL_RESULT",pack,baseline,target,locked};
    if(locked===target)return {kind:"ORIGINAL_LOCKED",pack,baseline,target,locked};
    return {kind:"ORIGINAL_BLIND",pack,baseline,target,locked};
  }
  if(baseline)return {kind:"ARCHIVED_ORIGINAL",pack:null,baseline,target:baseline.races||0,locked:baseline.races||0};
  return {kind:s.runType==="BACKTEST"?"BACKTEST_EMPTY":"LIVE_BLIND",pack:null,baseline:null,target,locked};
}
function stateLabel(s=session()){
  const k=appState(s).kind;
  return ({
    RETEST_BLIND:"RETEST · BLIND",
    RETEST_LOCKED:"RETEST · LOCKED",
    RETEST_RESULT:"RETEST · RESULT",
    ORIGINAL_BLIND:"BACKTEST · ORIGINAL BLIND",
    ORIGINAL_LOCKED:"BACKTEST · ORIGINAL LOCKED",
    ORIGINAL_RESULT:"BACKTEST · ORIGINAL RESULT",
    ARCHIVED_ORIGINAL:"ARCHIVED · ORIGINAL BLIND",
    BACKTEST_EMPTY:"BACKTEST · NO PACK",
    LIVE_BLIND:"LIVE · BLIND"
  })[k]||k;
}
function renderReplayControls(s){
  const panel=$("#replayPanel");if(!panel)return;
  const pack=activeReplayPack(s), lc=targetLockedCount(s), target=requiredReplayLocks(s), skipped=skippedReplayRaces(s).length;
  panel.classList.toggle("active",!!pack);
  $("#loadReplayBtn").disabled=false;
  $("#loadReplayBtn").textContent=pack?(s.replayRevealed?"新規RETESTを開始":"RETESTを最初からやり直す"):"2025/12/15 パックを読み込む";
  if($("#unloadReplayBtn"))$("#unloadReplayBtn").classList.toggle("hidden",!pack);
  $("#revealReplayBtn").classList.toggle("hidden",!(pack&&lc===target&&!s.replayRevealed));
  if($("#autoFinishBtn"))$("#autoFinishBtn").classList.toggle("hidden",!(pack&&lc===target&&!s.replayRevealed));
  const state=appState(s);
  if(!pack){
    $("#replayStatus").textContent=state.kind==="ARCHIVED_ORIGINAL"
      ?`ARCHIVED · ${state.baseline.id} ORIGINAL BLIND保存済み · パック再読込でRETEST可能`
      :s.runType==="BACKTEST"?"BACKTEST：パック未読込":"LIVEモード：必要なときだけ実レースパックを使用";
  }else if(s.replayRevealed){
    $("#replayStatus").textContent=`${s.retestMode?"RETEST RESULT":"RESULT REVEALED"} · ${pack.date} · ${target}R精算 / ${skipped}R見送り`;
  }else{
    $("#replayStatus").textContent=`${s.retestMode?"RETEST BLIND":"BLIND"} · ${pack.date} · ${lc}/${target} TARGET LOCK · ${skipped}R SKIP · ${pack.snapshotLevel}`;
  }
}

function setAutoPrepStatus(text,kind=""){
  const el=$("#autoPrepStatus");
  if(!el)return;
  el.textContent=text;
  el.className="generator-status "+kind;
}

async function runBlindAutoPrep(){
  const pack=BACKTEST_PACKS["gamagori-2025-12-15"];
  if(!pack){setAutoPrepStatus("FAILED · PACK NOT FOUND","error");return;}
  if(!confirm("新規RETESTとして、パック読込 → BLIND予想生成 → 予想対象HARD LOCKまで自動実行します。公式結果は解禁せず、LOCKED状態で停止します。実行しますか？"))return;
  const startedAt=new Date().toISOString();
  try{
    setAutoPrepStatus("① PACK / INTEGRITY CHECK…","working");
    const errors=validateReplayPack(pack);
    if(errors.length){setAutoPrepStatus(`FAILED · ${errors.join(" / ")}`,"error");return;}

    setAutoPrepStatus("② FRESH RETEST SESSION…","working");
    const fresh=startFreshReplayRun(pack.id);
    if(!fresh.ok){setAutoPrepStatus(`FAILED · ${fresh.error}`,"error");return;}
    let s=fresh.s;
    const snapshotMissing=s.races.filter(r=>!replaySnapshotHtml(s,r)).map(r=>r.race);
    if(snapshotMissing.length){setAutoPrepStatus(`FAILED · SNAPSHOT ${snapshotMissing.join(",")}R`,"error");return;}

    setAutoPrepStatus("③ BLIND PREDICTION…","working");
    const eligible=eligibleReplayRaces(s), skipped=skippedReplayRaces(s);
    const failed=[];
    for(const r of eligible){
      const out=makeBlindPicks(s,r);
      if(!out||!Array.isArray(out.picks)||!out.picks.length){failed.push(r.race);continue;}
      r.picks=out.picks;
      r.rationale=out.rationale;
    }
    if(failed.length){setAutoPrepStatus(`FAILED · PREDICTOR ${failed.join(",")}R`,"error");return;}
    saveStore();

    const invalid=eligible.filter(r=>{
      const picks=(r.picks||[]).map(normalizePick).filter(Boolean);
      return picks.length<1||picks.length>4||picks.some(p=>!validPick(p))||new Set(picks).size!==picks.length||!(r.rationale||"").trim();
    });
    if(invalid.length){setAutoPrepStatus(`FAILED · PREDICTION VERIFY ${invalid.map(r=>r.race).join(",")}R`,"error");return;}

    setAutoPrepStatus(`④ HARD LOCK… · ${eligible.length}R`,"working");
    for(const r of eligible){
      const ok=await lockRace(r.race);
      if(!ok){setAutoPrepStatus(`FAILED · LOCK ${r.race}R`,"error");return;}
    }

    s=session();
    const target=requiredReplayLocks(s), locked=targetLockedCount(s), settled=s.races.filter(r=>r.settled).length;
    if(locked!==target){setAutoPrepStatus(`FAILED · LOCK VERIFY ${locked}/${target}`,"error");return;}
    if(s.replayRevealed||settled>0){
      setAutoPrepStatus("CRITICAL FAIL · RESULT GATE VIOLATION","error");
      console.error("AUTO PREP RESULT GATE VIOLATION",{replayRevealed:s.replayRevealed,settled});
      return;
    }

    s.autoPrepAudit={
      mode:"BLIND_AUTO_PREP",
      startedAt,
      completedAt:new Date().toISOString(),
      packId:pack.id,
      eligible:target,
      skipped:skipped.length,
      locked,
      resultGate:"HIDDEN",
      state:appState(s).kind
    };
    saveStore();renderAll();
    setAutoPrepStatus(`✓ AUTO PREP COMPLETE · ${locked}/${target} LOCK · ${skipped.length}R SKIP · RESULT HIDDEN`,"success");
  }catch(err){
    console.error(err);
    setAutoPrepStatus(`FAILED · AUTO PREP · ${err?.message||"UNKNOWN ERROR"}`,"error");
  }
}
function setReplayLoadStatus(text,kind=""){
  const el=$("#replayLoadStatus");
  if(!el)return;
  el.textContent=text;
  el.className="replay-load-status "+kind;
}
function validateReplayPack(pack){
  const errors=[];
  if(!pack)errors.push("PACK_NOT_FOUND");
  else{
    if(!Array.isArray(pack.races)||pack.races.length!==12)errors.push("RACE_COUNT");
    const nums=(pack.races||[]).map(x=>Number(x.race));
    for(let i=1;i<=12;i++)if(!nums.includes(i))errors.push(`MISSING_${i}R`);
    if(!VERIFIED_BEFOREINFO_20251215)errors.push("VERIFIED_MAP");
  }
  return errors;
}

function nextRetestId(){
  const nums=[
    ...(store.retestArchive||[]).map(x=>Number(String(x.runId||"").replace(/\D/g,""))||0),
    ...Object.values(store.sessions||{}).map(x=>Number(String(x?.retestRunId||"").replace(/\D/g,""))||0)
  ];
  return `RT-${String(Math.max(0,...nums)+1).padStart(3,"0")}`;
}
function archiveCompletedRetest(s){
  if(!s?.retestMode||!s?.replayRevealed)return;
  store.retestArchive=Array.isArray(store.retestArchive)?store.retestArchive:[];
  const runId=s.retestRunId||nextRetestId();
  if(store.retestArchive.some(x=>x.runId===runId))return;
  const st=sessionStats(s);
  store.retestArchive.push({
    runId,date:s.date,venue:s.venue,strategyVersion:s.strategyVersion,retestOf:s.retestOf,
    completedAt:new Date().toISOString(),races:st.races,hits:st.hits,investment:st.investment,
    returns:st.returns,profit:st.profit,hitRate:st.hitRate,roi:st.roi,skipped:skippedReplayRaces(s).length
  });
}
function startFreshReplayRun(id){
  const pack=BACKTEST_PACKS[id];
  if(!pack)return {ok:false,error:"PACK_NOT_FOUND"};
  const errors=validateReplayPack(pack);
  if(errors.length)return {ok:false,error:errors.join(" / ")};
  const existing=store.sessions[pack.date];
  if(existing?.retestMode&&existing?.replayRevealed)archiveCompletedRetest(existing);
  const isRetest=!!VERIFIED_BASELINES[pack.date],s=baseSession(pack.date);
  s.runType="BACKTEST";s.strategyVersion="GAMAGORI-V1.0";s.mode="STRICT";
  s.retestMode=isRetest;s.retestOf=isRetest?VERIFIED_BASELINES[pack.date].id:null;
  s.retestRunId=isRetest?nextRetestId():null;
  s.replayPackId=pack.id;s.replayRevealed=false;s.replayLoadedAt=new Date().toISOString();
  store.sessions[pack.date]=s;currentDate=pack.date;
  localStorage.setItem("boatCommand.lastDate",currentDate);saveStore();
  if($("#sessionDate"))$("#sessionDate").value=currentDate;
  return {ok:true,s};
}

function loadReplayPack(id){
  try{
    setReplayLoadStatus("① PACK CHECK…","working");
    const pack=BACKTEST_PACKS[id];
    const isRetest=!!VERIFIED_BASELINES[pack?.date];
    const errors=validateReplayPack(pack);
    if(errors.length){setReplayLoadStatus(`LOAD FAILED · ${errors.join(" / ")}`,"error");return;}

    setReplayLoadStatus("② FRESH RETEST SESSION…","working");
    const fresh=startFreshReplayRun(id);
    if(!fresh.ok){setReplayLoadStatus(`LOAD FAILED · ${fresh.error}`,"error");return;}
    const s=fresh.s;

    setReplayLoadStatus("③ 12R DATA LINK…","working");
    const expected=[1,2,3,4,5,6,7,8,9,10,11,12];
    const linkErrors=expected.filter(n=>{
      const race=s.races.find(x=>Number(x.race)===n);
      return !race || !replaySnapshotHtml(s,race);
    });
    if(linkErrors.length){
      setReplayLoadStatus(`LOAD FAILED · SNAPSHOT ${linkErrors.join(",")}R`,"error");return;
    }

    setReplayLoadStatus("④ SNAPSHOT RENDER…","working");
    renderAll();

    requestAnimationFrame(()=>{
      const slots=[...document.querySelectorAll("[data-snapshot-race]")];
      const visible=slots.filter(x=>x.textContent.trim().length>0).length;
      if(visible===12){
        setReplayLoadStatus(isRetest?`✓ RETEST PACK READY · ${VERIFIED_BASELINES[pack.date].id}比較用 · 正式BLIND戦績には加算しません`:"✓ LOAD COMPLETE · 12/12 SNAPSHOT READY","success");
      }else{
        setReplayLoadStatus(`DISPLAY CHECK · ${visible}/12 SNAPSHOT · 再描画します`,"warn");
        renderAll();
        requestAnimationFrame(()=>{
          const slots2=[...document.querySelectorAll("[data-snapshot-race]")];
          const v2=slots2.filter(x=>x.textContent.trim().length>0).length;
          setReplayLoadStatus(v2===12?(isRetest?`✓ RETEST PACK READY · ${VERIFIED_BASELINES[pack.date].id}比較用 · 正式BLIND戦績には加算しません`:"✓ LOAD COMPLETE · 12/12 SNAPSHOT READY"):`LOAD FAILED · DISPLAY ${v2}/12` ,v2===12?"success":"error");
        });
      }
    });
  }catch(err){
    console.error(err);
    setReplayLoadStatus(`LOAD FAILED · ${err?.message||"UNKNOWN ERROR"}`,"error");
  }
}
function setAutoFinishStatus(text,kind=""){
  const el=$("#autoFinishStatus");
  if(!el)return;
  el.textContent=text;
  el.className="generator-status "+kind;
}
function validateReplayResultSource(s,pack){
  const errors=[];
  if(!pack)errors.push("PACK_NOT_FOUND");
  const eligible=new Set(eligibleReplayRaces(s).map(r=>Number(r.race)));
  for(const pr of (pack?.races||[])){
    if(!eligible.has(Number(pr.race)))continue;
    if(!validPick(normalizePick(pr.result)))errors.push(`${pr.race}R_RESULT`);
    const pay=Number(pr.pay);
    if(!Number.isFinite(pay)||pay<0)errors.push(`${pr.race}R_PAY`);
  }
  if((pack?.races||[]).filter(pr=>eligible.has(Number(pr.race))).length!==eligible.size)errors.push("RESULT_COUNT");
  return errors;
}
function performReplayRevealAndSettle(s,pack){
  const eligible=new Set(eligibleReplayRaces(s).map(r=>Number(r.race)));
  const stamp=new Date().toISOString();
  for(const pr of pack.races){
    const r=s.races.find(x=>Number(x.race)===Number(pr.race));
    if(!r)continue;
    if(!eligible.has(Number(r.race))){
      const gate=replayPredictionGate(s,r);
      r.predictionStatus="SKIPPED";
      r.skipReason=gate.reason;
      r.skipRecordedAt=stamp;
      continue;
    }
    if(!r.locked||r.settled)continue;
    r.result=normalizePick(pr.result);r.officialPayout100=Number(pr.pay);r.refundAmount=0;
    r.hit=r.picks.filter(Boolean).includes(r.result);
    r.returnAmount=r.hit?r.officialPayout100*5:0;r.profit=r.returnAmount-r.stake;
    r.settled=true;r.settledAt=stamp;r.note="BACKTEST REPLAY / OFFICIAL RESULT";
  }
  s.replayRevealed=true;s.replayRevealedAt=stamp;
}
async function runResultAutoFinish(){
  const s=session(),pack=activeReplayPack(s),target=requiredReplayLocks(s),locked=targetLockedCount(s);
  if(!pack){setAutoFinishStatus("BLOCKED · PACK NOT READY","error");return;}
  if(s.replayRevealed||settledRaces(s).length>0){setAutoFinishStatus("BLOCKED · RESULT ALREADY OPEN","error");return;}
  if(locked!==target){setAutoFinishStatus(`BLOCKED · LOCK ${locked}/${target}`,"error");return;}
  const sourceErrors=validateReplayResultSource(s,pack);
  if(sourceErrors.length){setAutoFinishStatus(`BLOCKED · RESULT SOURCE ${sourceErrors.join(" / ")}`,"error");return;}
  if(!confirm(`RESULT AUTO FINISHを実行します。${target}/${target} HARD LOCKを再確認し、公式結果ソースを検証後にのみ、結果解禁 → 一括精算 → 分析更新まで実行します。実行しますか？`))return;
  const startedAt=new Date().toISOString();
  try{
    setAutoFinishStatus("① LOCK GATE VERIFY…","working");
    if(targetLockedCount(s)!==target||s.replayRevealed)throw new Error("LOCK_GATE");
    setAutoFinishStatus("② RESULT SOURCE VERIFY…","working");
    const errors=validateReplayResultSource(s,pack);
    if(errors.length)throw new Error("RESULT_SOURCE_"+errors.join("_"));
    setAutoFinishStatus("③ REVEAL / SETTLE…","working");
    performReplayRevealAndSettle(s,pack);
    const settled=settledRaces(s).length, skipped=skippedReplayRaces(s).length;
    if(!s.replayRevealed||settled!==target)throw new Error(`SETTLE_VERIFY_${settled}_${target}`);
    s.aiReportUpdatedAt=new Date().toISOString();
    s.aiReportUpdateSource="RESULT_AUTO_FINISH";
    s.autoFinishAudit={
      mode:"RESULT_AUTO_FINISH",
      startedAt,
      completedAt:new Date().toISOString(),
      packId:pack.id,
      preState:"LOCKED",
      target,
      locked,
      resultSource:"VERIFIED",
      revealedAt:s.replayRevealedAt,
      settled,
      skipped,
      postState:"RESULT",
      analytics:"READY",
      aiReport:"UPDATED",
      aiReportUpdatedAt:s.aiReportUpdatedAt
    };
    saveStore();renderAll();showView("results");
    setAutoFinishStatus(`✓ AUTO FINISH COMPLETE · ${settled}/${target} SETTLED · ${skipped}R SKIP · ANALYTICS READY`,"success");
  }catch(err){
    console.error(err);
    setAutoFinishStatus(`CRITICAL FAIL · AUTO FINISH · ${err?.message||"UNKNOWN ERROR"}`,"error");
  }
}
function revealAndSettleReplay(){
  const s=session(),pack=activeReplayPack(s),target=requiredReplayLocks(s);
  if(!pack||targetLockedCount(s)!==target||s.replayRevealed)return;
  const sourceErrors=validateReplayResultSource(s,pack);
  if(sourceErrors.length){alert(`公式結果ソースを確認できません: ${sourceErrors.join(" / ")}`);return;}
  if(!confirm(`予想対象${target}RをすべてHARD LOCK済みです。公式結果を解禁して一括精算しますか？`))return;
  performReplayRevealAndSettle(s,pack);saveStore();renderAll();showView("results");
}

if($("#autoPrepBtn"))$("#autoPrepBtn").onclick=runBlindAutoPrep;
if($("#autoFinishBtn"))$("#autoFinishBtn").onclick=runResultAutoFinish;
$("#loadReplayBtn").onclick=()=>{
  const s=session(),pack=activeReplayPack(s);
  if(pack){
    const msg=s.replayRevealed
      ?"新しいRETESTを開始します。今回のRETEST結果は履歴へ保存し、ORIGINAL BLIND BT-001は変更しません。開始しますか？"
      :"現在のRETEST途中データを破棄して最初からやり直します。ORIGINAL BLIND BT-001は変更しません。よろしいですか？";
    if(!confirm(msg))return;
  }
  loadReplayPack("gamagori-2025-12-15");
};
if($("#unloadReplayBtn"))$("#unloadReplayBtn").onclick=()=>{
  const s=session(),pack=activeReplayPack(s);
  if(!pack)return;
  if(!confirm("パックを未読込状態に戻します。現在のRETEST途中データは画面から外れます。ORIGINAL BLIND BT-001は保持します。よろしいですか？"))return;
  if(s.retestMode&&s.replayRevealed)archiveCompletedRetest(s);
  const clean=baseSession(s.date);
  clean.runType="BACKTEST";
  clean.strategyVersion=s.strategyVersion||"GAMAGORI-V1.0";
  store.sessions[s.date]=clean;
  saveStore();
  setReplayLoadStatus("READY · パック未読込","success");
  renderAll();
};
$("#revealReplayBtn").onclick=revealAndSettleReplay;


function replayPredictionGate(s,r){
  if(s.runType!=="BACKTEST"||!s.replayPackId)return {status:"READY",label:"PREDICTION READY｜予想可能",reason:""};
  const n=Number(r.race);
  if(n===3)return {
    status:"NO_PREDICTION",
    label:"NO PREDICTION｜予想見送り",
    reason:"締切前の公式直前データを十分に確認できないため見送り"
  };
  if(n===2||n===6)return {
    status:"NO_PREDICTION",
    label:"NO PREDICTION｜予想見送り",
    reason:"展示タイム・展示STなど重要な直前比較データを締切前情報として確認できないため見送り"
  };
  if(n===1)return {
    status:"LIMITED",
    label:"LIMITED DATA｜一部データ不足",
    reason:"気象情報の時刻整合性を満たさないため気象を除外して判断"
  };
  return {status:"READY",label:"PREDICTION READY｜予想可能",reason:"締切前と確認できた直前データで判断可能"};
}


function predictionEditorHtml(s,r){
  const gate=replayPredictionGate(s,r);
  if(gate.status==="NO_PREDICTION"){
    return `<div class="no-prediction-panel">
      <div class="no-prediction-head"><b>NO PREDICTION｜予想見送り</b><span>このレースは見送り</span></div>
      <div class="no-prediction-reason">${escapeHtml(gate.reason)}</div>
      <div class="no-prediction-rule">重要な締切前データが不足しているため、予想入力とHARD LOCKを無効化しています。</div>
    </div>`;
  }

  const locked=!!r.lockedAt;
  const inputs=(r.picks||["","","",""]).map((pick,i)=>`
    <input class="pick-input" data-race="${r.race}" data-pick-index="${i}"
      value="${escapeHtml(pick||"")}" placeholder="${i+1}点目 例 1-3-4"
      ${locked?"disabled":""}>`).join("");

  return `<div class="prediction-gate ${gate.status.toLowerCase()}">
      <b>${gate.label}</b><span>${escapeHtml(gate.reason)}</span>
    </div>
    <div class="pick-grid">${inputs}</div>
    <label class="rationale-label">予想根拠（LOCK時に固定）</label>
    <textarea class="rationale-input" data-race="${r.race}" ${locked?"disabled":""}
      placeholder="例：1の展示気配良、3カド攻め想定">${escapeHtml(r.rationale||"")}</textarea>
    <div class="lock-row">
      <button class="hard-lock" data-lock-race="${r.race}" ${locked?"disabled":""}>
        ${locked?"LOCKED":"HARD LOCK"}
      </button>
    </div>`;
}

function replaySnapshotHtml(s,r){
  const pack=activeReplayPack(s);
  if(!pack)return "";
  const raceNo=Number(r.race);
  const pr=pack.races.find(x=>Number(x.race)===raceNo);
  const verified=VERIFIED_BEFOREINFO_20251215[raceNo];

  // 2R / 4R-12R: these snapshots are stored in the verified map.
  // They must render even when the base replay pack has no detailed race object.
  if(verified){
    const baseType=pr?.type||"一般戦";
    const rows=verified.rows.map((x,i)=>`<div class="verified-row">
      <div class="full-name"><b>${i+1}</b><span>${escapeHtml(x[0])}</span></div>
      <span>体重 <strong>${escapeHtml(x[1])}kg</strong></span>
      <span>展示 <strong>${escapeHtml(x[2])}</strong></span>
      <span>チルト <strong>${escapeHtml(x[3])}</strong></span>
      <span>展示ST <strong>${escapeHtml(x[4])}</strong></span>
    </div>`).join("");
    const w=verified.weather;
    return `<div class="replay-snapshot full-snapshot">
      <div class="snapshot-head"><span>PRE-RACE VERIFIED SNAPSHOT <em class="safe-badge">TIME-SAFE</em></span><b>${escapeHtml(baseType)} · 締切 ${verified.deadline}${verified.fixedEntry?" · 進入固定":""}${verified.stableBoard?" · 安定板":""}</b></div>
      <div class="weather-strip"><span>${escapeHtml(w.label)}</span><span>${escapeHtml(w.condition)}</span><span>気温 ${escapeHtml(w.temp)}</span><span>水温 ${escapeHtml(w.water)}</span><span>風 ${escapeHtml(w.wind)}</span><span>波 ${escapeHtml(w.wave)}</span></div>
      <div class="verified-grid">${rows}</div>
      <div class="snapshot-note">締切前と確認できた公式直前情報のみ表示。「—」は公式アーカイブ上で確認できなかったため欠損扱い。</div>
    </div>`;
  }

  // If the race is neither in verified map nor base pack, surface the failure.
  if(!pr){
    return `<div class="replay-snapshot integrity-warning">⚠ SNAPSHOT LINK ERROR · ${raceNo}R のパック情報を参照できません</div>`;
  }

  // 1R: detailed verified profile stored directly in replay pack.
  if(pr.profiles&&Array.isArray(pr.profiles)){
    const rows=pr.boats.map((name,i)=>{
      const p=pr.profiles[i];
      if(!p)return "";
      return `<div class="full-row">
        <div class="full-name"><b>${i+1}</b><span>${escapeHtml(name)}<small>${escapeHtml(p.cls||"")}</small></span></div>
        <span>平均ST <strong>${Number(p.avgST).toFixed(2)}</strong></span>
        <span>全国 <strong>${Number(p.natWin).toFixed(2)}</strong></span>
        <span>当地 <strong>${Number(p.localWin).toFixed(2)}</strong></span>
        <span>M${p.motor} <strong>${Number(p.motor2).toFixed(2)}%</strong></span>
        <span>展示 <strong>${Number(p.ex).toFixed(2)}</strong></span>
        <span>展示ST <strong>${Number(p.exST).toFixed(2)}</strong></span>
      </div>`;
    }).join("");
    const weatherHtml=pr.weather
      ? `<div class="weather-strip"><span>${pr.weather.condition}</span><span>気温 ${pr.weather.temp}</span><span>水温 ${pr.weather.water}</span><span>風 ${pr.weather.wind}</span><span>波 ${pr.weather.wave}</span></div>`
      : `<div class="integrity-warning">⚠ WEATHER EXCLUDED · 時刻整合性を満たさない気象値は予想入力から除外</div>`;
    return `<div class="replay-snapshot full-snapshot">
      <div class="snapshot-head"><span>PRE-RACE FULL SNAPSHOT <em class="safe-badge">TIME-SAFE</em></span><b>${escapeHtml(pr.type)} · 締切 ${escapeHtml(pr.deadline||"—")}${pr.stableBoard?" · 安定板":""}</b></div>
      ${weatherHtml}
      <div class="full-grid">${rows}</div>
      <div class="snapshot-note">出走表・展示・展示STはレース固有の公式直前情報。締切後に更新された項目は予想入力から除外。</div>
    </div>`;
  }

  // 3R: intentional integrity hold.
  return `<div class="replay-snapshot hold-snapshot">
    <div class="snapshot-head"><span>PRE-RACE SNAPSHOT <em class="hold-badge">INTEGRITY HOLD</em></span><b>${escapeHtml(pr.type||"一般戦")}</b></div>
    <div class="boat-grid">${(pr.boats||[]).map((name,i)=>`<div class="boat-chip"><b>${i+1}</b><span>${escapeHtml(name)}</span></div>`).join("")}</div>
    <div class="snapshot-note">詳細な公式直前情報を現在のアーカイブ取得経路で確認できていないため、値を推測せずENTRY BASELINEのまま保持。</div>
  </div>`;
}


function blindScoreRows(s,r){
  const n=Number(r.race);
  const pack=activeReplayPack(s);
  const pr=pack?.races?.find(x=>Number(x.race)===n);
  const v=VERIFIED_BEFOREINFO_20251215[n];

  if(n===1 && pr?.profiles){
    return pr.profiles.map((p,i)=>{
      const lane=i+1;
      const laneBonus=[2.6,1.45,1.05,.75,.45,.25][i];
      const exScore=(6.90-Number(p.ex))*8;
      const stScore=(.30-Number(p.exST))*4;
      const classScore=p.cls==="A1"?1.4:p.cls==="A2"?.8:0;
      const winScore=Number(p.natWin)*.28+Number(p.localWin)*.16;
      const motorScore=Number(p.motor2)*.025;
      return {lane,score:laneBonus+exScore+stScore+classScore+winScore+motorScore};
    });
  }

  if(v){
    return v.rows.map((x,i)=>{
      const lane=i+1, ex=Number(x[2]), stRaw=String(x[4]||"");
      if(!Number.isFinite(ex)||x[2]==="—"||stRaw==="—")return null;
      const laneBonus=[2.8,1.55,1.1,.8,.5,.3][i];
      const exScore=(6.95-ex)*8;
      let st=Number(stRaw.replace("F.","0."));
      if(!Number.isFinite(st))st=.20;
      const stScore=stRaw.startsWith("F.") ? Math.max(0,1.0-st*2) : (0.30-st)*4;
      return {lane,score:laneBonus+exScore+stScore};
    }).filter(Boolean);
  }
  return [];
}
function makeBlindPicks(s,r){
  if(replayPredictionGate(s,r).status==="NO_PREDICTION")return null;
  const rows=blindScoreRows(s,r).sort((a,b)=>b.score-a.score);
  if(rows.length<3)return null;
  const a=rows[0].lane,b=rows[1].lane,c=rows[2].lane,d=rows[3]?.lane||c;
  const candidates=[`${a}-${b}-${c}`,`${a}-${c}-${b}`,`${b}-${a}-${c}`,`${a}-${b}-${d}`];
  const picks=[...new Set(candidates)].slice(0,4);
  return {
    picks,
    rank:rows.map(x=>x.lane),
    rationale:`STRICT BLIND自動生成。表示済みの締切前データのみ使用。評価順位 ${rows.map(x=>x.lane).join("→")}。コース優位・展示タイム・展示ST${Number(r.race)===1?"・全国/当地勝率・モーター2連率":""}を固定ルールで採点。`
  };
}
function generateBlindPredictions(){
  const s=session();
  if(!activeReplayPack(s)){alert("先にBACKTESTパックを読み込んでください。");return;}
  let made=0,skipped=0;
  s.races.forEach(r=>{
    if(r.locked)return;
    if(replayPredictionGate(s,r).status==="NO_PREDICTION"){skipped++;return;}
    const out=makeBlindPicks(s,r);
    if(!out){skipped++;return;}
    r.picks=out.picks;
    r.rationale=out.rationale;
    made++;
  });
  saveStore();renderAll();
  alert(`${s.retestMode?"RETEST":"BLIND"}予想生成完了\n予想 ${made}R / 見送り ${skipped}R\nまだHARD LOCKはしていません。${s.retestMode?"\n正式BLIND戦績には加算しません。":""}`);
}


async function lockRace(n){
  const s=session(),r=s.races.find(x=>Number(x.race)===Number(n));
  if(!r||r.locked)return false;
  const gate=replayPredictionGate(s,r);
  if(gate.status==="NO_PREDICTION"){
    alert(`${n}RはNO PREDICTIONのためLOCK対象外です。`);
    return false;
  }
  const picks=(r.picks||[]).map(normalizePick).filter(Boolean);
  if(picks.length<1||picks.length>4||picks.some(p=>!validPick(p))||new Set(picks).size!==picks.length){
    alert(`${n}Rの買い目を確認してください。1〜4点・重複なし・例 1-3-4`);
    return false;
  }
  if(!(r.rationale||"").trim()){
    alert(`${n}Rの予想根拠が空です。`);
    return false;
  }
  r.picks=[...picks,...Array(4-picks.length).fill("")];
  r.stake=picks.length*500;
  r.locked=true;
  r.lockedAt=new Date().toISOString();
  r.predictionStatus=gate.status;
  r.predictionGateReason=gate.reason;
  r.lockHash=await digest(JSON.stringify({
    date:s.date,race:r.race,picks:r.picks,stake:r.stake,rationale:r.rationale,
    strategyVersion:s.strategyVersion,runType:s.runType,gate:gate.status
  }));
  saveStore();renderAll();
  return true;
}
async function lockAllEligible(){
  const s=session();
  const eligible=eligibleReplayRaces(s).filter(r=>!r.locked);
  if(!eligible.length){alert("LOCK対象の未LOCKレースはありません。");return;}
  for(const r of eligible){
    const picks=(r.picks||[]).map(normalizePick).filter(Boolean);
    if(picks.length<1||picks.length>4||picks.some(p=>!validPick(p))||new Set(picks).size!==picks.length||!(r.rationale||"").trim()){
      alert(`${r.race}Rの予想入力が未完成です。一括LOCKを中止しました。`);
      return;
    }
  }
  if(!confirm(`予想対象${requiredReplayLocks(s)}RをHARD LOCKします。LOCK後は変更できません。`))return;
  for(const r of eligible)await lockRace(r.race);
  renderAll();
}

function renderPredictions(s){
  const host=$("#predictionList"); if(!host)return;

  host.innerHTML=s.races.map(r=>{
    const gate=replayPredictionGate(s,r);
    const noPrediction=gate.status==="NO_PREDICTION";
    const picks=r.picks.map((p,i)=>`<input class="pick" data-r="${r.race}" data-i="${i}" ${(r.locked||noPrediction)?"disabled":""} value="${escapeHtml(p||"")}" placeholder="${i+1}点目 例 1-3-4">`).join("");

    const editor=noPrediction
      ? `<div class="no-prediction-panel">
          <div class="no-prediction-head">
            <b>NO PREDICTION｜予想見送り</b>
            <span>このレースは予想対象外</span>
          </div>
          <div class="no-prediction-reason">${escapeHtml(gate.reason)}</div>
          <div class="no-prediction-rule">予想入力・予想根拠・HARD LOCKは無効です。見送った理由はBACKTEST記録に残します。</div>
        </div>`
      : `<div class="pick-grid">${picks}</div>
        <div class="reason-box">
          <label>予想根拠（LOCK時に固定）</label>
          <textarea data-reason="${r.race}" ${r.locked?"disabled":""} placeholder="例：1の展示気配良、3カド攻め想定">${escapeHtml(r.rationale||"")}</textarea>
        </div>
        <div class="race-actions">
          ${r.locked
            ? `<span class="unlock-note">🔒 HARD LOCK済み</span>`
            : `<button class="lock-btn" data-lock="${r.race}">HARD LOCK</button>`}
        </div>`;

    return `<div class="race-card ${r.locked?"locked":""} ${activeReplayPack(s)?"replay-active":""} ${noPrediction?"no-prediction-race":""}">
      <div class="race-head">
        <div>
          <div class="race-no">${r.race}R</div>
          <div class="race-meta">${r.locked?`LOCK ${fmtTime(r.lockedAt)} / ID ${r.lockHash}`:"未確定"}${activeReplayPack(s)?' · PRE-RACE DATA ACTIVE':''}</div>
        </div>
        <div class="stake">${noPrediction?"見送り":(r.locked?money(r.stake):"最大 ¥2,000")}</div>
      </div>

      <div class="prediction-gate ${gate.status.toLowerCase()} prediction-gate-top">
        <b>${escapeHtml(gate.label)}</b>
        <span>${escapeHtml(gate.reason)}</span>
      </div>

      <div class="snapshot-slot" data-snapshot-race="${r.race}"></div>
      ${editor}
    </div>`;
  }).join("");

  $$("[data-snapshot-race]").forEach(slot=>{
    const raceNo=Number(slot.dataset.snapshotRace);
    const race=s.races.find(x=>Number(x.race)===raceNo);
    if(!race){
      slot.innerHTML=`<div class="replay-snapshot integrity-warning">⚠ SNAPSHOT PIPELINE ERROR · ${raceNo}R</div>`;
      return;
    }
    const out=replaySnapshotHtml(s,race);
    if(activeReplayPack(s)){
      slot.innerHTML=out||`<div class="replay-snapshot integrity-warning">⚠ SNAPSHOT PIPELINE EMPTY · ${raceNo}R</div>`;
      slot.dataset.state=out?"ok":"empty";
    }else{
      slot.innerHTML="";
      slot.dataset.state="inactive";
    }
  });

  $$(".pick").forEach(inp=>{
    inp.addEventListener("change",e=>{
      const r=s.races.find(x=>x.race===+e.target.dataset.r); if(!r||r.locked)return;
      if(replayPredictionGate(s,r).status==="NO_PREDICTION"){renderPredictions(s);return;}
      r.picks[+e.target.dataset.i]=normalizePick(e.target.value);saveStore();renderPredictions(s);
    });
  });
  $$("[data-reason]").forEach(inp=>inp.addEventListener("change",e=>{
    const r=s.races.find(x=>x.race===+e.target.dataset.reason); if(!r||r.locked)return;
    if(replayPredictionGate(s,r).status==="NO_PREDICTION"){renderPredictions(s);return;}
    r.rationale=e.target.value;saveStore();
  }));
  $$("[data-lock]").forEach(b=>b.onclick=()=>lockRace(+b.dataset.lock));
}


function testModeLabel(s){
  if(s.retestMode)return `RETEST · ${s.retestOf||"ORIGINAL"}比較`;
  if(VERIFIED_BASELINES[s.date]&&!activeReplayPack(s))return "BACKTEST · ORIGINAL BLIND";
  return s.runType==="BACKTEST"?"BACKTEST · ORIGINAL BLIND":"LIVE · BLIND";
}
function baselineCompareHtml(s){
  if(!s.retestMode)return "";
  const b=VERIFIED_BASELINES[s.date];if(!b)return "";
  return finalScoreHtml({
    ...b,
    kicker:`ORIGINAL BLIND ${b.id}｜正式比較基準・上書き禁止`,
    note:"初回の完全BLIND検証成績。RETESTを何回行ってもこの基準値は変更しません。"
  });
}

function finalScoreHtml({races,hits,skipped,invested,returned,profit,hitRate,roi,kicker="BACKTEST FINAL SCORE｜最終成績",note=""}){
  return `<section class="final-score-card">
    <div class="final-score-kicker">${kicker}</div>
    <div class="final-score-title">${races}戦 ${hits}的中 <span>／ ${skipped}R見送り</span></div>
    <div class="final-score-grid">
      <div><small>投資</small><b>${money(invested)}</b></div>
      <div><small>払戻</small><b>${money(returned)}</b></div>
      <div><small>収支</small><b class="${profit>=0?"plus":"minus"}">${profit>0?"+":""}${money(profit)}</b></div>
      <div><small>的中率</small><b>${Number(hitRate).toFixed(1)}%</b></div>
      <div><small>ROI</small><b>${Number(roi).toFixed(1)}%</b></div>
    </div>
    <div class="final-score-note">${note||`見送り ${skipped}R は投資・的中率・ROI・MISS集計から除外`}</div>
  </section>`;
}
function currentFinalScoreHtml(s){
  const settled=settledRaces(s), skipped=skippedReplayRaces(s);
  if(!s.replayRevealed||!settled.length)return "";
  const races=settled.length,hits=settled.filter(r=>r.hit).length;
  const invested=settled.reduce((a,r)=>a+(Number(r.stake)||0),0);
  const returned=settled.reduce((a,r)=>a+(Number(r.returnAmount)||0),0);
  const profit=returned-invested;
  return finalScoreHtml({
    races,hits,skipped:skipped.length,invested,returned,profit,
    hitRate:races?hits/races*100:0,roi:invested?returned/invested*100:0,
    kicker:s.retestMode?`RETEST FINAL SCORE ${s.retestRunId||""}｜今回の再検証成績`:"BACKTEST FINAL SCORE｜最終成績",
    note:s.retestMode
      ?"RETEST参考成績｜正式BACKTEST/LIVE集計には加算しません。ORIGINAL BLINDは下の比較基準として固定保存。"
      :`見送り ${skipped.length}R は投資・的中率・ROI・MISS集計から除外`
  });
}
function recoveredBaselineHtml(s){
  const b=VERIFIED_BASELINES[s.date];
  if(!b)return "";
  return finalScoreHtml({
    ...b,
    kicker:`VERIFIED BACKTEST ${b.id}｜復旧済み最終成績`,
    note:"SUMMARY-ONLY RECOVERY｜確定済み集計だけを保存。消失したrace-level LOCK IDや個別履歴は捏造して復元しません。"
  });
}

function renderResults(s){
  const state=appState(s), replay=state.pack;
  const open=isResultMode(s);
  const recovered=state.kind==="ARCHIVED_ORIGINAL";
  const displayOpen=["RETEST_RESULT","ORIGINAL_RESULT"].includes(state.kind)||(open&&(!replay||s.replayRevealed));

  $("#resultGate").classList.toggle("hidden",displayOpen);
  $("#resultList").classList.toggle("hidden",!displayOpen);
  $("#resultGateBadge").className="badge "+(displayOpen?"result":recovered?"result":"blind");
  $("#resultGateBadge").textContent=displayOpen?(s.retestMode?"✓ RETEST RESULT":"✓ RESULT MODE"):recovered?"✓ ARCHIVED RESULT":(replay&&open?"🔐 REVEAL待ち":s.retestMode?"RETEST · LOCK待ち":"LOCK待ち");

  if(recovered){
    $("#resultGate").classList.remove("hidden");
    $("#resultList").classList.add("hidden");
    $("#resultGate").innerHTML=`<div class="recovery-banner"><b>ARCHIVED RESULT｜ORIGINAL BLIND検証済み</b><span>初回成績は固定保存。再予想はパックを読み込み、RETESTとして別枠比較できます。</span></div>${recoveredBaselineHtml(s)}`;
    $("#resultSummary").innerHTML="";
    return;
  }

  if(replay&&open&&!s.replayRevealed){
    $("#resultGate").innerHTML=`<div class="gate-icon">🔐</div><h3>予想対象全件 HARD LOCK完了</h3><p>公式結果はまだ非表示です。「結果を解禁・一括精算」で初めて結果を開きます。</p>`;
  }else if(!displayOpen){
    $("#resultGate").innerHTML=s.retestMode
      ?`<div class="gate-icon">↻</div><h3>RETEST｜再検証中</h3><p>${state.locked}/${state.target} TARGET LOCK。自動予想 → HARD LOCK後に結果比較へ進みます。ORIGINAL BLIND成績は上書きしません。</p>`
      :`<div class="gate-icon">🔒</div><h3>RESULT MODEはまだ開いていません</h3><p>予想対象レースをすべてHARD LOCKすると、結果が解禁されます。見送りレースはLOCK不要です。</p>`;
  }
  if(!displayOpen){$("#resultSummary").innerHTML="";return;}

  const summaryHtml=s.retestMode
    ?`<div class="score-compare-head"><b>RETEST vs ORIGINAL BLIND</b><span>今回の再検証と初回正式成績を完全分離して比較</span></div>${currentFinalScoreHtml(s)}${baselineCompareHtml(s)}`
    :currentFinalScoreHtml(s);
  $("#resultSummary").innerHTML="";
  $("#resultList").innerHTML=summaryHtml+s.races.map(r=>{
    if(replay&&replayPredictionGate(s,r).status==="NO_PREDICTION")return `<div class="race-card no-prediction-race">
      <div class="race-head"><div><div class="race-no">${r.race}R</div><div class="race-meta">BACKTEST監査記録</div></div><div class="stake">SKIPPED</div></div>
      <div class="no-prediction-panel"><b>NO PREDICTION｜予想見送り</b><div class="no-prediction-reason">${escapeHtml(r.skipReason||replayPredictionGate(s,r).reason)}</div><div class="no-prediction-rule">投資・的中率・ROI・MISS集計には含めません。</div></div>
    </div>`;
    if(r.settled)return `<div class="race-card locked">
      <div class="race-head"><div><div class="race-no">${r.race}R</div><div class="race-meta">精算 ${fmtTime(r.settledAt)}</div></div><div class="stake">${r.hit?"🎯 HIT":"MISS"}</div></div>
      <div class="settled-box"><div><span>結果</span><b>${r.result}</b></div><div><span>投資</span><b>${money(r.stake)}</b></div><div><span>払戻+返還</span><b>${money(r.returnAmount)}</b></div><div><span>損益</span><b class="${r.profit>=0?"positive":"negative"}">${money(r.profit)}</b></div></div>
      ${r.hit?"":`<div class="miss-select"><label>外れ原因</label><select data-miss="${r.race}">${missOptions(r.missClass)}</select></div>`}
      ${r.rationale?`<div class="refund-note">LOCK根拠：${escapeHtml(r.rationale)}</div>`:""}
    </div>`;
    return `<div class="race-card">
      <div class="race-head"><div><div class="race-no">${r.race}R</div><div class="race-meta">LOCK買い目 ${r.picks.filter(Boolean).join(" / ")}</div></div><div class="stake">投資 ${money(r.stake)}</div></div>
      <div class="result-fields">
        <div class="field"><label>結果（例 1-3-4）</label><input data-result="${r.race}" placeholder="1-3-4"></div>
        <div class="field"><label>3連単払戻 / 100円</label><input data-pay="${r.race}" type="number" inputmode="numeric" min="0" placeholder="例 2270"></div>
        <div class="field"><label>返還額（該当時のみ）</label><input data-refund="${r.race}" type="number" inputmode="numeric" min="0" max="${r.stake}" placeholder="0"></div>
        <div class="field"><label>メモ（任意）</label><input data-note="${r.race}" placeholder="例 逃げ / まくり差し"></div>
        <button class="settle-btn" data-settle="${r.race}">精算確定</button>
      </div><div class="refund-note">欠場・F等で購入買い目が返還対象になった場合だけ返還額を入力。</div>
    </div>`;
  }).join("");
  $$("[data-settle]").forEach(b=>b.onclick=()=>settleRace(+b.dataset.settle));
  $$("[data-miss]").forEach(x=>x.onchange=()=>{
    const r=s.races.find(r=>r.race===+x.dataset.miss);r.missClass=x.value;saveStore();renderAnalytics();renderReport();
  });
}
function settleRace(n){
  const s=session(),r=s.races.find(x=>x.race===n);if(!isResultMode(s)||r.settled)return;
  const result=normalizePick($(`[data-result="${n}"]`).value),pay=+$(`[data-pay="${n}"]`).value,refund=+$(`[data-refund="${n}"]`).value||0;
  if(!validPick(result)){alert("結果を「1-3-4」の形式で入力してください。");return}
  if(!Number.isFinite(pay)||pay<0){alert("払戻金を確認してください。");return}
  if(!Number.isFinite(refund)||refund<0||refund>r.stake){alert("返還額を確認してください。");return}
  const hit=r.picks.filter(Boolean).includes(result);
  if(hit && pay<=0){alert("的中買い目なので、3連単の公式払戻（100円あたり）を入力してください。");return}
  r.result=result;r.officialPayout100=pay;r.refundAmount=refund;r.hit=hit;r.returnAmount=(hit?pay*5:0)+refund;r.profit=r.returnAmount-r.stake;
  r.settled=true;r.settledAt=new Date().toISOString();r.note=$(`[data-note="${n}"]`).value.trim();saveStore();renderAll();
}
function renderChart(){
  const svg=$("#bankrollChart"),data=bankrollSeries(),w=900,h=280,p=30;
  const vals=data.map(x=>x.value),min0=Math.min(...vals),max0=Math.max(...vals),pad=Math.max(2000,(max0-min0)*.15);
  const min=min0-pad,max=max0+pad,x=i=>p+(w-2*p)*(data.length===1?0:i/(data.length-1)),y=v=>h-p-(h-2*p)*(v-min)/(max-min||1);
  let grid="";for(let i=0;i<5;i++){const yy=p+(h-2*p)*i/4;grid+=`<line class="gridline" x1="${p}" y1="${yy}" x2="${w-p}" y2="${yy}"/>`}
  if(data.length===1){svg.innerHTML=`${grid}<text class="chart-label" x="42" y="140">精算データが入ると資金曲線が表示されます</text>`;return}
  const pts=data.map((d,i)=>[x(i),y(d.value)]),path=pts.map((q,i)=>(i?"L":"M")+q[0].toFixed(1)+" "+q[1].toFixed(1)).join(" ");
  const area=path+` L ${pts.at(-1)[0]} ${h-p} L ${pts[0][0]} ${h-p} Z`;
  svg.innerHTML=`<defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#19d9ff" stop-opacity=".30"/><stop offset="1" stop-color="#19d9ff" stop-opacity="0"/></linearGradient></defs>${grid}<path class="chart-fill" d="${area}"/><path class="chart-line" d="${path}"/>${pts.filter((_,i)=>i===pts.length-1||i%Math.max(1,Math.floor(pts.length/8))===0).map(q=>`<circle class="chart-point" cx="${q[0]}" cy="${q[1]}" r="4"/>`).join("")}`;
}
function aggregateHeadBoat(){
  const rows=Array.from({length:6},(_,i)=>({name:`${i+1}頭`,inv:0,ret:0}));
  for(const s of allSessions().filter(s=>!s.retestMode))for(const r of s.races.filter(x=>x.settled)){
    const picks=r.picks.filter(Boolean), per=PICK_PRICE;
    for(const p of picks){const idx=+p[0]-1;rows[idx].inv+=per;if(r.hit&&p===r.result)rows[idx].ret+=r.returnAmount}
  }
  return rows.map(x=>({name:x.name,value:x.inv?x.ret/x.inv*100:0,empty:!x.inv}));
}
function aggregateWinners(){
  const counts=Array(6).fill(0);let total=0;
  for(const s of allSessions().filter(s=>!s.retestMode))for(const r of s.races.filter(x=>x.settled)){counts[+r.result[0]-1]++;total++}
  return counts.map((c,i)=>({name:`${i+1}号艇`,value:total?c/total*100:0,empty:!total}));
}
function renderBars(id,rows){
  const el=$(id);if(!el)return;
  el.innerHTML=rows.map(r=>`<div class="bar-row"><span>${r.name}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,r.value)}%"></div></div><span class="bar-value">${r.empty?"—":r.value.toFixed(1)+"%"}</span></div>`).join("");
}
function renderAnalytics(){
  renderBars("#headBoatBars",aggregateHeadBoat());renderBars("#winnerBars",aggregateWinners());
  const rows=allSessions().slice().reverse().map(s=>{const x=sessionStats(s),kind=s.retestMode?`RETEST（参考・正式集計外）`:s.runType;return `<tr class="${s.retestMode?"retest-row":""}"><td>${s.date}</td><td>${kind}</td><td>${s.strategyVersion}</td><td>${x.races}/12</td><td>${x.hits}</td><td>${pct(x.hitRate)}</td><td>${pct(x.roi)}</td><td class="${x.profit>=0?"positive":"negative"}">${money(x.profit)}</td></tr>`}).join("");
  $("#historyTable").innerHTML=`<table class="tbl"><thead><tr><th>日付</th><th>区分</th><th>戦略</th><th>精算</th><th>的中</th><th>的中率</th><th>回収率</th><th>損益</th></tr></thead><tbody>${rows||'<tr><td colspan="8">まだ精算データがありません</td></tr>'}</tbody></table>`;
  const bt=allStats("BACKTEST"),lv=allStats("LIVE");
  $("#modeCompare").innerHTML=[["BACKTEST",bt],["LIVE",lv]].map(([name,x])=>`<div class="compare-card"><h3>${name}</h3><div class="mini"><div><span>RACE</span><b>${x.races}</b></div><div><span>HIT</span><b>${pct(x.hitRate)}</b></div><div><span>ROI</span><b>${pct(x.roi)}</b></div><div><span>P/L</span><b class="${x.profit>=0?"positive":"negative"}">${money(x.profit)}</b></div></div></div>`).join("");
}
function reportData(){
  const s=session(),st=sessionStats(s),bt=allStats("BACKTEST"),lv=allStats("LIVE"),baseline=VERIFIED_BASELINES[s.date]||null;
  const cards=[];
  if(s.retestMode&&st.races){
    cards.push(["現在地",`RETEST ${st.races}R精算済み・${st.hits}的中。的中率${pct(st.hitRate)}、ROI ${pct(st.roi)}、損益 ${money(st.profit)}。参考成績として扱い、正式BACKTEST/LIVE戦績には加算しません。`]);
  }else if(st.races){
    cards.push(["現在地",`${s.runType} ${st.races}R精算済み・${st.hits}的中。的中率${pct(st.hitRate)}、ROI ${pct(st.roi)}、損益 ${money(st.profit)}。`]);
  }else{
    cards.push(["現在地","この対象日の精算済みレースはまだありません。"]);
  }
  cards.push(["正式成績",`BACKTEST ${bt.races}R・${bt.hits}的中・ROI ${pct(bt.roi)}・損益 ${money(bt.profit)}。LIVE ${lv.races}R・${lv.hits}的中・ROI ${pct(lv.roi)}・損益 ${money(lv.profit)}。RETESTはこの集計から除外します。`]);
  if(baseline){
    cards.push(["ORIGINAL基準",`${baseline.id} ORIGINAL BLIND：${baseline.races}R・${baseline.hits}的中・${baseline.skipped}R見送り・ROI ${pct(baseline.roi)}・損益 ${money(baseline.profit)}。正式比較基準として固定し、RETESTで上書きしません。`]);
  }else{
    cards.push(["ORIGINAL基準","この対象日には固定済みORIGINAL BLIND基準がありません。"]);
  }
  return cards;
}
function renderReport(){
  $("#reportCards").innerHTML=reportData().map(x=>`<article class="report-card"><h3>${x[0]}</h3><p>${x[1]}</p></article>`).join("");
  const s=session(),status=$("#reportRefreshStatus");
  if(status){
    if(s.aiReportUpdatedAt){
      const stamp=new Date(s.aiReportUpdatedAt).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
      const source=s.aiReportUpdateSource==="RESULT_AUTO_FINISH"?"AUTO":"手動";
      status.textContent=`✓ ${source}更新済み ${stamp}`;status.classList.add("done");
    }else{status.textContent="未更新";status.classList.remove("done");}
  }
}
function refreshReportWithAudit(){
  const btn=$("#refreshReport"),status=$("#reportRefreshStatus");
  if(btn){btn.disabled=true;btn.textContent="更新中…";}
  const s=session(),now=new Date();
  s.aiReportUpdatedAt=now.toISOString();s.aiReportUpdateSource="MANUAL";saveStore();
  renderReport();
  const stamp=now.toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  if(status){status.textContent=`✓ 手動更新済み ${stamp}`;status.classList.add("done");}
  if(btn){btn.textContent="更新完了";setTimeout(()=>{btn.disabled=false;btn.textContent="更新";},650);}
}
$("#refreshReport").onclick=refreshReportWithAudit;
function fmtTime(v){if(!v)return"—";try{return new Date(v).toLocaleString("ja-JP",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"})}catch{return v}}
const MISS_CLASSES=[
 ["","未分類"],["A","A：1着読み違い"],["B","B：2着読み違い"],["C","C：3着抜け"],["D","D：進入"],["E","E：ST"],["F","F：モーター"],["G","G：展示"],["H","H：荒れ・想定外"]
];
function missOptions(v){return MISS_CLASSES.map(([k,n])=>`<option value="${k}" ${v===k?"selected":""}>${n}</option>`).join("")}
function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function criticalRegressionCheck(s=session()){
  const state=appState(s),issues=[];
  if(state.pack){
    if(!state.pack.races||state.pack.races.length!==12)issues.push("PACK");
    const skipped=s.races.filter(r=>replayPredictionGate(s,r).status==="NO_PREDICTION").length;
    if(skipped!==3)issues.push(`SKIP:${skipped}`);
    const generated=s.races.filter(r=>replayPredictionGate(s,r).status!=="NO_PREDICTION"&&Array.isArray(r.picks)&&r.picks.filter(Boolean).length).length;
    if(["RETEST_LOCKED","RETEST_RESULT","ORIGINAL_LOCKED","ORIGINAL_RESULT"].includes(state.kind)&&generated!==9)issues.push(`PICKS:${generated}`);
    if(["RETEST_LOCKED","RETEST_RESULT","ORIGINAL_LOCKED","ORIGINAL_RESULT"].includes(state.kind)&&state.locked!==state.target)issues.push(`LOCK:${state.locked}/${state.target}`);
  }
  if(state.kind==="RETEST_RESULT"){
    if(settledRaces(s).length!==9)issues.push(`SETTLE:${settledRaces(s).length}`);
    if(!VERIFIED_BASELINES[s.date])issues.push("BASELINE");
  }
  return {ok:issues.length===0,issues};
}

function renderData(){
  const s=session(),regression=criticalRegressionCheck(s),target=requiredReplayLocks(s),tl=targetLockedCount(s),skips=skippedReplayRaces(s).length;$("#sessionInfo").textContent=`${s.date} / ${stateLabel(s)} / ${s.strategyVersion} / TARGET LOCK ${tl}/${target} / SKIP ${skips} / 精算 ${settledRaces(s).length}/${target} / CRITICAL CHAIN ${regression.ok?"PASS":"FAIL "+regression.issues.join(",")} / SAVE REV ${Number(store._meta?.revision)||0}`;
  $("#auditTable").innerHTML=`<table class="tbl"><thead><tr><th>R</th><th>状態</th><th>LOCK時刻</th><th>LOCK ID</th></tr></thead><tbody>${s.races.map(r=>`<tr><td>${r.race}R</td><td>${activeReplayPack(s)&&replayPredictionGate(s,r).status==="NO_PREDICTION"?"SKIP":r.settled?"精算済":r.locked?"LOCK":"OPEN"}</td><td>${fmtTime(r.lockedAt)}</td><td>${r.lockHash||"—"}</td></tr>`).join("")}</tbody></table>`;
  renderLiveGate();
}

const LIVE_ALLOWED_PATHS=new Set(["racelist","beforeinfo"]);
function liveOfficialUrl(kind,date,race){
  if(!LIVE_ALLOWED_PATHS.has(kind))throw new Error("RESULT_ENDPOINT_BLOCKED");
  const d=String(date||"").replace(/-/g,"");
  const r=Math.max(1,Math.min(12,Number(race)||1));
  if(!/^\d{8}$/.test(d))throw new Error("INVALID_DATE");
  return `https://www.boatrace.jp/owpc/pc/race/${kind}?hd=${d}&jcd=07&rno=${r}`;
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function parseDeadlineFromHtml(html,race){
  const text=String(html||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/\s+/g," ");
  const re=new RegExp(`${Number(race)}R[\\s\\S]{0,500}?締切予定時刻[\\s\\S]{0,80}?(\\d{1,2}:\\d{2})`,`i`);
  return text.match(re)?.[1]||text.match(/締切予定時刻[\s\S]{0,80}?(\d{1,2}:\d{2})/i)?.[1]||null;
}
function preRaceEvidence(html,kind){
  const text=String(html||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ");
  if(kind==="racelist")return {ok:/出走表/.test(text)&&/ボートレーサー|レーサー/.test(text),fields:["出走表","全国/当地","モーター"]};
  return {ok:/直前情報/.test(text)&&/展示タイム/.test(text),fields:["展示タイム","チルト","スタート展示","水面気象"]};
}
async function safePreRaceFetch(kind,date,race){
  const url=liveOfficialUrl(kind,date,race),started=Date.now();
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),8000);
  try{
    const res=await fetch(url,{method:"GET",mode:"cors",cache:"no-store",credentials:"omit",signal:ctl.signal,headers:{"Accept":"text/html"}});
    if(!res.ok)throw new Error(`HTTP_${res.status}`);
    const html=await res.text(),ev=preRaceEvidence(html,kind);
    if(!ev.ok)throw new Error("UNEXPECTED_PRE_RACE_FORMAT");
    return {kind,ok:true,url,fetchedAt:new Date().toISOString(),ms:Date.now()-started,bytes:html.length,deadline:parseDeadlineFromHtml(html,race),fields:ev.fields};
  }catch(e){
    return {kind,ok:false,url,fetchedAt:new Date().toISOString(),ms:Date.now()-started,error:e?.name==="AbortError"?"TIMEOUT":String(e?.message||e)};
  }finally{clearTimeout(timer)}
}
function renderLiveGate(){
  const dateEl=$("#liveDate"),raceEl=$("#liveRace"),st=$("#liveGateStatus"),audit=$("#liveGateAudit");if(!dateEl||!raceEl||!st||!audit)return;
  if(!dateEl.value)dateEl.value=todayISO();
  const x=store.liveMonitor?.last;
  if(!x){st.className="live-gate-status";st.textContent="未実行 · 予想/LOCK/結果取得なし";audit.innerHTML="";return;}
  st.className=`live-gate-status ${x.status==="SAFE"?"ok":x.status==="PARTIAL"?"warn":"fail"}`;
  st.textContent=`${x.status} · ${x.date} ${x.race}R · ${x.summary}`;
  const rows=[
    ["取得時刻",x.fetchedAtJST||"—"],["締切予定",x.deadline||"—"],["購入余裕",x.marginLabel||"未判定"],
    ["出走表",x.racelist?.ok?`OK · ${x.racelist.bytes} bytes · ${x.racelist.ms}ms`:`BLOCK · ${x.racelist?.error||"—"}`],
    ["直前情報",x.beforeinfo?.ok?`OK · ${x.beforeinfo.bytes} bytes · ${x.beforeinfo.ms}ms`:`BLOCK · ${x.beforeinfo?.error||"—"}`],
    ["結果系", "HARD BLOCK · このモニターには結果取得コードなし"],
    ["予想/LOCK", "DISABLED · AUDIT ONLY"]
  ];
  audit.innerHTML=rows.map(([a,b])=>`<div class="live-audit-row"><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("");
}
function jstTimeLabel(iso){try{return new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date(iso))}catch{return "—"}}
function marginToDeadline(date,deadline,now=new Date()){
  if(!deadline)return {minutes:null,label:"未判定"};
  const [h,m]=deadline.split(":").map(Number);
  const target=new Date(`${date}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00+09:00`);
  const min=(target-now)/60000;
  return {minutes:min,label:Number.isFinite(min)?`${min>=0?"残り":"締切後 "}${Math.abs(min).toFixed(1)}分`:"未判定"};
}
async function runLiveProbe(){
  const btn=$("#liveProbeBtn"),date=$("#liveDate").value||todayISO(),race=Number($("#liveRace").value)||1,st=$("#liveGateStatus");
  if(btn.disabled)return;btn.disabled=true;btn.textContent="接続監査中…";st.className="live-gate-status warn";st.textContent="CHECKING · 公式PRE-RACEのみ · 結果系HARD BLOCK";
  const racelist=await safePreRaceFetch("racelist",date,race);
  const beforeinfo=await safePreRaceFetch("beforeinfo",date,race);
  const deadline=racelist.deadline||beforeinfo.deadline||null,now=new Date(),margin=marginToDeadline(date,deadline,now);
  let status="BLOCKED",summary="ブラウザから公式PRE-RACEを安全に読めません";
  if(racelist.ok&&beforeinfo.ok){status="SAFE";summary="出走表+直前情報を取得。予想/LOCKは未実行"}
  else if(racelist.ok||beforeinfo.ok){status="PARTIAL";summary="一部のみ取得。予想は禁止"}
  const rec={status,summary,date,race,deadline,marginMinutes:margin.minutes,marginLabel:margin.label,fetchedAt:now.toISOString(),fetchedAtJST:jstTimeLabel(now),racelist,beforeinfo,resultEndpoint:"BLOCKED",prediction:"DISABLED"};
  store.liveMonitor=store.liveMonitor||{last:null,history:[]};store.liveMonitor.last=rec;store.liveMonitor.history=(store.liveMonitor.history||[]).concat([rec]).slice(-30);saveStore();renderLiveGate();btn.disabled=false;btn.textContent="公式PRE-RACE接続テスト";
}

$("#exportBtn").onclick=()=>{
  const payload={exportedAt:new Date().toISOString(),exportDateJST:todayISO(),app:"BOAT COMMAND",version:"0.17.0",data:store};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=`boat-command-backup-${todayISO()}.json`;a.click();URL.revokeObjectURL(a.href);
}
$("#importFile").onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  try{
    const x=JSON.parse(await f.text()),d=x.data||x;
    if(!d||d.schema!==5||!d.sessions)throw new Error();
    if(!confirm("現在の端末データをバックアップ内容で置き換えます。よろしいですか？"))return;
    store=d;saveStore();renderAll();alert("バックアップを読み込みました。");
  }catch{alert("BOAT COMMANDの対応バックアップとして読み込めませんでした。")}
  e.target.value="";
}
$("#liveProbeBtn").onclick=()=>runLiveProbe();
$("#resetDayBtn").onclick=()=>{
  if(!confirm(`${currentDate} の記録を初期化します。この操作は元に戻せません。`))return;
  store.sessions[currentDate]=baseSession(currentDate);saveStore();renderAll();
}
$("#runType").onchange=e=>{const s=session();if(lockedCount(s))return;s.runType=e.target.value;saveStore();renderAll()}
$("#strategyVersion").onchange=e=>{const s=session();if(lockedCount(s))return;s.strategyVersion=(e.target.value.trim()||"GAMAGORI-V1.0");saveStore();renderAll()}
$("#sessionDate").value=currentDate;
$("#sessionDate").onchange=e=>{currentDate=e.target.value||todayISO();localStorage.setItem("boatCommand.lastDate",currentDate);session();renderAll()}

function addBubble(text,type){const b=document.createElement("div");b.className=`bubble ${type}`;b.innerHTML=text;$("#chat").appendChild(b);$("#chat").scrollTop=$("#chat").scrollHeight}
function answer(q){
  const s=session(),st=sessionStats(s),all=allStats(),t=q.replace(/\s/g,"");
  if(/今日|どう|成績/.test(t)){
    if(!st.races)return `今日はまだ精算前です。現在 <strong>${lockedCount(s)}/12R</strong> がLOCK済みです。`;
    return `今日は <strong>${st.races}R精算・${st.hits}的中</strong>。回収率は <strong>${pct(st.roi)}</strong>、損益は <strong>${money(st.profit)}</strong> です。`;
  }
  if(/ロック|LOCK|予想/.test(t)){showView("predict");return `現在 <strong>${lockedCount(s)}/12R</strong> LOCK済みです。予想画面を開きました。`}
  if(/資金|推移/.test(t)){showView("home");return `現在の累計仮想資金は <strong>${money(all.bankroll)}</strong>。最大ドローダウンは <strong>${money(-all.maxdd)}</strong> です。`}
  if(/過去|本番|BACKTEST|LIVE|比較/.test(t)){
    const bt=allStats("BACKTEST"),lv=allStats("LIVE");showView("analytics");
    return `BACKTESTは <strong>${bt.races}R・ROI ${pct(bt.roi)}・損益 ${money(bt.profit)}</strong>。LIVEは <strong>${lv.races}R・ROI ${pct(lv.roi)}・損益 ${money(lv.profit)}</strong> です。`;
  }
  if(/弱点|原因|分析|悪/.test(t)){showView("assistant");return reportData()[0][1]+" "+reportData()[1][1]}
  if(/結果|精算/.test(t)){showView("results");return isResultMode(s)?"RESULT MODEを開きました。":"まだ12RすべてLOCKされていないため、結果入力は閉じています。"}
  return `質問を受け取りました。無料版では「今日どう？」「ロック状況」「資金推移」「弱点は？」「精算を開いて」に対応しています。`;
}
let speechOn=localStorage.getItem("boatCommand.speech")!=="off";
let cachedVoices=[];
function refreshVoices(){cachedVoices=("speechSynthesis" in window&&speechSynthesis.getVoices)?speechSynthesis.getVoices():[]}
if("speechSynthesis" in window){refreshVoices();speechSynthesis.onvoiceschanged=refreshVoices}
function spokenJapanese(input){
  let t=String(input||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
  t=t.replace(/\b(\d{1,2})R\b/gi,"$1レース");
  t=t.replace(/\bROI\s*([0-9]+(?:\.[0-9]+)?)%/gi,"回収率 $1パーセント");
  t=t.replace(/\bROI\b/gi,"回収率").replace(/\bP\/L\b/gi,"損益");
  t=t.replace(/\bHIT\b/gi,"的中").replace(/\bMISS\b/gi,"不的中");
  t=t.replace(/\bBACKTEST\b/gi,"バックテスト").replace(/\bLIVE\b/gi,"ライブ");
  t=t.replace(/\bHARD LOCK\b/gi,"ハードロック").replace(/\bLOCK\b/gi,"ロック");
  t=t.replace(/\bRESULT MODE\b/gi,"リザルトモード").replace(/\bSTRICT BLIND\b/gi,"ストリクトブラインド");
  t=t.replace(/\bST\b/g,"スタートタイミング");
  t=t.replace(/¥\s*([\d,]+)/g,"$1円").replace(/([0-9]+(?:\.[0-9]+)?)%/g,"$1パーセント");
  t=t.replace(/(\d{1,2})\/12\b/g,"12レース中、$1レース");
  // Turn dashboard shorthand into a calmer spoken report.
  t=t.replace(/バックテスト\s*(\d+)レース/g,"バックテストは、$1レース終了。");
  t=t.replace(/ライブ\s*(\d+)レース/g,"ライブは、$1レース終了。");
  t=t.replace(/回収率\s*([0-9]+(?:\.[0-9]+)?)パーセント/g,"回収率は、$1パーセント。");
  t=t.replace(/損益\s*\+\s*([\d,]+)円/g,"損益は、プラス$1円です。");
  t=t.replace(/損益\s*-\s*([\d,]+)円/g,"損益は、マイナス$1円です。");
  t=t.replace(/的中率\s*([0-9]+(?:\.[0-9]+)?)パーセント/g,"的中率は、$1パーセント。");
  t=t.replace(/。\s*/g,"。　").replace(/、\s*/g,"、 ");
  return t.trim();
}
function preferredJapaneseVoice(){
  const jp=cachedVoices.filter(v=>/^ja([-_]|$)/i.test(v.lang||""));
  const names=["Kyoko","Nanami","Siri","Japanese","Otoya"];
  for(const n of names){const v=jp.find(x=>(x.name||"").toLowerCase().includes(n.toLowerCase()));if(v)return v}
  return jp[0]||null;
}
function speakText(html){
  if(!speechOn||!("speechSynthesis" in window))return;
  const text=spokenJapanese(html);if(!text)return;
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);u.lang="ja-JP";
  const v=preferredJapaneseVoice();if(v)u.voice=v;
  u.rate=0.91;u.pitch=1.16;u.volume=1;
  speechSynthesis.speak(u);
}
function updateSpeakBtn(){if($("#speakBtn"))$("#speakBtn").textContent=speechOn?"🔊":"🔇"}
function send(q){
  q=(q||$("#prompt").value).trim();if(!q)return;addBubble(q,"user");$("#prompt").value="";
  setTimeout(()=>{const a=answer(q);addBubble(a,"ai");speakText(a)},180)
}
$("#speakBtn").onclick=()=>{speechOn=!speechOn;localStorage.setItem("boatCommand.speech",speechOn?"on":"off");updateSpeakBtn();if(speechOn)speakText("音声返答をオンにしました。")};
updateSpeakBtn();
$("#send").onclick=()=>send();$("#prompt").addEventListener("keydown",e=>{if(e.key==="Enter")send()});$$(".quick button").forEach(b=>b.onclick=()=>send(b.dataset.q));
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SR){
  const rec=new SR();rec.lang="ja-JP";rec.interimResults=false;
  rec.onstart=()=>$("#micBtn").classList.add("listening");rec.onend=()=>$("#micBtn").classList.remove("listening");
  rec.onresult=e=>send(e.results[0][0].transcript);$("#micBtn").onclick=()=>rec.start();
}else{$("#micBtn").onclick=()=>addBubble("このiPad環境ではWeb音声認識が使えません。入力欄でiPad標準のキーボード音声入力を使えます。","ai")}

renderAll();



function setGeneratorStatus(text,kind=""){
  const el=$("#generatorStatus");
  if(!el)return;
  el.textContent=text;
  el.className="generator-status "+kind;
}
async function runBlindGeneratorPipeline(){
  try{
    setGeneratorStatus("① GENERATOR START…","working");
    await new Promise(r=>setTimeout(r,0));
    const s=session(), state=appState(s);
    if(!s||!state.pack){
      setGeneratorStatus("FAILED · DATA GATE · 先にBACKTESTパックを読み込んでください","error");
      return;
    }
    if(["RETEST_RESULT","ORIGINAL_RESULT"].includes(state.kind)){
      setGeneratorStatus("RESULT済み · 先に「新規RETESTを開始」を押してください","warn");
      return;
    }

    setGeneratorStatus("② DATA GATE CHECK…","working");
    const eligible=s.races.filter(r=>replayPredictionGate(s,r).status!=="NO_PREDICTION");
    const skipped=s.races.filter(r=>replayPredictionGate(s,r).status==="NO_PREDICTION");
    if(!eligible.length){
      setGeneratorStatus("FAILED · DATA GATE · 予想対象レース0件","error");
      return;
    }

    setGeneratorStatus(`③ BLIND SCORE… · 対象 ${eligible.length}R / 見送り ${skipped.length}R`,"working");
    let made=0,failed=[];
    for(const r of eligible){
      if(r.locked)continue;
      const out=makeBlindPicks(s,r);
      if(!out||!Array.isArray(out.picks)||out.picks.length===0){
        failed.push(r.race);continue;
      }
      r.picks=out.picks;
      r.rationale=out.rationale;
      made++;
    }
    if(failed.length){
      setGeneratorStatus(`FAILED · PREDICTOR · ${failed.join(",")}R`,"error");
      return;
    }

    setGeneratorStatus(`④ PICKS GENERATED… · ${made}R`,"working");
    saveStore();
    renderAll();
    setGeneratorStatus(`④ PICKS GENERATED… · ${made}R`,"working");
    await new Promise(r=>requestAnimationFrame(r));

    const s2=session();
    const filled=s2.races.filter(r=>{
      if(replayPredictionGate(s2,r).status==="NO_PREDICTION")return false;
      return Array.isArray(r.picks)&&r.picks.filter(Boolean).length>0;
    }).length;
    const pickInputs=[...document.querySelectorAll("input.pick[data-r]")];
    const visibleFilled=pickInputs.length?s2.races.filter(r=>{
      if(replayPredictionGate(s2,r).status==="NO_PREDICTION")return false;
      const inputs=[...document.querySelectorAll(`input.pick[data-r="${r.race}"]`)];
      return inputs.length===4&&inputs.some(x=>x.value.trim());
    }).length:filled;
    if(filled!==eligible.length){
      setGeneratorStatus(`FAILED · DATA VERIFY · ${filled}/${eligible.length}R`,"error");
      return;
    }
    if(pickInputs.length&&visibleFilled!==eligible.length){
      setGeneratorStatus(`FAILED · VIEW VERIFY · ${visibleFilled}/${eligible.length}R`,"error");
      return;
    }
    setGeneratorStatus(`${s2.retestMode?"✓ RETEST READY TO LOCK":"✓ READY TO LOCK"} · ${filled}R予想 / ${skipped.length}R見送り · 結果未表示${s2.retestMode?" · 正式戦績対象外":""}`,"success");
  }catch(err){
    console.error(err);
    setGeneratorStatus(`FAILED · GENERATOR · ${err?.message||"UNKNOWN ERROR"}`,"error");
  }
}

document.addEventListener("click",(e)=>{
  const btn=e.target.closest?.("#generateBlindBtn");
  if(!btn)return;
  e.preventDefault();
  runBlindGeneratorPipeline();
});


$("#lockAllBtn").onclick=lockAllEligible;
