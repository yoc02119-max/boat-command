// BOAT COMMAND GAMAGORI VISUAL AI CORE v0.29.9
// Free UI layer only. Reads existing session/voice state and never mutates race data.
(()=>{
'use strict';
const VERSION='GAMAGORI-VISUAL-AI-CORE-V0.29.9';
let pulseTimer=null;

function getSession(){try{return typeof window.session==='function'?window.session():null}catch{return null}}
function stateFromText(value){
  const text=String(value||'');
  if(/エラー|失敗|非対応/.test(text))return'error';
  if(/認識|聞いて/.test(text))return'listening';
  if(/準備|思考|処理|同期中|更新中/.test(text))return'thinking';
  if(/返答|テスト中/.test(text))return'speaking';
  return'idle';
}
function stateLabel(state){return({idle:'待機中',listening:'聞き取り中',thinking:'思考中',speaking:'返答中',error:'接続確認'})[state]||'待機中'}
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
    second:races.filter(r=>r.liveSuggestion?.status==='CANDIDATE').length,
    locked:races.filter(r=>r.locked).length,
    settled:races.filter(r=>r.settled).length
  };
}
function renderStats(){
  const root=document.querySelector('#bcVisualCore');if(!root)return;
  const st=sessionStats();
  for(const [key,value] of Object.entries(st)){const el=root.querySelector(`[data-core-stat="${key}"]`);if(el)el.textContent=`${value}/12`}
}
function latestLine(){
  const bubbles=[...document.querySelectorAll('#chat .bubble')];
  const text=bubbles.at(-1)?.textContent?.trim();
  if(text)setState(stateFromText(document.querySelector('#bcVoiceStatus')?.textContent),text);
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
    setState('speaking',text);if(typeof api?.speak==='function')api.speak(text);
  }catch{setState('error','同期中にエラーが発生しました')}
}
function connect(){
  const api=window.BOAT_COMMAND_CHATGPT_VOICE;
  if(typeof api?.handoff==='function'){api.handoff();return}
  setState('error','ChatGPT接続の準備待ちです');
}
function installStyle(){if(document.querySelector('#bc-visual-core-style'))return;const style=document.createElement('style');style.id='bc-visual-core-style';style.textContent=`
.bc-ai-core{position:relative;overflow:hidden;min-height:520px;margin:14px 0 22px;border:1px solid rgba(67,196,255,.24);border-radius:24px;background:radial-gradient(circle at 50% 35%,rgba(21,119,171,.18),transparent 35%),linear-gradient(145deg,#06111e,#071927 55%,#04101b);box-shadow:inset 0 0 60px rgba(0,0,0,.38),0 18px 50px rgba(0,0,0,.2);color:#eaf8ff}
.bc-ai-core:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(88,187,230,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(88,187,230,.045) 1px,transparent 1px);background-size:34px 34px;mask-image:linear-gradient(to bottom,#000,transparent 84%);pointer-events:none}
.bc-core-top{position:relative;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:20px 22px}.bc-core-title small{display:block;color:#6fa9c6;font-size:10px;letter-spacing:.18em}.bc-core-title strong{display:block;margin-top:4px;font-size:17px;letter-spacing:.06em}.bc-core-online{display:flex;align-items:center;gap:7px;color:#77efbc;font-size:10px;font-weight:900;letter-spacing:.09em}.bc-core-online i{width:7px;height:7px;border-radius:50%;background:#4dffc1;box-shadow:0 0 14px #4dffc1}
.bc-core-stage{position:relative;z-index:1;display:grid;place-items:center;min-height:285px}.bc-orb-wrap{position:relative;width:220px;height:220px;display:grid;place-items:center;filter:drop-shadow(0 0 24px rgba(64,205,255,.2))}.bc-orb,.bc-ring{position:absolute;border-radius:50%}.bc-orb{width:98px;height:98px;background:radial-gradient(circle at 38% 34%,#faffd0 0 7%,#d9ff5a 15%,#62eabc 43%,#18aada 67%,rgba(15,97,165,.2) 74%);box-shadow:0 0 18px #83f5cd,0 0 48px #20bcdc,0 0 96px rgba(37,162,231,.65);animation:bcOrb 3.2s ease-in-out infinite}.bc-orb:after{content:"";position:absolute;inset:18%;border-radius:50%;background:radial-gradient(circle at 45% 40%,#fff,#cfff73 23%,transparent 62%);filter:blur(3px)}
.bc-ring{border:1px solid rgba(116,224,255,.45);box-shadow:0 0 10px rgba(44,191,255,.3)}.bc-ring.r1{width:145px;height:145px;animation:bcSpin 9s linear infinite}.bc-ring.r2{width:183px;height:108px;transform:rotate(25deg);animation:bcTilt 6s ease-in-out infinite}.bc-ring.r3{width:206px;height:150px;transform:rotate(-28deg);animation:bcTilt2 8s ease-in-out infinite}.bc-orbit-dot{position:absolute;width:7px;height:7px;border-radius:50%;background:#ddff6c;box-shadow:0 0 12px #ddff6c;animation:bcDot 7s linear infinite}
.bc-core-caption{position:absolute;bottom:4px;text-align:center}.bc-core-caption strong{display:block;font-size:18px;letter-spacing:.12em}.bc-core-caption span{display:block;max-width:360px;margin:7px auto 0;color:#8fb4c9;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bc-core-stats{position:relative;z-index:2;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:0 18px 16px}.bc-core-stat{padding:10px 8px;border:1px solid rgba(62,164,207,.18);border-radius:12px;background:rgba(5,28,43,.62);text-align:center}.bc-core-stat span{display:block;color:#668da5;font-size:9px}.bc-core-stat b{display:block;margin-top:3px;font-size:14px}
.bc-core-actions{position:relative;z-index:2;display:flex;justify-content:center;gap:9px;padding:0 18px 20px}.bc-core-actions button{min-height:42px;border:1px solid #286889;border-radius:12px;background:#0a2a40;color:#eaf8ff;padding:0 15px;font-weight:900}.bc-core-actions button:first-child{border-color:#70dcff;background:linear-gradient(135deg,#176a91,#154b77);box-shadow:0 0 18px rgba(49,181,236,.2)}
.bc-ai-core[data-state="listening"] .bc-orb{animation-duration:.7s;box-shadow:0 0 22px #9affea,0 0 65px #29cfee,0 0 120px rgba(37,162,231,.8)}.bc-ai-core[data-state="thinking"] .bc-ring{border-style:dashed;animation-duration:2.2s}.bc-ai-core[data-state="speaking"] .bc-orb{animation:bcSpeak .45s ease-in-out infinite alternate}.bc-ai-core[data-state="error"] .bc-orb{filter:hue-rotate(135deg);opacity:.72}
@keyframes bcOrb{50%{transform:scale(1.08);filter:brightness(1.15)}}@keyframes bcSpeak{to{transform:scale(1.13);filter:brightness(1.3)}}@keyframes bcSpin{to{transform:rotate(360deg)}}@keyframes bcTilt{50%{transform:rotate(-18deg) scaleX(.92)}}@keyframes bcTilt2{50%{transform:rotate(24deg) scaleY(.92)}}@keyframes bcDot{0%{transform:rotate(0) translateX(92px)}100%{transform:rotate(360deg) translateX(92px)}}
@media(max-width:720px){.bc-ai-core{min-height:500px;border-radius:18px}.bc-core-top{padding:16px}.bc-orb-wrap{width:195px;height:195px}.bc-core-stage{min-height:270px}.bc-core-actions{display:grid;grid-template-columns:1fr 1fr}.bc-core-actions button:last-child{grid-column:1/-1}.bc-core-caption span{max-width:280px}.bc-core-stats{padding-inline:12px;gap:5px}.bc-core-stat{padding-inline:3px}}
@media(prefers-reduced-motion:reduce){.bc-ai-core *{animation-duration:0s!important;animation-iteration-count:1!important}}
`;document.head.appendChild(style)}
function install(){
  const host=document.querySelector('#assistant .panel');if(!host||document.querySelector('#bcVisualCore'))return;
  installStyle();
  const core=document.createElement('section');core.id='bcVisualCore';core.className='bc-ai-core';core.dataset.state='idle';core.setAttribute('aria-label','蒲郡担当AIコア');
  core.innerHTML=`<div class="bc-core-top"><div class="bc-core-title"><small>BOAT COMMAND · GAMAGORI</small><strong>AI CORE</strong></div><div class="bc-core-online"><i></i>LOCAL CORE ONLINE</div></div><div class="bc-core-stage"><div class="bc-orb-wrap" aria-hidden="true"><div class="bc-ring r1"></div><div class="bc-ring r2"></div><div class="bc-ring r3"></div><div class="bc-orbit-dot"></div><div class="bc-orb"></div></div><div class="bc-core-caption"><strong data-core-state>待機中</strong><span data-core-line>蒲郡LIVEの状態を監視しています</span></div></div><div class="bc-core-stats"><div class="bc-core-stat"><span>第一候補</span><b data-core-stat="first">0/12</b></div><div class="bc-core-stat"><span>第二候補</span><b data-core-stat="second">0/12</b></div><div class="bc-core-stat"><span>HARD LOCK</span><b data-core-stat="locked">0/12</b></div><div class="bc-core-stat"><span>精算</span><b data-core-stat="settled">0/12</b></div></div><div class="bc-core-actions"><button type="button" data-core-action="talk">🎙 AIと話す</button><button type="button" data-core-action="refresh">最新同期</button><button type="button" data-core-action="connect">ChatGPT接続</button></div>`;
  const heading=host.querySelector('h2');heading?.insertAdjacentElement('afterend',core);
  core.querySelector('[data-core-action="talk"]').addEventListener('click',talk);
  core.querySelector('[data-core-action="refresh"]').addEventListener('click',refresh);
  core.querySelector('[data-core-action="connect"]').addEventListener('click',connect);
  renderStats();latestLine();
  const voice=document.querySelector('#bcVoiceStatus');if(voice)new MutationObserver(()=>setState(stateFromText(voice.textContent),voice.textContent)).observe(voice,{childList:true,subtree:true,characterData:true});
  const chat=document.querySelector('#chat');if(chat)new MutationObserver(latestLine).observe(chat,{childList:true,subtree:true});
  pulseTimer=setInterval(renderStats,5000);
}
window.BOAT_COMMAND_VISUAL_AI_CORE=Object.freeze({version:VERSION,free:true,readOnly:true,setState,renderStats});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
