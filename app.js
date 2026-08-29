const DATA = {
  balance:[100000,96500,101500,98000,104000,109000,103500,111000,107000,115500,109500,118000,112500,121000,114000,108000,102500,98600,94400,82600],
  courses:[92,101,135,118,123,87],
  methods:[["逃げ",98],["差し",112],["まくり",135],["まくり差し",128],["抜き",95],["恵まれ",102]],
  misses:[["3着抜け",42],["1着読み違い",24],["進入違い",14],["ST評価",11],["その他",9]],
  races:[
    ["1R","1-3-4 / 1-4-3 / 3-1-4 / 3-4-1","¥2,000","LOCK"],
    ["2R","1-2-5 / 1-5-2 / 5-1-2 / 5-2-1","¥2,000","LOCK"],
    ["3R","3-5-1 / 3-1-5 / 5-3-1 / 5-1-3","¥2,000","LOCK"],
    ["4R","6-3-4 / 6-4-3 / 3-6-4 / 3-4-6","¥2,000","LOCK"],
    ["5R","4-1-6 / 4-6-1 / 1-4-6 / 1-6-4","¥2,000","LOCK"],
    ["6R","2-6-1 / 2-1-6 / 6-2-1 / 6-1-2","¥2,000","LOCK"],
    ["7R","1-3-4 / 3-1-4 / 3-4-1 / 1-4-3","¥2,000","LOCK"],
    ["8R","1-5-4 / 1-4-5 / 5-1-4 / 5-4-1","¥2,000","LOCK"],
    ["9R","1-4-2 / 1-2-4 / 4-1-2 / 4-2-1","¥2,000","LOCK"],
    ["10R","1-4-5 / 1-5-4 / 4-1-5 / 4-5-1","¥2,000","LOCK"],
    ["11R","1-4-5 / 1-5-4 / 4-1-5 / 4-5-1","¥2,000","LOCK"],
    ["12R","1-4-5 / 4-1-5 / 4-5-1 / 5-4-1","¥2,000","LOCK"]
  ]
};

const qs=s=>document.querySelector(s), qsa=s=>[...document.querySelectorAll(s)];

