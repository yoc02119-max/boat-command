'use strict';
const crypto=require('crypto');
module.exports=function chooseB(pre,raw,rule=null){
 const p=JSON.parse(raw.toString());
 if(p.resultIncluded!==false||p.resultEndpointsIncluded!==false||pre.resultInput!==false||pre.payoutInput!==false||pre.immutableAfterFirstWrite!==true)return null;
 if(['date','race','venueCode','deadline'].some(k=>String(p[k])!==String(pre[k])))return null;
 if(crypto.createHash('sha256').update(raw).digest('hex')!==pre.sources?.programSha256)return null;
 const fetched=Date.parse(p.fetchedAt),generated=Date.parse(pre.generatedAt);if(!Number.isFinite(fetched)||!Number.isFinite(generated)||fetched>generated)return null;
 const boats=p.boats||[];if(boats.length!==6||new Set(boats.map(x=>x.lane)).size!==6||boats.some(x=>![1,2,3,4,5,6].includes(x.lane)||!['A1','A2','B1','B2'].includes(x.class)))return null;
 const a=boats.filter(x=>x.class[0]==='A'),b=boats.filter(x=>x.class[0]==='B');if(!a.length||!b.length)return null;
 const ranked=pre.pointExpansion?.ranked||[],seen=new Set(),weights=Array(7).fill(0);
 for(const x of ranked){if(!/^[1-6]-[1-6]-[1-6]$/.test(x.order)||new Set(x.order.split('-')).size!==3||seen.has(x.order)||typeof x.probability!=='number'||!Number.isFinite(x.probability)||x.probability<0||x.probability>1)return null;seen.add(x.order);weights[Number(x.order[0])]+=x.probability;}
 if(seen.size!==120||Math.abs(weights.reduce((s,x)=>s+x,0)-1)>1e-5)return null;
 const best=xs=>xs.slice().sort((x,y)=>weights[y.lane]-weights[x.lane]||x.lane-y.lane)[0],bb=best(b),aa=best(a);
 if(weights[bb.lane]<=weights[aa.lane])return null;
 const chosen=ranked.filter(x=>Number(x.order[0])===bb.lane).sort((x,y)=>y.probability-x.probability||x.order.localeCompare(y.order)).slice(0,4);
 const coverage=chosen.reduce((sum,x)=>sum+x.probability,0),margin=weights[bb.lane]-weights[aa.lane];
 if(rule&&(margin<rule.minMargin||coverage<rule.minCoverage))return null;
 return {bLane:bb.lane,bClass:bb.class,bScore:weights[bb.lane],aScore:weights[aa.lane],picks:chosen.map(x=>x.order),...(rule?{autoRank:rule.ranking==='coverage'?coverage:margin,selectionExperimentId:rule.experimentId}:{})};
};
