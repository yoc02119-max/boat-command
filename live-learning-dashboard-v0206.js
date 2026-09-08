// BOAT COMMAND GAMAGORI LIVE LEARNING ROLLUP v0.20.6
// Aggregates only already-separated learning records across saved LIVE sessions.
// Read-only analytics: never changes PRE-RACE predictor, readiness, picks, or lock snapshots.
const BC_LIVE_LEARNING_ROLLUP_V0206={version:'GAMAGORI-LIVE-LEARNING-ROLLUP-V0.20.6',autoModelUpdate:false};

function bcAllLearningRecordsV0206(){
  const sessions=typeof allSessions==='function'?allSessions():Object.values(store?.sessions||{});
  return sessions
    .filter(s=>s&&s.runType==='LIVE')
    .flatMap(s=>(s.races||[]).map(r=>r?.liveLearningRecord).filter(Boolean))
    .filter(x=>x?.venue==='GAMAGORI'&&x?.boundaries?.preRaceImmutable===true&&x?.boundaries?.postRaceSeparated===true&&x?.boundaries?.resultUsedForPrediction===false);
}
function bcLearningRollupV0206(){
  const records=bcAllLearningRecordsV0206();
  const hits=records.filter(x=>x.outcome?.hit).length;
  const investment=records.reduce((a,x)=>a+Number(x.outcome?.stake||0),0);
  const returns=records.reduce((a,x)=>a+Number(x.outcome?.returnAmount||0),0);
  const missClasses=records.reduce((a,x)=>{const k=x.diagnosis?.class||'UNKNOWN';a[k]=(a[k]||0)+1;return a;},{});
  const byHead={};
  for(const x of records){
    const head=Number(String(x.prediction?.picks?.[0]||'').split('-')[0])||0;if(!head)continue;
    const b=byHead[head]||(byHead[head]={races:0,hits:0,investment:0,returns:0});
    b.races++;if(x.outcome?.hit)b.hits++;b.investment+=Number(x.outcome?.stake||0);b.returns+=Number(x.outcome?.returnAmount||0);
  }
  const byStrategy={};
  for(const x of records){const k=x.strategyVersion||'UNKNOWN',b=byStrategy[k]||(byStrategy[k]={races:0,hits:0,investment:0,returns:0});b.races++;if(x.outcome?.hit)b.hits++;b.investment+=Number(x.outcome?.stake||0);b.returns+=Number(x.outcome?.returnAmount||0);}
  return {records,hits,investment,returns,profit:returns-investment,hitRate:records.length?hits/records.length*100:null,roi:investment?returns/investment*100:null,missClasses,byHead,byStrategy};
}
function bcPctV0206(v){return Number.isFinite(v)?v.toFixed(1)+'%':'—';}
function bcRenderLearningRollupV0206(){
  const host=document.querySelector('#analytics .analytics-grid');if(!host)return;
  let panel=document.querySelector('#bcLearningRollupV0206');
  if(!panel){panel=document.createElement('section');panel.id='bcLearningRollupV0206';panel.className='panel wide';host.appendChild(panel);}
  const z=bcLearningRollupV0206();
  const miss=Object.entries(z.missClasses).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${v}R`).join(' / ')||'—';
  const heads=Object.entries(z.byHead).sort((a,b)=>Number(a[0])-Number(b[0])).map(([k,v])=>{const roi=v.investment?v.returns/v.investment*100:null;return `${k}号艇軸 ${v.races}R・的中${v.hits}・ROI ${bcPctV0206(roi)}`;}).join('<br>')||'—';
  panel.innerHTML=`<div class="panel-head"><div><h2>蒲郡 LIVE 学習ロールアップ</h2><p>保存済みLIVE全期間 · 結果→予想の自動逆流なし</p></div><span class="badge ready">SHADOW ONLY</span></div><div class="stack-stats"><div><span>記録</span><b>${z.records.length}R</b></div><div><span>的中率</span><b>${bcPctV0206(z.hitRate)}</b></div><div><span>回収率</span><b>${bcPctV0206(z.roi)}</b></div><div><span>損益</span><b>${typeof money==='function'?money(z.profit):z.profit}</b></div></div><div class="snapshot-note">ミス分類: ${esc(miss)}</div><div class="snapshot-note">1着軸別:<br>${heads}</div><div class="fineprint">この集計は改善候補を見るためのSHADOW分析です。予想モデルの重み・買い目・READY判定は自動変更しません。</div>`;
}
function bcLearningInsightV0206(){
  const z=bcLearningRollupV0206();if(!z.records.length)return 'まだ学習記録がありません。';
  const topMiss=Object.entries(z.missClasses).sort((a,b)=>b[1]-a[1])[0];
  const heads=Object.entries(z.byHead).filter(([,v])=>v.races>0).map(([head,v])=>({head,races:v.races,hits:v.hits,roi:v.investment?v.returns/v.investment*100:null})).sort((a,b)=>(b.roi??-Infinity)-(a.roi??-Infinity));
  const best=heads[0];
  return `全${z.records.length}R、的中率 ${bcPctV0206(z.hitRate)}、回収率 ${bcPctV0206(z.roi)}。最多ミスは ${topMiss?`${topMiss[0]} ${topMiss[1]}R`:'—'}。${best?`現時点の1着軸別最高ROIは${best.head}号艇軸 ${bcPctV0206(best.roi)}（${best.races}R）`:'軸別データなし'}。サンプル不足を避けるため自動モデル変更はしていません。`;
}
const _bcRenderAllV0206=renderAll;
renderAll=function(){_bcRenderAllV0206();bcRenderLearningRollupV0206();};
const _bcAnswerV0206=answer;
answer=function(q){const t=String(q||'').replace(/\s/g,'');if(/全期間学習|学習ロールアップ|改善傾向|ミス傾向|軸別成績/.test(t))return bcLearningInsightV0206();return _bcAnswerV0206(q);};
bcRenderLearningRollupV0206();
