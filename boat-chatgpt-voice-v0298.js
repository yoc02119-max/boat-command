// BOAT COMMAND embedded AI connection helper v0.33.7
// Keeps conversation inside BOAT COMMAND. External ChatGPT handoff is intentionally disabled.
(()=>{
'use strict';
const VERSION='GAMAGORI-EMBEDDED-AI-V0.33.7';
function getSession(){try{return typeof window.session==='function'?window.session():null}catch{return null}}
function appVersion(){return document.querySelector('.version')?.textContent?.trim()||document.title||'BOAT COMMAND'}
function bankroll(){return document.querySelector('#bankrollNow')?.textContent?.trim()||'—'}
function raceSummary(r){
 const main=r?.firstSuggestion?.status==='CANDIDATE'?(r.firstSuggestion.picks||[]).join('/'):(r?.firstSuggestion?.reason||'未生成');
 return `${r.race}R メイン:${main} LOCK:${r.locked?'済':'未'} 精算:${r.settled?'済':'未'}`
}
function buildContext(question=''){const s=getSession();if(!s)return'';return[
 'BOAT COMMANDからChatGPTボイスへ接続しました。あなたはこの会話のBOAT COMMAND蒲郡担当です。以下の現在状態を前提に、固定応答ではなく質問の意図を読み、比較・理由・注意点まで自然な日本語で会話してください。',
 '厳守: 当日結果・払戻・展示をPRE-RACE予想へ入れない。メイン予想は公式番組と対象日より前の履歴だけを使用。HARD LOCK済み予想は後から書き換えない。出目は1-2-3のように数字だけで読む。',
 '--- ChatGPTボイス操作権限 ---',
 'GitHub連携が利用可能なら、ユーザーの音声指示に従って yoc02119-max/boat-command を確認・更新できます。利用不能なら実行したふりをせず「このボイスではGitHub操作を利用できない」と明言してください。',
 '画面操作は repository=yoc02119-max/boat-command の boat-command-remote-command.json だけを更新します。schemaはboat-command-remote-command-v1、idは毎回一意、venueは蒲郡。許可actionはOPEN_VIEW、OPEN_RACE、REFRESH_LIVEのみです。',
 'OPEN_VIEW payload.view は home/predict/results/analytics/assistant/data のいずれか。OPEN_RACE payloadは {view:"predict",race:1〜12,mode:"VOICE"}。REFRESH_LIVE payloadは {}。更新後、BOAT COMMANDが約5秒で反映すると伝えてください。',
 '画面操作コマンドから、買い目・HARD LOCK・結果・払戻・仮想資金・精算データは絶対に変更しないでください。',
 'GitHubへの開発指示は、対象と目的を確認してから安全な変更を行い、構文確認・Actions確認・変更内容を報告してください。削除、履歴改変、秘密情報の保存は行わないでください。',
 `アプリ:${appVersion()}`,
 `対象日:${s.date||'—'} / runType:${s.runType||'—'} / 会場:${s.venue||'蒲郡'}`,
 `仮想資金:${bankroll()}`,
 '--- 12R現在状態 ---',
 ...(s.races||[]).map(raceSummary),
 '--- 最初の依頼 ---',
 question||'接続できたことを短く伝えて。続けて音声で質問します。'
].join('\n')}
function status(msg){const el=document.querySelector('#bcChatGPTVoiceStatus');if(el)el.textContent=msg}
async function copyText(text){try{await navigator.clipboard.writeText(text);return true}catch{return false}}
async function handoff(){
 const cloud=window.BOAT_COMMAND_CLOUD_AI_V0336,prompt=document.querySelector('#prompt');
 if(prompt){prompt.focus();prompt.scrollIntoView?.({behavior:'smooth',block:'center'})}
 status(cloud?.configured?.()?'アプリ内AI接続済み':'クラウドAI接続待ち');
 return!!cloud?.configured?.()
}
function install(){
 const card=document.querySelector('.assistant-card'),head=card?.querySelector('.panel-head');
 if(!card||!head||document.querySelector('#bcChatGPTVoiceBtn'))return;
 const old=document.querySelector('.bc-gpt-bridge');if(old)old.remove();
 const wrap=document.createElement('div');wrap.className='bc-gpt-voice';
 wrap.innerHTML='<button id="bcChatGPTVoiceBtn" type="button">AIコアで話す</button><span id="bcChatGPTVoiceStatus">会話はアプリ内で完結します</span>';
 head.appendChild(wrap);
 const style=document.createElement('style');style.id='bc-gpt-voice-style';style.textContent='.bc-gpt-voice{margin-left:auto;display:flex;align-items:center;gap:8px}.bc-gpt-voice button{border:1px solid #66a0ff;background:#173265;color:#fff;border-radius:10px;padding:8px 11px;font-weight:900}.bc-gpt-voice span{font-size:10px;color:#8fb1ce}@media(max-width:720px){.bc-gpt-voice span{display:none}.bc-gpt-voice button{font-size:11px;padding:7px 9px}}';document.head.appendChild(style);
 wrap.querySelector('#bcChatGPTVoiceBtn').addEventListener('click',handoff)
}
window.BOAT_COMMAND_CHATGPT_VOICE=Object.freeze({version:VERSION,buildContext,handoff,zeroApi:false,embedded:true,opensExternalPage:false});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
