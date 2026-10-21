// Private source definition search only. Never log titles, message IDs, text, credentials or tickets.
import {createHash} from 'node:crypto';import {open,readFile,writeFile,mkdir,rm} from 'node:fs/promises';import {createWriteStream} from 'node:fs';import {pipeline} from 'node:stream/promises';import {spawn,execFileSync} from 'node:child_process';import {once} from 'node:events';
import {conversationRecords} from '../../public/tower/archive-parser.js';
const key=process.env.CREATE_ROOM_KEY;
if(!key)throw Error('Existing storage credentials required');
const origin='https://group-canvas-tower.agi144348.workers.dev',directory='/tmp/echo-private-dictionary-focus';
const sha=b=>createHash('sha256').update(b).digest('hex');
const uuid=s=>{let h=sha(s).slice(0,32).split('');h[12]='5';h[16]='8';h=h.join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
async function api(path,method='GET',body,checksum){const r=await fetch(origin+'/api/files'+path,{method,headers:{'x-filing-key':key,...(checksum?{'x-part-sha256':checksum}:{}),...(body&&!Buffer.isBuffer(body)?{'content-type':'application/json'}:{})},body:Buffer.isBuffer(body)?body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error('Private cabinet HTTP '+r.status);return r.json();}
async function download(id,path){const ticket=await api('/files/'+id+'/ticket','POST');const r=await fetch(origin+ticket.path,{signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error('Private download failed');await pipeline(r.body,createWriteStream(path,{mode:0o600}));}
async function inventory(){const files=[];let after;for(let n=0;n<100;n++){const r=await api('/files'+(after?'?after='+encodeURIComponent(after):''));files.push(...r.files);after=r.next;if(!after)return files;}throw Error('Inventory budget exceeded');}
async function upload(collection,name,bytes){const checksum=sha(bytes),id=uuid('echo-dictionary-recovery-v1:'+name+':'+checksum),sampleHash=sha(Buffer.concat([bytes.subarray(0,65536),bytes.subarray(Math.max(0,bytes.length-65536))]));await api('/files','POST',{id,collection,source:{name,size:bytes.length,sampleHash}});const status=await api('/files/'+id+'/status');if(status.status!=='complete'){for(let n=1;n<=Math.ceil(bytes.length/status.partBytes);n++){const part=bytes.subarray((n-1)*status.partBytes,n*status.partBytes),hash=sha(part),old=status.parts.find(p=>p.partNumber===n);if(old&&old.sha256!==hash)throw Error('Derived part conflict');if(!old)await api(`/files/${id}/parts/${n}`,'PUT',part,hash);}await api('/files/'+id+'/complete','POST');}await download(id,directory+'/verify');if(sha(await readFile(directory+'/verify'))!==checksum)throw Error('Derived readback mismatch');await rm(directory+'/verify');return {fileId:id,sha256:checksum,bytes:bytes.length};}

await mkdir(directory,{recursive:true,mode:0o700});
try{
 await download('019fe11a-464c-5909-820f-314a4f2bab9f',directory+'/broad.json');
 const input=await readFile(directory+'/broad.json');
 if(input.length!==18119134||sha(input)!=='f0e66619bba6f5e6b4ccfbe0d6181f7a87a3183b25d6d44ce0ba96f96d6eeeac')throw Error('Pinned derived report mismatch');
 execFileSync('python',['tools/dictionary-focus/focus.py',directory+'/broad.json',directory+'/focused.json'],{stdio:'ignore'});
 const collectionId=uuid('echo-dictionary-recovery-collection-v1');
 await upload(collectionId,'echo-dictionary-focused.json',await readFile(directory+'/focused.json'));
 await upload(collectionId,'echo-dictionary-focused-guide.md',await readFile(directory+'/focused.md'));
 await mkdir('dictionary-focus-result',{recursive:true});
 await writeFile('dictionary-focus-result/summary.json',await readFile(directory+'/focused.summary.json'));
 execFileSync('openssl',['cms','-encrypt','-binary','-aes-256-cbc','-in',directory+'/focused.json.gz','-out','dictionary-focus-result/private-focus.cms','-outform','DER','tools/dictionary-research/recipient.pem'],{stdio:'ignore'});
 console.log('Focused private dictionary guide saved and SHA-256 readback verified. No source transcript text emitted.');
}catch{console.log('Private dictionary focus stopped; inspect bounded derived artifact access without publishing contents.');process.exitCode=1;}
finally{await rm(directory,{recursive:true,force:true});}
