// Operator-authenticated, bounded R2 text reader. No credentials or object data in logs.
import {digest,json} from './upload-service.js';
const noStore={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const MAX=1024*1024;
export async function r2ReadAPI(request,env){
  if(request.method!=='POST')return json({error:'POST required'},405);
  if(!env.SOURCES || !env.SOURCE_CREATE_KEY || env.SOURCE_CREATE_KEY.length<24)return json({error:'Private R2 reader unavailable'},503);
  const credential=request.headers.get('x-filing-key')||'';
  if(!credential || await digest(credential)!==await digest(env.SOURCE_CREATE_KEY))return json({error:'Unauthorized'},401);
  let input;
  try { input=await request.json(); } catch {return json({error:'Invalid JSON'},400);}
  const key=input?.key;
  if(typeof key!=='string' || key.length>512 || !/^(claude-exports\/2026-10-20\/|citadel-sources\/)/.test(key) || key.includes('..') || /[\x00-\x1f]/.test(key))return json({error:'Object key outside approved archive prefixes'},400);
  const obj=await env.SOURCES.head(key);
  if(!obj)return json({error:'Object not found'},404);
  if(obj.size>MAX)return json({error:'Object exceeds 1 MiB text limit; request a bounded document reader'},413);
  const body=await env.SOURCES.get(key);
  if(!body)return json({error:'Object not found'},404);
  const bytes=await body.arrayBuffer();
  let value;
  try { value=new TextDecoder('utf-8',{fatal:true}).decode(bytes); } catch {return json({error:'Not UTF-8 text'},415);}
  if(value.includes('\u0000'))return json({error:'Binary content not supported'},415);
  return new Response(JSON.stringify({key,bytes:bytes.byteLength,text:value}),{status:200,headers:{...noStore,'content-type':'application/json; charset=utf-8'}});
}
