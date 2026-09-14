// BOAT COMMAND GAMAGORI LIVE performance visibility v0.32.4
// Presentation-only: reads already-settled local session records. Never fetches PRE-RACE or POST-RACE endpoints.
(()=>{'use strict';
const VERSION='GAMAGORI-LIVE-PERFORMANCE-V0.32.4';
const yen=n=>(Number(n||0)<0?'-':'')+'¥'+Math.abs(Math.round(Number(n)||0)).toLocaleString('ja-JP');
const pc=n=>Number.isFinite(Number(n))?Number(n).toFixed(1)+'%':'—';
function sessions(){try{return Object.values(store?.sessions||{}).filter(s=>s?.venue==='蒲郡')}catch{return[]}}
function settled(s){return (s?.races||[]).filter(r=>r?.settled===true)}
function totals(rows){const invested=rows.reduce((a,r)=>a+Number(r.stake||0),0),returned=rows.reduce((a,r)=>a+Number(r.returnAmount||0),0),hits=rows.filter(r=>r.hit).length;return{count:rows.length,hits,invested,returned,profit:returned-invested,roi:invested?returned/invested*100:null,hitRate:rows.length?hits/rows.length*100:null}}
function allSettled(){return sessions().flatMap(s=>settled(s).map(r=>({sessionDate:s.date,...r})))}
function maxDrawdown(rows){
 const ordered=[...rows].sort((a,b)=>{const ta=Date.parse(a.settledAt||'')||Date.parse(`${a.sessionDate||'1970-01-01'}T00:00:00+09:00`)||0,tb=Date.parse(b.settledAt||'')||Date.parse(`${b.sessionDate||'1970-01-01'}T00:00:00+09:00`)||0;return ta-tb||Number(a.race||0)-Number(b.race||0)});
 let equity=0,peak=0,maxDd=0;for(const r of ordered){equity+=Number(r.profit||0);peak=Math.max(peak,equity);maxDd=Math.max(maxDd,peak-equity)}return maxDd;
}
function renderMaxDd(){const el=document.getElementById('allDd');if(el)el.textContent=yen(maxDrawdown(allSettled()))}
function renderHeadBoat(){const host=document.getElementById('headBoatBars');if(!host)return;const rows=allSettled();host.innerHTML=[1,2,3,4,5,6].map(n=>{const x=rows.filter(r=>String(r.result||'').startsWith(`${n}-`)),t=totals(x);return `<div class="stack-stats"><div><span>${n}号艇1着</span><b>${t.count}R</b></div><div><span>回収率</span><b>${pc(t.roi)}</b></div><div><span>損益</span><b>${yen(t.profit)}</b></div></div>`}).join('')||'<div class="snapshot-note">精算データ待ち</div>'}
function renderWinners(){const host=document.getElementById('winnerBars');if(!host)return;const rows=allSettled(),count=rows.length;host.innerHTML=count?[1,2,3,4,5,6].map(n=>{const c=rows.filter(r=>String(r.result||'').startsWith(`${n}-`)).length;return `<div class="snapshot-note">${n}号艇 ${c}R · ${pc(count?c/count*100:null)}</div>`}).join(''):'<div class="snapshot-note">精算データ待ち</div>'}
function renderMode(){const host=document.getElementById('modeCompare');if(!host)return;const ss=sessions(),live=totals(ss.filter(s=>s.runType==='LIVE').flatMap(settled)),back=totals(ss.filter(s=>s.runType==='BACKTEST').flatMap(settled));host.innerHTML=`<div class="stack-stats"><div><span>LIVE</span><b>${live.count}R · 回収率 ${pc(live.roi)} · ${yen(live.profit)}</b></div><div><span>BACKTEST</span><b>${back.count}R · 回収率 ${pc(back.roi)} · ${yen(back.profit)}</b></div></div>`}
function renderHistory(){const host=document.getElementById('historyTable');if(!host)return;const rows=sessions().map(s=>({date:s.date,runType:s.runType||'LIVE',...totals(settled(s))})).filter(x=>x.count).sort((a,b)=>String(b.date).localeCompare(String(a.date)));host.innerHTML=rows.length?`<div class="history-list">${rows.map(x=>`<div class="snapshot-note"><b>${x.date}</b> · ${x.runType} · ${x.hits}/${x.count}的中 · 回収率 ${pc(x.roi)} · 損益 ${yen(x.profit)}</div>`).join('')}</div>`:'<div class="snapshot-note">精算データ待ち</div>'}
function render(){renderMaxDd();renderHeadBoat();renderWinners();renderMode();renderHistory()}
const prior=typeof renderAll==='function'?renderAll:null;if(prior)renderAll=function(){const out=prior.apply(this,arguments);render();return out};
window.BOAT_COMMAND_LIVE_PERFORMANCE_V0323=Object.freeze({version:VERSION,render,maxDrawdown,readOnly:true,fetchesResults:false,fetchesPreRace:false});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
})();