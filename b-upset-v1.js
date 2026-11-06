(()=>{'use strict';
const $=id=>document.getElementById(id),el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n};
const names=['桐生','戸田','江戸川','平和島','多摩川','浜名湖','蒲郡','常滑','津','三国','びわこ','住之江','尼崎','鳴門','丸亀','児島','宮島','徳山','下関','若松','芦屋','福岡','唐津','大村'];
const date=v=>new Date(v).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}),today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),yen=v=>Number(v).toLocaleString('ja-JP')+'円';
let busy=false,candidates=null,review=null;
async function read(path){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const r=await fetch('https://raw.githubusercontent.com/yoc02119-max/boat-command/main/research/'+path+'?t='+Date.now(),{cache:'no-store',credentials:'omit',signal:controller.signal});if(!r.ok)throw Error('通信');return await r.json()}finally{clearTimeout(timer)}}
function renderCandidates(){if(!candidates)return;const p=candidates,stale=Date.now()-Date.parse(p.generatedAt)>1800000;
$('status').textContent=p.date+'の記録／更新 '+date(p.generatedAt);$('fresh').textContent=stale?'30分以上前の記録です。今の情報か、まだ確認できていません。':'';
$('work-candidates').textContent='記録あり：'+p.selected+'レース。更新 '+date(p.generatedAt);
$('counts').textContent='A級とB級が一緒に走り、元の情報を確認できた '+p.eligibleMixed+'レース中、候補は '+p.selected+'レース。';
const labels={program_hash_changed:'元の出走表と予想に使った出走表が違う',not_mixed:'A級とB級が一緒ではない',missing_program_or_pre:'出走表か予想がまだない',unsafe_snapshot:'予想の安全条件を満たさない',unsafe_program:'出走表の安全条件を満たさない',identity:'レースの情報が一致しない',late_or_invalid_pre:'締切前の記録と確認できない',invalid_clock:'記録時刻を確認できない',boat_classes:'選手の級や艇番号を確認できない',missing_120_orders:'予想の情報が足りない',probability:'予想点を確認できない',probability_sum:'予想点の合計が合わない'};
$('excluded').textContent='表示しない枠：'+Object.entries(p.excluded).map(([k,v])=>(labels[k]||'情報の確認が必要')+' '+v+'枠').join('、');
const rows=p.rows.filter(x=>x.selected&&x.date===today()&&Date.parse(x.deadlineAt)-Date.now()>180000),list=$('list');list.replaceChildren();
if(!rows.length)list.append(el('p','今、締切に間に合う候補はありません。'));
for(const x of rows){const card=el('article','');card.append(el('h3',(names[Number(x.venueCode)-1]||x.venue)+' '+x.race+'レース'),el('strong',x.bLane+'号艇 '+x.bClass+' '+x.bName),el('p','1着を'+x.bLane+'号艇にした候補：'+x.bPicks.join('、')),el('p','締切 '+date(x.deadlineAt)));
const found=review?.rows.find(r=>r.date===x.date&&r.venue===x.venue&&r.race===x.race&&r.selected&&r.predictionSha256===x.predictionSha256);
if(found?.bOdds){card.append(el('p','100円が当たった場合：'+Object.entries(found.bOdds).map(([p,o])=>p+' → '+yen(Math.round(o*100))).join(' ／ ')),el('small',date(found.oddsReceivedAt)+'に調べた金額です。最終的な払戻額とは異なる場合があります。'));}else card.append(el('p','戻る金額：まだ取得できていません。'));
const detail=el('details','');detail.append(el('summary','候補になった理由'),el('p','B級の予想点 '+(x.bScore*100).toFixed(1)+'点 ／ 比べたA級 '+x.aLane+'号艇 '+x.aClass+' '+(x.aScore*100).toFixed(1)+'点。B級の方が高いため候補です。'),el('small','当たる確率や高配当を示す点数ではありません。予想を作った時刻：'+date(x.generatedAt)));card.append(detail);list.append(card)}
}
function renderReview(){if(!review)return;const p=review,late=Date.now()-Date.parse(p.generatedAt)>1800000;
$('work-odds').textContent='金額の記録あり：候補 '+p.selectedWithOdds+'レース。'+(p.oddsSource.observations?'直近の受け取りで、新しく保存した数 '+p.oddsSource.imported+'件。':'受け取りの動作は、まだ実際のデータで確認できていません。');
const waiting=p.rows.filter(r=>r.selected&&r.status!=='SETTLED').length;
$('work-results').textContent='集計できた '+p.settled+'レース／結果や情報待ち '+waiting+'レース。'+(late?'集計の記録が30分以上前です。':'');
const out=$('results');out.replaceChildren();if(!p.settled){out.append(el('p','まだ集計できる結果がありません。収支は未判定です。'));}else{
out.append(el('p',p.settled+'レースを集計。B級が1着：'+p.bWins+'回／4通りの的中：'+p.bHits+'回。'),el('p','使ったとする金額 '+yen(p.stake)+' ／ 戻った金額 '+yen(p.bReturn)),el('p','B級を選んだ場合の収支 '+yen(p.bProfit)),el('p','同じ金額でA級を選んだ場合の収支 '+yen(p.aProfit)),el('small','集計更新 '+date(p.generatedAt)+'。この結果だけで、これからも増えるとは判断できません。'));}
const unusable=p.rows.filter(r=>r.status==='RESULT_UNUSABLE').length;if(unusable)out.append(el('p','結果の情報を確認できず、集計に入れていないもの：'+unusable+'レース。'));
}
async function load(){if(busy)return;busy=true;$('refresh').disabled=true;const results=await Promise.allSettled([read('b-over-a-latest-v1.json'),read('b-over-a-review-latest-v1.json')]);try{
const [a,b]=results;if(a.status==='fulfilled'&&a.value.schema==='b-over-a-shadow-v1'&&Array.isArray(a.value.rows)&&Number.isFinite(Date.parse(a.value.generatedAt))){if(!candidates||Date.parse(a.value.generatedAt)>=Date.parse(candidates.generatedAt))candidates=a.value;}else $('status').textContent='候補を読み込めませんでした。残っている表示は前回の記録です。';
if(b.status==='fulfilled'&&b.value.schema==='b-over-a-review-v1'&&Array.isArray(b.value.rows)&&Number.isFinite(Date.parse(b.value.generatedAt))){if(!review||Date.parse(b.value.generatedAt)>=Date.parse(review.generatedAt))review=b.value;renderReview();}else{if(review)renderReview();else{$('results').textContent='集計を読み込めませんでした。';$('work-results').textContent='集計の取得待ちです。';$('work-odds').textContent='金額情報の取得状況を確認できません。'}$('work-results').append(el('small','通信に失敗しました。残っている表示は前回の記録です。'));}
renderCandidates();if(a.status!=='fulfilled')$('status').textContent='候補を読み込めませんでした。残っている表示は前回の記録です。';
}catch(e){$('status').textContent='表示に必要な情報を確認できませんでした。残っている表示は前回の記録です。';}finally{busy=false;$('refresh').disabled=false}}
$('refresh').addEventListener('click',load);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});setInterval(()=>{if(!document.hidden){renderCandidates();renderReview();load()}},30000);load();
})();
