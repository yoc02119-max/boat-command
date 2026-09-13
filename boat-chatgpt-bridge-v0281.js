// BOAT COMMAND CHATGPT BRIDGE v0.28.2
// Zero-API one-tap handoff: current BOAT COMMAND state is prefilled into ChatGPT.
(()=>{
'use strict';
const VERSION='GAMAGORI-CHATGPT-BRIDGE-V0.28.2';
function getSession(){try{return typeof window.session==='function'?window.session():null}catch{return null}}
function appVersion(){return document.querySelector('.version')?.textContent?.trim()||document.title||'BOAT COMMAND'}
function bankroll(){return document.querySelector('#bankrollNow')?.textContent?.trim()||'—'}
function raceSummary(r){
 const first=r?.firstSuggestion?.status==='CANDIDATE'?(r.firstSuggestion.picks||[]).join('/'):(r?.firstSuggestion?.reason||'未生成');
 const second=r?.liveSuggestion?.status==='CANDIDATE'?(r.liveSuggestion.picks||[]).join('/'):(r?.liveSuggestion?.reason||'展示待ち');
 return `${r.race}R 第一:${first} 第二:${second} LOCK:${r.locked?'済':'未'} 精算:${r.settled?'済':'未'}`;
}
function buildContext(question=''){const s=getSession();if(!s)return '';
 const lines=[
 'BOAT COMMANDから接続しました。あなたはこの会話のBOAT COMMAND蒲郡担当として、以下の現在状態を前提に自由会話してください。固定応答ではなく質問の意図を読み、必要なら比較・理由・注意点まで自然に答えてください。',
 '厳守: 当日結果・払戻をPRE-RACE予想に逆流させない。第一候補は展示不使用。第二候補のみ展示反映。HARD LOCK済み予想は後から書き換えない。',
 `アプリ:${appVersion()}`,
 `対象日:${s.date||'—'} / runType:${s.runType||'—'} / 会場:${s.venue||'蒲郡'}`,
 `仮想資金:${bankroll()}`,
 '--- 12R現在状態 ---',
 ...(s.races||[]).map(raceSummary),
 '--- 質問 ---',
 question||'今のBOAT COMMANDの状況を見て、重要な点だけ教えて。'
 ];return lines.join('\n')}
async function copyText(text){try{await navigator.clipboard.writeText(text);return true}catch{return false}}
function status(msg){const el=document.querySelector('#bcChatGPTBridgeStatus');if(el)el.textContent=msg}
function openPrefilled(ctx){
 const urls=[`https://chatgpt.com/?q=${encodeURIComponent(ctx)}`,`https://chatgpt.com/?prompt=${encodeURIComponent(ctx)}`];
 let w=null;try{w=window.open(urls[0],'_blank')}catch{}
 return !!w;
}
async function handoff(){
 const q=document.querySelector('#prompt')?.value?.trim()||'';
 const ctx=buildContext(q);if(!ctx){status('LIVE状態を取得できません');return}
 status('現在状態をChatGPTへ接続中…');
 const copied=await copyText(ctx);
 const opened=openPrefilled(ctx);
 status(opened?'ChatGPTへ現在状態を渡しました':copied?'現在状態をコピー済み。ChatGPTで貼り付けてください':'接続に失敗しました');
}
function install(){const card=document.querySelector('.assistant-card');const head=card?.querySelector('.panel-head');if(!card||!head||document.querySelector('#bcChatGPTBridgeBtn'))return;
 const wrap=document.createElement('div');wrap.className='bc-gpt-bridge';wrap.innerHTML='<button id="bcChatGPTBridgeBtn" type="button">✦ ChatGPTと接続</button><span id="bcChatGPTBridgeStatus">現在状態を自動連携</span>';head.appendChild(wrap);
 const style=document.createElement('style');style.id='bc-gpt-bridge-style';style.textContent='.bc-gpt-bridge{margin-left:auto;display:flex;align-items:center;gap:8px}.bc-gpt-bridge button{border:1px solid #4b7cff;background:#10264a;color:#fff;border-radius:10px;padding:8px 11px;font-weight:800}.bc-gpt-bridge span{font-size:10px;color:#7fa4c4}@media(max-width:720px){.bc-gpt-bridge span{display:none}}';document.head.appendChild(style);
 wrap.querySelector('#bcChatGPTBridgeBtn').addEventListener('click',handoff)}
 window.BOAT_COMMAND_CHATGPT_BRIDGE=Object.freeze({version:VERSION,buildContext,handoff,zeroApi:true});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();