// BOAT COMMAND independent venue model cycle UI v1
(()=>{'use strict';
const VERSION='VENUE-MODEL-CYCLE-UI-V1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=v=>Number.isFinite(Number(v))?(Number(v)*100).toFixed(1)+'%':'—';
const signed=v=>Number.isFinite(Number(v))?(Number(v)>0?'+':'')+(Number(v)*100).toFixed(1)+'pt':'—';
const phaseLabel=p=>({ACTIVE:'30日検証中',WAITING_FOR_MAINLINE:'本線準備待ち',REVIEW_READY:'30日評価待ち',EVIDENCE_EXTENSION:'証拠延長中',REVIEW_BLOCKED:'評価ブロック',APPROVED_PENDING_DEPLOYMENT:'昇格承認・反映待ち'})[p]||p||'—';
const recommendationLabel=s=>({WAIT:'収集中',WAITING_FOR_MAINLINE:'準備待ち',EXTEND_EVIDENCE:'検証継続',BLOCKED:'要修正',CANDIDATE_ELIGIBLE:'昇格候補あり',KEEP_CURRENT:'現本線継続候補',HUMAN_REVIEW:'人間レビュー待ち'})[s]||s||'—';
function install(){
 if(document.getElementById('bcModelCycleStyle'))return;
 const s=document.createElement('style');s.id='bcModelCycleStyle';
 s.textContent=[
 '.mc-card{margin-top:12px;border:1px solid rgba(64,185,255,.25);border-radius:16px;background:linear-gradient(180deg,#0b1d30,#071521);padding:16px}',
 '.mc-head{display:flex;justify-content:space-between;gap:14px}.mc-head h2{margin:0;font-size:17px}.mc-head p{margin:5px 0 0;color:#7892a5;font-size:9px;line-height:1.5}.mc-phase{font-size:9px;border:1px solid rgba(74,211,190,.28);border-radius:999px;padding:6px 9px;color:#91d9ca;white-space:nowrap;height:max-content}',
 '.mc-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:12px}.mc-kpi{border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:9px;background:rgba(255,255,255,.02)}.mc-kpi small{display:block;color:#6f8799;font-size:7px;margin-bottom:4px}.mc-kpi b{font-size:12px;line-height:1.3}',
 '.mc-progress{height:5px;border-radius:99px;background:rgba(255,255,255,.06);margin-top:10px;overflow:hidden}.mc-progress i{display:block;height:100%;background:linear-gradient(90deg,#26a7df,#35d0b1);width:0}',
 '.mc-candidate{margin-top:10px;border-top:1px solid rgba(255,255,255,.06);padding-top:10px;display:grid;gap:6px}.mc-candidate-row{display:grid;grid-template-columns:1.4fr .8fr .8fr .8fr;gap:8px;font-size:9px;align-items:center}.mc-candidate-row b{font-size:10px}.mc-ok{color:#79e7bb}.mc-warn{color:#f4c56c}.mc-note{margin-top:10px;color:#647f93;font-size:8px;line-height:1.6}',
 '@media(max-width:720px){.mc-head{flex-direction:column}.mc-kpis{grid-template-columns:1fr 1fr}.mc-kpi:last-child{grid-column:1/-1}.mc-candidate-row{grid-template-columns:1fr 1fr}.mc-candidate-row b{grid-column:1/-1}}'
 ].join('');
 document.head.appendChild(s);
}
async function load(slug){
 try{const r=await fetch('./venues/'+encodeURIComponent(slug)+'/model-cycle-v1.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)return null;return await r.json()}catch{return null}
}
function mainMetrics(x){
 const e=x?.mainline?.evaluation||{};
 if(Array.isArray(e.methods)){
   const settled=e.methods.reduce((a,m)=>a+Number(m.settledMatchedRaces||0),0),hits=e.methods.reduce((a,m)=>a+Number(m.hits||0),0),stake=e.methods.reduce((a,m)=>a+Number(m.stakeYen||0),0),ret=e.methods.reduce((a,m)=>a+Number(m.returnYen||0),0);
   return {races:settled,hits,hitRate:settled?hits/settled:null,roi:stake?ret/stake:null,profit:ret-stake};
 }
 return {races:Number(e.races||0),hits:Number(e.hits||0),hitRate:e.hitRate??null,roi:e.roi??null,profit:e.profitYenAt100PerPick??null};
}
function render(root,x){
 install();
 if(!x){root.innerHTML='<div class="mc-card"><div class="mc-note">モデル更新サイクル状態を準備中です。</div></div>';return}
 const m=mainMetrics(x),day=Number(x.cycleDay||0),progress=Math.max(0,Math.min(100,day/30*100));
 const candidate=(x.candidates||[]).find(c=>c.id===x.recommendation?.candidateId)||(x.candidates||[])[0]||null;
 let candidateHtml='';
 if(candidate){
   candidateHtml='<div class="mc-candidate"><div class="mc-candidate-row"><b>'+esc(candidate.modelVersion)+'</b><span>比較 '+(candidate.pairedRaces||0)+'R</span><span>的中差 '+signed(candidate.deltas?.hitRateDelta)+'</span><span>ROI差 '+signed(candidate.deltas?.roiDelta)+'</span></div><div class="'+(candidate.gates?.eligible?'mc-ok':'mc-warn')+'">'+(candidate.gates?.eligible?'昇格ゲート通過・人間承認待ち':'SHADOW継続 · '+esc((candidate.gates?.reasons||[]).slice(0,2).join(' / ')))+'</div></div>';
 }
 const period=x.startDate?esc(x.startDate)+'〜'+esc(x.endDate)+' · 残り'+x.daysRemaining+'日 · ':'';
 root.innerHTML='<section class="mc-card"><div class="mc-head"><div><h2>30日モデル更新サイクル · '+esc(x.venueName)+'</h2><p>この場だけの本線・候補・評価履歴で独立更新。ほか23場の重みや成績は使用しません。</p></div><span class="mc-phase">'+esc(phaseLabel(x.phase))+'</span></div><div class="mc-kpis"><div class="mc-kpi"><small>CYCLE</small><b>'+(x.cycleNumber||1)+' · '+day+'/30日</b></div><div class="mc-kpi"><small>本線MODEL</small><b>'+esc(x.mainline?.modelVersion||'準備中')+'</b></div><div class="mc-kpi"><small>評価</small><b>'+(m.races||0)+'R / '+(m.hits||0)+'的中</b></div><div class="mc-kpi"><small>的中率 / ROI</small><b>'+pct(m.hitRate)+' / '+pct(m.roi)+'</b></div><div class="mc-kpi"><small>判定</small><b>'+esc(recommendationLabel(x.recommendation?.state))+'</b></div></div><div class="mc-progress"><i style="width:'+progress.toFixed(1)+'%"></i></div>'+candidateHtml+'<div class="mc-note">'+period+'30日中は本線固定。候補はSHADOWのみ。自動昇格なし・人間承認必須・実金なし。旧サイクルと元データは削除しません。</div></section>';
}
async function mount({root,slug}={}){
 const el=typeof root==='string'?document.querySelector(root):root;if(!el||!slug)return null;
 el.hidden=false;el.innerHTML='<div class="mc-card"><div class="mc-note">モデル更新サイクルを読み込み中…</div></div>';
 const x=await load(slug);render(el,x);return x;
}
function auto(){
 document.querySelectorAll('[data-venue-model-cycle]').forEach(el=>{const slug=el.getAttribute('data-venue-model-cycle');if(slug)mount({root:el,slug})});
}
window.BOAT_COMMAND_VENUE_MODEL_CYCLE=Object.freeze({version:VERSION,load,mount});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',auto,{once:true});else auto();
})();