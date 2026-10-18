import {digest,boundedBody,json} from './upload-service.js';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const validId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
async function body(request){try{return JSON.parse(new TextDecoder().decode(await boundedBody(request,8192)));}catch(e){if(e.status)throw e;fail('Invalid filing request');}}
export async function filingAPI(request,env){
 try{
  const u=new URL(request.url);
  if(u.pathname==='/api/files/config')return json({enabled:Boolean(env.CABINETS&&env.SOURCES&&env.UPLOADS&&env.SOURCE_CREATE_KEY?.length>=24),maxBytes:5*1024**3,partBytes:8*1024**2,access:'operator-only private cabinet'});
  if(!env.CABINETS||!env.SOURCES||!env.UPLOADS||!(env.SOURCE_CREATE_KEY?.length>=24))fail('Private filing storage is not configured',503);
  const download=u.pathname.match(/^\/api\/files\/download\/([a-f0-9-]{72})$/);
  if(!download){const key=request.headers.get('x-filing-key')||'';if(await digest(key)!==await digest(env.SOURCE_CREATE_KEY))fail('Enter your operator storage code to open the cabinet',401);}
  const stub=env.CABINETS.get(env.CABINETS.idFromName('operator-cabinet-v1'));
  const path=u.pathname.replace('/api/files','')+u.search;return await stub.fetch(new Request('https://cabinet'+path,request));
 }catch(e){return json({error:e.message},e.status||500);}
}
export class FileCabinet{
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.queue=Promise.resolve();}
 fetch(request){const p=this.queue.then(()=>this.handle(request)).catch(e=>json({error:e.message},e.status||500));this.queue=p.then(()=>{});return p;}
 async upload(id,path,method='GET',data,headers={}){const stub=this.env.UPLOADS.get(this.env.UPLOADS.idFromName(id));const response=await stub.fetch(new Request('https://upload/internal/'+path,{method,body:data,headers,...(data instanceof ReadableStream?{duplex:'half'}:{})}));if(!response.ok){const error=await response.json();fail(error.error||'Source operation failed',response.status);}return response;}
 async getFile(id){if(!validId(id))fail('Invalid file ID');const file=await this.ctx.storage.get('file:'+id);if(!file)fail('File not found',404);return file;}
 async collection(id){if(id==='inbox')return {id:'inbox',name:'Inbox'};const c=await this.ctx.storage.get('collection:'+id);if(!c)fail('Collection not found',404);return c;}
 async handle(request){
  const u=new URL(request.url),path=u.pathname;
  if(path==='/collections'&&request.method==='GET'){const rows=await this.ctx.storage.list({prefix:'collection:',limit:100});return json({collections:[{id:'inbox',name:'Inbox'},...rows.values()]});}
  if(path==='/collections'&&request.method==='POST'){const b=await body(request);if(!validId(b.id)||typeof b.name!=='string'||!b.name.trim()||b.name.length>80)fail('Collection ID and name required');const old=await this.ctx.storage.get('collection:'+b.id);if(old){if(old.name!==b.name.trim())fail('Collection ID collision',409);return json(old);}const all=await this.ctx.storage.list({prefix:'collection:',limit:100});if(all.size>=100)fail('This prototype supports 100 collections');const c={id:b.id,name:b.name.trim(),created:new Date().toISOString()};await this.ctx.storage.put('collection:'+b.id,c);return json(c,201);}
  if(path==='/files'&&request.method==='GET'){
   const after=u.searchParams.get('after')||'',collection=u.searchParams.get('collection')||'';const rows=await this.ctx.storage.list({prefix:'file:',limit:50,...(after?{startAfter:after}:{})});const files=[...rows.values()].filter(f=>f.status!=='deleted'&&(!collection||f.collection===collection));return json({files,next:rows.size===50?[...rows.keys()].at(-1):null});
  }
  if(path==='/files'&&request.method==='POST'){
   const b=await body(request);if(!validId(b.id))fail('New file ID required');await this.collection(b.collection||'inbox');const old=await this.ctx.storage.get('file:'+b.id);if(old){if(old.source.size!==b.source?.size||old.source.sampleHash!==b.source?.sampleHash||old.source.name!==b.source?.name)fail('File request ID collision',409);if(old.status==='deleted')fail('File was deleted',410);return json(old);}
   const source={...b.source,foundationId:b.id};let state;
   try{state=await (await this.upload(b.id,'status')).json();if(state.source.size!==source.size||state.source.sampleHash!==source.sampleHash||state.source.name!==source.name)fail('Source ID collision',409);}catch(e){if(e.status!==404)throw e;const init=await this.upload(b.id,'init','POST',JSON.stringify({id:b.id,source,tokenHash:await digest(crypto.randomUUID()+crypto.randomUUID())}));state=await init.json();}
   const file={id:b.id,name:state.source.name,source:state.source,collection:b.collection||'inbox',status:state.status,created:state.created};await this.ctx.storage.put('file:'+file.id,file);return json(file,201);
  }
  if(path==='/legacy'&&request.method==='GET'){
   const objects=await this.env.SOURCES.list({prefix:'citadel-sources/',limit:25,...(u.searchParams.get('cursor')?{cursor:u.searchParams.get('cursor')}:{})});const files=[];for(const obj of objects.objects){const id=obj.key.match(/^citadel-sources\/([a-f0-9-]{36})\/source.json$/)?.[1];if(id&&!await this.ctx.storage.get('file:'+id))files.push({id,size:obj.size,uploaded:obj.uploaded});}return json({files,next:objects.truncated?objects.cursor:null});
  }
  const adopt=path.match(/^\/adopt\/([a-f0-9-]{36})$/);
  if(adopt&&request.method==='POST'){const id=adopt[1],existing=await this.ctx.storage.get('file:'+id);if(existing)return json(existing);const state=await (await this.upload(id,'status')).json();if(state.status!=='complete')fail('Older source is not complete',409);const file={id,name:state.source.name,source:state.source,collection:'inbox',status:'complete',created:state.created};await this.ctx.storage.put('file:'+id,file);return json(file);}
  const download=path.match(/^\/download\/([a-f0-9-]{72})$/);
  if(download&&request.method==='GET'){const ticket=await this.ctx.storage.get('ticket:'+await digest(download[1]));if(!ticket||ticket.expires<Date.now())fail('Download link expired. Open the cabinet for a fresh link.',401);const file=await this.getFile(ticket.file);if(file.status!=='complete')fail('File unavailable',409);const response=await this.upload(file.id,'download','GET',undefined,request.headers);const headers=new Headers(response.headers);const safe=file.name.replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,150)||'download';headers.set('content-disposition',`attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g,'%27')}`);headers.set('referrer-policy','no-referrer');return new Response(response.body,{status:response.status,headers});}
  const m=path.match(/^\/files\/([a-f0-9-]{36})(\/status|\/parts\/\d+|\/complete|\/ticket)?$/);if(!m)fail('Filing endpoint not found',404);
  let file=await this.getFile(m[1]);if(file.status==='deleted'){if(request.method==='DELETE')return json({deleted:true});fail('File was deleted',410);}
  if(!m[2]&&request.method==='PATCH'){const b=await body(request);if(b.name!==undefined){if(typeof b.name!=='string'||!b.name.trim()||b.name.length>200)fail('File name must contain 1–200 characters');file.name=b.name.trim();}if(b.collection!==undefined){await this.collection(b.collection);file.collection=b.collection;}file.updated=new Date().toISOString();await this.ctx.storage.put('file:'+file.id,file);return json(file);}
  if(!m[2]&&request.method==='DELETE'){await this.upload(file.id,'remove','DELETE');file={...file,status:'deleted',deleted:new Date().toISOString()};await this.ctx.storage.put('file:'+file.id,file);return json({deleted:true});}
  if(m[2]==='/status'&&request.method==='GET')return this.upload(file.id,'status');
  if(m[2]?.startsWith('/parts/')&&request.method==='PUT')return this.upload(file.id,m[2].slice(1),'PUT',request.body,request.headers);
  if(m[2]==='/complete'&&request.method==='POST'){const response=await this.upload(file.id,'complete','POST'),state=await response.json();file.status=state.status;await this.ctx.storage.put('file:'+file.id,file);return json(file);}
  if(m[2]==='/ticket'&&request.method==='POST'){if(file.status!=='complete')fail('File is not complete',409);const token=crypto.randomUUID()+crypto.randomUUID();await this.ctx.storage.put('ticket:'+await digest(token),{file:file.id,expires:Date.now()+60000});await this.ctx.storage.setAlarm(Date.now()+65000);return json({path:'/api/files/download/'+token,expiresInSeconds:60});}
  fail('Filing operation not supported',405);
 }
 async alarm(){const tickets=await this.ctx.storage.list({prefix:'ticket:',limit:1000});for(const [key,value] of tickets)if(value.expires<Date.now())await this.ctx.storage.delete(key);if(tickets.size)await this.ctx.storage.setAlarm(Date.now()+65000);}
}
