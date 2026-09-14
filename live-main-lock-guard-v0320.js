// Final LIVE lock gate for program-only main predictions. No exhibition dependency.
(()=>{'use strict';
const POLICY={version:'GAMAGORI-MAIN-LOCK-GUARD-V0.32.9',minMarginMinutes:3,maxFutureSkewMinutes:2};
function deadline(date,time){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date))||!/^\d{1,2}:\d{2}$/.test(String(time)))return null;const d=new Date(`${date}T${time}:00+09:00`);return Number.isFinite(d.getTime())?d:null}
function validPick(v){const s=String(v||'').trim();return /^[1-6]-[1-6]-[1-6]$/.test(s)&&new Set(s.split('-')).size===3}
function cleanPicks(xs){return (Array.isArray(xs)?xs:[]).map(x=>String(x||'').trim()).filter(Boolean)}
function audit(s,r,now=new Date()){
 if(!s||s.runType!=='LIVE')return {ok:true,status:'NOT_LIVE'};
 if(!r||r.locked)return {ok:false,status:'BLOCKED',reason:!r?'レース情報なし':'HARD LOCK済み'};
 if(r.programSnapshotStatus!=='READY'||!Array.isArray(r.preRaceProfiles)||r.preRaceProfiles.length!==6)return {ok:false,status:'BLOCKED',reason:r.programSnapshotReason||'公式番組データ未取得'};
 const x=r.firstSuggestion;
 if(x?.status!=='CANDIDATE'||x.stage!=='MAIN')return {ok:false,status:'BLOCKED',reason:x?.reason||'メイン予想未生成'};
 if(String(x.sessionDate)!==String(s.date))return {ok:false,status:'BLOCKED',reason:'予想対象日不一致'};
 if(Math.abs(Number(x.probabilitySum)-1)>1e-10)return {ok:false,status:'BLOCKED',reason:'120通り確率監査NG'};
 const expected=cleanPicks(x.picks),actual=cleanPicks(r.picks);
 if(expected.length<1||expected.length>6||expected.some(p=>!validPick(p))||new Set(expected).size!==expected.length)return {ok:false,status:'BLOCKED',reason:'正式メイン予想の買い目監査NG'};
 if(actual.length!==expected.length||actual.some(p=>!validPick(p))||new Set(actual).size!==actual.length||JSON.stringify(actual)!==JSON.stringify(expected))return {ok:false,status:'BLOCKED',reason:'入力買い目が正式メイン予想と一致しません。更新して正式予想を復元してください'};
 const at=deadline(s.date,r.programDeadline);if(!at)return {ok:false,status:'BLOCKED',reason:'締切時刻未確認'};
 const margin=(at-now)/60000;if(margin<POLICY.minMarginMinutes)return {ok:false,status:'BLOCKED',reason:`締切余裕${Math.max(0,margin).toFixed(1)}分のためLOCK禁止`,marginMinutes:margin};
 const source=new Date(r.programSnapshotAt);if(!Number.isFinite(source.getTime())||(now-source)/60000 < -POLICY.maxFutureSkewMinutes)return {ok:false,status:'BLOCKED',reason:'番組取得時刻異常'};
 return {ok:true,status:'SAFE_TO_LOCK',marginMinutes:margin,checkedAt:now.toISOString(),version:POLICY.version,exhibitionRequired:false,candidateMatched:true};
}
window.bcFinalMainLockAuditV0320=audit;
const old=lockRace;lockRace=async function(n){const s=session(),r=s.races.find(x=>Number(x.race)===Number(n));if(s.runType==='LIVE'){const a=audit(s,r);r.liveLockAudit=a;saveStore();if(!a.ok){alert(`${n}R HARD LOCK BLOCKED\n${a.reason}`);renderAll();return false}}return old(n)};
})();
