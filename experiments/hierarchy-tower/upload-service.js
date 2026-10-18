const PART=8*1024*1024,MAX=5*1024*1024*1024;
export const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function validateSource(b){if(!b||typeof b.name!=='string'||!b.name.length||b.name.length>200||!Number.isSafeInteger(b.size)||b.size<1||b.size>MAX||!/^([a-f0-9]{64})$/.test(b.sampleHash||''))fail('Choose a named file between 1 byte and 5 GiB with a source fingerprint.');if(!/^[a-f0-9-]{36}$/.test(b.foundationId||''))fail('A citadel foundation ID is required');return {name:b.name,size:b.size,sampleHash:b.sampleHash,foundationId:b.foundationId};}
export function expectedPart(source,number){const total=Math.ceil(source.size/PART);if(!Number.isInteger(number)||number<1||number>total)fail('Invalid part number');return number===total?source.size-PART*(number-1):PART;}
export async function boundedBody(request,limit){const reader=request.body?.getReader();if(!reader)fail('Request body required');const pieces=[];let length=0;try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();fail('Request exceeds size limit',413);}pieces.push(value);}}finally{reader.releaseLock();}const data=new Uint8Array(length);let offset=0;for(const p of pieces){data.set(p,offset);offset+=p.length;}return data;}
async function smallJSON(request){try{return JSON.parse(new TextDecoder().decode(await boundedBody(request,8192)));}catch(e){if(e.status)throw e;fail('Invalid JSON');}}
export async function storageAPI(request,env){
 try{
 const url=new URL(request.url),path=url.pathname;
 if(path==='/api/storage/config'&&request.method==='GET')return json({enabled:Boolean(env.SOURCES&&env.UPLOADS&&env.SOURCE_CREATE_KEY?.length>=24),partBytes:PART,maxBytes:MAX,auth:'operator-create + private per-upload capability',drive:'Android file picker; no direct Google OAuth'});
 if(!env.SOURCES||!env.UPLOADS||!env.SOURCE_CREATE_KEY||env.SOURCE_CREATE_KEY.length<24)return json({error:'Private storage is not configured yet. Local import remains available.'},503);
 if(path==='/api/storage/uploads'&&request.method==='POST'){
  const provided=request.headers.get('x-source-create-key')||'';if(await digest(provided)!==await digest(env.SOURCE_CREATE_KEY))fail('The operator storage access code is required.',401);
  const source=validateSource(await smallJSON(request)),id=crypto.randomUUID(),token=crypto.randomUUID()+crypto.randomUUID();
  const stub=env.UPLOADS.get(env.UPLOADS.idFromName(id));const initialized=await stub.fetch(new Request('https://upload/internal/init',{method:'POST',body:JSON.stringify({id,source,tokenHash:await digest(token)})}));if(!initialized.ok)return initialized;return json({...(await initialized.json()),token},201);
 }
 const m=path.match(/^\/api\/storage\/uploads\/([a-f0-9-]{36})(\/parts\/\d+|\/complete|\/source)?$/);if(!m)fail('Storage endpoint not found',404);
 const stub=env.UPLOADS.get(env.UPLOADS.idFromName(m[1]));return await stub.fetch(new Request('https://upload'+(m[2]||'/status'),request));
 }catch(e){return json({error:e.message},e.status||500);}
}
export class TowerUpload{
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.queue=Promise.resolve();}
 fetch(request){const run=this.queue.then(()=>this.handle(request)).catch(e=>json({error:e.message},e.status||500));this.queue=run.then(()=>{});return run;}
 async persist(state){await this.ctx.storage.put('upload',state);}
 snapshot(s){return {id:s.id,source:s.source,status:s.status,partBytes:PART,parts:s.parts,created:s.created,completed:s.completed||null};}
 async handle(request){
  const url=new URL(request.url);let s=await this.ctx.storage.get('upload');
  if(url.pathname==='/internal/init'&&request.method==='POST'){
   if(s)fail('Upload already initialized',409);const b=await smallJSON(request),source=validateSource(b.source);if(!/^[a-f0-9]{64}$/.test(b.tokenHash))fail('Invalid upload credential');
   const key='citadel-sources/'+b.id+'/source.json',upload=await this.env.SOURCES.createMultipartUpload(key,{httpMetadata:{contentType:'application/octet-stream'},customMetadata:{citadelupload:b.id}});
   s={id:b.id,source,tokenHash:b.tokenHash,key,uploadId:upload.uploadId,parts:[],status:'uploading',created:new Date().toISOString()};await this.persist(s);return json(this.snapshot(s));
  }
  if(!s)fail('Upload not found',404);
  const token=(request.headers.get('authorization')||'').replace(/^Bearer /,'');if(!token||await digest(token)!==s.tokenHash)fail('Invalid private upload credential',401);
  if(url.pathname==='/status'&&request.method==='GET')return json(this.snapshot(s));
  const part=url.pathname.match(/^\/parts\/(\d+)$/);
  if(part&&request.method==='PUT'){
   if(s.status!=='uploading')fail('Upload is already complete',409);const number=Number(part[1]),size=expectedPart(s.source,number),data=await boundedBody(request,PART);if(data.length!==size)fail('Part length does not match the source');const hash=await digest(data);if(request.headers.get('x-part-sha256')!==hash)fail('Part checksum mismatch');
   const previous=s.parts.find(p=>p.partNumber===number);if(previous){if(previous.sha256!==hash)fail('This part was already saved with different contents',409);return json(previous);}
   const upload=this.env.SOURCES.resumeMultipartUpload(s.key,s.uploadId),saved=await upload.uploadPart(number,data);const record={partNumber:number,etag:saved.etag,sha256:hash,size};s.parts.push(record);s.parts.sort((a,b)=>a.partNumber-b.partNumber);await this.persist(s);return json(record);
  }
  if(url.pathname==='/complete'&&request.method==='POST'){
   if(s.status==='complete')return json(this.snapshot(s));
   const count=Math.ceil(s.source.size/PART);if(s.parts.length!==count||s.parts.some((p,i)=>p.partNumber!==i+1||p.size!==expectedPart(s.source,i+1)))fail('Source parts are missing',409);
   // Recover if R2 completion succeeded but the metadata checkpoint was interrupted.
   let object=await this.env.SOURCES.head(s.key);if(!object){const upload=this.env.SOURCES.resumeMultipartUpload(s.key,s.uploadId);await upload.complete(s.parts.map(({partNumber,etag})=>({partNumber,etag})));object=await this.env.SOURCES.head(s.key);}
   if(!object||object.size!==s.source.size||object.customMetadata?.citadelupload!==s.id)fail('Stored source verification failed',409);
   s.status='complete';s.completed=new Date().toISOString();await this.persist(s);return json(this.snapshot(s));
  }
  if(url.pathname==='/source'&&request.method==='GET'){
   if(s.status!=='complete')fail('Source is not complete',409);const offset=Number(url.searchParams.get('offset')||0),length=Number(url.searchParams.get('length')||1048576);if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(length)||length<1||length>PART||offset>=s.source.size)fail('Request a source range of at most 8 MiB');
   const object=await this.env.SOURCES.get(s.key,{range:{offset,length:Math.min(length,s.source.size-offset)}});if(!object)fail('Source unavailable',404);return new Response(object.body,{headers:{'content-type':'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff'}});
  }
  fail('Storage operation not supported',405);
 }
}
