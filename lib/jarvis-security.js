import crypto from 'node:crypto';

export const ALLOWED_ORIGIN=process.env.BOAT_COMMAND_ALLOWED_ORIGIN||'https://yoc02119-max.github.io';

export function sameSecret(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&x.length>0&&crypto.timingSafeEqual(x,y)}
export function cors(req,res,methods='POST, OPTIONS'){
  res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Origin');
  const origin=String(req.headers?.origin||'');
  if(origin===ALLOWED_ORIGIN){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods',methods)}
  return origin;
}
export function authorized(req){return Boolean(process.env.BOAT_COMMAND_ACCESS_TOKEN)&&sameSecret(String(req.headers?.authorization||'').replace(/^Bearer\s+/i,''),process.env.BOAT_COMMAND_ACCESS_TOKEN)}
const BLOCKED_KEY=/(?:result|payout|exhibition|finish(?:ed)?order|odds|払戻|結果|展示)/i;
export function scrub(value,depth=0){
  if(depth>5)return null;
  if(value==null||typeof value==='boolean'||typeof value==='number')return value;
  if(typeof value==='string')return value.slice(0,5000);
  if(Array.isArray(value))return value.slice(0,40).map(x=>scrub(x,depth+1));
  if(typeof value==='object'){const out={};for(const [key,item] of Object.entries(value).slice(0,60)){if(BLOCKED_KEY.test(key))continue;out[key]=scrub(item,depth+1)}return out}
  return null;
}
