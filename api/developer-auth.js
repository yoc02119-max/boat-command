import crypto from 'node:crypto';

const COOKIE='boat_command_dev';
const TTL_SECONDS=12*60*60;

function secret(){return String(process.env.BOAT_COMMAND_DEVELOPER_PASSWORD||'');}
function cookieValue(req){
  const raw=String(req.headers?.cookie||'');
  for(const part of raw.split(';')){
    const i=part.indexOf('=');
    if(i<0)continue;
    if(part.slice(0,i).trim()===COOKIE)return decodeURIComponent(part.slice(i+1).trim());
  }
  return '';
}
function mac(payload,key){return crypto.createHmac('sha256',key).update(payload).digest('base64url');}
function same(a,b){
  const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));
  return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);
}
function issue(key){
  const payload=Buffer.from(JSON.stringify({v:1,exp:Date.now()+TTL_SECONDS*1000})).toString('base64url');
  return payload+'.'+mac(payload,key);
}
function valid(token,key){
  if(!token||!key)return false;
  const parts=String(token).split('.');
  if(parts.length!==2||!same(parts[1],mac(parts[0],key)))return false;
  try{
    const x=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
    return x?.v===1&&Number(x.exp)>Date.now();
  }catch{return false;}
}
function setCookie(res,value,maxAge){
  res.setHeader('Set-Cookie',COOKIE+'='+encodeURIComponent(value)+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+maxAge);
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  const key=secret();
  if(req.method==='GET'){
    return res.status(200).json({authenticated:valid(cookieValue(req),key),configured:Boolean(key),expiresHours:12});
  }
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  const action=String(req.body?.action||'login').toLowerCase();
  if(action==='logout'){
    setCookie(res,'',0);
    return res.status(200).json({ok:true,authenticated:false});
  }
  if(action!=='login')return res.status(400).json({error:'INVALID_ACTION'});
  if(!key)return res.status(503).json({error:'DEVELOPER_PASSWORD_NOT_CONFIGURED'});
  const supplied=String(req.body?.code||req.body?.password||'');
  if(!same(supplied,key)){
    await new Promise(r=>setTimeout(r,650));
    return res.status(401).json({error:'INVALID_DEVELOPER_PASSWORD'});
  }
  setCookie(res,issue(key),TTL_SECONDS);
  return res.status(200).json({ok:true,authenticated:true,expiresHours:12});
}
