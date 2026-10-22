// Private source definition search only. Never log titles, message IDs, text, credentials or tickets.
import {createHash} from 'node:crypto';import {open,readFile,writeFile,mkdir,rm} from 'node:fs/promises';import {createWriteStream} from 'node:fs';import {pipeline} from 'node:stream/promises';import {spawn,execFileSync} from 'node:child_process';import {once} from 'node:events';
import {conversationRecords} from '../../public/tower/archive-parser.js';
const key=process.env.CREATE_ROOM_KEY,account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!key||!account||!token)throw Error('Existing storage credentials required');
const origin='https://group-canvas-tower.agi144348.workers.dev',directory='/tmp/julian-private-recovery';
const sha=b=>createHash('sha256').update(b).digest('hex');
const uuid=s=>{let h=sha(s).slice(0,32).split('');h[12]='5';h[16]='8';h=h.join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
async function api(path,method='GET',body,checksum){const r=await fetch(origin+'/api/files'+path,{method,headers:{'x-filing-key':key,...(checksum?{'x-part-sha256':checksum}:{}),...(body&&!Buffer.isBuffer(body)?{'content-type':'application/json'}:{})},body:Buffer.isBuffer(body)?body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error('Private cabinet HTTP '+r.status);return r.json();}
async function download(id,path){const ticket=await api('/files/'+id+'/ticket','POST');const r=await fetch(origin+ticket.path,{signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error('Private download failed');await pipeline(r.body,createWriteStream(path,{mode:0o600}));}
async function inventory(){const files=[];let after;for(let n=0;n<100;n++){const r=await api('/files'+(after?'?after='+encodeURIComponent(after):''));files.push(...r.files);after=r.next;if(!after)return files;}throw Error('Inventory budget exceeded');}
async function upload(collection,name,bytes){const checksum=sha(bytes),id=uuid('project-julian-recovery-v1:'+name+':'+checksum),sampleHash=sha(Buffer.concat([bytes.subarray(0,65536),bytes.subarray(Math.max(0,bytes.length-65536))]));await api('/files','POST',{id,collection,source:{name,size:bytes.length,sampleHash}});const status=await api('/files/'+id+'/status');if(status.status!=='complete'){for(let n=1;n<=Math.ceil(bytes.length/status.partBytes);n++){const part=bytes.subarray((n-1)*status.partBytes,n*status.partBytes),hash=sha(part),old=status.parts.find(p=>p.partNumber===n);if(old&&old.sha256!==hash)throw Error('Derived part conflict');if(!old)await api(`/files/${id}/parts/${n}`,'PUT',part,hash);}await api('/files/'+id+'/complete','POST');}await download(id,directory+'/verify');if(sha(await readFile(directory+'/verify'))!==checksum)throw Error('Derived readback mismatch');await rm(directory+'/verify');return {fileId:id,sha256:checksum,bytes:bytes.length};}
await mkdir(directory,{recursive:true,mode:0o700});
let child=null;
try{
 const indexer=spawn('python',['tools/julian-recovery/recover.py',directory+'/julian-conversations.jsonl'],{stdio:['pipe','pipe','pipe']});
 child=indexer;
 indexer.stdout.resume();indexer.stderr.resume();indexer.stdin.on('error',()=>{});
 const finished=once(indexer,'close');let closed=false;indexer.on('close',()=>closed=true);
 async function send(data){if(closed)throw Error('Indexer stopped');if(!indexer.stdin.write(JSON.stringify(data)+'\n'))await once(indexer.stdin,'drain');}
 const files=await inventory(),sources=files.filter(f=>/^conversations(?:[-_ ]\d+)?\.json$/i.test(f.source.name));
 const seen=new Map(),pending=[],duplicateReferences=[],sourceReferences=[];let read=0,duplicates=0,occurrences=0;
 for(const file of sources){const status=await api('/files/'+file.id+'/status');if(status.status!=='complete'){pending.push({fileId:file.id,status:status.status});continue;}if(file.source.size>512*1024**2)throw Error('Source exceeds bounded scan');
  const path=directory+'/source.json';await download(file.id,path);const handle=await open(path,'r'),stat=await handle.stat();if(stat.size!==file.source.size)throw Error('Source size mismatch');
  const hash=createHash('sha256');for await(const b of handle.createReadStream({autoClose:false}))hash.update(b);const checksum=hash.digest('hex');
  if(seen.has(checksum)){duplicateReferences.push({sourceId:file.id,duplicateOf:seen.get(checksum),sha256:checksum});duplicates++;await handle.close();await rm(path);continue;}seen.set(checksum,file.id);sourceReferences.push({sourceId:file.id,sha256:checksum,bytes:stat.size});read++;
  const view={size:stat.size,slice:(start,end)=>({arrayBuffer:async()=>{const b=Buffer.alloc(end-start),r=await handle.read(b,0,b.length,start);return b.buffer.slice(b.byteOffset,b.byteOffset+r.bytesRead);}})};
  let ordinal=0;
  try{for await(const record of conversationRecords(view)){await send({provider:'openai',conversation:record.value,source:{source_id:file.id,sha256:checksum,ordinal:ordinal++,start_byte:record.start,end_byte:record.end,conversation_sha256:sha(record.raw)}});}}finally{await handle.close();await rm(path);}
  occurrences+=ordinal;
 }
 const objectKey='claude-exports/2026-10-20/conversations-000.zip';
 const url='https://api.cloudflare.com/client/v4/accounts/'+account+'/r2/buckets/group-canvas-citadel-sources/objects/'+encodeURIComponent(objectKey);
 const response=await fetch(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(180000)});if(!response.ok)throw Error('Private Claude R2 read HTTP '+response.status);
 const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length!==16640005||createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex')!=='70938cc8b9a75e5395943e4615a8a2ea4b92a60e')throw Error('Claude archive identity mismatch');
 await writeFile(directory+'/claude.zip',bytes,{mode:0o600});await send({archive_path:directory+'/claude.zip',source:{source_id:'r2:'+objectKey,sha256:sha(bytes)}});indexer.stdin.end();const [code]=await finished;if(code!==0)throw Error('Private indexer failed');
 const raw=await readFile(directory+'/julian-conversations.jsonl'),packed=await readFile(directory+'/julian-conversations.jsonl.gz');
 const scanSummary=JSON.parse(await readFile(directory+'/julian-conversations.summary.json','utf8'));
 const collectionId=uuid('project-julian-recovery-collection-v1'),collections=await api('/collections');
 if(!collections.collections.some(c=>c.id===collectionId))await api('/collections','POST',{id:collectionId,name:'Project Julian Thornfield · recovered conversations'});
 const saved=await upload(collectionId,'julian-conversations.jsonl',raw);
 const compressed=await upload(collectionId,'julian-conversations.jsonl.gz',packed);
 const summary={...scanSummary,sourceFilesRead:read,exactDuplicateFilesSkipped:duplicates,openaiConversationOccurrences:occurrences,pendingFiles:pending.length,sourceUnchanged:true,derivedReadbackVerified:true,outputBytes:raw.length,compressedBytes:packed.length,missingClaudeArchiveCategories:['frames']};
 const provenance={summary,pendingSources:pending,sourceReferences,duplicateReferences,derived:saved,compressed,claudeArchive:{objectKey,bytes:bytes.length,sha256:sha(bytes)},codeCommit:process.env.GITHUB_SHA,plan:'https://github.com/AGI144348Outlook/Group_Canvas/issues/9'};
 await upload(collectionId,'julian-recovery-provenance.json',Buffer.from(JSON.stringify(provenance,null,2)));
 await writeFile(directory+'/julian-recovery-provenance.json',JSON.stringify(provenance,null,2),{mode:0o600});
 await mkdir('julian-result',{recursive:true});await writeFile('julian-result/summary.json',JSON.stringify(summary,null,2));
 execFileSync('openssl',['cms','-encrypt','-binary','-aes-256-cbc','-in',directory+'/julian-conversations.jsonl.gz','-out','julian-result/private-report.cms','-outform','DER','tools/julian-recovery/recipient.pem'],{stdio:'ignore'});
 execFileSync('openssl',['cms','-encrypt','-binary','-aes-256-cbc','-in',directory+'/julian-recovery-provenance.json','-out','julian-result/private-provenance.cms','-outform','DER','tools/julian-recovery/recipient.pem'],{stdio:'ignore'});
 console.log('PRIVATE JULIAN RECOVERY '+JSON.stringify(summary));
}catch(e){console.log('Julian recovery stopped: '+(e.message.startsWith('Private')||e.message.startsWith('Source')||e.message.startsWith('Claude')?e.message:'bounded scan failed'));process.exitCode=1;}finally{if(child&&child.exitCode===null){child.stdin.destroy();child.kill();}await rm(directory,{recursive:true,force:true});}

