// BOAT COMMAND venue rolling 30-day performance v1
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.BOAT_COMMAND_VENUE_PERFORMANCE_30D=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION='VENUE-PERFORMANCE-30D-V1';
  const WINDOW_DAYS=30;
  const STAKE_PER_PICK_YEN=100;
  const cache=new Map();

  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const yen=v=>Number.isFinite(Number(v))?`¥${Math.round(Number(v)).toLocaleString('ja-JP')}`:'—';
  const signedYen=v=>Number.isFinite(Number(v))?`${Number(v)>0?'+':''}${yen(v)}`:'—';
  const pct=v=>Number.isFinite(Number(v))?`${(Number(v)*100).toFixed(1)}%`:'—';

  function todayJst(now=new Date()){
    return new Intl.DateTimeFormat('en-CA',{
      timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'
    }).format(now);
  }

  function shiftDate(date,days){
    const m=String(date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)throw new Error('PERFORMANCE_DATE_INVALID');
    const d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])+Number(days||0)));
    return d.toISOString().slice(0,10);
  }

  function windowDates(endDate=todayJst()){
    return Array.from({length:WINDOW_DAYS},(_,i)=>shiftDate(endDate,-i));
  }

  function normalizeRow(row,date){
    if(!row||typeof row!=='object')return null;
    const primary=row.programOnly||row?.modes?.PROGRAM_ONLY||null;
    const picks=Array.isArray(primary?.picks)?primary.picks.map(String).filter(x=>/^[1-6]-[1-6]-[1-6]$/.test(x)):[];
    const actual=String(row.actual??row.result??'');
    const payout100=Number(row.payout100);
    const race=Number(row.race);
    if(!Number.isInteger(race)||race<1||race>12)return null;
    if(!/^[1-6]-[1-6]-[1-6]$/.test(actual))return null;
    if(!picks.length||new Set(picks).size!==picks.length)return null;
    if(!Number.isFinite(payout100)||payout100<0)return null;
    const hit=primary?.hit===true||picks.includes(actual);
    const stake=picks.length*STAKE_PER_PICK_YEN;
    const returns=hit?payout100:0;
    return Object.freeze({
      date:String(date),race,actual,payout100,picks:Object.freeze([...picks]),
      hit,stake,returns,profit:returns-stake,
      modelVersion:primary?.modelVersion||null,
      generatedAt:primary?.generatedAt||null
    });
  }

  function normalizeDay(x,{date,venueCode}={}){
    if(!x||typeof x!=='object')return [];
    if(date&&String(x.date)!==String(date))return [];
    if(venueCode&&String(x.venueCode).padStart(2,'0')!==String(venueCode).padStart(2,'0'))return [];
    const d=String(x.date||date||'');
    const rows=Array.isArray(x.rows)?x.rows:[];
    return rows.map(r=>normalizeRow(r,d)).filter(Boolean);
  }

  function aggregate(rows){
    const clean=(Array.isArray(rows)?rows:[]).filter(Boolean);
    const races=clean.length;
    const hits=clean.filter(x=>x.hit).length;
    const stake=clean.reduce((a,x)=>a+Number(x.stake||0),0);
    const returns=clean.reduce((a,x)=>a+Number(x.returns||0),0);
    return Object.freeze({
      races,hits,stake,returns,profit:returns-stake,
      hitRate:races?hits/races:null,
      roi:stake?returns/stake:null
    });
  }

  function groupDays(rows){
    const map=new Map();
    for(const row of rows||[]){
      if(!map.has(row.date))map.set(row.date,[]);
      map.get(row.date).push(row);
    }
    return [...map.entries()]
      .sort((a,b)=>b[0].localeCompare(a[0]))
      .map(([date,items])=>Object.freeze({
        date,
        rows:Object.freeze([...items].sort((a,b)=>a.race-b.race)),
        summary:aggregate(items)
      }));
  }

  async function fetchJson(path){
    try{
      const sep=path.includes('?')?'&':'?';
      const r=await fetch(`${path}${sep}t=${Date.now()}`,{cache:'no-store',credentials:'same-origin'});
      if(!r.ok)return null;
      return await r.json();
    }catch{return null}
  }

  async function load({dataRoot,venueCode,endDate=todayJst()}){
    const rootPath=String(dataRoot||'').replace(/\/$/,'');
    if(!rootPath)throw new Error('PERFORMANCE_DATA_ROOT_MISSING');
    const dates=windowDates(endDate);
    const key=`${rootPath}|${String(venueCode||'')}|${endDate}`;
    const prev=cache.get(key);
    if(prev&&Date.now()-prev.at<60000)return prev.value;
    const docs=await Promise.all(dates.map(async date=>{
      const x=await fetchJson(`${rootPath}/${date}/research-evaluation-v1.json`);
      return {date,x};
    }));
    const rows=docs.flatMap(({date,x})=>normalizeDay(x,{date,venueCode}));
    const value=Object.freeze({
      version:VERSION,
      windowDays:WINDOW_DAYS,
      startDate:dates[dates.length-1],
      endDate:dates[0],
      rows:Object.freeze(rows.sort((a,b)=>b.date.localeCompare(a.date)||a.race-b.race)),
      days:Object.freeze(groupDays(rows)),
      summary:aggregate(rows),
      retention:'PRESERVE_ALL_SOURCE_DATA',
      viewPolicy:'ROLLING_30_CALENDAR_DAYS_JST',
      stakeConvention:`${STAKE_PER_PICK_YEN}_YEN_PER_PICK_SIMULATION_ONLY`
    });
    cache.set(key,{at:Date.now(),value});
    return value;
  }

  function installStyle(){
    if(typeof document==='undefined'||document.getElementById('bcVenuePerformance30dStyle'))return;
    const s=document.createElement('style');
    s.id='bcVenuePerformance30dStyle';
    s.textContent=`
.v30-shell{margin-top:12px;border:1px solid #1c3d5f;border-radius:16px;padding:16px;background:linear-gradient(180deg,#0b1e31,#071522)}
.v30-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.v30-head h2{margin:0;font-size:18px}.v30-head p{margin:5px 0 0;color:#7893a7;font-size:10px;line-height:1.5}.v30-window{color:#6d879a;font-size:9px;text-align:right;line-height:1.45}
.v30-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:12px}.v30-kpi{padding:10px;border:1px solid rgba(255,255,255,.075);border-radius:11px;background:rgba(255,255,255,.025)}.v30-kpi small{display:block;color:#6f899d;font-size:8px;margin-bottom:4px}.v30-kpi b{font-size:15px}.v30-kpi.profit.pos b{color:#79e7bb}.v30-kpi.profit.neg b{color:#ff8997}
.v30-note{margin-top:9px;color:#648096;font-size:9px;line-height:1.55}
.v30-days{display:grid;gap:8px;margin-top:12px}.v30-day{border:1px solid rgba(255,255,255,.07);border-radius:11px;background:rgba(255,255,255,.02);overflow:hidden}.v30-day>summary{cursor:pointer;list-style:none;display:grid;grid-template-columns:110px 1fr repeat(3,minmax(80px,auto));gap:9px;align-items:center;padding:10px 11px}.v30-day>summary::-webkit-details-marker{display:none}.v30-day>summary strong{font-size:12px}.v30-day>summary span{font-size:9px;color:#8199ac}.v30-day>summary b{font-size:10px;text-align:right}.v30-day>summary .up{color:#79e7bb}.v30-day>summary .down{color:#ff8997}
.v30-races{border-top:1px solid rgba(255,255,255,.06)}.v30-row{display:grid;grid-template-columns:42px minmax(170px,1.5fr) 86px 60px 92px;gap:8px;align-items:center;padding:9px 11px;border-top:1px solid rgba(255,255,255,.045)}.v30-row:first-child{border-top:0}.v30-row .race{font-weight:900;font-size:12px}.v30-row small{display:block;color:#6d879b;font-size:7px;margin-bottom:3px}.v30-row .picks{font-size:9px;line-height:1.45;color:#dbe8f0}.v30-row .actual{font-size:11px;font-weight:900}.v30-row .judge{font-size:9px;font-weight:950;text-align:center;border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:4px}.v30-row .judge.hit{color:#79e7bb;border-color:rgba(65,222,164,.35)}.v30-row .judge.miss{color:#ff8997;border-color:rgba(255,120,136,.28)}.v30-row .money{font-size:9px;text-align:right}.v30-empty,.v30-loading{margin-top:12px;padding:18px;text-align:center;border:1px dashed rgba(255,255,255,.08);border-radius:11px;color:#728da1;font-size:10px}
@media(max-width:720px){.v30-head{flex-direction:column}.v30-window{text-align:left}.v30-kpis{grid-template-columns:1fr 1fr}.v30-kpi:last-child{grid-column:1/-1}.v30-day>summary{grid-template-columns:1fr auto;gap:5px}.v30-day>summary span{grid-column:1}.v30-day>summary b{grid-column:2}.v30-row{grid-template-columns:38px 1fr 54px;gap:6px}.v30-row .picks{grid-column:2/4}.v30-row .actual{grid-column:2}.v30-row .judge{grid-column:3;grid-row:2}.v30-row .money{grid-column:2/4;text-align:left}}
`;
    document.head.appendChild(s);
  }

  function raceRows(day){
    return day.rows.map(row=>`<div class="v30-row">
      <div class="race">${row.race}R</div>
      <div class="picks"><small>メイン予想</small>${row.picks.map(esc).join(' / ')}</div>
      <div class="actual"><small>結果</small>${esc(row.actual)}</div>
      <div class="judge ${row.hit?'hit':'miss'}">${row.hit?'HIT':'MISS'}</div>
      <div class="money"><small>払戻 / 損益</small>${yen(row.payout100)} / ${signedYen(row.profit)}</div>
    </div>`).join('');
  }

  function render(rootEl,data,venueName){
    installStyle();
    const s=data.summary;
    const profitClass=s.profit>0?'pos':s.profit<0?'neg':'';
    const days=data.days.map(day=>{
      const d=day.summary;
      const cls=d.profit>0?'up':d.profit<0?'down':'';
      return `<details class="v30-day">
        <summary>
          <strong>${esc(day.date.replaceAll('-','/'))}</strong>
          <span>${d.races}R · ${d.hits}的中</span>
          <b>的中率 ${pct(d.hitRate)}</b>
          <b>ROI ${pct(d.roi)}</b>
          <b class="${cls}">${signedYen(d.profit)}</b>
        </summary>
        <div class="v30-races">${raceRows(day)}</div>
      </details>`;
    }).join('');
    rootEl.hidden=false;
    rootEl.innerHTML=`<div class="v30-shell">
      <div class="v30-head">
        <div><h2>直近30日戦績 · ${esc(venueName||'この場')}</h2><p>結果前に固定されたメイン予想（PROGRAM_ONLY）だけを集計します。</p></div>
        <div class="v30-window">${esc(data.startDate)} 〜 ${esc(data.endDate)}<br>日本時間・30暦日ローリング</div>
      </div>
      <div class="v30-kpis">
        <div class="v30-kpi"><small>評価レース</small><b>${s.races}R</b></div>
        <div class="v30-kpi"><small>的中</small><b>${s.hits}R</b></div>
        <div class="v30-kpi"><small>的中率</small><b>${pct(s.hitRate)}</b></div>
        <div class="v30-kpi"><small>回収率</small><b>${pct(s.roi)}</b></div>
        <div class="v30-kpi profit ${profitClass}"><small>100円/点換算 損益</small><b>${signedYen(s.profit)}</b></div>
      </div>
      <div class="v30-note">表示・集計だけが毎日1日ずつ入れ替わります。30日を超えた元データは削除せず保存します。表示専用の後付け結果や、事前予想証跡がないレースは戦績に含めません。</div>
      ${days?`<div class="v30-days">${days}</div>`:'<div class="v30-empty">直近30日に評価可能な戦績はまだありません。</div>'}
    </div>`;
  }

  async function mount(opts={}){
    if(typeof document==='undefined')return null;
    const rootEl=typeof opts.root==='string'?document.querySelector(opts.root):opts.root;
    if(!rootEl)throw new Error('PERFORMANCE_ROOT_MISSING');
    installStyle();
    rootEl.hidden=false;
    rootEl.innerHTML='<div class="v30-loading">直近30日戦績を読み込み中…</div>';
    const data=await load(opts);
    render(rootEl,data,opts.venueName);
    return data;
  }

  return Object.freeze({
    version:VERSION,windowDays:WINDOW_DAYS,stakePerPickYen:STAKE_PER_PICK_YEN,
    todayJst,shiftDate,windowDates,normalizeRow,normalizeDay,aggregate,groupDays,load,mount
  });
});
