'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
module.exports=function ruleFor(root,code,date,nowMs=Date.now()){
 const file=path.join(root,'research/b-over-a-active-rules-v1.json');if(!fs.existsSync(file))return null;
 const p=JSON.parse(fs.readFileSync(file,'utf8'));if(p.schema!=='b-over-a-active-rules-v1')throw Error('B_AUTO_RULE_SCHEMA');if(p.enabled!==true)return null;
 const list=p.venues?.[code]||[];if(!Array.isArray(list))throw Error('B_AUTO_RULE_LIST');
 const x=list.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.effectiveDate)&&x.effectiveDate<=date).sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate))[0];if(!x)return null;
 if(x.gatePass!==true||!/^research\/b-over-a-auto-history-v1\/[0-9]{2}\/[a-zA-Z0-9-]+-decision\.json$/.test(x.decisionPath))throw Error('B_AUTO_RULE_UNVERIFIED');
 const raw=fs.readFileSync(path.join(root,x.decisionPath));if(crypto.createHash('sha256').update(raw).digest('hex')!==x.decisionSha256)throw Error('B_AUTO_RULE_EVIDENCE_CHANGED');
 const e=JSON.parse(raw);const evaluated=Date.parse(e.evaluatedAt),start=Date.parse(x.effectiveDate+'T00:00:00+09:00');
 if(e.schema!=='b-over-a-auto-decision-v1'||e.venueCode!==code||e.experimentId!==x.experimentId||e.outcome?.decision!=='ADOPT'||e.modelChanged!==false||e.realMoney!==false||!Number.isFinite(evaluated)||evaluated>nowMs||!(start>evaluated))throw Error('B_AUTO_RULE_BOUNDARY');
 const r=x.rule;if(!r||!['margin','coverage'].includes(r.ranking)||['minMargin','minCoverage'].some(k=>typeof r[k]!=='number'||!Number.isFinite(r[k])||r[k]<0||r[k]>1||r[k]!==e.trial?.rule?.[k])||r.ranking!==e.trial.rule.ranking)throw Error('B_AUTO_RULE_INVALID');
 return {...r,experimentId:x.experimentId,effectiveDate:x.effectiveDate};
};
