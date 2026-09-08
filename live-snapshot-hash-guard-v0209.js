// BOAT COMMAND GAMAGORI LIVE SNAPSHOT HASH GUARD v0.20.9
// Recomputes the immutable PRE-RACE snapshot hash before POST-RACE settlement.
// Fail-closed: no result settlement is allowed if the stored snapshot hash cannot be verified.
const BC_LIVE_SNAPSHOT_HASH_GUARD_V0209={version:'GAMAGORI-LIVE-SNAPSHOT-HASH-GUARD-V0.20.9',productionMutation:false};

function bcCanonicalSnapshotV0209(snapshot){
  if(!snapshot)return null;
  const x=JSON.parse(JSON.stringify(snapshot));
  delete x.snapshotHash;
  return x;
}

async function bcVerifyLiveLockSnapshotHashV0209(r){
  if(!r?.locked)return {ok:false,reason:'未LOCK'};
  const snap=r.liveLockSnapshot;
  if(!snap)return {ok:false,reason:'LOCK SNAPSHOTなし'};
  if(typeof digest!=='function')return {ok:false,reason:'HASH関数なし'};
  const stored=String(r.liveLockSnapshotHash||snap.snapshotHash||'');
  if(!stored)return {ok:false,reason:'SNAPSHOT HASHなし'};
  if(r.liveLockSnapshotHash&&snap.snapshotHash&&String(r.liveLockSnapshotHash)!==String(snap.snapshotHash))return {ok:false,reason:'SNAPSHOT HASH二重管理不一致'};
  const canonical=bcCanonicalSnapshotV0209(snap);
  const computed=String(await digest(JSON.stringify(canonical)));
  if(computed!==stored)return {ok:false,reason:'SNAPSHOT HASH不一致',stored,computed};
  const legacy=typeof bcVerifyLiveLockSnapshotV0203==='function'?bcVerifyLiveLockSnapshotV0203(r):{ok:false,reason:'SNAPSHOT_VERIFIERなし'};
  if(!legacy.ok)return {ok:false,reason:legacy.reason};
  return {ok:true,reason:'HASH_VERIFIED',hash:computed};
}

async function bcAuditLiveSnapshotHashesV0209(){
  const s=session();
  if(!s||s.runType!=='LIVE')return {status:'NOT_LIVE',ok:true,checked:0,failed:0,races:[]};
  const races=[];
  for(const r of s.races||[]){
    if(!r.locked)continue;
    const a=await bcVerifyLiveLockSnapshotHashV0209(r);
    races.push({race:Number(r.race),ok:a.ok,reason:a.reason});
  }
  const failed=races.filter(x=>!x.ok).length;
  const out={version:BC_LIVE_SNAPSHOT_HASH_GUARD_V0209.version,status:failed?'HASH_FAIL':'HASH_PASS',ok:failed===0,checked:races.length,failed,races,checkedAt:new Date().toISOString(),productionMutation:false};
  s.liveSnapshotHashAudit=out;
  saveStore();
  return out;
}

const _bcAnswerV0209=answer;
answer=function(q){
  const t=String(q||'').replace(/\s/g,'');
  if(/ハッシュ監査|HASH監査|スナップショット真正性|改ざん検知/.test(t)){
    setTimeout(()=>bcAuditLiveSnapshotHashesV0209().then(()=>{if(typeof renderAll==='function')renderAll();}),0);
    const a=session()?.liveSnapshotHashAudit;
    if(!a)return 'LOCKスナップショットのHASH監査を開始しました。';
    return `LOCKスナップショットHASH監査は <strong>${esc(a.status)}</strong>。確認 ${a.checked||0}件、FAIL ${a.failed||0}件です。`;
  }
  return _bcAnswerV0209(q);
};

setTimeout(()=>bcAuditLiveSnapshotHashesV0209(),600);
