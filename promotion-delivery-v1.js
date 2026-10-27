/* Owner-authenticated delivery for the static Pages portal. No credentials in the browser. */
(function(root){
 'use strict';
 const TITLE='[BOAT COMMAND 昇格判断]';
 function request(row,decision){
  if(!['approve','reject'].includes(decision)||!/^[-a-z0-9]+$/.test(row.slug||'')||!['RANK6','RANK8','HEAD6','SECOND6','THIRD6'].includes(row.candidateVariant)||!row.candidateVersion)throw Error('INVALID_PROMOTION_REQUEST');
  return {schema:'boat-command-owner-promotion-v1',decision,venue:row.slug,variant:row.candidateVariant,candidateVersion:row.candidateVersion};
 }
 function issueUrl(row,decision){
  const x=request(row,decision),url=new URL('https://github.com/yoc02119-max/boat-command/issues/new');
  url.searchParams.set('title',TITLE+' '+x.decision+' '+x.venue+' '+x.variant);
  url.searchParams.set('body',JSON.stringify(x,null,2));return url.href;
 }
 function validateIssue(event,policy){
  if(event.action!=='opened'||event.repository?.full_name!=='yoc02119-max/boat-command'||event.issue?.pull_request||event.issue?.user?.login!=='yoc02119-max'||event.sender?.login!=='yoc02119-max')throw Error('OWNER_IDENTITY_REQUIRED');
  const x=JSON.parse(event.issue.body||'null');
  if(x?.schema!=='boat-command-owner-promotion-v1')throw Error('INVALID_PROMOTION_SCHEMA');
  const row=(policy.venues||[]).find(v=>v.slug===x.venue);
  if(policy.automaticPromotion!==false||policy.requiresExplicitHumanApproval!==true||policy.candidateVersion!==x.candidateVersion||!row||row.decision!=='AWAITING_HUMAN_REVIEW'||row.humanReviewPending!==true||row.candidateVariant!==x.variant)throw Error('EXPANSION_DECISION_NOT_CURRENT');
  const checked=request({...row,candidateVersion:policy.candidateVersion},x.decision);
  if(event.issue.title!==TITLE+' '+checked.decision+' '+checked.venue+' '+checked.variant)throw Error('PROMOTION_TITLE_MISMATCH');
  return checked;
 }
 const api={issueUrl,validateIssue};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.BoatPromotionDelivery=api;
})(typeof globalThis==='object'?globalThis:this);
