// BOAT COMMAND GAMAGORI VOICE AGENT v0.28.0
// Free local voice shell: Web Speech API + BOAT COMMAND live state. No paid API.
(()=>{
'use strict';
const VERSION='GAMAGORI-VOICE-AGENT-V0.28.0';
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const canSpeak='speechSynthesis' in window;
function getSession(){try{return typeof window.session==='function'?window.session():null}catch{return null}}
function stats(){const s=getSession();const rs=s?.races||[];return{session:s,first:rs.filter(r=>r.firstSuggestion?.status==='CANDIDATE').length,second:rs.filter(r=>r.liveSuggestion?.status==='CANDIDATE').length,wait:rs.filter(r=>!r.liveSuggestion||r.liveSuggestion.status==='WAIT').length,locked:rs.filter(r=>r.locked).length,settled:rs.filter(r=>r.settled).length}}
function picksFor(race){const s=getSession(),r=s?.races?.find(x=>Number(x.race)===Number(race));if(!r)return null;return{first:r.firstSuggestion,second:r.liveSuggestion}}
async function doRefresh(){const btn=document.querySelector('#bcLatestBtn');if(btn){btn.click();return '最新データと予想の同期を開始しました。'}if(typeof window.sweepVerifiedLiveRelays==='function'){await window.sweepVerifiedLiveRelays({render:true});return '最新データを同期しました。'}return '更新機能を確認できませんでした。'}
function answer(q){const t=String(q||'').trim();const a=t.replace(/\s/g,'');const st=stats();if(!st.session)return '蒲郡LIVEセッションを確認できません。';
 const m=a.match(/(\d{1,2})R/),race=m?Number(m[1]):null;
 if(/今日どう|状況|進捗|どうなって|予想でき/.test(a))return `今日の蒲郡は、第一候補${st.first}レース、第二候補${st.second}レース、HARD LOCK ${st.locked}レースです。第二候補は展示公開に合わせて順次更新します。`;
 if(/第一候補/.test(a)&&race){const x=picksFor(race)?.first;return x?.status==='CANDIDATE'?`${race}Rの第一候補は、${x.picks.join('、')}です。`: `${race}Rの第一候補は${x?.reason||'準備中'}です。`}
 if(/第二候補|展示/.test(a)&&race){const x=picksFor(race)?.second;return x?.status==='CANDIDATE'?`${race}Rの第二候補は、${x.picks.join('、')}です。`: `${race}Rの第二候補は${x?.reason||'展示待ち'}です。`}
 if(/ロック|LOCK/i.test(t))return `現在、HARD LOCKは${st.locked}レースです。`;
 if(/精算|結果/.test(a))return `現在、精算済みは${st.settled}レースです。結果はPOST-RACE側だけで扱います。`;
 if(/資金|残高/.test(a)){const el=document.querySelector('#bankrollNow');return `現在の仮想資金は${el?.textContent?.trim()||'確認中'}です。`}
 if(/最新版|バージョン/.test(a))return `BOAT COMMANDは現在の公開画面を確認して回答しています。最新に更新ボタンで予想と公開資産を再同期できます。`;
 if(/更新|同期|最新/.test(a))return '__REFRESH__';
 return `この無料ローカル応答では判断しきれません。画面上の「ChatGPTと接続」を使うと、現在のBOAT COMMAND状態をChatGPTへ渡して自由会話できます。`;
}
function speak(text){if(!canSpeak)return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='ja-JP';u.rate=1.02;speechSynthesis.speak(u)}catch{}}
function pushChat(role,text){const chat=document.querySelector('#chat');if(!chat)return;const d=document.createElement('div');d.className=`bubble ${role}`;d.textContent=text;chat.appendChild(d);chat.scrollTop=chat.scrollHeight}
async function handle(q){if(!q)return;pushChat('user',q);let out=answer(q);if(out==='__REFRESH__')out=await doRefresh();pushChat('ai',out);speak(out);return out}
function loadBridge(){if(window.BOAT_COMMAND_CHATGPT_BRIDGE||document.querySelector('script[data-bc-chatgpt-bridge]'))return;const s=document.createElement('script');s.src=`boat-chatgpt-bridge-v0281.js?v=${Date.now()}`;s.dataset.bcChatgptBridge='1';s.async=true;document.head.appendChild(s)}
function install(){const card=document.querySelector('.assistant-card');const row=card?.querySelector('.input-row');if(!card||!row||document.querySelector('#bcVoiceBtn')){loadBridge();return}
 const btn=document.createElement('button');btn.id='bcVoiceBtn';btn.type='button';btn.className='bc-voice-btn';btn.textContent='🎙 話す';row.appendChild(btn);
 const style=document.createElement('style');style.id='bc-voice-agent-style';style.textContent='.bc-voice-btn{border:1px solid #2a6f96;background:#0b2740;color:#fff;border-radius:10px;padding:0 14px;font-weight:800;white-space:nowrap}.bc-voice-btn.listening{box-shadow:0 0 0 3px rgba(30,162,227,.2);background:#123c5d}.bubble.user{margin-left:auto;background:#123a5a;color:#eaf8ff}';document.head.appendChild(style);
 const prompt=document.querySelector('#prompt'),send=document.querySelector('#send');if(send&&!send.dataset.bcVoiceBound){send.dataset.bcVoiceBound='1';send.addEventListener('click',e=>{const q=prompt?.value?.trim();if(!q)return;e.stopImmediatePropagation();if(prompt)prompt.value='';handle(q)},true)}
 if(prompt&&!prompt.dataset.bcVoiceBound){prompt.dataset.bcVoiceBound='1';prompt.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const q=prompt.value.trim();if(q){prompt.value='';handle(q)}}})}
 if(!SR){btn.textContent='🎙 音声非対応';btn.disabled=true;loadBridge();return}
 const rec=new SR();rec.lang='ja-JP';rec.interimResults=false;rec.maxAlternatives=1;rec.onstart=()=>{btn.classList.add('listening');btn.textContent='● 聞いてます'};rec.onend=()=>{btn.classList.remove('listening');btn.textContent='🎙 話す'};rec.onerror=()=>{btn.classList.remove('listening');btn.textContent='🎙 話す'};rec.onresult=e=>{const q=e.results?.[0]?.[0]?.transcript||'';if(q)handle(q)};btn.addEventListener('click',()=>{try{rec.start()}catch{}});loadBridge()
}
window.BOAT_COMMAND_VOICE_AGENT=Object.freeze({version:VERSION,free:true,paidApi:false,handle});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();