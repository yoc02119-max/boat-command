/* Read-only delivery progress. Plan + evidence are fetched from main, never inferred as complete. */
(() => {
 'use strict';
 const root=document.getElementById('deliveryProgress'); if(!root)return;
 const BASE='https://raw.githubusercontent.com/yoc02119-max/boat-command/main/';
 const EVERY=30000, STALE=90000;
 const $=id=>document.getElementById(id);
 let busy=false, lastGood=0, plan=null, fingerprint='', workFingerprint='', controller=null;
 const time=v=>{if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v+' JST（日付のみ）';const n=typeof v==='number'?v:Date.parse(v);return Number.isFinite(n)?new Date(n).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',hour12:false})+' JST':'未記録';};
 const node=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=String(txt);if(cls)n.className=cls;return n;};
 function safeLink(label,url){
  const a=node('a',label);try{const u=new URL(url);if(u.protocol!=='https:'||!['github.com','raw.githubusercontent.com'].includes(u.hostname))return node('span',label);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';return a;}catch{return node('span',label);}
 }
 function validate(p){
  if(!p||typeof p.version!=='string'||!p.current||!Array.isArray(p.stages)||p.stages.length!==6)throw Error('計画形式');
  const ids=new Set();for(const s of p.stages){if(!s.id||!s.title||!s.status||!Array.isArray(s.lines)||!Array.isArray(s.checks))throw Error('工程形式');for(const c of s.checks){if(!c.id||ids.has(c.id)||!c.status||typeof c.task!=='string')throw Error('確認項目形式');ids.add(c.id);}}
  return p;
 }
 async function read(path){
  const response=await fetch(BASE+path+'?progress='+Date.now(),{cache:'no-store',credentials:'omit',signal:controller.signal});
  if(!response.ok)throw Error('HTTP '+response.status);return response.json();
 }
 function renderPlan(p){
  plan=p;$('dpCurrent').textContent=p.current;$('dpVersion').textContent='v'+p.version;
  $('dpUpdated').textContent='計画更新：'+time(p.updatedAt);
  $('dpVerified').textContent='運用証拠の確認：'+time(p.evidenceLastVerifiedAt);
  $('dpLastWork').textContent=p.lastWork?.summary||'作業記録なし';
  $('dpLastWorkAt').textContent='作業記録：'+time(p.lastWork?.updatedAt)+'（現在の実行を保証する表示ではありません）';
  const next=$('dpNext');next.replaceChildren();
  for(const id of p.nextCheckIds||[]){const c=p.stages.flatMap(s=>s.checks).find(c=>c.id===id);if(c)next.append(node('li',id+'｜'+c.task));}
  const stages=$('dpStages'); const opens=new Set([...stages.querySelectorAll('details[open]')].map(x=>x.dataset.stage));stages.replaceChildren();
  for(const s of p.stages){
   const detail=node('details',undefined,'dp-stage');detail.dataset.stage=s.id;detail.open=opens.has(s.id);
   const summary=node('summary');summary.append(node('span',s.id,'dp-number'),node('span',s.title,'dp-title'),node('span',s.status,'dp-state'));detail.append(summary);
   const body=node('div',undefined,'dp-stage-body');for(const l of s.lines)body.append(node('p',l));body.append(node('p',s.gate,'dp-gate'));
   const list=node('ul');for(const c of s.checks){const li=node('li');li.dataset.check=c.id;li.append(node('strong',c.id+' · '+c.status),node('p',c.task));if(c.verifiedAt)li.append(node('small','確認：'+time(c.verifiedAt)));for(const e of c.evidence||[])li.append(safeLink(e.label,e.url));list.append(li);}body.append(list);detail.append(body);stages.append(detail);
  }
  const history=$('dpHistory');history.replaceChildren();for(const c of [...(p.changelog||[])].reverse()){const li=node('li');li.append(node('strong','v'+c.version+' · '+time(c.at)),node('p',c.summary));history.append(li);}
  $('dpOptional').textContent=p.optional||'';
  const evidence=$('dpEvidence');evidence.replaceChildren();for(const e of p.evidence||[])evidence.append(safeLink(e.label,e.url));
  $('dpDownload').disabled=false;
 }
 function liveCard(title,path,result,format){
  const el=node('article',undefined,'dp-observation');el.append(node('h4',title));
  if(result.status!=='fulfilled'){el.append(node('p','取得失敗 · 次回に再試行','dp-warning'));return el;}
  const x=result.value;el.append(node('p',format(x)),node('small','データ生成：'+time(x.generatedAt||x.updatedAt||x.lastVerifiedAt)),safeLink('取得元を確認',BASE+path));return el;
 }
 function renderLive(results){
  const target=$('dpLive');target.replaceChildren();
  target.append(liveCard('仮想TRY・精算','shared-try-portfolio-v1.json',results[0],x=>'精算 '+(x.settledTries??'不明')+'R / 結果待ち '+(x.pendingTries??'不明')+'R / 確定資金 '+(Number.isFinite(x.confirmedBankrollYen)?'¥'+x.confirmedBankrollYen.toLocaleString('ja-JP'):'不明')));
  target.append(liveCard('期別2着の独立研究','research/racer-period-second-forward-evaluation-v1.json',results[1],x=>'比較対象 '+(x.summary?.pairedRaces??'不明')+'R / '+(x.promotionEligible===true?'昇格候補の判定あり（承認は別途）':'昇格基準を満たした改善は未確認')));
  target.append(liveCard('保存された検証状態','AI-STATE.json',results[2],x=>'24場の一連動作：'+(x.deploymentState?.all24VenueEndToEndVerified===true?'確認済み':'未確認')+' / 予測改善：'+(x.deploymentState?.predictionImprovementVerified===true?'確認済み':'未確認')));
 }
 function freshness(){
  if(!lastGood){$('dpSync').textContent='最新計画の取得待ち';return;}
  if(!navigator.onLine||Date.now()-lastGood>STALE){$('dpSync').textContent='更新を確認できていません · 最後の取得 '+time(lastGood);$('dpSync').classList.add('dp-warning');}
 }
 async function refresh(){
  if(busy)return;busy=true;$('dpRefresh').disabled=true;controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
  try{
   const results=await Promise.allSettled([read('docs/delivery-roadmap-v1.json'),read('shared-try-portfolio-v1.json'),read('research/racer-period-second-forward-evaluation-v1.json'),read('AI-STATE.json')]);
   if(results[0].status!=='fulfilled')throw Error('計画取得失敗');const p=validate(results[0].value);const key=JSON.stringify(p);
   if(key!==fingerprint){renderPlan(p);fingerprint=key;}
   const live=results.slice(1), liveKey=JSON.stringify(live);if(liveKey!==workFingerprint){renderLive(live);workFingerprint=liveKey;}
   lastGood=Date.now();$('dpSync').textContent='最新計画を取得 · '+time(lastGood)+' · 表示中は30秒ごとに確認';$('dpSync').classList.remove('dp-warning');
   $('dpHomeCurrent').textContent=p.current+' · v'+p.version;
   $('dpHomeSync').textContent='計画更新 '+time(p.updatedAt);
  }catch{
   $('dpSync').textContent=(plan?'取得失敗 · 前回取得した計画を表示中（':'取得失敗 · 最新計画は未確認（')+(lastGood?'最後の取得 '+time(lastGood):'通信を確認してください')+'）';$('dpSync').classList.add('dp-warning');
   $('dpHomeSync').textContent='最新計画の取得失敗 · 前回の表示を保持';
  }finally{clearTimeout(timeout);busy=false;$('dpRefresh').disabled=false;}
 }
 function svg(p){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const wrap=(text,width=37)=>{const chars=Array.from(text);const a=[];for(let i=0;i<chars.length;i+=width)a.push(chars.slice(i,i+width).join(''));return a;};
  let y=255;const text=(x,y,s,size=24,col='#eaf0fa')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${col}">${esc(s)}</text>`;
  let body=`<rect width="1200" height="2350" fill="#0b1324"/>`+text(60,70,'BOAT COMMAND  /  v'+p.version,30,'#64d9d2')+text(60,128,'完成までのロードマップ',44)+text(60,182,'現在地：'+p.current,28,'#ffd58a')+text(60,222,'計画更新：'+time(p.updatedAt),20,'#a5b5ce');
  for(const s of p.stages){body+=`<rect x="45" y="${y}" width="1110" height="276" rx="18" fill="#142239" stroke="#2c405b"/>`+text(68,y+45,s.id+'  '+s.title,31)+text(68,y+85,s.status,24,'#ffd58a');let yy=y+126;for(const l of s.lines)for(const line of wrap(l)){body+=text(68,yy,line,24);yy+=33;}for(const line of wrap(s.gate,41)){body+=text(68,yy+15,line,22,'#83dbd2');yy+=29;}y+=300;}
  body+=text(60,2115,'運用と予測改善は別判定。詳細・根拠はアプリで確認。',24)+text(60,2160,'画像出力時点の計画です。最新版は開発進捗画面へ。',22,'#a5b5ce');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="2230" viewBox="0 0 1200 2230" role="img" aria-label="完成ロードマップ"><g font-family="sans-serif">${body}</g></svg>`;
 }
 $('dpRefresh').addEventListener('click',refresh);
 $('dpDownload').addEventListener('click',()=>{if(!plan)return;const blob=new Blob([svg(plan)],{type:'image/svg+xml;charset=utf-8'});const url=URL.createObjectURL(blob);const a=node('a');a.href=url;a.download='boat-command-roadmap-v'+plan.version+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 const details=$('dpDetails');for(const link of document.querySelectorAll('[data-open-progress]'))link.addEventListener('click',()=>{details.open=true;});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){freshness();refresh();}});window.addEventListener('online',refresh);window.addEventListener('offline',freshness);window.addEventListener('pageshow',refresh);
 setInterval(()=>{freshness();if(!document.hidden&&navigator.onLine)refresh();},EVERY);refresh();
})();
