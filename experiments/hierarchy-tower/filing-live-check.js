// Tiny synthetic production check. Never logs credentials, download tickets or source content.
const origin='https://group-canvas-tower.agi144348.workers.dev',key=process.env.CREATE_ROOM_KEY;
let stage='configuration',fileId=null;
const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
async function request(path,{method='GET',data,checksum}={}){const response=await fetch(origin+'/api/files'+path,{method,headers:{'x-filing-key':key,...(checksum?{'x-part-sha256':checksum}:{})},body:data instanceof Uint8Array?data:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('HTTP '+response.status);return response;}
try{
 const config=await (await request('/config')).json();if(!config.enabled||!key){console.log('SKIPPED: private filing storage is unavailable');process.exit(0);}
 stage='synthetic upload registration';fileId=crypto.randomUUID();const bytes=new Uint8Array(8*1024*1024+3);bytes.fill(97);bytes.set([98,99,100],bytes.length-3);const samples=new Uint8Array(131072);samples.set(bytes.slice(0,65536));samples.set(bytes.slice(-65536),65536);
 await request('/files',{method:'POST',data:{id:fileId,collection:'inbox',source:{name:'synthetic-storage-check.bin',size:bytes.length,sampleHash:await hash(samples)}}});
 stage='first chunk and idempotent retry';const first=bytes.slice(0,8*1024*1024),checksum=await hash(first);await request('/files/'+fileId+'/parts/1',{method:'PUT',data:first,checksum});await request('/files/'+fileId+'/parts/1',{method:'PUT',data:first,checksum});
 stage='resume status';const resumed=await (await request('/files/'+fileId+'/status')).json();if(resumed.parts.length!==1)throw Error('Unexpected receipt count');
 stage='final chunk and completion';const last=bytes.slice(8*1024*1024);await request('/files/'+fileId+'/parts/2',{method:'PUT',data:last,checksum:await hash(last)});await request('/files/'+fileId+'/complete',{method:'POST'});
 stage='file listing';const listing=await (await request('/files')).json();if(!listing.files.some(f=>f.id===fileId))throw Error('Synthetic file absent from first page');
 stage='streamed attachment read-back';const {path}=await (await request('/files/'+fileId+'/ticket',{method:'POST'})).json();const download=await fetch(origin+path,{signal:AbortSignal.timeout(120000)});if(!download.ok)throw Error('Download unavailable');if(await hash(await download.arrayBuffer())!==await hash(bytes))throw Error('Read-back checksum mismatch');
 stage='filing metadata';await request('/files/'+fileId,{method:'PATCH',data:{name:'synthetic-storage-check-renamed.bin',collection:'inbox'}});
 console.log('PASS: real R2 multipart upload, duplicate retry, resume status, completion, listing, private streamed read-back and rename');
}catch(e){console.error('FAIL: live storage check at '+stage+' ('+e.message+')');process.exitCode=1;}
finally{if(fileId){try{await request('/files/'+fileId,{method:'DELETE'});console.log('CLEANUP: synthetic bytes removed');}catch{console.error('CLEANUP NEEDED: synthetic source '+fileId);process.exitCode=1;}}}
