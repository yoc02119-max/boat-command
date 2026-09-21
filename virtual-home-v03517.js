// BOAT COMMAND GAMAGORI virtual bankroll home v0.35.17
// Presentation-only home dashboard for simulated funds. No real-money actions.
(()=>{'use strict';
const VERSION='GAMAGORI-VIRTUAL-HOME-V0.35.17';
const PICK_PRICE=500;
const yen=v=>{const n=Number(v)||0;return (n<0?'-':'')+'¥'+Math.abs(Math.round(n)).toLocaleString('ja-JP')};
const pct=v=>Number.isFinite(Number(v))?Number(v).toFixed(1)+'%':'—';
function today(){
 try{return session()}catch{return null}
}
function metrics(){
 const s=today(),races=Array.isArray(s?.races)?s.races:[];
 const t=typeof bcVirtualTryLedger==='function'?bcVirtualTryLedger():{
   todayCommittedStakeYen:0,todayPendingStakeYen:0,todaySettledStakeYen:0,todayReturnYen:0,
   todayProfitYen:0,todayHits:0,todaySettledRaces:0,todayPendingRaces:0,currentTryRaces:[]
 };
 const committed=Number(t.todayCommittedStakeYen)||0;
 const pending=Number(t.todayPendingStakeYen)||0;
 const settledStake=Number(t.todaySettledStakeYen)||0;
 const returned=Number(t.todayReturnYen)||0;
 const profit=Number(t.todayProfitYen)||0;
 const hits=Number(t.todayHits)||0;
 const settledCount=Number(t.todaySettledRaces)||0;
 const pendingCount=Number(t.todayPendingRaces)||0;
 const roi=settledStake?returned/settledStake*100:null;
 const hitRate=settledCount?hits/settledCount*100:null;
 const bankroll=typeof bcVirtualBankrollNow==='function'?bcVirtualBankrollNow():(Number(store?.startBankroll)||100000)+profit;
 const start=(Number(store?.startBankroll)||100000)+(typeof bcVirtualDepositTotal==='function'?bcVirtualDepositTotal():0);
 return {s,races,lockedStake:committed,pendingStake:pending,settledStake,returned,profit,hits,settledCount,pendingCount,roi,hitRate,planned:0,bankroll,start,tryCommitted:committed};
}
function chartSvg(){
 const rows=typeof bankrollSeries==='function'?bankrollSeries():[];
 const vals=rows.map(x=>Number(x.value)).filter(Number.isFinite);
 if(!vals.length)return '<div class="vh-empty">資金履歴待ち</div>';
 const w=720,h=180,p=16,min=Math.min(...vals),max=Math.max(...vals),span=Math.max(1,max-min);
 const pts=vals.map((v,i)=>{const x=p+(w-p*2)*(vals.length===1?.5:i/(vals.length-1));const y=h-p-(h-p*2)*(v-min)/span;return [x,y]});
 const path=pts.map((q,i)=>(i?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' ');
 const area=pts.length>1?`M${pts[0][0].toFixed(1)} ${(h-p).toFixed(1)} L${pts.map(q=>q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' L')} L${pts.at(-1)[0].toFixed(1)} ${(h-p).toFixed(1)} Z`:'';
 return `<svg class="vh-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="仮資金推移"><path class="vh-area" d="${area}"></path><path class="vh-line" d="${path}"></path>${pts.map(q=>`<circle cx="${q[0]}" cy="${q[1]}" r="3"></circle>`).join('')}</svg>`;
}
function transactions(){
 const rows=typeof bankrollSeries==='function'?bankrollSeries():[];
 if(rows.length<=1)return '<div class="vh-empty">まだ資金移動はありません</div>';
 return rows.slice(1).map((x,i,arr)=>{const globalIndex=rows.length-arr.length+i;const prev=rows[globalIndex-1];const delta=Number(x.value)-Number(prev?.value||x.value);return `<div class="vh-tx"><span>${String(x.label||'')}</span><b class="${delta>0?'up':delta<0?'down':''}">${delta>0?'+':''}${yen(delta)}</b><em>${yen(x.value)}</em></div>`}).slice(-5).reverse().join('');
}
function installStyle(){
 if(document.getElementById('bcVirtualHomeStyle'))return;
 const st=document.createElement('style');st.id='bcVirtualHomeStyle';
 st.textContent=`
#bcVirtualHome{margin-bottom:14px;padding:16px;border:1px solid rgba(83,226,255,.2);border-radius:16px;background:linear-gradient(180deg,rgba(9,31,49,.96),rgba(5,18,30,.94));overflow:hidden}
.vh-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.vh-kicker{font-size:9px;letter-spacing:.16em;color:#74bad8}.vh-head h2{font-size:20px;margin:3px 0 0}.vh-safe{font-size:9px;font-weight:900;color:#79e7bb;border:1px solid rgba(65,222,164,.3);border-radius:999px;padding:5px 8px;white-space:nowrap}
.vh-main{display:grid;grid-template-columns:minmax(240px,.8fr) minmax(0,1.4fr);gap:14px;margin-top:14px}.vh-balance,.vh-graph{border:1px solid rgba(255,255,255,.08);border-radius:13px;background:rgba(255,255,255,.025);padding:14px}.vh-balance small,.vh-graph small{display:block;font-size:9px;color:#7895aa}.vh-balance strong{display:block;font-size:34px;line-height:1.05;margin:5px 0 6px;color:#8fe8ff;letter-spacing:-.03em}.vh-balance p{margin:0;font-size:9px;color:#647f93;line-height:1.5}
.vh-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:10px}.vh-kpis>div{padding:10px;border-radius:10px;background:rgba(255,255,255,.035);min-width:0}.vh-kpis span{display:block;font-size:8px;color:#7895aa;margin-bottom:4px}.vh-kpis b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vh-kpis .profit.up b{color:#79e7bb}.vh-kpis .profit.down b{color:#ff8997}.vh-money-kpis{display:grid;grid-template-columns:1fr;gap:5px}.vh-money-kpis>div{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:8px 10px}.vh-money-kpis span{margin:0;font-size:9px;white-space:nowrap}.vh-money-kpis b{font-size:15px;overflow:visible;text-overflow:clip;text-align:right}
.vh-chart{width:100%;height:145px;margin-top:7px;overflow:visible}.vh-line{fill:none;stroke:#73d9ff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.vh-area{fill:rgba(83,226,255,.08)}.vh-chart circle{fill:#8fe8ff;stroke:#071726;stroke-width:2}
.vh-bottom{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.vh-txs,.vh-actions{border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:12px;background:rgba(255,255,255,.02)}.vh-title{font-size:10px;font-weight:900;color:#bcd4e4;margin-bottom:8px}.vh-tx{display:grid;grid-template-columns:1fr auto auto;gap:9px;align-items:center;padding:6px 0;border-top:1px solid rgba(255,255,255,.045);font-size:9px}.vh-tx:first-of-type{border-top:0}.vh-tx span{color:#7791a4}.vh-tx b{font-size:10px}.vh-tx b.up{color:#79e7bb}.vh-tx b.down{color:#ff8997}.vh-tx em{font-style:normal;color:#a9c0cf}.vh-action-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.vh-action-grid button{border:1px solid #284967;background:#0b1f33;color:#d9eeff;border-radius:10px;padding:10px;font-weight:800}.vh-action-grid button:first-child{border-color:#1ea2e3;background:linear-gradient(135deg,#087dbb,#5c54ff);color:white}.vh-note{margin-top:9px;font-size:9px;line-height:1.5;color:#668298}.vh-empty{padding:12px 0;font-size:10px;color:#6d879b}
@media(max-width:760px){#bcVirtualHome{padding:12px}.vh-main,.vh-bottom{grid-template-columns:1fr}.vh-balance strong{font-size:30px}.vh-kpis:not(.vh-money-kpis){grid-template-columns:1fr 1fr}.vh-money-kpis{grid-template-columns:1fr}.vh-chart{height:125px}.vh-head h2{font-size:18px}}
`;
 document.head.appendChild(st);
}
function ensure(){
 const grid=document.querySelector('#home .dashboard-grid');if(!grid)return null;
 let el=document.getElementById('bcVirtualHome');
 if(!el){el=document.createElement('section');el.id='bcVirtualHome';el.className='panel wide';grid.prepend(el)}
 return el;
}
function render(){
 installStyle();const el=ensure();if(!el)return;const m=metrics();
 const pc=m.profit>0?'up':m.profit<0?'down':'';
 el.innerHTML=`
 <div class="vh-head"><div><div class="vh-kicker">VIRTUAL BANKROLL</div><h2>仮資金ホーム</h2></div><div class="vh-safe">実金連動なし</div></div>
 <div class="vh-main">
  <div class="vh-balance"><small>現在の仮資金</small><strong>${yen(m.bankroll)}</strong><p>開始 ${yen(m.start)} · 確定損益を継続反映 · TRY未精算 ${yen(m.pendingStake)}予約 · 利用可能 ${yen(Math.max(0,m.bankroll-m.pendingStake))}</p>
   <div class="vh-kpis vh-money-kpis"><div><span>本日投入済</span><b>${yen(m.lockedStake)}</b></div><div><span>予定投入</span><b>${yen(m.planned)}</b></div><div class="profit ${pc}"><span>確定損益</span><b>${m.profit>0?'+':''}${yen(m.profit)}</b></div><div><span>ROI</span><b>${pct(m.roi)}</b></div></div>
  </div>
  <div class="vh-graph"><small>仮資金推移</small>${chartSvg()}</div>
 </div>
 <div class="vh-bottom">
  <div class="vh-txs"><div class="vh-title">最近の資金移動</div>${transactions()}</div>
  <div class="vh-actions"><div class="vh-title">今日の状況</div><div class="vh-kpis"><div><span>精算</span><b>${m.settledCount}R</b></div><div><span>的中</span><b>${m.hits}</b></div><div><span>的中率</span><b>${pct(m.hitRate)}</b></div><div><span>未精算</span><b>${m.pendingCount}R</b></div></div><div class="vh-action-grid"><button type="button" data-vh-jump="predict">12Rを見る</button><button type="button" data-vh-jump="results">結果を見る</button></div><div class="vh-note">資金反映はTRYのみ。メイン12Rは的中精度の評価専用で、仮資金には反映しません。</div></div>
 </div>`;
 el.querySelectorAll('[data-vh-jump]').forEach(b=>b.onclick=()=>document.querySelector(`.nav[data-view="${b.dataset.vhJump}"]`)?.click());
}
const prior=typeof renderAll==='function'?renderAll:null;
if(prior)renderAll=function(){const out=prior.apply(this,arguments);render();return out};
window.BOAT_COMMAND_VIRTUAL_HOME_V03517=Object.freeze({version:VERSION,render,realMoney:false});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
window.addEventListener('boatcommand:forward-status',render);
})();