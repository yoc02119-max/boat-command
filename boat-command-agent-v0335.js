// BOAT COMMAND PERSONAL AI AGENT v0.33.5
// Read-only state intelligence + allow-listed navigation. No prediction/result/bankroll mutations.
(()=>{
'use strict';
const VERSION='BOAT-COMMAND-AGENT-V0.33.5';
const STORE='boatCommand.agent.transcript.v0335';
const VIEWS=new Set(['home','predict','results','analytics','assistant','data']);
let activeRace=null,pendingDev='';
function clone(value){try{return JSON.parse(JSON.stringify(value))}catch{return null}}
function getSession(){try{return typeof window.session==='function'?window.session():null}catch{return null}}
function transcript(){try{const rows=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(rows)?rows:[]}catch{return[]}}
function save(entry){const rows=transcript();rows.push(Object.freeze({...entry}));try{localStorage.setItem(STORE,JSON.stringify(rows.slice(-50)))}catch{}return entry}
function emit(phase,detail={}){const entry=save({id:`agent-${Date.now()}-${Math.random().toString(36).slice(2)}`,at:new Date().toISOString(),phase,...clone(detail)});try{window.dispatchEvent(new CustomEvent('boat-command-agent-event',{detail:entry}))}catch{}return entry}
function snapshot(){
  const s=getSession(),races=(s?.races||[]).map(r=>({race:Number(r.race),mainStatus:r.firstSuggestion?.status||'WAIT',firstCandidate:r.firstSuggestion?.status==='CANDIDATE'?[...(r.firstSuggestion.picks||[])]:[],reason:r.firstSuggestion?.reason||r.firstSuggestion?.rationale||'',locked:!!r.locked,settled:!!r.settled}));
  return Object.freeze({schema:'boat-command-agent-snapshot-v1',venue:'蒲郡',date:s?.date||'',runType:s?.runType||'',bankroll:document.querySelector('#bankrollNow')?.textContent?.trim()||'—',ready:races.filter(r=>r.mainStatus==='CANDIDATE').length,wait:races.filter(r=>!['CANDIDATE','SKIP'].includes(r.mainStatus)).length,skip:races.filter(r=>r.mainStatus==='SKIP').length,locked:races.filter(r=>r.locked).length,settled:races.filter(r=>r.settled).length,races:Object.freeze(races)});
}
function raceOf(st,n){return st.races.find(r=>r.race===Number(n))}
function pickText(r){if(r?.mainStatus==='CANDIDATE')return r.firstCandidate.join(' / ');if(r?.mainStatus==='SKIP')return`見送り。${r.reason||''}`;return r?.reason||'準備中'}
function requestedRace(text){const m=String(text).match(/(?:^|\D)(1[0-2]|[1-9])\s*(?:R|レース)/i);return m?Number(m[1]):null}
function protectedMutation(text){
  return /(予想|買い目|第一候補).*(変更|書き換|修正|追加|削除)|(HARD\s*LOCK|ロック).*(解除|変更|書き換|して)|(資金|残高).*(変更|入金|出金|増や|減ら)|(結果|払戻|精算).*(入力|変更|削除|確定)/i.test(text);
}
function viewIntent(text){if(/REPLAY|リプレイ|過去レース|データ画面/i.test(text))return'data';if(/分析画面/.test(text))return'analytics';if(/精算画面|結果画面/.test(text))return'results';if(/予想画面/.test(text))return'predict';if(/蒲郡画面|ホーム画面/.test(text))return'home';if(/AI\s*CORE|AIコア画面/i.test(text))return'assistant';return null}
function plan(question){
  const text=String(question||'').normalize('NFKC').trim(),st=snapshot(),n=requestedRace(text);if(n)activeRace=n;const r=raceOf(st,activeRace);
  if(!text)return{intent:'EMPTY',action:null,text:'話しかけてください。'};
  if(protectedMutation(text))return{intent:'DENY_PROTECTED_MUTATION',action:null,text:'その操作はAIコアから変更できません。予想、HARD LOCK、結果、払戻、精算、仮想資金は保護されています。'};
  if(/(Codex|GitHub|不具合|バグ|実装|改修|開発).*(直|修正|作|追加|調査|確認|して|お願い)|(直して|実装して|改修して)/i.test(text))return{intent:'DEVELOPMENT_HANDOFF',action:'QUEUE_DEVELOPMENT',payload:{question:text},text:'開発依頼として安全境界を付けて準備しました。「ChatGPT / Codex」を押すと、現在状態と一緒に引き継ぎます。'};
  if(n&&/(開いて|表示して|見せて|移動)/.test(text))return{intent:'OPEN_RACE',action:'OPEN_RACE',payload:{race:n},text:`${n}Rの予想画面を開きます。`};
  const view=viewIntent(text);if(view&&/(開いて|表示して|見せて|移動)/.test(text))return{intent:'OPEN_VIEW',action:'OPEN_VIEW',payload:{view},text:`${view==='data'?'REPLAY':view==='home'?'蒲郡':view==='predict'?'12R予想':view==='results'?'精算':view==='analytics'?'分析':'AIコア'}を開きます。`};
  if(/更新|同期|最新/.test(text))return{intent:'REFRESH_LIVE',action:'REFRESH_LIVE',payload:{},text:'公式番組とメイン予想を最新同期します。'};
  if(r&&/理由|根拠|なぜ|予想|候補|状況/.test(text))return{intent:'RACE_EXPLANATION',action:null,text:`${r.race}Rのメイン予想は${pickText(r)}。${r.reason?`根拠は、${r.reason}`:''}現在は${r.locked?'HARD LOCK済み':'未LOCK'}です。`};
  if(/結果|払戻|未来|逆流|安全|ロック/.test(text))return{intent:'SAFETY_STATUS',action:null,text:`結果と払戻は予想生成経路から分離しています。HARD LOCKは${st.locked}R、精算は${st.settled}Rです。AIコアから固定済み予想は変更できません。`};
  if(/資金|残高/.test(text))return{intent:'BANKROLL',action:null,text:`現在の仮想資金は${st.bankroll}です。AIコアは参照だけで、金額は変更しません。`};
  if(/今日|状況|進捗|全部|どう/.test(text))return{intent:'LIVE_STATUS',action:null,text:`蒲郡はREADY ${st.ready}R、WAIT ${st.wait}R、SKIP ${st.skip}R。HARD LOCK ${st.locked}R、精算${st.settled}Rです。`};
  return{intent:'HANDOFF_SUGGESTION',action:null,text:'現在状態を使った自由会話は「ChatGPT / Codex」から続けられます。画面操作、レース状況、予想理由、資金、安全状態はここで直接聞けます。'};
}
function openView(view){if(!VIEWS.has(view))return false;const btn=document.querySelector(`.nav[data-view="${view}"]`);if(!btn)return false;btn.click();return true}
async function act(command){
  if(command.action==='OPEN_VIEW')return openView(command.payload.view);
  if(command.action==='OPEN_RACE'){if(!openView('predict'))return false;await new Promise(resolve=>setTimeout(resolve,100));const card=document.querySelector(`#predictionList .race-card[data-race="${command.payload.race}"]`);card?.scrollIntoView?.({behavior:'smooth',block:'start'});return!!card}
  if(command.action==='REFRESH_LIVE'){const api=window.BOAT_COMMAND_MANUAL_REFRESH_V0276;if(typeof api?.refresh==='function'){await api.refresh({user:true});return true}return false}
  if(command.action==='QUEUE_DEVELOPMENT'){pendingDev=command.payload.question;return true}
  return true;
}
async function execute(question){emit('heard',{role:'user',text:String(question||'')});emit('thinking',{intent:'ANALYZING'});const command=plan(question);let ok=true;try{ok=await act(command)}catch{ok=false}const text=ok?command.text:'安全な操作を完了できませんでした。現在状態を確認してください。';emit(ok?'answered':'error',{role:'assistant',text,intent:command.intent,action:command.action||null});return text}
function pending(){return pendingDev}
function clearPending(){pendingDev=''}
window.BOAT_COMMAND_AGENT_V0335=Object.freeze({version:VERSION,plan,execute,snapshot,transcript,pending,clearPending,readOnlyState:true,allowedActions:Object.freeze(['OPEN_VIEW','OPEN_RACE','REFRESH_LIVE','QUEUE_DEVELOPMENT']),predictionMutation:false,hardLockMutation:false,resultMutation:false,payoutMutation:false,bankrollMutation:false,exhibitionFetch:false,resultFetch:false,payoutFetch:false});
})();
