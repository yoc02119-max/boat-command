// BOAT COMMAND CHATGPT BRIDGE v0.28.1
// Zero-API prototype: packages current BOAT COMMAND state for ChatGPT handoff.
(()=>{
'use strict';
const VERSION='GAMAGORI-CHATGPT-BRIDGE-V0.28.1';
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
 'あなたはBOAT COMMAND蒲郡専属AIです。以下はアプリが自動収集した現在状態です。',
 'ルール: 当日結果・払戻をPRE-RACE予想に逆流させない。第一候補は展示不使用。第二候補のみ展示反映。HARD LOCK済み予想は後から書き換えない。',
 `アプリ:${appVersion()}`,
 `対象日:${s.date||'—'} / runType:${s.runType||'—'} / 会場:${s.venue||'蒲郡'}`,
 `仮想資金:${bankroll()}`,
 '--- 12R状態 ---',
 ...(s.races||[]).map(raceSummary),
 '--- ユーザー質問 ---',
 question||'現在の状況を自然な日本語で分析し、重要な点と次に見るべきことを短く答えて。'
 ];return lines.join('\n')}
async function copyText(text){try{await navigator.clipboard.writeText(text);return true}catch{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand('copy')}catch{}ta.remove();return ok}}
function status(msg){let el=document.querySelector('#bcChatGPTBridgeStatus');if(!el)return;el.textContent=msg}
async function handoff(){const q=document.querySelector('#prompt')?.value?.trim()||'';const ctx=buildContext(q);if(!ctx){status('LIVE状態を取得できません');return}status('ChatGPT用コンテキスト作成中…');const copied=await copyText(ctx);status(copied?'現在状態をコピーしました。ChatGPTで貼り付ければこの続きから会話できます。':'コピーに失敗しました');if(copied){setTimeout(()=>{try{window.open('https://chatgpt.com/','_blank','noopener')}catch{}},150)}}
function install(){const card=document.querySelector('.assistant-card');const head=card?.querySelector('.panel-head');if(!card||!head||document.querySelector('#bcChatGPTBridgeBtn'))return;
 const wrap=document.createElement('div');wrap.className='bc-gpt-bridge';wrap.innerHTML='<button id="bcChatGPTBridgeBtn" type="button">✦ ChatGPTと接続</button><span id="bcChatGPTBridgeStatus">無料ブリッジ</span>';head.appendChild(wrap);
 const style=document.createElement('style');style.id='bc-gpt-bridge-style';style.textContent='.bc-gpt-bridge{margin-left:auto;display:flex;align-items:center;gap:8px}.bc-gpt-bridge button{border:1px solid #4b7cff;background:#10264a;color:#fff;border-radius:10px;padding:8px 11px;font-weight:800}.bc-gpt-bridge span{font-size:10px;color:#7fa4c4}@media(max-width:720px){.bc-gpt-bridge span{display:none}}';document.head.appendChild(style);
 wrap.querySelector('#bcChatGPTBridgeBtn').addEventListener('click',handoff)}
 window.BOAT_COMMAND_CHATGPT_BRIDGE=Object.freeze({version:VERSION,buildContext,handoff,zeroApi:true});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();