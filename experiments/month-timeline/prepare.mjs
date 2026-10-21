// Private source indexing only. Never log titles, message IDs, text, credentials or tickets.
import {createHash} from 'node:crypto';import {open,readFile,writeFile,mkdir,rm} from 'node:fs/promises';import {createWriteStream} from 'node:fs';import {pipeline} from 'node:stream/promises';import {spawn,execFileSync} from 'node:child_process';import {once} from 'node:events';
import {compileBlocks} from './compile.mjs';
const key=process.env.CREATE_ROOM_KEY;
if(!key)throw Error('Existing storage credentials required');
const origin='https://group-canvas-tower.agi144348.workers.dev',directory='/tmp/echo-block-months';
const sha=b=>createHash('sha256').update(b).digest('hex');
const uuid=s=>{let h=sha(s).slice(0,32).split('');h[12]='5';h[16]='8';h=h.join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
async function api(path,method='GET',body,checksum){const r=await fetch(origin+'/api/files'+path,{method,headers:{'x-filing-key':key,...(checksum?{'x-part-sha256':checksum}:{}),...(body&&!Buffer.isBuffer(body)?{'content-type':'application/json'}:{})},body:Buffer.isBuffer(body)?body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error('Private cabinet HTTP '+r.status);return r.json();}
async function download(id,path){const ticket=await api('/files/'+id+'/ticket','POST');const r=await fetch(origin+ticket.path,{signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error('Private download failed');await pipeline(r.body,createWriteStream(path,{mode:0o600}));}
async function inventory(){const files=[];let after;for(let n=0;n<100;n++){const r=await api('/files'+(after?'?after='+encodeURIComponent(after):''));files.push(...r.files);after=r.next;if(!after)return files;}throw Error('Inventory budget exceeded');}
async function upload(collection,name,bytes){const checksum=sha(bytes),id=uuid('echo-block-months-v1:'+name+':'+checksum),sampleHash=sha(Buffer.concat([bytes.subarray(0,65536),bytes.subarray(Math.max(0,bytes.length-65536))]));await api('/files','POST',{id,collection,source:{name,size:bytes.length,sampleHash}});const status=await api('/files/'+id+'/status');if(status.status!=='complete'){for(let n=1;n<=Math.ceil(bytes.length/status.partBytes);n++){const part=bytes.subarray((n-1)*status.partBytes,n*status.partBytes),hash=sha(part),old=status.parts.find(p=>p.partNumber===n);if(old&&old.sha256!==hash)throw Error('Derived part conflict');if(!old)await api(`/files/${id}/parts/${n}`,'PUT',part,hash);}await api('/files/'+id+'/complete','POST');}await download(id,directory+'/verify');if(sha(await readFile(directory+'/verify'))!==checksum)throw Error('Derived readback mismatch');await rm(directory+'/verify');return {fileId:id,sha256:checksum,bytes:bytes.length};}

await mkdir(directory,{recursive:true,mode:0o700});
try{
 const files=await inventory();
 const candidates=files.filter(f=>f.status==='complete'&&f.source.name==='echo-timeline-provenance.json').sort((a,b)=>a.created.localeCompare(b.created));
 if(!candidates.length)throw Error('No derived chronology provenance');
 await download(candidates.at(-1).id,directory+'/provenance.json');const provenance=JSON.parse((await readFile(directory+'/provenance.json')).toString());
 await download(provenance.derived.fileId,directory+'/index.json');const raw=await readFile(directory+'/index.json');
 if(sha(raw)!==provenance.derived.sha256)throw Error('Derived chronology checksum mismatch');
 const sources=files.filter(f=>/^conversations(?:[-_ ]\d+)?\.json$/i.test(f.source.name));
 for(const source of sources){const status=await api('/files/'+source.id+'/status');source.status=status.status;}
 const manifest=compileBlocks(sources,JSON.parse(raw.toString()));
 manifest.sourceIndexSHA256=provenance.derived.sha256;
 manifest.echoAssistance={status:'source metadata only; vocabulary qualification and semantic placement pending'};
 manifest.revision=sha(JSON.stringify(manifest));
 const content=Buffer.from(JSON.stringify(manifest)),collectionId=uuid('echo-conversation-timeline-collection-v1');
 await upload(collectionId,'echo-gpt-block-months.json',content);
 await mkdir('month-result',{recursive:true});await writeFile('month-result/summary.json',JSON.stringify({...manifest.summary,firstMonth:manifest.firstMonth,lastMonth:manifest.lastMonth,manifestBytes:content.length,sourceExportsRead:false,derivedReadbackVerified:true},null,2));
 await writeFile(directory+'/manifest.json',content,{mode:0o600});
 execFileSync('openssl',['cms','-encrypt','-binary','-aes-256-cbc','-in',directory+'/manifest.json','-out','month-result/private-manifest.cms','-outform','DER','tools/dictionary-research/recipient.pem'],{stdio:'ignore'});
 console.log('Private GPT block/month manifest saved and readback verified. '+manifest.summary.blocks+' source slots; '+manifest.summary.pending+' incomplete.');
} catch {console.log('Private block/month preparation stopped; no source identifiers or contents logged.');process.exitCode=1;}
finally{await rm(directory,{recursive:true,force:true});}

