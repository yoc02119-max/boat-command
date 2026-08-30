const APP_KEY="boatCommand.v05";
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

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function dateISOInTokyo(d=new Date()){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
  const get=t=>parts.find(p=>p.type===t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
const todayISO=()=>dateISOInTokyo();
const money=n=>(n<0?"-":"")+"¥"+Math.abs(Math.round(n||0)).toLocaleString("ja-JP");
const pct=n=>Number.isFinite(n)?n.toFixed(1)+"%":"—";

function baseStore(){return {schema:5,venue:"蒲郡",startBankroll:START_BANKROLL,sessions:{}}}
function baseSession(date){return {date,venue:"蒲郡",mode:"STRICT",runType:"LIVE",strategyVersion:"GAMAGORI-V1.0",createdAt:new Date().toISOString(),races:Array.from({length:12},(_,i)=>({
  race:i+1,picks:["","","",""],locked:false,lockedAt:null,lockHash:null,stake:0,
  result:"",officialPayout100:0,refundAmount:0,settled:false,settledAt:null,returnAmount:0,profit:0,hit:false,rationale:"",missClass:""
}))}}

let store=loadStore();
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

function loadStore(){
  try{
    const x=JSON.parse(localStorage.getItem(APP_KEY));
    if(x&&x.schema===5&&x.sessions)return x;
  }catch(e){}
  return baseStore();
}
function saveStore(){localStorage.setItem(APP_KEY,JSON.stringify(store))}
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
function isResultMode(s=session()){return lockedCount(s)===12}
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
  for(const s of allSessions()){
    for(const r of s.races.filter(x=>x.settled)){
      bal+=r.profit;out.push({label:`${s.date.slice(5)} ${r.race}R`,value:bal});
    }
  }
  return out;
}
function allStats(filterType=null){
  const sessions=filterType?allSessions().filter(s=>s.runType===filterType):allSessions();
  const all=sessions.flatMap(s=>s.races.filter(r=>r.settled));
  const inv=all.reduce((a,r)=>a+r.stake,0),ret=all.reduce((a,r)=>a+r.returnAmount,0),hits=all.filter(r=>r.hit).length;
  const series=bankrollSeries(); let peak=series[0].value,maxdd=0;
  for(const p of series){peak=Math.max(peak,p.value);maxdd=Math.max(maxdd,peak-p.value)}
  return {races:all.length,hits,investment:inv,returns:ret,profit:ret-inv,hitRate:all.length?hits/all.length*100:NaN,roi:inv?ret/inv*100:NaN,maxdd,bankroll:series.at(-1).value};
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


function loadReplayPack20251215(){
  const pack=BACKTEST_PACKS["2025-12-15"];
  if(!pack){alert("BACKTESTパックが見つかりません");return;}
  const s=freshSession(pack.date);
  s.runType="BACKTEST";
  s.strategyVersion=s.strategyVersion||"GAMAGORI-V1.0";
  s.replayPackId=pack.id;
  s.replayRevealed=false;
  s.replayLoadedAt=new Date().toISOString();
  s.mode="STRICT";
  s.races=s.races||{};
  store.sessions[pack.date]=s;
  currentDate=pack.date;
  localStorage.setItem("boatCommand.lastDate",currentDate);
  saveStore();
  renderAll();
  setTimeout(()=>{document.getElementById("sessionDate")?.scrollIntoView({behavior:"smooth",block:"start"});},50);
}

function renderAll(){
  const s=session(),st=sessionStats(s),all=allStats(),lc=lockedCount(s),mode=isResultMode(s);
  const rt=$("#runType"),sv=$("#strategyVersion");
  if(rt){rt.value=s.runType||"LIVE";rt.disabled=lc>0||!!s.replayPackId}
  if(sv){sv.value=s.strategyVersion||"GAMAGORI-V1.0";sv.disabled=lc>0||!!s.replayPackId}
  if($("#sessionLockNote"))$("#sessionLockNote").textContent=lc>0?`🔒 ${s.runType} / ${s.strategyVersion} はこの日のLOCK記録として固定済み`:"1RでもLOCKすると区分と戦略バージョンは固定されます。";
  renderReplayControls(s);
  $("#kLocked").textContent=`${lc}/12`;
  $("#kHits").textContent=st.races?`${st.hits}/${st.races}`:"—";
  $("#kHitRate").textContent=st.races?pct(st.hitRate):"未精算";
  $("#kRoi").textContent=st.races?pct(st.roi):"—";
  $("#kProfit").textContent=st.races?money(st.profit):"¥0";
  setSign($("#kProfit"),st.profit);
  $("#summarySub").textContent=st.races?`${st.races}R精算済み`:(lc?`${lc}R LOCK済み`:"未開始");
  $("#todayStatus").textContent=st.races===12?"COMPLETE":mode?"RESULT MODE":"OPEN";
  $("#todayStatus").classList.toggle("done",st.races===12);
  $("#guardNote").textContent=mode?"全12R LOCK済み。RESULT MODEが解禁されています。":"全12RをLOCKするまで、結果入力は開きません。";
  $("#modeBadge").className="badge "+(mode?"result":"blind");
  $("#modeBadge").textContent=mode?`✓ RESULT · ${s.runType}`:`🔒 ${s.runType} · BLIND`;
  $("#bankrollNow").textContent=money(all.bankroll);
  $("#allRecord").textContent=`${all.races}戦 ${all.hits}的中`;
  $("#allHitRate").textContent=pct(all.hitRate);
  $("#allRoi").textContent=pct(all.roi);
  $("#allDd").textContent=money(-all.maxdd);
  renderRaceStrip(s);renderPredictions(s);renderResults(s);renderChart();renderAnalytics();renderReport();renderData();
}
function setSign(el,n){el.classList.remove("positive","negative");if(n>0)el.classList.add("positive");if(n<0)el.classList.add("negative")}
function renderRaceStrip(s){
  $("#raceStrip").innerHTML=s.races.map(r=>{
    let c="race-chip",label="OPEN";
    if(r.settled){c+=" settled "+(r.hit?"hit":"miss");label=r.hit?"HIT":"MISS"}
    else if(r.locked){c+=" locked";label="LOCK"}
    return `<div class="${c}"><b>${r.race}R</b><small>${label}</small></div>`
  }).join("");
}

function activeReplayPack(s=session()){return s.replayPackId?BACKTEST_PACKS[s.replayPackId]||null:null}
function renderReplayControls(s){
  const panel=$("#replayPanel");if(!panel)return;
  const pack=activeReplayPack(s), lc=lockedCount(s);
  panel.classList.toggle("active",!!pack);
  $("#loadReplayBtn").disabled=lc>0;
  $("#revealReplayBtn").classList.toggle("hidden",!(pack&&lc===12&&!s.replayRevealed));
  if(!pack){
    $("#replayStatus").textContent=s.runType==="BACKTEST"?"BACKTEST：パック未読込":"LIVEモード：必要なときだけ実レースパックを使用";
  }else if(s.replayRevealed){
    $("#replayStatus").textContent=`RESULT REVEALED · ${pack.date} · 12R一括精算済み`;
  }else{
    $("#replayStatus").textContent=`BLIND · ${pack.date} · ${lc}/12 LOCK · ${pack.snapshotLevel}`;
  }
}
function loadReplayPack(id){
  const pack=BACKTEST_PACKS[id];if(!pack)return;
  const existing=store.sessions[pack.date];
  if(existing&&(lockedCount(ensureSessionShape(existing))>0||settledRaces(existing).length>0)){
    if(!confirm(`${pack.date}には保存済みデータがあります。BACKTESTパックで初期化しますか？`))return;
  }
  const s=baseSession(pack.date);
  s.runType="BACKTEST";s.strategyVersion="GAMAGORI-V1.0";
  s.replayPackId=pack.id;s.replayRevealed=false;s.replayLoadedAt=new Date().toISOString();
  store.sessions[pack.date]=s;currentDate=pack.date;localStorage.setItem("boatCommand.lastDate",currentDate);saveStore();
  if($("#sessionDate"))$("#sessionDate").value=currentDate;
  renderAll();
  alert("実レースBACKTESTパックを読み込みました。公式結果は12RすべてLOCKするまで画面に表示されません。");
}
function revealAndSettleReplay(){
  const s=session(),pack=activeReplayPack(s);
  if(!pack||lockedCount(s)!==12||s.replayRevealed)return;
  if(!confirm("12RすべてHARD LOCK済みです。公式結果を解禁して一括精算しますか？"))return;
  for(const pr of pack.races){
    const r=s.races.find(x=>x.race===pr.race);if(r.settled)continue;
    r.result=pr.result;r.officialPayout100=pr.pay;r.refundAmount=0;
    r.hit=r.picks.filter(Boolean).includes(pr.result);
    r.returnAmount=r.hit?pr.pay*5:0;r.profit=r.returnAmount-r.stake;
    r.settled=true;r.settledAt=new Date().toISOString();r.note="BACKTEST REPLAY / OFFICIAL RESULT";
  }
  s.replayRevealed=true;s.replayRevealedAt=new Date().toISOString();saveStore();renderAll();showView("results");
}
$("#loadReplayBtn").onclick=()=>loadReplayPack("gamagori-2025-12-15");
$("#revealReplayBtn").onclick=revealAndSettleReplay;

function replaySnapshotHtml(s,r){
  const pack=activeReplayPack(s);
  if(!pack)return "";
  const raceNo=Number(r.race);
  const pr=pack.races.find(x=>Number(x.race)===raceNo);

  if(!pr){
    return `<div class="replay-snapshot integrity-warning">⚠ SNAPSHOT LINK ERROR · ${raceNo}R のパック情報を参照できません</div>`;
  }

  // 1R: verified FULL snapshot stored directly on race profile.
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

  // 2R, 4R-12R: verified before-info map.
  const verified=VERIFIED_BEFOREINFO_20251215[raceNo];
  if(verified){
    const rows=verified.rows.map((x,i)=>`<div class="verified-row">
      <div class="full-name"><b>${i+1}</b><span>${escapeHtml(x[0])}</span></div>
      <span>体重 <strong>${escapeHtml(x[1])}kg</strong></span>
      <span>展示 <strong>${escapeHtml(x[2])}</strong></span>
      <span>チルト <strong>${escapeHtml(x[3])}</strong></span>
      <span>展示ST <strong>${escapeHtml(x[4])}</strong></span>
    </div>`).join("");
    const w=verified.weather;
    return `<div class="replay-snapshot full-snapshot">
      <div class="snapshot-head"><span>PRE-RACE VERIFIED SNAPSHOT <em class="safe-badge">TIME-SAFE</em></span><b>${escapeHtml(pr.type)} · 締切 ${verified.deadline}${verified.fixedEntry?" · 進入固定":""}${verified.stableBoard?" · 安定板":""}</b></div>
      <div class="weather-strip"><span>${escapeHtml(w.label)}</span><span>${escapeHtml(w.condition)}</span><span>気温 ${escapeHtml(w.temp)}</span><span>水温 ${escapeHtml(w.water)}</span><span>風 ${escapeHtml(w.wind)}</span><span>波 ${escapeHtml(w.wave)}</span></div>
      <div class="verified-grid">${rows}</div>
      <div class="snapshot-note">締切前と確認できた公式直前情報のみ表示。「—」は確認不能のため欠損扱い。</div>
    </div>`;
  }

  // 3R: intentional hold. Do not invent unavailable values.
  return `<div class="replay-snapshot hold-snapshot">
    <div class="snapshot-head"><span>PRE-RACE SNAPSHOT <em class="hold-badge">INTEGRITY HOLD</em></span><b>${escapeHtml(pr.type)}</b></div>
    <div class="boat-grid">${pr.boats.map((name,i)=>`<div class="boat-chip"><b>${i+1}</b><span>${escapeHtml(name)}</span></div>`).join("")}</div>
    <div class="snapshot-note">詳細な公式直前情報を現在のアーカイブ取得経路で確認できていないため、値を推測せずENTRY BASELINEのまま保持。</div>
  </div>`;
}

function renderPredictions(s){
  const host=$("#predictionList"); if(!host)return;
  host.innerHTML=s.races.map(r=>{
    const picks=r.picks.map((p,i)=>`<input class="pick" data-r="${r.race}" data-i="${i}" ${r.locked?"disabled":""} value="${p||""}" placeholder="${i+1}点目 例 1-3-4">`).join("");
    return `<div class="race-card ${r.locked?"locked":""} ${activeReplayPack(s)?"replay-active":""}">
      <div class="race-head">
        <div><div class="race-no">${r.race}R</div><div class="race-meta">${r.locked?`LOCK ${fmtTime(r.lockedAt)} / ID ${r.lockHash}`:"未確定"}</div></div>
        <div class="stake">${r.locked?money(r.stake):"最大 ¥2,000"}</div>
      </div>
      ${replaySnapshotHtml(s,r)}
      <div class="pick-grid">${picks}</div>
      <div class="reason-box"><label>予想根拠（LOCK時に固定）</label><textarea data-reason="${r.race}" ${r.locked?"disabled":""} placeholder="例：1の展示気配良、3カド攻め想定">${r.rationale||""}</textarea></div>
      <div class="race-actions">${r.locked?`<span class="unlock-note">🔒 HARD LOCK済み</span>`:`<button class="lock-btn" data-lock="${r.race}">HARD LOCK</button>`}</div>
    </div>`
  }).join("");
  $$(".pick").forEach(inp=>{
    inp.addEventListener("change",e=>{
      const r=s.races.find(x=>x.race===+e.target.dataset.r); if(r.locked)return;
      r.picks[+e.target.dataset.i]=normalizePick(e.target.value);saveStore();renderPredictions(s);
    });
  });
  $$("[data-reason]").forEach(inp=>inp.addEventListener("change",e=>{
    const r=s.races.find(x=>x.race===+e.target.dataset.reason);if(r.locked)return;
    r.rationale=e.target.value.trim();saveStore();
  }));
  $$("[data-lock]").forEach(b=>b.onclick=()=>lockRace(+b.dataset.lock));
  $("#lockAllBtn").disabled=lockedCount(s)===12;
}
async function lockRace(n){
  const s=session(),r=s.races.find(x=>x.race===n);if(r.locked)return;
  let picks=r.picks.map(normalizePick).filter(Boolean);
  if(!picks.length){alert(`${n}Rの買い目を入力してください。`);return}
  if(picks.length>MAX_PICKS||!picks.every(validPick)){alert("買い目は最大4点。「1-3-4」の形式で、同じ艇番は重複できません。");return}
  if(new Set(picks).size!==picks.length){alert("同じ買い目が重複しています。");return}
  r.picks=[...picks,...Array(MAX_PICKS-picks.length).fill("")];
  r.stake=picks.length*PICK_PRICE;r.lockedAt=new Date().toISOString();
  r.lockHash=await digest(`${s.date}|${s.runType}|${s.strategyVersion}|${r.race}|${picks.join(",")}|${r.rationale||""}|${r.stake}|${r.lockedAt}`);
  r.locked=true;saveStore();renderAll();
}
$("#lockAllBtn").onclick=async()=>{
  const s=session();
  const open=s.races.filter(r=>!r.locked);
  if(!open.length)return;
  for(const r of open){
    const picks=r.picks.map(normalizePick).filter(Boolean);
    if(!picks.length||!picks.every(validPick)||new Set(picks).size!==picks.length){alert(`${r.race}Rの買い目を確認してください。一括LOCKを中止しました。`);return}
  }
  if(!confirm(`入力済みの${open.length}レースをHARD LOCKします。LOCK後は変更できません。よろしいですか？`))return;
  for(const r of open)await lockRace(r.race);
}
function renderResults(s){
  const replay=activeReplayPack(s);
  const open=isResultMode(s);
  const displayOpen=open&&(!replay||s.replayRevealed);
  $("#resultGate").classList.toggle("hidden",displayOpen);
  $("#resultList").classList.toggle("hidden",!displayOpen);
  $("#resultGateBadge").className="badge "+(displayOpen?"result":"blind");
  $("#resultGateBadge").textContent=displayOpen?"✓ RESULT MODE":(replay&&open?"🔐 REVEAL待ち":"LOCK待ち");
  if(replay&&open&&!s.replayRevealed){
    $("#resultGate").innerHTML=`<div class="gate-icon">🔐</div><h3>12R HARD LOCK完了</h3><p>公式結果はまだ非表示です。予想画面の「12R結果を解禁・一括精算」で初めて結果を開きます。</p>`;
  }
  if(!displayOpen)return;
  $("#resultList").innerHTML=s.races.map(r=>{
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
    </div>`
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
  for(const s of allSessions())for(const r of s.races.filter(x=>x.settled)){
    const picks=r.picks.filter(Boolean), per=PICK_PRICE;
    for(const p of picks){const idx=+p[0]-1;rows[idx].inv+=per;if(r.hit&&p===r.result)rows[idx].ret+=r.returnAmount}
  }
  return rows.map(x=>({name:x.name,value:x.inv?x.ret/x.inv*100:0,empty:!x.inv}));
}
function aggregateWinners(){
  const counts=Array(6).fill(0);let total=0;
  for(const s of allSessions())for(const r of s.races.filter(x=>x.settled)){counts[+r.result[0]-1]++;total++}
  return counts.map((c,i)=>({name:`${i+1}号艇`,value:total?c/total*100:0,empty:!total}));
}
function renderBars(id,rows){
  const el=$(id);if(!el)return;
  el.innerHTML=rows.map(r=>`<div class="bar-row"><span>${r.name}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,r.value)}%"></div></div><span class="bar-value">${r.empty?"—":r.value.toFixed(1)+"%"}</span></div>`).join("");
}
function renderAnalytics(){
  renderBars("#headBoatBars",aggregateHeadBoat());renderBars("#winnerBars",aggregateWinners());
  const rows=allSessions().slice().reverse().map(s=>{const x=sessionStats(s);return `<tr><td>${s.date}</td><td>${s.runType}</td><td>${s.strategyVersion}</td><td>${x.races}/12</td><td>${x.hits}</td><td>${pct(x.hitRate)}</td><td>${pct(x.roi)}</td><td class="${x.profit>=0?"positive":"negative"}">${money(x.profit)}</td></tr>`}).join("");
  $("#historyTable").innerHTML=`<table class="tbl"><thead><tr><th>日付</th><th>区分</th><th>戦略</th><th>精算</th><th>的中</th><th>的中率</th><th>回収率</th><th>損益</th></tr></thead><tbody>${rows||'<tr><td colspan="8">まだ精算データがありません</td></tr>'}</tbody></table>`;
  const bt=allStats("BACKTEST"),lv=allStats("LIVE");
  $("#modeCompare").innerHTML=[["BACKTEST",bt],["LIVE",lv]].map(([name,x])=>`<div class="compare-card"><h3>${name}</h3><div class="mini"><div><span>RACE</span><b>${x.races}</b></div><div><span>HIT</span><b>${pct(x.hitRate)}</b></div><div><span>ROI</span><b>${pct(x.roi)}</b></div><div><span>P/L</span><b class="${x.profit>=0?"positive":"negative"}">${money(x.profit)}</b></div></div></div>`).join("");
}
function reportData(){
  const all=allStats(),head=aggregateHeadBoat().filter(x=>!x.empty).sort((a,b)=>b.value-a.value),wins=aggregateWinners().filter(x=>!x.empty).sort((a,b)=>b.value-a.value);
  if(!all.races)return [
    ["現在地","まだ精算データがありません。まず1日分をBLIND予想→LOCK→精算すると分析が始まります。"],
    ["運用ルール","結果入力は全12R LOCK後のみ解禁。LOCK時刻と簡易ハッシュを保存します。"],
    ["次の重点","BACKTESTとLIVEを混ぜずに蓄積し、過去検証と本番再現性を比較します。"]
  ];
  const best=head[0],winner=wins[0],trend=all.roi>=100?"累計回収率は100%を上回っています。":"累計回収率は100%未満です。サンプルを増やして原因を分解します。";
  return [
    ["現在地",`${all.races}R精算、${all.hits}的中。的中率${pct(all.hitRate)}、回収率${pct(all.roi)}。${trend}`],
    ["買い目傾向",best?`${best.name}の買い目回収率が現状トップで${best.value.toFixed(1)}%。件数が少ない段階では過信しません。`:"買い目別の比較にはもう少しデータが必要です。"],
    ["結果傾向",winner?`結果1着は${winner.name}が最も多く、構成比${winner.value.toFixed(1)}%。今後は風・展示・モーターも別軸で追加します。`:"結果分布はまだありません。"]
  ];
}
function renderReport(){
  $("#reportCards").innerHTML=reportData().map(x=>`<article class="report-card"><h3>${x[0]}</h3><p>${x[1]}</p></article>`).join("");
}
$("#refreshReport").onclick=renderReport;
function fmtTime(v){if(!v)return"—";try{return new Date(v).toLocaleString("ja-JP",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"})}catch{return v}}
const MISS_CLASSES=[
 ["","未分類"],["A","A：1着読み違い"],["B","B：2着読み違い"],["C","C：3着抜け"],["D","D：進入"],["E","E：ST"],["F","F：モーター"],["G","G：展示"],["H","H：荒れ・想定外"]
];
function missOptions(v){return MISS_CLASSES.map(([k,n])=>`<option value="${k}" ${v===k?"selected":""}>${n}</option>`).join("")}
function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderData(){
  const s=session();$("#sessionInfo").textContent=`${s.date} / ${s.runType} / ${s.strategyVersion} / LOCK ${lockedCount(s)}/12 / 精算 ${settledRaces(s).length}/12`;
  $("#auditTable").innerHTML=`<table class="tbl"><thead><tr><th>R</th><th>状態</th><th>LOCK時刻</th><th>LOCK ID</th></tr></thead><tbody>${s.races.map(r=>`<tr><td>${r.race}R</td><td>${r.settled?"精算済":r.locked?"LOCK":"OPEN"}</td><td>${fmtTime(r.lockedAt)}</td><td>${r.lockHash||"—"}</td></tr>`).join("")}</tbody></table>`;
}
$("#exportBtn").onclick=()=>{
  const payload={exportedAt:new Date().toISOString(),exportDateJST:todayISO(),app:"BOAT COMMAND",version:"0.10",data:store};
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


document.addEventListener("click",(e)=>{
  const btn=e.target.closest?.("#loadReplayPack,[data-action='load-replay-pack']");
  if(!btn)return;
  e.preventDefault();
  loadReplayPack20251215();
});
