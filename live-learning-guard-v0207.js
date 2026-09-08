// BOAT COMMAND GAMAGORI LEARNING PROMOTION GUARD v0.20.7
// Produces SHADOW improvement signals only. It never changes production predictor weights automatically.
const BC_LEARNING_GUARD_V0207={version:'GAMAGORI-LEARNING-GUARD-V0.20.7',minRecords:30,minSegmentRecords:10,autoPromotion:false};

function bcLearningGuardV0207(){
  const z=typeof bcLearningRollupV0206==='function'?bcLearningRollupV0206():{records:[],byHead:{},missClasses:{}};
  const records=z.records||[];
  const reasons=[];
  if(records.length<BC_LEARNING_GUARD_V0207.minRecords)reasons.push(`全体サンプル ${records.length}/${BC_LEARNING_GUARD_V0207.minRecords}`);
  const segments=Object.entries(z.byHead||{}).map(([head,v])=>({head:Number(head),...v,roi:v.investment?v.returns/v.investment*100:null,hitRate:v.races?v.hits/v.races*100:null}));
  const qualified=segments.filter(x=>x.races>=BC_LEARNING_GUARD_V0207.minSegmentRecords);
  if(!qualified.length)reasons.push(`軸別サンプル ${BC_LEARNING_GUARD_V0207.minSegmentRecords}R以上が未成立`);
  const topMiss=Object.entries(z.missClasses||{}).sort((a,b)=>b[1]-a[1])[0]||null;
  const best=qualified.slice().sort((a,b)=>(b.roi??-Infinity)-(a.roi??-Infinity))[0]||null;
  const worst=qualified.slice().sort((a,b)=>(a.roi??Infinity)-(b.roi??Infinity))[0]||null;
  const evidenceReady=reasons.length===0;
  return {
    version:BC_LEARNING_GUARD_V0207.version,status:evidenceReady?'EVIDENCE_READY_SHADOW':'INSUFFICIENT_SAMPLE',
    records:records.length,reasons,topMiss,best,worst,
    autoPromotion:false,productionPredictorChanged:false,
    recommendation:evidenceReady?`SHADOW比較可能。${best?`${best.head}号艇軸 ROI ${best.roi.toFixed(1)}% / ${best.races}R`:'優位軸なし'}。ただしproduction自動変更は禁止。`:'データ蓄積を継続。production予想ロジックは変更しない。'
  };
}
function renderLearningGuardV0207(){
  const host=document.querySelector('#analytics .analytics-grid');if(!host)return;
  let panel=document.querySelector('#bcLearningGuardV0207');if(!panel){panel=document.createElement('section');panel.id='bcLearningGuardV0207';panel.className='panel wide';host.appendChild(panel);}
  const g=bcLearningGuardV0207(),safe=g.status==='EVIDENCE_READY_SHADOW';
  panel.innerHTML=`<div class="panel-head"><div><h2>学習 → 本番昇格ガード</h2><p>過学習防止 · production自動変更禁止</p></div><span class="badge ${safe?'ready':'blind'}">${esc(g.status)}</span></div><div class="snapshot-note">${esc(g.recommendation)}</div><div class="snapshot-note">${g.reasons.length?'不足: '+esc(g.reasons.join(' / ')):'SHADOW評価条件を満たしています'}</div><div class="fineprint">autoPromotion=false。学習データは分析専用で、予想候補・READY判定・LOCK条件を自動では書き換えません。</div>`;
}
const _bcRenderAllV0207=renderAll;
renderAll=function(){_bcRenderAllV0207();renderLearningGuardV0207();};
const _bcAnswerV0207=answer;
answer=function(q){const t=String(q||'').replace(/\s/g,'');if(/学習を反映|自動学習|昇格|過学習|サンプル十分|モデル更新/.test(t)){const g=bcLearningGuardV0207();return `学習昇格ゲートは <strong>${g.status}</strong>。${esc(g.recommendation)} ${g.reasons.length?'不足: '+esc(g.reasons.join(' / ')):''}`;}return _bcAnswerV0207(q);};
renderLearningGuardV0207();
