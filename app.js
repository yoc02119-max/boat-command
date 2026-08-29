const APP_KEY="boatCommand.v05";
const START_BANKROLL=100000;
const PICK_PRICE=500;
const MAX_PICKS=4;

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
function baseSession(date){return {date,venue:"蒲郡",mode:"STRICT",strategyVersion:"GAMAGORI-v0.6",createdAt:new Date().toISOString(),races:Array.from({length:12},(_,i)=>({
  race:i+1,picks:["","","",""],locked:false,lockedAt:null,lockHash:null,stake:0,
  result:"",officialPayout100:0,settled:false,settledAt:null,returnAmount:0,profit:0,hit:false
}))}}

let store=loadStore();
let currentDate=todayISO();

function loadStore(){
  try{
    const x=JSON.parse(localStorage.getItem(APP_KEY));
    if(x&&x.schema===5&&x.sessions)return x;
  }catch(e){}
  return baseStore();
}
function saveStore(){localStorage.setItem(APP_KEY,JSON.stringify(store))}
function session(date=currentDate){
  if(!store.sessions[date]){store.sessions[date]=baseSession(date);saveStore()}
  return store.sessions[date];
}
function allSessions(){return Object.values(store.sessions).sort((a,b)=>a.date.localeCompare(b.date))}
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
function allStats(){
  const all=allSessions().flatMap(s=>s.races.filter(r=>r.settled));
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

function renderAll(){
  const s=session(),st=sessionStats(s),all=allStats(),lc=lockedCount(s),mode=isResultMode(s);
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
  $("#modeBadge").textContent=mode?"✓ RESULT MODE":"🔒 BLIND MODE";
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
function renderPredictions(s){
  const host=$("#predictionList"); if(!host)return;
  host.innerHTML=s.races.map(r=>{
    const picks=r.picks.map((p,i)=>`<input class="pick" data-r="${r.race}" data-i="${i}" ${r.locked?"disabled":""} value="${p||""}" placeholder="${i+1}点目 例 1-3-4">`).join("");
    return `<div class="race-card ${r.locked?"locked":""}">
      <div class="race-head">
        <div><div class="race-no">${r.race}R</div><div class="race-meta">${r.locked?`LOCK ${fmtTime(r.lockedAt)} / ID ${r.lockHash}`:"未確定"}</div></div>
        <div class="stake">${r.locked?money(r.stake):"最大 ¥2,000"}</div>
      </div>
      <div class="pick-grid">${picks}</div>
      <div class="race-actions">${r.locked?`<span class="unlock-note">🔒 HARD LOCK済み</span>`:`<button class="lock-btn" data-lock="${r.race}">HARD LOCK</button>`}</div>
    </div>`
  }).join("");
  $$(".pick").forEach(inp=>{
    inp.addEventListener("change",e=>{
      const r=s.races.find(x=>x.race===+e.target.dataset.r); if(r.locked)return;
      r.picks[+e.target.dataset.i]=normalizePick(e.target.value);saveStore();renderPredictions(s);
    });
  });
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
  r.lockHash=await digest(`${s.date}|${r.race}|${picks.join(",")}|${r.stake}|${r.lockedAt}`);
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
  const open=isResultMode(s);
  $("#resultGate").classList.toggle("hidden",open);
  $("#resultList").classList.toggle("hidden",!open);
  $("#resultGateBadge").className="badge "+(open?"result":"blind");
  $("#resultGateBadge").textContent=open?"✓ RESULT MODE":"LOCK待ち";
  if(!open)return;
  $("#resultList").innerHTML=s.races.map(r=>{
    if(r.settled)return `<div class="race-card locked">
      <div class="race-head"><div><div class="race-no">${r.race}R</div><div class="race-meta">精算 ${fmtTime(r.settledAt)}</div></div><div class="stake">${r.hit?"🎯 HIT":"MISS"}</div></div>
      <div class="settled-box"><div><span>結果</span><b>${r.result}</b></div><div><span>投資</span><b>${money(r.stake)}</b></div><div><span>払戻</span><b>${money(r.returnAmount)}</b></div><div><span>損益</span><b class="${r.profit>=0?"positive":"negative"}">${money(r.profit)}</b></div></div>
    </div>`;
    return `<div class="race-card">
      <div class="race-head"><div><div class="race-no">${r.race}R</div><div class="race-meta">LOCK買い目 ${r.picks.filter(Boolean).join(" / ")}</div></div><div class="stake">投資 ${money(r.stake)}</div></div>
      <div class="result-fields">
        <div class="field"><label>結果（例 1-3-4）</label><input data-result="${r.race}" placeholder="1-3-4"></div>
        <div class="field"><label>3連単払戻 / 100円</label><input data-pay="${r.race}" type="number" inputmode="numeric" min="0" placeholder="例 2270"></div>
        <div class="field"><label>メモ（任意）</label><input data-note="${r.race}" placeholder="例 逃げ / まくり差し"></div>
        <button class="settle-btn" data-settle="${r.race}">精算確定</button>
      </div>
    </div>`
  }).join("");
  $$("[data-settle]").forEach(b=>b.onclick=()=>settleRace(+b.dataset.settle));
}
function settleRace(n){
  const s=session(),r=s.races.find(x=>x.race===n);if(!isResultMode(s)||r.settled)return;
  const result=normalizePick($(`[data-result="${n}"]`).value),pay=+$(`[data-pay="${n}"]`).value;
  if(!validPick(result)){alert("結果を「1-3-4」の形式で入力してください。");return}
  if(!Number.isFinite(pay)||pay<0){alert("払戻金を確認してください。");return}
  const hit=r.picks.filter(Boolean).includes(result);
  if(hit && pay<=0){alert("的中買い目なので、3連単の公式払戻（100円あたり）を入力してください。");return}
  r.result=result;r.officialPayout100=pay;r.hit=hit;r.returnAmount=hit?pay*5:0;r.profit=r.returnAmount-r.stake;
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
  const rows=allSessions().slice().reverse().map(s=>{const x=sessionStats(s);return `<tr><td>${s.date}</td><td>${x.races}/12</td><td>${x.hits}</td><td>${pct(x.hitRate)}</td><td>${pct(x.roi)}</td><td class="${x.profit>=0?"positive":"negative"}">${money(x.profit)}</td></tr>`}).join("");
  $("#historyTable").innerHTML=`<table class="tbl"><thead><tr><th>日付</th><th>精算</th><th>的中</th><th>的中率</th><th>回収率</th><th>損益</th></tr></thead><tbody>${rows||'<tr><td colspan="6">まだ精算データがありません</td></tr>'}</tbody></table>`;
}
function reportData(){
  const all=allStats(),head=aggregateHeadBoat().filter(x=>!x.empty).sort((a,b)=>b.value-a.value),wins=aggregateWinners().filter(x=>!x.empty).sort((a,b)=>b.value-a.value);
  if(!all.races)return [
    ["現在地","まだ精算データがありません。まず1日分をBLIND予想→LOCK→精算すると分析が始まります。"],
    ["運用ルール","結果入力は全12R LOCK後のみ解禁。LOCK時刻と簡易ハッシュを保存します。"],
    ["次の重点","蒲郡データだけを蓄積し、他場データとは混ぜずに比較できる土台です。"]
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
function renderData(){
  const s=session();$("#sessionInfo").textContent=`${s.date} / LOCK ${lockedCount(s)}/12 / 精算 ${settledRaces(s).length}/12`;
  $("#auditTable").innerHTML=`<table class="tbl"><thead><tr><th>R</th><th>状態</th><th>LOCK時刻</th><th>LOCK ID</th></tr></thead><tbody>${s.races.map(r=>`<tr><td>${r.race}R</td><td>${r.settled?"精算済":r.locked?"LOCK":"OPEN"}</td><td>${fmtTime(r.lockedAt)}</td><td>${r.lockHash||"—"}</td></tr>`).join("")}</tbody></table>`;
}
$("#exportBtn").onclick=()=>{
  const payload={exportedAt:new Date().toISOString(),exportDateJST:todayISO(),app:"BOAT COMMAND",version:"0.6",data:store};
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
$("#sessionDate").value=currentDate;
$("#sessionDate").onchange=e=>{currentDate=e.target.value||todayISO();session();renderAll()}

function addBubble(text,type){const b=document.createElement("div");b.className=`bubble ${type}`;b.innerHTML=text;$("#chat").appendChild(b);$("#chat").scrollTop=$("#chat").scrollHeight}
function answer(q){
  const s=session(),st=sessionStats(s),all=allStats(),t=q.replace(/\s/g,"");
  if(/今日|どう|成績/.test(t)){
    if(!st.races)return `今日はまだ精算前です。現在 <strong>${lockedCount(s)}/12R</strong> がLOCK済みです。`;
    return `今日は <strong>${st.races}R精算・${st.hits}的中</strong>。回収率は <strong>${pct(st.roi)}</strong>、損益は <strong>${money(st.profit)}</strong> です。`;
  }
  if(/ロック|LOCK|予想/.test(t)){showView("predict");return `現在 <strong>${lockedCount(s)}/12R</strong> LOCK済みです。予想画面を開きました。`}
  if(/資金|推移/.test(t)){showView("home");return `現在の累計仮想資金は <strong>${money(all.bankroll)}</strong>。最大ドローダウンは <strong>${money(-all.maxdd)}</strong> です。`}
  if(/弱点|原因|分析|悪/.test(t)){showView("assistant");return reportData()[0][1]+" "+reportData()[1][1]}
  if(/結果|精算/.test(t)){showView("results");return isResultMode(s)?"RESULT MODEを開きました。":"まだ12RすべてLOCKされていないため、結果入力は閉じています。"}
  return `質問を受け取りました。無料版では「今日どう？」「ロック状況」「資金推移」「弱点は？」「精算を開いて」に対応しています。`;
}
function send(q){
  q=(q||$("#prompt").value).trim();if(!q)return;addBubble(q,"user");$("#prompt").value="";setTimeout(()=>addBubble(answer(q),"ai"),180)
}
$("#send").onclick=()=>send();$("#prompt").addEventListener("keydown",e=>{if(e.key==="Enter")send()});$$(".quick button").forEach(b=>b.onclick=()=>send(b.dataset.q));
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SR){
  const rec=new SR();rec.lang="ja-JP";rec.interimResults=false;
  rec.onstart=()=>$("#micBtn").classList.add("listening");rec.onend=()=>$("#micBtn").classList.remove("listening");
  rec.onresult=e=>send(e.results[0][0].transcript);$("#micBtn").onclick=()=>rec.start();
}else{$("#micBtn").onclick=()=>addBubble("このiPad環境ではWeb音声認識が使えません。入力欄でiPad標準のキーボード音声入力を使えます。","ai")}

renderAll();
