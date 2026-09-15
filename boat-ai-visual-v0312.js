// BOAT COMMAND GLOBAL VISUAL AI CORE v0.31.2
// Free command-center UI. Reads state and delegates safe operations to existing app controls.
(()=>{
'use strict';
const VERSION='BOAT-COMMAND-VISUAL-AI-CORE-V0.33.7';
let pulseTimer=null,lastUser='';
const VIEW_TITLES={assistant:['BOAT COMMAND AI CORE','SYSTEM INTELLIGENCE'],home:['蒲郡コマンドセンター','GAMAGORI ANALYST'],predict:['蒲郡 12R予想','GAMAGORI PREDICTION'],results:['蒲郡 結果・精算','GAMAGORI SETTLEMENT'],analytics:['蒲郡 分析','GAMAGORI ANALYTICS'],data:['BOAT COMMAND REPLAY','HISTORICAL REPLAY']};

function getSession(){try{return typeof window.session==='function'?window.session():null}catch{return null}}
function stateFromText(value){
  const text=String(value||'');
  if(/エラー|失敗|非対応/.test(text))return'error';
  if(/認識|聞いて/.test(text))return'listening';
  if(/準備|思考|処理|同期中|更新中/.test(text))return'thinking';
  if(/返答|テスト中/.test(text))return'speaking';
  return'idle';
}
function stateLabel(state){return({idle:'待機中',listening:'聞き取り中',thinking:'思考中',development:'開発中',completed:'完了',speaking:'返答中',error:'接続確認'})[state]||'待機中'}
function setState(state,detail){
  const root=document.querySelector('#bcVisualCore');if(!root)return;
  root.dataset.state=state;
  const label=root.querySelector('[data-core-state]');if(label)label.textContent=stateLabel(state);
  const line=root.querySelector('[data-core-line]');if(line&&detail)line.textContent=detail;
}
function sessionStats(){
  const s=getSession(),races=s?.races||[];
  return{
    first:races.filter(r=>r.firstSuggestion?.status==='CANDIDATE').length,
    history:window.BOAT_COMMAND_MAIN_PREDICTION_V0320?'4,071':'同期中',
    locked:races.filter(r=>r.locked).length,
    settled:races.filter(r=>r.settled).length
  };
}
function renderStats(){
  const root=document.querySelector('#bcVisualCore');if(!root)return;
  const st=sessionStats();
  for(const [key,value] of Object.entries(st)){const el=root.querySelector(`[data-core-stat="${key}"]`);if(el)el.textContent=key==='history'?String(value):`${value}/12`}
}
function setTranscript(text){const el=document.querySelector('[data-core-transcript]');if(el&&text)el.textContent=String(text).trim()}
function latestLine(){
  if(window.BOAT_COMMAND_AGENT_V0335)return;
  const replies=[...document.querySelectorAll('#chat .bubble.ai')];
  const text=replies.at(-1)?.textContent?.trim();
  if(text){setTranscript(text);setState(stateFromText(document.querySelector('#bcVoiceStatus')?.textContent),text)}
}
function agentEvent(event){
  const d=event?.detail||{};
  if(d.phase==='heard'){
    lastUser=d.text||'';setTranscript(`YOU｜${lastUser}`);setState('listening','指示を受け取りました');
  }else if(d.phase==='thinking'){
    setState('thinking','BOAT COMMANDの状態と安全権限を確認中');
  }else if(d.phase==='development'){
    setTranscript(`${lastUser?`YOU｜${lastUser}\n`:''}AI｜${d.text||''}`);setState('development',d.developmentStatus==='queued'?'SHADOW開発タスクを待機中':'SHADOW環境で調査・実装中');
  }else if(d.phase==='completed'){
    setTranscript(`AI｜${d.text||'SHADOW開発が完了しました。'}`);setState('completed','LIVE未反映・確認待ち');
  }else if(d.phase==='answered'){
    setTranscript(`${lastUser?`YOU｜${lastUser}\n`:''}AI｜${d.text||''}`);setState('speaking',d.action?`安全操作 ${d.action} を実行しました`:'回答を生成しました');
  }else if(d.phase==='error'){
    setTranscript(`AI｜${d.text||'操作エラー'}`);setState('error','安全な操作を完了できませんでした');
  }
}
function talk(){
  const btn=document.querySelector('#bcVoiceBtn');
  if(btn&&!btn.disabled){btn.click();setState('listening','話しかけてください');return}
  setState('error','この端末では音声入力を開始できません');
}
async function refresh(){
  setState('thinking','最新の蒲郡データを同期しています');
  try{
    const api=window.BOAT_COMMAND_VOICE_AGENT;
    const text=typeof api?.refresh==='function'?await api.refresh():'同期機能の準備待ちです';
    setTranscript(text);setState('speaking',text);if(typeof api?.speak==='function')api.speak(text);
  }catch{setState('error','同期中にエラーが発生しました')}
}
function connect(){
  const cloud=window.BOAT_COMMAND_CLOUD_AI_V0336,dev=window.BOAT_COMMAND_DEVELOPMENT_AGENT_V0337;
  if(cloud?.configured?.()){setTranscript('AI｜クラウドAIは接続済みです。この画面でそのまま話せます。');setState('speaking',dev?.configured?.()?'自由会話・開発依頼とも接続済み':'自由会話は接続済み・開発接続は準備待ち');return}
  setTranscript('AI｜Vercel接続後、この画面だけで自由会話と開発依頼を利用できます。');setState('error','クラウドAI接続の準備待ちです');
}
function syncHeader(view){const pair=VIEW_TITLES[view]||VIEW_TITLES.assistant;const title=document.querySelector('#pageTitle'),eye=document.querySelector('.topbar .eyebrow');if(title)title.textContent=pair[0];if(eye)eye.textContent=pair[1]}
function openView(view){const btn=document.querySelector(`.nav[data-view="${view}"]`);if(btn){btn.click();syncHeader(view)}}
function installStyle(){if(document.querySelector('#bc-visual-core-style'))return;const style=document.createElement('style');style.id='bc-visual-core-style';style.textContent=`
.bc-ai-core{position:relative;overflow:hidden;min-height:520px;margin:14px 0 22px;border:1px solid rgba(67,196,255,.24);border-radius:24px;background:radial-gradient(circle at 50% 35%,rgba(21,119,171,.18),transparent 35%),linear-gradient(145deg,#06111e,#071927 55%,#04101b);box-shadow:inset 0 0 60px rgba(0,0,0,.38),0 18px 50px rgba(0,0,0,.2);color:#eaf8ff}
.bc-ai-core:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(88,187,230,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(88,187,230,.045) 1px,transparent 1px);background-size:34px 34px;mask-image:linear-gradient(to bottom,#000,transparent 84%);pointer-events:none}
.bc-core-top{position:relative;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:20px 22px}.bc-core-title small{display:block;color:#6fa9c6;font-size:10px;letter-spacing:.18em}.bc-core-title strong{display:block;margin-top:4px;font-size:17px;letter-spacing:.06em}.bc-core-online{display:flex;align-items:center;gap:7px;color:#77efbc;font-size:10px;font-weight:900;letter-spacing:.09em}.bc-core-online i{width:7px;height:7px;border-radius:50%;background:#4dffc1;box-shadow:0 0 14px #4dffc1}
.bc-core-stage{position:relative;z-index:1;display:grid;place-items:center;min-height:320px;padding-bottom:30px}.bc-orb-wrap{position:relative;width:220px;height:220px;display:grid;place-items:center;filter:drop-shadow(0 0 24px rgba(64,205,255,.2))}.bc-orb,.bc-ring{position:absolute;border-radius:50%}.bc-orb{width:98px;height:98px;background:radial-gradient(circle at 38% 34%,#faffd0 0 7%,#d9ff5a 15%,#62eabc 43%,#18aada 67%,rgba(15,97,165,.2) 74%);box-shadow:0 0 18px #83f5cd,0 0 48px #20bcdc,0 0 96px rgba(37,162,231,.65);animation:bcOrb 3.2s ease-in-out infinite}.bc-orb:after{content:"";position:absolute;inset:18%;border-radius:50%;background:radial-gradient(circle at 45% 40%,#fff,#cfff73 23%,transparent 62%);filter:blur(3px)}
.bc-ring{border:1px solid rgba(116,224,255,.45);box-shadow:0 0 10px rgba(44,191,255,.3)}.bc-ring.r1{width:145px;height:145px;animation:bcSpin 9s linear infinite}.bc-ring.r2{width:183px;height:108px;transform:rotate(25deg);animation:bcTilt 6s ease-in-out infinite}.bc-ring.r3{width:206px;height:150px;transform:rotate(-28deg);animation:bcTilt2 8s ease-in-out infinite}.bc-orbit-dot{position:absolute;width:7px;height:7px;border-radius:50%;background:#ddff6c;box-shadow:0 0 12px #ddff6c;animation:bcDot 7s linear infinite}
.bc-core-caption{position:absolute;bottom:15px;left:18px;right:18px;text-align:center}.bc-core-caption strong{display:block;font-size:18px;letter-spacing:.12em}.bc-core-caption span{display:block;max-width:460px;margin:7px auto 0;color:#8fb4c9;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bc-core-stats{position:relative;z-index:2;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:14px 18px 16px}.bc-core-stat{padding:10px 8px;border:1px solid rgba(62,164,207,.18);border-radius:12px;background:rgba(5,28,43,.62);text-align:center}.bc-core-stat span{display:block;color:#668da5;font-size:9px}.bc-core-stat b{display:block;margin-top:3px;font-size:14px}
.bc-core-actions{position:relative;z-index:2;display:flex;justify-content:center;gap:9px;padding:0 18px 20px}.bc-core-actions button{min-height:42px;border:1px solid #286889;border-radius:12px;background:#0a2a40;color:#eaf8ff;padding:0 15px;font-weight:900}.bc-core-actions button:first-child{border-color:#70dcff;background:linear-gradient(135deg,#176a91,#154b77);box-shadow:0 0 18px rgba(49,181,236,.2)}
.bc-core-transcript{position:relative;z-index:2;margin:0 18px 12px;padding:14px 16px;border:1px solid rgba(90,193,236,.24);border-radius:15px;background:rgba(5,25,40,.78);box-shadow:inset 0 0 22px rgba(19,111,157,.08)}.bc-core-transcript>span{display:block;color:#67cffa;font-size:9px;font-weight:900;letter-spacing:.14em}.bc-core-transcript p{min-height:42px;margin:8px 0 0;color:#e8f7ff;font-size:13px;line-height:1.65;white-space:pre-wrap}
.bc-core-control{position:relative;z-index:2;margin:0 18px 20px;padding:14px;border:1px solid rgba(62,164,207,.18);border-radius:15px;background:rgba(4,20,33,.56)}.bc-core-control>span{display:block;margin-bottom:9px;color:#6f9ab3;font-size:9px;font-weight:900;letter-spacing:.14em}.bc-core-nav{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.bc-core-nav button{min-height:38px;border:1px solid #234d69;border-radius:10px;background:#081f31;color:#cfe8f5;font-size:11px;font-weight:800}.bc-core-nav button:hover{border-color:#48bce8;color:#fff}
.bc-ai-core[data-state="listening"] .bc-orb{animation-duration:.7s;box-shadow:0 0 22px #9affea,0 0 65px #29cfee,0 0 120px rgba(37,162,231,.8)}.bc-ai-core[data-state="thinking"] .bc-ring,.bc-ai-core[data-state="development"] .bc-ring{border-style:dashed;animation-duration:2.2s}.bc-ai-core[data-state="development"] .bc-orb{animation:bcSpeak .7s ease-in-out infinite alternate;filter:hue-rotate(22deg)}.bc-ai-core[data-state="completed"] .bc-orb{box-shadow:0 0 22px #9affb9,0 0 65px #45e69a,0 0 120px rgba(37,231,140,.55)}.bc-ai-core[data-state="speaking"] .bc-orb{animation:bcSpeak .45s ease-in-out infinite alternate}.bc-ai-core[data-state="error"] .bc-orb{filter:hue-rotate(135deg);opacity:.72}
@keyframes bcOrb{50%{transform:scale(1.08);filter:brightness(1.15)}}@keyframes bcSpeak{to{transform:scale(1.13);filter:brightness(1.3)}}@keyframes bcSpin{to{transform:rotate(360deg)}}@keyframes bcTilt{50%{transform:rotate(-18deg) scaleX(.92)}}@keyframes bcTilt2{50%{transform:rotate(24deg) scaleY(.92)}}@keyframes bcDot{0%{transform:rotate(0) translateX(92px)}100%{transform:rotate(360deg) translateX(92px)}}
@media(max-width:720px){.bc-ai-core{min-height:520px;border-radius:18px}.bc-core-top{padding:16px}.bc-orb-wrap{width:195px;height:195px}.bc-core-stage{min-height:300px;padding-bottom:34px}.bc-core-actions{display:grid;grid-template-columns:1fr 1fr}.bc-core-actions button:last-child{grid-column:1/-1}.bc-core-caption span{max-width:280px}.bc-core-stats{padding:12px;gap:5px}.bc-core-stat{padding-inline:3px}.bc-core-transcript,.bc-core-control{margin-inline:12px}.bc-core-nav{grid-template-columns:repeat(3,1fr)}.bc-core-nav button:last-child{grid-column:2}}
@media(prefers-reduced-motion:reduce){.bc-ai-core *{animation-duration:0s!important;animation-iteration-count:1!important}}
`;document.head.appendChild(style)}
function install(){
  const host=document.querySelector('#assistant .panel');if(!host||document.querySelector('#bcVisualCore'))return;
  installStyle();
  for(const selector of ['#refreshReport','#reportRefreshStatus']){const legacy=host.querySelector(selector);if(legacy)legacy.hidden=true}
  const cloudOnline=!!window.BOAT_COMMAND_CLOUD_AI_V0336?.configured?.();
  const core=document.createElement('section');core.id='bcVisualCore';core.className='bc-ai-core';core.dataset.state='idle';core.setAttribute('aria-label','BOAT COMMAND専用AIコア');
  core.innerHTML=`<div class="bc-core-top"><div class="bc-core-title"><small>BOAT COMMAND · PERSONAL AGENT</small><strong>AI CORE</strong></div><div class="bc-core-online"><i></i>${cloudOnline?'CLOUD AI ONLINE':'SAFE AGENT ONLINE'}</div></div><div class="bc-core-stage"><div class="bc-orb-wrap" aria-hidden="true"><div class="bc-ring r1"></div><div class="bc-ring r2"></div><div class="bc-ring r3"></div><div class="bc-orbit-dot"></div><div class="bc-orb"></div></div><div class="bc-core-caption"><strong data-core-state>待機中</strong><span data-core-line>${cloudOnline?'自由会話・状態確認・安全な画面操作をアプリ内で行います':'状態確認・安全な画面操作をアプリ内で行います'}</span></div></div><div class="bc-core-stats"><div class="bc-core-stat"><span>蒲郡 メイン予想</span><b data-core-stat="first">0/12</b></div><div class="bc-core-stat"><span>過去DB</span><b data-core-stat="history">同期中</b></div><div class="bc-core-stat"><span>HARD LOCK</span><b data-core-stat="locked">0/12</b></div><div class="bc-core-stat"><span>精算</span><b data-core-stat="settled">0/12</b></div></div><div class="bc-core-actions"><button type="button" data-core-action="talk">🎙 AIコアと話す</button><button type="button" data-core-action="connect">AI接続</button><button type="button" data-core-action="refresh">最新同期</button></div><div class="bc-core-transcript"><span>VOICE / AI TRANSCRIPT</span><p data-core-transcript aria-live="polite">ここにあなたの指示とAIコアの返答を表示します。</p></div><div class="bc-core-control"><span>APP CONTROL</span><div class="bc-core-nav"><button type="button" data-core-view="home">蒲郡</button><button type="button" data-core-view="predict">12R予想</button><button type="button" data-core-view="results">精算</button><button type="button" data-core-view="analytics">分析</button><button type="button" data-core-view="data">REPLAY</button></div></div>`;
  const heading=host.querySelector('h2');heading?.insertAdjacentElement('afterend',core);
  core.querySelector('[data-core-action="talk"]').addEventListener('click',talk);
  core.querySelector('[data-core-action="refresh"]').addEventListener('click',refresh);
  core.querySelector('[data-core-action="connect"]').addEventListener('click',connect);
  core.querySelectorAll('[data-core-view]').forEach(btn=>btn.addEventListener('click',()=>openView(btn.dataset.coreView)));
  document.querySelectorAll('.nav[data-view]').forEach(btn=>btn.addEventListener('click',()=>syncHeader(btn.dataset.view)));
  syncHeader('assistant');
  renderStats();latestLine();
  const voice=document.querySelector('#bcVoiceStatus');if(voice)new MutationObserver(()=>setState(stateFromText(voice.textContent),voice.textContent)).observe(voice,{childList:true,subtree:true,characterData:true});
  const chat=document.querySelector('#chat');if(chat)new MutationObserver(latestLine).observe(chat,{childList:true,subtree:true});
  window.addEventListener('boat-command-agent-event',agentEvent);
  pulseTimer=setInterval(renderStats,5000);
}
window.BOAT_COMMAND_VISUAL_AI_CORE=Object.freeze({version:VERSION,free:true,commandCenter:true,transcript:true,protectedMutations:true,setState,setTranscript,renderStats,openView});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
