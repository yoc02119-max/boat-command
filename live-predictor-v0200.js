// BOAT COMMAND GAMAGORI LIVE CANDIDATE PREDICTOR v0.20.1
// Verified PRE-RACE only. No result fetch. No auto bet.
const BC_LIVE_PREDICTOR_V0200={version:'GAMAGORI-LIVE-V0.20.1'};
function bcStValue(raw){const s=String(raw||'').trim();let v=null;if(/^F\.\d+$/i.test(s))v=Number(`0.${s.slice(2)}`);else if(/^\.\d+$/.test(s))v=Number(`0${s}`);else if(/^0\.\d+$/.test(s))v=Number(s);else if(/^\d+$/.test(s))v=Number(`0.${s}`);return Number.isFinite(v)?v:null}
function bcUniqueLaneMap(rows,key){if(!Array.isArray(rows)||rows.length!==6)return null;const map=new Map();for(const row of rows){const lane=Number(row?.[key]);if(!Number.isInteger(lane)||lane<1||lane>6||map.has(lane))return null;map.set(lane,row)}return map.size===6?map:null}
function bcLiveScoreRows(r){
 const pre=r?.livePreRace,ex=pre?.beforeinfo?.exhibition||[],st=pre?.beforeinfo?.startExhibition||[],boats=pre?.racelist?.boats||[];
 const exByLane=bcUniqueLaneMap(ex,'lane'),boatsByLane=bcUniqueLaneMap(boats,'lane'),stByLane=bcUniqueLaneMap(st,'lane'),stByCourse=bcUniqueLaneMap(st,'course');
 if(!exByLane||!boatsByLane||(!stByLane&&!stByCourse))return [];
 const stRows=stByLane?[...stByLane.values()]:[...stByCourse.values()];if(stRows.some(row=>bcStValue(row?.st)===null))return [];
 const stIdentityVerified=!!stByLane,out=[];
 for(let lane=1;lane<=6;lane++){
   const e=exByLane.get(lane),boat=boatsByLane.get(lane);if(!e||!boat)return [];
   const exTime=Number(e.exhibitionTime);if(!Number.isFinite(exTime))return [];
   const laneBonus=[2.8,1.6,1.15,.82,.52,.32][lane-1]||0,exScore=(6.95-exTime)*8;
   let stRaw='',stScore=0;if(stIdentityVerified){const stRow=stByLane.get(lane);if(!stRow)return [];stRaw=String(stRow.st||'');const stVal=bcStValue(stRaw);if(stVal===null)return [];stScore=stRaw.toUpperCase().startsWith('F.')?Math.max(0,.8-stVal*1.5):(.30-stVal)*4}
   const cls=String(boat.class||''),classScore=cls==='A1'?1:cls==='A2'?.55:0;
   out.push({lane,score:laneBonus+exScore+stScore+classScore,exTime,stRaw,stIdentityVerified});
 }
 return out.sort((a,b)=>b.score-a.score);
}
function bcLiveCandidate(r){
 if(r?.liveDataStatus!=='READY'||!r?.livePreRace)return{status:'WAIT',reason:r?.liveDataReason||'verified LIVEデータ待ち'};
 const rows=bcLiveScoreRows(r);if(rows.length!==6)return{status:'SKIP',reason:'6艇すべての展示・ST・艇番対応を安全に確認できないため見送り'};
 const [a,b,c,d]=rows.map(x=>x.lane),picks=[...new Set([`${a}-${b}-${c}`,`${a}-${c}-${b}`,`${b}-${a}-${c}`,`${a}-${b}-${d}`])].slice(0,4),gap=rows[0].score-rows[1].score;
 if(!Number.isFinite(gap)||gap<.18)return{status:'SKIP',reason:'上位評価差が小さく軸を固定できないため見送り',rank:rows.map(x=>x.lane)};
 return{status:'CANDIDATE',picks,rank:rows.map(x=>x.lane),rationale:`LIVE VERIFIED候補。評価順 ${rows.map(x=>x.lane).join('→')}。展示タイム・級別・コース優位のみで採点。結果データ未使用。`,generatedAt:new Date().toISOString(),strategyVersion:BC_LIVE_PREDICTOR_V0200.version};
}
function refreshLiveCandidates(){const s=session();if(!s||s.runType!=='LIVE')return;let changed=false;for(const r of s.races||[]){if(r.locked)continue;const out=bcLiveCandidate(r),before=JSON.stringify(r.liveSuggestion||null);r.liveSuggestion={...out,sessionDate:s.date};if(before!==JSON.stringify(r.liveSuggestion))changed=true}if(changed&&typeof saveStore==='function')saveStore()}
function renderLiveCandidates(){const s=session();if(!s||s.runType!=='LIVE')return;document.querySelectorAll('#predictionList .race-card').forEach(card=>{const race=Number((card.querySelector('.race-no')?.textContent||'').replace(/\D/g,'')),r=s.races.find(x=>Number(x.race)===race);let box=card.querySelector('.live-candidate-v0200');if(!box){box=document.createElement('div');box.className='live-candidate-v0200';card.prepend(box)}box.textContent=r?.liveSuggestion?.status==='CANDIDATE'?r.liveSuggestion.picks.join(' / '):(r?.liveSuggestion?.reason||'WAIT')})}
const _bcRenderAllV0200=typeof renderAll==='function'?renderAll:null;if(_bcRenderAllV0200)renderAll=function(){const out=_bcRenderAllV0200.apply(this,arguments);refreshLiveCandidates();renderLiveCandidates();return out};
const _bcSweepV0200=typeof sweepVerifiedLiveRelays==='function'?sweepVerifiedLiveRelays:null;if(_bcSweepV0200)sweepVerifiedLiveRelays=async function(opts={}){const out=await _bcSweepV0200(opts);refreshLiveCandidates();renderLiveCandidates();return out};
window.BOAT_COMMAND_LIVE_PREDICTOR_V0200=BC_LIVE_PREDICTOR_V0200;refreshLiveCandidates();renderLiveCandidates();