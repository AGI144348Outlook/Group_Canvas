// Private bounded scan: no conversation text or download capabilities are logged.
import {createHash} from 'node:crypto';
import {open,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {conversationRecords} from '../../public/tower/archive-parser.js';
import {filterConversation,characters} from './filter.mjs';
const origin='https://group-canvas-tower.agi144348.workers.dev',key=process.env.CREATE_ROOM_KEY;
if(!key||key.length<24)throw Error('Operator credential unavailable');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const uuid=text=>{let h=sha(text).slice(0,32).split('');h[12]='5';h[16]='8';h=h.join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
async function api(path,method='GET',body,checksum){const r=await fetch(origin+'/api/files'+path,{method,headers:{'x-filing-key':key,...(checksum?{'x-part-sha256':checksum}:{}),...(body&&!Buffer.isBuffer(body)?{'content-type':'application/json'}:{})},body:Buffer.isBuffer(body)?body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error('Private storage request failed: HTTP '+r.status);return r.json();}
async function inventory(){const files=[];let after;for(let page=0;page<100;page++){const r=await api('/files'+(after?'?after='+encodeURIComponent(after):''));files.push(...r.files);after=r.next;if(!after)return files;}throw Error('Inventory budget exceeded');}
async function download(file,path){const ticket=await api('/files/'+file.id+'/ticket','POST');const r=await fetch(origin+ticket.path,{signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error('Private source download failed');await pipeline(r.body,createWriteStream(path,{mode:0o600}));}
async function upload(collection,name,bytes){const checksum=sha(bytes),id=uuid('tower-filter-v1:'+collection+':'+name+':'+checksum),sampleHash=sha(Buffer.concat([bytes.subarray(0,65536),bytes.subarray(Math.max(0,bytes.length-65536))]));await api('/files','POST',{id,collection,source:{name,size:bytes.length,sampleHash}});const state=await api('/files/'+id+'/status');if(state.status!=='complete'){for(let n=1;n<=Math.ceil(bytes.length/state.partBytes);n++){const chunk=bytes.subarray((n-1)*state.partBytes,n*state.partBytes),hash=sha(chunk),old=state.parts.find(p=>p.partNumber===n);if(old&&old.sha256!==hash)throw Error('Derived part collision');if(!old)await api(`/files/${id}/parts/${n}`,'PUT',chunk,hash);}await api('/files/'+id+'/complete','POST');}const verify='/tmp/tower-filter-private/verify';await download({id},verify);const actual=sha(await readFile(verify));await rm(verify);if(actual!==checksum)throw Error('Derived output read-back checksum failed');return {fileId:id,name,sha256:checksum,bytes:bytes.length};}
await mkdir('/tmp/tower-filter-private',{recursive:true,mode:0o700});
try{
 const collections=await api('/collections');const towers={};
 for(const [kind,name] of [['prompts','My prompts tower'],['mentions','Character mentions tower']]){const id=uuid('derived-tower-v1:'+kind);const old=collections.collections.find(c=>c.id===id);if(!old)await api('/collections','POST',{id,name});towers[kind]={format:'derived-citadel/1',id,name,sourceBucket:'group-canvas-citadel-sources',filterVersion:1,filter:kind==='prompts'?{role:'user',branches:'all-recorded'}:{names:characters,case:'insensitive',boundaries:'Unicode letters/numbers/underscore',classification:'mention-candidate'},sourceUnchanged:true,roleAssignment:false,files:[],sources:[],pendingSources:[]};}
 const all=await inventory(),sources=all.filter(f=>/^conversations(?:[-_ ]\d+)?\.json$/i.test(f.source.name));
 const seen=new Map();let totalConversations=0;
 for(const file of sources){const status=await api('/files/'+file.id+'/status');if(status.status!=='complete'){for(const tower of Object.values(towers))tower.pendingSources.push({fileId:file.id,name:file.source.name,status:status.status});continue;}
  if(file.source.size>512*1024**2)throw Error('Source exceeds this scan runner budget');
  const path='/tmp/tower-filter-private/source';await download(file,path);const handle=await open(path,'r'),stat=await handle.stat();if(stat.size!==file.source.size){await handle.close();throw Error('Source size mismatch');}
  const hash=createHash('sha256');for await(const chunk of handle.createReadStream({autoClose:false}))hash.update(chunk);const sourceSha256=hash.digest('hex');
  if(seen.has(sourceSha256)){for(const tower of Object.values(towers))tower.sources.push({fileId:file.id,sha256:sourceSha256,duplicateOf:seen.get(sourceSha256)});await handle.close();await rm(path);continue;}seen.set(sourceSha256,file.id);
  const source={fileId:file.id,name:file.source.name,size:stat.size,sha256:sourceSha256};for(const tower of Object.values(towers))tower.sources.push(source);
  const outputs={prompts:[],mentions:[]};let ordinal=0,outputBytes=0;
  const view={size:stat.size,slice:(start,end)=>({arrayBuffer:async()=>{const bytes=Buffer.alloc(end-start);const {bytesRead}=await handle.read(bytes,0,bytes.length,start);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytesRead);}})};
  try{for await(const record of conversationRecords(view)){const result=filterConversation(record.value,{sourceFileId:file.id,sourceSha256,ordinal:ordinal++,startByte:record.start,endByte:record.end,conversationSha256:sha(record.raw)});for(const kind of Object.keys(outputs))for(const entry of result[kind]){const line=JSON.stringify(entry);outputBytes+=Buffer.byteLength(line);if(outputBytes>512*1024**2)throw Error('Derived source output exceeds scan memory budget');outputs[kind].push(line);}}}finally{await handle.close();await rm(path);}
  totalConversations+=ordinal;
  for(const kind of Object.keys(outputs)){const bytes=Buffer.from('[\n'+outputs[kind].join(',\n')+'\n]\n');const output=await upload(towers[kind].id,kind+'-'+file.id+'.json',bytes);towers[kind].files.push({...output,records:outputs[kind].length,sourceFileId:file.id});}
  console.log('Filtered completed source '+seen.size+'; conversation occurrences='+ordinal+'; user messages='+outputs.prompts.length+'; character mention messages='+outputs.mentions.length);
 }
 for(const kind of Object.keys(towers)){const tower=towers[kind];tower.records=tower.files.reduce((n,f)=>n+f.records,0);tower.conversationOccurrences=totalConversations;tower.generatedAt=new Date().toISOString();const bytes=Buffer.from(JSON.stringify(tower,null,2));await upload(tower.id,'tower-manifest-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json',bytes);console.log(tower.name+': '+tower.records+' records; '+tower.pendingSources.length+' pending upload entries excluded.');}
 console.log('Two derived tower collections saved and SHA-256 read-back verified. No source files changed. Character mentions are candidates, user messages include quotations; no persona inference.');
}finally{await rm('/tmp/tower-filter-private',{recursive:true,force:true});}
