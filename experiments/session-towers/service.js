import {boundedBody,digest,json} from '../hierarchy-tower/upload-service.js';
const hex=/^[a-f0-9]{64}$/,ids=/^[a-f0-9-]{36}$/;
const fail=(s,status=400)=>{throw Object.assign(Error(s),{status});};
const bindings={self:'SELF_OUTPUT',julian:'JULIAN_OUTPUT',review:'SOURCES'};
const objectKey=(tower,hash)=>tower==='review'?'derived-session-review/'+hash+'.json':'derived/'+hash+'.json';
const read=async(r,max=2*1024**2)=>{try{return JSON.parse(new TextDecoder().decode(await boundedBody(r,max)));}catch(e){if(e.status)throw e;fail('Invalid tower request');}};
async function sourceAvailable(cabinet,id){if(!ids.test(id))fail('Invalid source reference');const file=await cabinet.getFile(id);if(file.status!=='complete')fail('Source is incomplete or unavailable',409);if(!await cabinet.env.SOURCES.head('citadel-sources/'+id+'/source.json'))fail('Source bytes unavailable',409);}
async function object(cabinet,tower,hash){if(!bindings[tower]||!hex.test(hash))fail('Invalid tower object address');const bucket=cabinet.env[bindings[tower]];if(!bucket)fail('Tower bucket is not bound',503);const stored=await bucket.get(objectKey(tower,hash));if(!stored)fail('Tower object unavailable',404);const text=await new Response(stored.body).text();if(await digest(text)!==hash)fail('Tower object checksum mismatch',409);return JSON.parse(text);}
async function manifest(cabinet,tower,hash){const m=await object(cabinet,tower,hash);if(m.format!=='session-tower-manifest/1'||m.tower!==tower)fail('Invalid tower manifest');return m;}
async function checkSources(cabinet,sources){if(!Array.isArray(sources)||sources.length>100)fail('Source list exceeds prototype limit');for(const source of sources){if(!hex.test(source.sha256))fail('Full source hash required');await sourceAvailable(cabinet,source.fileId);}}
export async function sessionAPI(request,cabinet){
 const path=new URL(request.url).pathname,env=cabinet.env;
 if(path==='/towers/config'&&request.method==='GET')return json({enabled:Boolean(env.SELF_OUTPUT&&env.JULIAN_OUTPUT),queryInterface:'Lattice JSON queries (not GraphQL)',towers:['self','julian','review']});
 if(!env.SELF_OUTPUT||!env.JULIAN_OUTPUT)fail('Session tower storage is not configured',503);
 if(path==='/towers/verify-bindings'&&request.method==='POST'){for(const name of Object.values(bindings)){const bucket=env[name],key='checks/session-'+crypto.randomUUID(),data='synthetic binding check';try{await bucket.put(key,data);const r=await bucket.get(key);if(!r||await new Response(r.body).text()!==data)fail('Binding read-back failed',503);}finally{await bucket.delete(key);}}return json({verified:true,syntheticOnly:true,cleaned:true});}
 if(path==='/towers'&&request.method==='GET'){const rows=await cabinet.ctx.storage.list({prefix:'session-active:',limit:3});return json({towers:[...rows.values()]});}
 const obj=path.match(/^\/towers\/(self|julian|review)\/objects\/([a-f0-9]{64})$/);
 if(obj&&request.method==='PUT'){
  const [,tower,hash]=obj,bytes=await boundedBody(request,2*1024**2);if(await digest(bytes)!==hash)fail('Object digest mismatch');let value;try{value=JSON.parse(new TextDecoder().decode(bytes));}catch{fail('Invalid derived JSON');}
  if(!value||typeof value!=='object'||Array.isArray(value))fail('Derived object required');
  if(value.format==='session-tower-part/1'){if(value.tower!==tower||!Array.isArray(value.records)||value.records.length>500)fail('Invalid tower part');await checkSources(cabinet,value.sources);for(const r of value.records){if(!r||typeof r!=='object')fail('Invalid derived record');if(!value.sources.some(s=>s.fileId===r.source?.fileId&&s.sha256===r.source?.sha256))fail('Unlisted record source');if(tower==='self'&&r.role!=='user')fail('Self records must be user-role');if(tower==='julian'&&(!r.candidate||!['direct','inherited'].includes(r.tier)))fail('Julian records must remain session candidates');}}
  else if(value.format==='session-tower-manifest/1'){if(value.tower!==tower||!Array.isArray(value.parts)||value.parts.length>1000||value.parts.some(p=>!hex.test(p.hash)||!Number.isSafeInteger(p.count)||p.count<0))fail('Invalid manifest parts');await checkSources(cabinet,value.sources);}
  else fail('Unsupported derived object');
  const bucket=env[bindings[tower]],key=objectKey(tower,hash),old=await bucket.head(key);if(!old)await bucket.put(key,bytes,{httpMetadata:{contentType:'application/json'},customMetadata:{sha256:hash,tower,count:String(value.records?.length??0),format:value.format}});
  // Independently read the persisted object, including on retries.
  await object(cabinet,tower,hash);return json({hash,verified:true,reused:Boolean(old)});
 }
 if(obj&&request.method==='GET'){const value=await object(cabinet,obj[1],obj[2]);await checkSources(cabinet,value.sources);return json(value);}
 if(path==='/towers/commit'&&request.method==='POST'){
  const b=await read(request,4096);if(!['self','julian','review'].includes(b.tower)||!hex.test(b.manifestHash)||!ids.test(b.runId))fail('Invalid commit identity');const m=await manifest(cabinet,b.tower,b.manifestHash);await checkSources(cabinet,m.sources);let total=0;
  for(const part of m.parts){const head=await env[bindings[b.tower]].head(objectKey(b.tower,part.hash));if(head?.customMetadata?.sha256!==part.hash||head.customMetadata.format!=='session-tower-part/1'||head.customMetadata.count!==String(part.count))fail('Unverified or missing derived part',409);total+=part.count;}
  if(total!==m.count)fail('Manifest count differs from parts');const previous=await cabinet.ctx.storage.get('session-run:'+b.runId+':'+b.tower);if(previous){if(previous.manifestHash!==b.manifestHash)fail('Run identity collision',409);return json(previous);}
  const active={tower:b.tower,manifestHash:b.manifestHash,runId:b.runId,count:m.count,updated:new Date().toISOString(),policy:m.policy,counts:m.counts};const write=async storage=>{await storage.put('session-run:'+b.runId+':'+b.tower,active);await storage.put('session-active:'+b.tower,active);};if(cabinet.ctx.storage.transaction)await cabinet.ctx.storage.transaction(write);else await write(cabinet.ctx.storage);return json(active);
 }
 if(path==='/towers/query'&&request.method==='POST'){
  const q=await read(request,8192);if(!['self','julian','review'].includes(q.tower))fail('Known tower required');const active=await cabinet.ctx.storage.get('session-active:'+q.tower);const hash=q.manifestHash||active?.manifestHash;if(!hash)fail('No completed session scan exists yet',404);const m=await manifest(cabinet,q.tower,hash);if(q.operation==='inventory')return json({manifestHash:hash,manifest:m});await checkSources(cabinet,m.sources);
  if(q.operation==='manifest')return json({manifestHash:hash,manifest:m});
  let part=q.after?.part??0,offset=q.after?.offset??0,first=q.first??20;if(!Number.isSafeInteger(part)||part<0||part>m.parts.length||!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(first)||first<1||first>20)fail('Invalid query pagination');if(q.hash){part=m.parts.findIndex(p=>p.hash===q.hash);if(part<0)fail('Part does not belong to this manifest',404);}
  if(part===m.parts.length)return json({records:[],next:null,manifestHash:hash});const chunk=await object(cabinet,q.tower,m.parts[part].hash);if(offset>chunk.records.length)fail('Invalid record offset');
  const records=[];let bytes=0;while(offset<chunk.records.length&&records.length<first){const row=chunk.records[offset],size=JSON.stringify(row).length;if(bytes+size>1800000&&records.length)break;records.push({record:row,reference:{type:'tower',tower:q.tower,manifestHash:hash,partHash:m.parts[part].hash,index:offset}});bytes+=size;offset++;}
  const next=offset<chunk.records.length?{part,offset}:part+1<m.parts.length?{part:part+1,offset:0}:null;return json({records,next,manifestHash:hash,total:m.count});
 }
 fail('Unknown session tower operation',404);
}