function switchView(id){
  qsa(".view").forEach(v=>v.classList.toggle("active",v.id===id));
  qsa(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
  const titles={home:"おはよう。今日は蒲郡を見ます。",today:"今日の12R予想",analytics:"蒲郡データ分析",ai:"蒲郡担当AIレポート"};
  qs("#view-title").textContent=titles[id]||"BOAT COMMAND";
}
qsa(".nav-btn").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
qsa("[data-view-jump]").forEach(b=>b.onclick=()=>switchView(b.dataset.viewJump));

function drawLine(){
  const svg=qs("#balanceChart"), w=720,h=260,p=22, arr=DATA.balance;
  const min=Math.min(...arr)*0.94, max=Math.max(...arr)*1.04;
  const x=i=>p+(w-2*p)*i/(arr.length-1);
  const y=v=>h-p-(h-2*p)*(v-min)/(max-min);
  const pts=arr.map((v,i)=>[x(i),y(v)]);
  const d=pts.map((q,i)=>(i?"L":"M")+q[0].toFixed(1)+" "+q[1].toFixed(1)).join(" ");
  const area=d+` L ${x(arr.length-1)} ${h-p} L ${x(0)} ${h-p} Z`;
  svg.innerHTML=`<defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#18d9ff" stop-opacity=".28"/><stop offset="100%" stop-color="#18d9ff" stop-opacity="0"/></linearGradient></defs>
  <line class="axis" x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}"/>
  <path class="area" d="${area}"/><path class="line" d="${d}"/>
  ${pts.filter((_,i)=>i%4===0||i===pts.length-1).map(q=>`<circle class="point" cx="${q[0]}" cy="${q[1]}" r="4"/>`).join("")}`;
}

function bars(el, rows, suffix="%"){
  el.innerHTML=rows.map((r,i)=>{
    const name=Array.isArray(r)?r[0]:`${i+1}コース`;
    const val=Array.isArray(r)?r[1]:r;
    const width=Math.min(100,val/1.4);
    return `<div class="bar-row"><span>${name}</span><div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div><span class="bar-val">${val}${suffix}</span></div>`
  }).join("");
}
bars(qs("#courseBars"),DATA.courses);
bars(qs("#methodBars"),DATA.methods);

qs("#raceStrip").innerHTML=DATA.races.map((r,i)=>`<div class="race-chip lock">${i+1}R<br><small>LOCK</small></div>`).join("");
qs("#raceTable").innerHTML=DATA.races.map(r=>`<div class="race-row"><div class="race-no">${r[0]}</div><div class="picks">${r[1]}</div><div class="money">${r[2]}</div><div class="state">🔒 ${r[3]}</div></div>`).join("");

function donut(){
  let acc=0; const colors=["#18d9ff","#8e64ff","#ffc53d","#ff5e7a","#25e58a"];
  const stops=DATA.misses.map((r,i)=>{const s=acc,e=acc+r[1];acc=e;return `${colors[i]} ${s}% ${e}%`});
  qs("#donut").style.background=`conic-gradient(${stops.join(",")})`;
  qs("#donutLegend").innerHTML=DATA.misses.map((r,i)=>`<div class="legend-row"><span>${r[0]}</span><strong>${r[1]}%</strong></div>`).join("");
}
donut(); drawLine();

function addBubble(text,type){
  const b=document.createElement("div"); b.className=`bubble ${type}`; b.innerHTML=text;
  qs("#chat").appendChild(b); qs("#chat").scrollTop=qs("#chat").scrollHeight;
}
function reply(q){
  const t=q.replace(/\s/g,"");
  if(/今日|成績|どう/.test(t)){
    addBubble("現在のサンプル表示では、4R終了時点で2的中、回収率128%、損益は<strong>+2,240円</strong>です。<br>実データ接続後は、この部分を当日のDBから自動集計します。","ai");
  }else if(/資金|推移|グラフ/.test(t)){
    addBubble("資金推移を表示します。現在残高は<strong>82,600円</strong>というサンプル設定です。","ai");
    switchView("home"); setTimeout(()=>qs("#balanceChart").scrollIntoView({behavior:"smooth",block:"center"}),80);
  }else if(/予想|買い目|12R/.test(t)){
    addBubble("今日の12R予想を開きます。各R最大4点、HARD LOCKの状態が確認できます。","ai");
    switchView("today");
  }else if(/弱点|悪い|原因|負け/.test(t)){
    addBubble("サンプル上の最大課題は<strong>3着抜け</strong>です。失敗要因の42%を占める想定で、3着評価ロジックを改善対象にします。","ai");
    switchView("analytics");
  }else{
    addBubble("その質問は受け取りました。v0.1では「今日どう？」「資金推移」「予想を見せて」「弱点は？」に対応しています。","ai");
  }
}
function send(q){
  q=(q||qs("#promptInput").value).trim(); if(!q)return;
  addBubble(q,"user"); qs("#promptInput").value=""; setTimeout(()=>reply(q),280);
}
qs("#sendBtn").onclick=()=>send();
qs("#promptInput").addEventListener("keydown",e=>{if(e.key==="Enter")send()});
qsa(".quick").forEach(b=>b.onclick=()=>send(b.dataset.q));

const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SpeechRecognition){
  const rec=new SpeechRecognition(); rec.lang="ja-JP"; rec.interimResults=false;
  rec.onstart=()=>qs("#micBtn").classList.add("listening");
  rec.onend=()=>qs("#micBtn").classList.remove("listening");
  rec.onresult=e=>{const q=e.results[0][0].transcript; send(q)};
  qs("#micBtn").onclick=()=>rec.start();
}else{
  qs("#micBtn").onclick=()=>addBubble("このブラウザでは音声認識APIが利用できないため、下の入力欄を使ってください。iPadでの音声方式は次工程で最適化します。","ai");
}
