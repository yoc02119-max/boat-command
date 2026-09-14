// BOAT COMMAND GAMAGORI state-aware AI core v0.32.0
(()=>{'use strict';
const VERSION='GAMAGORI-AI-CORE-V0.32.0',ctx={race:null};
const s=()=>{try{return session()}catch{return null}},race=(x,n)=>x?.races?.find(r=>Number(r.race)===Number(n));
const pickText=x=>x?.status==='CANDIDATE'?(x.picks||[]).join('、'):(x?.reason||'準備中');
function snapshot(){const x=s(),rs=x?.races||[];return{x,races:rs,ready:rs.filter(r=>r.firstSuggestion?.status==='CANDIDATE').length,locked:rs.filter(r=>r.locked).length,settled:rs.filter(r=>r.settled).length}}
function answer(q){const t=String(q||'').normalize('NFKC').trim(),st=snapshot();if(!st.x)return'蒲郡セッションを確認できません。';const m=t.match(/(1[0-2]|[1-9])\s*(?:R|レース)/i);if(m)ctx.race=Number(m[1]);const r=ctx.race?race(st.x,ctx.race):null;
 if(/更新|同期|最新/.test(t))return{action:'REFRESH',text:'公式番組とメイン予想を更新します。'};
 if(/展示|第二候補|404/.test(t))return'展示予想と第二候補は廃止済みです。展示ファイルは取得せず、公式番組と対象日より前の履歴だけでメイン予想を作ります。';
 if(/結果|払戻|未来|逆流|安全/.test(t))return`結果と払戻は予想確定まで遮断しています。履歴は対象日より前だけ、HARD LOCK済み予想は不変です。精算は${st.settled}/12です。`;
 if(r&&/理由|根拠|なぜ/.test(t)){const x=r.firstSuggestion;return x?.status==='CANDIDATE'?`${r.race}Rは${pickText(x)}。根拠は、${x.rationale}`:`${r.race}Rは${pickText(x)}です。`}
 if(r)return`${r.race}Rのメイン予想は${pickText(r.firstSuggestion)}です。現在は${r.locked?'HARD LOCK済み':'未LOCK'}です。`;
 if(/予想|状況|進捗|今日|全部/.test(t))return`メイン予想は${st.ready}/12、HARD LOCKは${st.locked}/12、精算は${st.settled}/12です。`;
 if(/資金|残高/.test(t))return`現在の仮想資金は${document.querySelector('#bankrollNow')?.textContent?.trim()||'確認中'}です。`;
 return`蒲郡専用メイン予想は${st.ready}/12です。レース番号を付けて、予想・理由・安全状態を聞けます。`}
async function respond(q){const out=answer(q);if(out?.action==='REFRESH'){const api=window.BOAT_COMMAND_MANUAL_REFRESH_V0276;return await api?.refresh?.()?'公式番組とメイン予想を更新しました。':'更新に失敗しました。'}return out}
window.BOAT_COMMAND_AI_CORE=Object.freeze({version:VERSION,answer,respond,snapshot,readOnly:true,exhibitionFetch:false,resultFetch:false,payoutFetch:false,predictionMutation:false});
})();
