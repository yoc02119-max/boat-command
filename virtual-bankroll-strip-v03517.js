// BOAT COMMAND GAMAGORI virtual bankroll strip v0.35.17
// Display-only summary for the simple 12R screen. Real money is never touched.
(()=>{'use strict';
const VERSION='GAMAGORI-VIRTUAL-BANKROLL-STRIP-V0.35.17';
function yen(v){const n=Number(v)||0;return (n<0?'-':'')+'¥'+Math.abs(Math.round(n)).toLocaleString('ja-JP')}
function installStyle(){
 if(document.getElementById('bcVirtualBankrollStripStyle'))return;
 const s=document.createElement('style');s.id='bcVirtualBankrollStripStyle';
 s.textContent=`
#bcVirtualBankrollStrip{position:sticky;top:52px;z-index:3;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 12px;padding:9px;border:1px solid rgba(83,226,255,.18);border-radius:12px;background:rgba(5,17,29,.94);backdrop-filter:blur(10px)}
#bcVirtualBankrollStrip>div{min-width:0;padding:9px 10px;border-radius:9px;background:rgba(255,255,255,.035)}
#bcVirtualBankrollStrip small{display:block;font-size:9px;color:#7895aa;margin-bottom:3px}
#bcVirtualBankrollStrip b{display:block;font-size:17px;line-height:1.15;color:#eef9ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#bcVirtualBankrollStrip .bankroll b{color:#8fe8ff}
#bcVirtualBankrollStrip .profit.positive b{color:#79e7bb}
#bcVirtualBankrollStrip .profit.negative b{color:#ff8997}
#bcVirtualBankrollStrip .sub{grid-column:1/-1;padding:0 2px;background:none;font-size:8px;color:#667f92}
@media(max-width:760px){#bcVirtualBankrollStrip{top:46px;gap:5px;padding:7px}#bcVirtualBankrollStrip>div{padding:8px 7px}#bcVirtualBankrollStrip b{font-size:14px}#bcVirtualBankrollStrip small{font-size:8px}}
`;
 document.head.appendChild(s);
}
function ensure(){
 const panel=document.querySelector('#predict > .panel');if(!panel)return null;
 let el=document.getElementById('bcVirtualBankrollStrip');
 if(!el){el=document.createElement('div');el.id='bcVirtualBankrollStrip';const head=panel.querySelector(':scope > .panel-head');head?.insertAdjacentElement('afterend',el)}
 return el;
}
function render(){
 installStyle();const el=ensure();if(!el)return;
 let s=null;try{s=session()}catch{}if(!s)return;
 const shared=typeof bcSharedTryLedger==='function'?bcSharedTryLedger():null;
 const t=shared||(typeof bcVirtualTryLedger==='function'?bcVirtualTryLedger():{todayCommittedStakeYen:0,todayPendingStakeYen:0,todayProfitYen:0});
 const invested=Number(t.todayCommittedStakeYen)||0;
 const profit=Number(t.todayProfitYen)||0;
 const pending=Number(t.todayPendingStakeYen)||0;
 const bankroll=typeof bcVirtualBankrollNow==='function'?bcVirtualBankrollNow():(Number(store?.startBankroll)||100000)+profit;
 const available=Math.max(0,bankroll-pending);
 const cls=profit>0?'positive':profit<0?'negative':'';
 el.innerHTML=`<div class="bankroll"><small>24場共通 仮資金</small><b>${yen(bankroll)}</b></div><div><small>本日AUTO TRY</small><b>${yen(invested)}</b></div><div class="profit ${cls}"><small>本日確定損益</small><b>${profit>0?'+':''}${yen(profit)}</b></div><div class="sub">24場共通10万円 · 確定損益を継続反映 · 未精算TRY ${yen(pending)}予約 · 利用可能 ${yen(available)} · 自動リセットなし · 実金なし</div>`;
}
const prior=typeof renderAll==='function'?renderAll:null;
if(prior)renderAll=function(){const out=prior.apply(this,arguments);render();return out};
window.BOAT_COMMAND_VIRTUAL_BANKROLL_STRIP_V03517=Object.freeze({version:VERSION,render,realMoney:false});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
window.addEventListener('boatcommand:forward-status',render);
window.addEventListener('boatcommand:shared-portfolio',render);
})();