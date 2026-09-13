const APP_KEY="boatCommand.v05";
const MIRROR_KEY="boatCommand.v05.mirror";
const SESSION_MIRROR_KEY="boatCommand.v05.sessionMirror";

const VERIFIED_BASELINES={
  "2025-12-15":{
    id:"BT-001",venue:"蒲郡",strategyVersion:"GAMAGORI-V1.0",
    races:9,hits:2,skipped:3,invested:18000,returned:9700,profit:-8300,
    hitRate:22.2,roi:53.9,
    note:"v0.14.0でSTRICT BACKTESTのHARD LOCK→結果解禁→精算まで完了した確定集計。"
  }
};
const START_BANKROLL=100000;
const PICK_PRICE=500;
const MAX_PICKS=4;

const PROGRAM_MODEL={
  version:"PROGRAM-V1.0",historyYears:3,primaryMonths:12,minSamples:30,strongSamples:100,
  weights:[
    {maxDays:92,weight:1.00,label:"直近3か月"},{maxDays:365,weight:.82,label:"3〜12か月"},
    {maxDays:730,weight:.52,label:"1〜2年前"},{maxDays:1095,weight:.28,label:"2〜3年前"}
  ]
};

const BACKTEST_PACKS={};
const STARTUP_FORCE_TODAY_LIVE=true;

function dateISOInTokyo(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=t=>parts.find(p=>p.type===t)?.value;return `${get('year')}-${get('month')}-${get('day')}`}
const todayISO=()=>dateISOInTokyo();
const money=n=>(n<0?"-":"")+"¥"+Math.abs(Math.round(n||0)).toLocaleString("ja-JP");
const pct=n=>Number.isFinite(n)?n.toFixed(1)+"%":"—";

function baseStore(){return {schema:5,venue:"蒲郡",startBankroll:START_BANKROLL,sessions:{},retestArchive:[]}}
function baseSession(date){return {date,venue:"蒲郡",mode:"STRICT",runType:"LIVE",strategyVersion:"GAMAGORI-V1.0",createdAt:new Date().toISOString(),races:Array.from({length:12},(_,i)=>({race:i+1,picks:["","","",""],locked:false,lockedAt:null,lockHash:null,stake:0,result:"",officialPayout100:0,refundAmount:0,settled:false,settledAt:null,returnAmount:0,profit:0,hit:false,rationale:"",missClass:""}))}}

function parseStored(raw){try{const x=JSON.parse(raw);if(x&&x.schema===5&&x.sessions)return x}catch(e){}return null}
function storeRank(x){const rev=Number(x?._meta?.revision)||0;const t=Date.parse(x?._meta?.updatedAt||"")||0;return rev*10000000000000+t}
function loadStore(){const candidates=[];try{const x=parseStored(localStorage.getItem(APP_KEY));if(x)candidates.push(x)}catch(e){}try{const x=parseStored(localStorage.getItem(MIRROR_KEY));if(x)candidates.push(x)}catch(e){}try{const x=parseStored(sessionStorage.getItem(SESSION_MIRROR_KEY));if(x)candidates.push(x)}catch(e){}if(!candidates.length)return baseStore();candidates.sort((a,b)=>storeRank(b)-storeRank(a));const chosen=candidates[0];const raw=JSON.stringify(chosen);try{localStorage.setItem(APP_KEY,raw)}catch(e){}try{localStorage.setItem(MIRROR_KEY,raw)}catch(e){}try{sessionStorage.setItem(SESSION_MIRROR_KEY,raw)}catch(e){}return chosen}
function saveStore(){store._meta=store._meta||{};store._meta.revision=(Number(store._meta.revision)||0)+1;store._meta.updatedAt=new Date().toISOString();const raw=JSON.stringify(store);let ok=0;try{localStorage.setItem(APP_KEY,raw);ok++}catch(e){}try{localStorage.setItem(MIRROR_KEY,raw);ok++}catch(e){}try{sessionStorage.setItem(SESSION_MIRROR_KEY,raw);ok++}catch(e){}return ok>0}

let store=loadStore();if(!Array.isArray(store.retestArchive))store.retestArchive=[];if(!store.liveMonitor)store.liveMonitor={last:null,history:[]};
function initialSessionDate(){return todayISO()}
let currentDate=initialSessionDate();
function session(date=currentDate){if(!store.sessions[date])store.sessions[date]=baseSession(date);return ensureSessionShape(store.sessions[date])}
function ensureSessionShape(s){if(s.replayPackId===undefined)s.replayPackId="";if(s.replayRevealed===undefined)s.replayRevealed=false;if(!s.runType)s.runType="LIVE";if(!s.strategyVersion||s.strategyVersion==="GAMAGORI-v0.6")s.strategyVersion="GAMAGORI-V1.0";for(const r of s.races){if(r.rationale===undefined)r.rationale="";if(r.missClass===undefined)r.missClass="";if(r.refundAmount===undefined)r.refundAmount=0;if(r.programComposition===undefined)r.programComposition=null}return s}

// Compatibility shell: retained API names for LIVE modules. Historical RETEST is never auto-opened.
function activeReplayPack(){return null}
function programProfiles(s,r){return Array.isArray(r.preRaceProfiles)&&r.preRaceProfiles.length===6?r.preRaceProfiles:null}
function renderAll(){
 const s=session();
 const date=document.querySelector('#sessionDate');if(date)date.value=currentDate;
 const type=document.querySelector('#runType');if(type&&!type.disabled)type.value=s.runType;
 const title=document.querySelector('#pageTitle');if(title&&document.querySelector('#predict.view.active'))title.textContent='蒲郡 12R予想';
 const list=document.querySelector('#predictionList');if(list&&!list.children.length){list.innerHTML=s.races.map(r=>`<article class="race-card" data-race="${r.race}"><div class="race-head"><div class="race-no">${r.race}R</div><span>${r.locked?'HARD LOCK':'PRE-RACE'}</span></div><div class="two-stage-v0260"></div></article>`).join('')}
}
function save(){return saveStore()}
try{localStorage.setItem('boatCommand.lastDate',currentDate)}catch(e){}

// Minimal navigation remains functional while LIVE modules own prediction/detail rendering.
document.querySelectorAll('.nav').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));document.getElementById(btn.dataset.view)?.classList.add('active');renderAll()}));
document.querySelectorAll('[data-jump]').forEach(btn=>btn.addEventListener('click',()=>document.querySelector(`.nav[data-view="${btn.dataset.jump}"]`)?.click()));
renderAll();