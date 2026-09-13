// BOAT COMMAND GAMAGORI STATE-AWARE AI CORE v0.29.0
// Local deterministic conversation core. It never fetches results/payouts or mutates predictions.
(()=>{
'use strict';
const VERSION='GAMAGORI-AI-CORE-V0.29.0',ctx={lastRace:null,lastTopic:null};
const clean=v=>String(v??'').trim();
function getSession(){try{return typeof window.session==='function'?window.session():null}catch{return null}}
function raceOf(s,n){return s?.races?.find(r=>Number(r.race)===Number(n))||null}
function displayReason(v,fallback='準備中'){const x=clean(v||fallback);if(/HTTP_404/i.test(x))return '展示データ未公開';if(/HTTP_403/i.test(x))return '公式データへの接続待ち';if(/HTTP_5\d\d/i.test(x))return '配信元の一時応答待ち';return x.replaceAll('_',' ')}
function candidate(x,stage){if(x?.status==='CANDIDATE')return{ready:true,stage,picks:(x.picks||[]).filter(Boolean),reason:clean(x.rationale),rank:x.rank||[]};return{ready:false,stage,picks:[],reason:displayReason(x?.reason,stage==='FIRST'?'番組データ同期中':'展示データ待ち'),status:x?.status||'WAIT'}}
function bankroll(){return document.querySelector('#bankrollNow')?.textContent?.trim()||'—'}
function snapshot(){const s=getSession();if(!s)return null;const races=s.races||[];return{s,races,firstReady:races.filter(r=>r.firstSuggestion?.status==='CANDIDATE').length,secondReady:races.filter(r=>r.liveSuggestion?.status==='CANDIDATE').length,locked:races.filter(r=>r.locked).length,settled:races.filter(r=>r.settled).length,skipped:races.filter(r=>r.liveSuggestion?.status==='SKIP').length,waiting:races.filter(r=>r.liveSuggestion?.status!=='CANDIDATE'&&r.liveSuggestion?.status!=='SKIP').length}}
function raceNumbers(q){const a=clean(q).normalize('NFKC'),out=[];for(const m of a.matchAll(/(?:^|\D)(1[0-2]|[1-9])\s*(?:R|レース)/gi))out.push(Number(m[1]));if(!out.length){const m=a.match(/(1[0-2]|[1-9])\s*(?:番|について|はどう)/);if(m)out.push(Number(m[1]))}return[...new Set(out)]}
function picksText(x){return x.ready&&x.picks.length?x.picks.join('、'):displayReason(x.reason)}
function stageName(x){return x==='FIRST'?'第一候補':'第二候補'}
function raceReport(r,focus='BOTH'){const f=candidate(r.firstSuggestion,'FIRST'),z=candidate(r.liveSuggestion,'SECOND');if(focus==='FIRST')return`${r.race}Rの第一候補は${picksText(f)}です。${f.ready?'展示を使わず、番組と過去DBだけで固定した候補です。':''}`;if(focus==='SECOND')return`${r.race}Rの第二候補は${picksText(z)}です。${z.ready?'展示を反映した直前候補です。':z.status==='SKIP'?'安全条件を満たさないため見送りです。':'公開後に自動生成します。'}`;return`${r.race}Rは、第一候補が${picksText(f)}。第二候補は${picksText(z)}。現在は${r.locked?'HARD LOCK済み':'未LOCK'}です。`}
function compare(r){const f=candidate(r.firstSuggestion,'FIRST'),z=candidate(r.liveSuggestion,'SECOND');if(!f.ready)return`${r.race}Rは第一候補がまだ${displayReason(f.reason)}のため、比較できません。`;if(!z.ready)return`${r.race}Rは第一候補${f.picks.join('、')}まで確定。第二候補は${displayReason(z.reason)}なので、展示公開後に比較します。`;const same=f.picks.filter(p=>z.picks.includes(p)),added=z.picks.filter(p=>!f.picks.includes(p)),removed=f.picks.filter(p=>!z.picks.includes(p));if(same.length===f.picks.length&&same.length===z.picks.length)return`${r.race}Rは第一候補と第二候補が同じです。展示後も${same.join('、')}を維持しており、事前評価と直前評価が一致しています。`;return`${r.race}Rは共通${same.length?same.join('、'):'なし'}。展示後に加わったのは${added.length?added.join('、'):'なし'}、外れたのは${removed.length?removed.join('、'):'なし'}です。`}
function status(st){const waits=st.races.filter(r=>r.liveSuggestion?.status!=='CANDIDATE'&&r.liveSuggestion?.status!=='SKIP').map(r=>r.race);const tail=st.secondReady===12?'第二候補も12Rすべて生成済みです。':`第二候補は${st.secondReady}/12。${waits.length?waits.join('・')+'Rが展示待ちです。':''}`;return`今日の蒲郡は第一候補${st.firstReady}/12、${tail} HARD LOCKは${st.locked}/12、精算は${st.settled}/12です。`}
function safety(q,st){if(/結果|払戻|逆流|リーク|不正/.test(q))return`結果と払戻はPRE-RACE予想コアから分離しています。第一候補は展示・当日結果不使用、第二候補は展示だけを追加し、HARD LOCK済み予想は書き換えません。現在の精算は${st.settled}/12です。`;return'予想はPRE-RACE領域だけで生成します。第一候補は展示不使用、第二候補だけ展示反映、HARD LOCK後は不変です。'}
function explain(r,stage){const x=stage==='FIRST'?candidate(r.firstSuggestion,'FIRST'):candidate(r.liveSuggestion,'SECOND');if(!x.ready)return`${r.race}Rの${stageName(stage)}は${displayReason(x.reason)}です。`;return`${r.race}Rの${stageName(stage)}は${x.picks.join('、')}。理由は、${x.reason||(stage==='FIRST'?'番組構成と過去DBの照合':'展示タイム・ST・級別・コース評価')}です。`}
function answer(question){const q=clean(question);if(!q)return'質問を入力してください。';const st=snapshot();if(!st)return'蒲郡LIVEセッションを取得できません。';const nums=raceNumbers(q);let n=nums[0]||null;if(!n&&/(それ|そのレース|さっき|こっち)/.test(q))n=ctx.lastRace;if(n)ctx.lastRace=n;const r=n?raceOf(st.s,n):null,first=/第一|事前/.test(q),second=/第二|展示|直前/.test(q),why=/なぜ|理由|根拠|どうして/.test(q),comparison=/比較|違い|変わ|同じ|維持/.test(q);
 if(/更新|同期|最新に/.test(q))return{action:'REFRESH',text:'最新データを同期します。'};
 if(/結果|払戻|逆流|安全|ルール|ロック後|LOCK後/i.test(q)){ctx.lastTopic='SAFETY';return safety(q,st)}
 if(/資金|残高|仮想資金/.test(q)){ctx.lastTopic='BANKROLL';return`現在の仮想資金は${bankroll()}です。今日の精算済みは${st.settled}Rです。`}
 if(/何レース|何個|いくつ|状況|進捗|今日どう|予想でき|全部|全体/.test(q)&&!r){ctx.lastTopic='STATUS';return status(st)}
 if(/待ち|404|エラー|出ない|未生成|できない/.test(q)&&!r){const a=st.races.filter(x=>x.liveSuggestion?.status!=='CANDIDATE').map(x=>`${x.race}R:${displayReason(x.liveSuggestion?.reason||x.liveDataReason)}`);return a.length?`第二候補の未生成は${a.join('、')}です。HTTP 404は故障確定ではなく、展示データがまだ公開されていない状態として扱います。`:'第二候補はすべて生成済みです。'}
 if(r){if(comparison){ctx.lastTopic='COMPARE';return compare(r)}if(why){const stage=second&&!first?'SECOND':'FIRST';ctx.lastTopic=stage;return explain(r,stage)}const focus=first&&!second?'FIRST':second&&!first?'SECOND':'BOTH';ctx.lastTopic=focus;return raceReport(r,focus)}
 if(/第一/.test(q))return`第一候補は${st.firstReady}/12生成済みです。展示と当日結果は使っていません。レース番号を付ければ買い目と理由を説明できます。`;
 if(/第二|展示/.test(q))return`第二候補は${st.secondReady}/12生成済み、${st.skipped}R見送り、${st.waiting}R待機です。展示公開後のverifiedデータだけを反映します。`;
 if(/ロック|LOCK/i.test(q))return`HARD LOCKは${st.locked}/12です。LOCK済みの買い目と根拠は後から変更しません。`;
 if(/精算|成績|回収率|損益/.test(q))return`精算済みは${st.settled}/12です。回収率と損益は結果側でのみ計算し、予想側へ戻しません。`;
 return`${status(st)} 「3Rの第一と第二の違い」「第二候補が出ない理由」のように聞けば、現在データから具体的に答えます。`}
async function respond(q){const out=answer(q);if(out&&typeof out==='object'&&out.action==='REFRESH'){try{const api=window.BOAT_COMMAND_MANUAL_REFRESH_V0276;if(typeof api?.refresh==='function')await api.refresh({user:true});else{if(typeof window.syncGamagoriProgramSnapshot==='function')await window.syncGamagoriProgramSnapshot({render:true});if(typeof window.sweepVerifiedLiveRelays==='function')await window.sweepVerifiedLiveRelays({render:true})}return'予想データとアプリ最新版を同期しました。'}catch{return'同期中にエラーが発生しました。時間を置いて再試行します。'}}return out}
window.BOAT_COMMAND_AI_CORE=Object.freeze({version:VERSION,answer,respond,snapshot,readOnly:true,resultFetch:false,payoutFetch:false,predictionMutation:false});
})();
