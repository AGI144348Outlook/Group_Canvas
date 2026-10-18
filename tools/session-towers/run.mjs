// Private deterministic batch runner. Aggregate counts only; no source text or capabilities in logs.
import {open,mkdir,rm} from 'node:fs/promises';import {createWriteStream} from 'node:fs';import {pipeline} from 'node:stream/promises';import {createHash,randomUUID} from 'node:crypto';
import {conversationRecords} from '../../public/tower/archive-parser.js';import {deriveConversation,POLICY} from '../../experiments/session-towers/engine.js';
const origin='https://group-canvas-tower.agi144348.workers.dev',key=process.env.CREATE_ROOM_KEY;
if(!key||key.length<24)throw Error('Operator credential unavailable');
const sha=text=>createHash('sha256').update(text).digest('hex');
async function api(path,method='GET',body){const response=await fetch(origin+'/api/files'+path,{method,headers:{'x-filing-key':key,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(180000)});if(!response.ok)throw Error('Private storage HTTP '+response.status);return response.json();}
async function inventory(){let after;const files=[];for(let i=0;i<100;i++){const r=await api('/files'+(after?'?after='+encodeURIComponent(after):''));files.push(...r.files);after=r.next;if(!after)return files;}throw Error('Source inventory limit exceeded');}
async function save(tower,value){const hash=sha(JSON.stringify(value));const result=await api(`/towers/${tower}/objects/${hash}`,'PUT',value);if(!result.verified)throw Error('Server read-back failed');const read=await api(`/towers/${tower}/objects/${hash}`);if(sha(JSON.stringify(read))!==hash)throw Error('Independent read-back checksum mismatch');return hash;}
await mkdir('/tmp/session-towers-private',{mode:0o700,recursive:true});
try{
 const config=await api('/towers/config');if(!config.enabled)throw Error('Output bindings unavailable');const bindingCheck=await api('/towers/verify-bindings','POST');if(!bindingCheck.cleaned)throw Error('Binding check cleanup failed');console.log('Private binding checks passed; synthetic bytes cleaned.');
 const previous={};for(const tower of ['self','julian','review']){try{previous[tower]=(await api('/towers/query','POST',{tower,operation:'inventory'})).manifest;}catch(error){if(!/HTTP 404$/.test(error.message))throw error;}}
 const files=(await inventory()).filter(f=>/^conversations(?:[-_ ]\d+)?\.json$/i.test(f.source.name));
 const manifests={};for(const tower of ['self','julian','review'])manifests[tower]={format:'session-tower-manifest/1',tower,policy:POLICY,sources:[],pending:[],parts:[],count:0,counts:{conversations:0,branchErrors:0,direct:0,inherited:0,unsure:0,flaggedPrompts:0,exclusions:{}},orphans:[],duplicateSources:[]};
 const seen=new Map();
 for(const file of files){const state=await api('/files/'+file.id+'/status');if(state.status!=='complete'){for(const m of Object.values(manifests))m.pending.push({fileId:file.id,name:file.source.name,status:state.status});continue;}if(file.source.size>512*1024**2)throw Error('Source exceeds bounded scan size');
  const path='/tmp/session-towers-private/source';const ticket=await api('/files/'+file.id+'/ticket','POST');const response=await fetch(origin+ticket.path,{signal:AbortSignal.timeout(180000)});if(!response.ok)throw Error('Source read failed');await pipeline(response.body,createWriteStream(path,{mode:0o600}));const handle=await open(path,'r');
  try{const stat=await handle.stat();if(stat.size!==file.source.size)throw Error('Source size mismatch');const h=createHash('sha256');for await(const chunk of handle.createReadStream({autoClose:false}))h.update(chunk);const sourceSha=h.digest('hex');if(seen.has(sourceSha)){for(const m of Object.values(manifests))m.duplicateSources.push({fileId:file.id,duplicateOf:seen.get(sourceSha),sha256:sourceSha});continue;}seen.set(sourceSha,file.id);
   const source={fileId:file.id,name:file.source.name,sha256:sourceSha,size:stat.size};for(const m of Object.values(manifests))m.sources.push(source);
   const buffers={self:[],julian:[],review:[]};let sizes={self:0,julian:0,review:0};
   async function flush(tower){if(!buffers[tower].length)return;const records=buffers[tower];const hash=await save(tower,{format:'session-tower-part/1',tower,sources:[source],records});manifests[tower].parts.push({hash,count:records.length});manifests[tower].count+=records.length;buffers[tower]=[];sizes[tower]=0;}
   async function append(tower,record){const bytes=Buffer.byteLength(JSON.stringify(record));if(bytes>1800000)throw Error('One derived record exceeds bounded output limit; scan stopped without activating a new manifest');if(sizes[tower]+bytes>1800000||buffers[tower].length>=400)await flush(tower);buffers[tower].push(record);sizes[tower]+=bytes;}
   const view={size:stat.size,slice:(start,end)=>({arrayBuffer:async()=>{const bytes=Buffer.alloc(end-start),r=await handle.read(bytes,0,bytes.length,start);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+r.bytesRead);}})};let ordinal=0;
   for await(const record of conversationRecords(view)){
    const provenance={...source,ordinal:ordinal++,conversationId:record.value.id||record.value.conversation_id||null,currentNode:record.value.current_node||null,startByte:record.start,endByte:record.end,conversationSha256:sha(record.raw)};
    const result=deriveConversation(record.value,provenance);for(const m of Object.values(manifests)){m.counts.conversations++;if(result.error)m.counts.branchErrors++;for(const [reason,count] of Object.entries(result.excluded))m.counts.exclusions[reason]=(m.counts.exclusions[reason]||0)+count;}
    if(result.error)await append('review',{source:provenance,candidate:true,reason:result.error});
    for(const row of result.self){if(row.flags.length)manifests.self.counts.flaggedPrompts++;await append('self',row);}
    for(const row of result.julian){manifests.julian.counts[row.tier]++;await append('julian',row);}
    for(const row of result.review){if(row.tier==='unsure')manifests.review.counts.unsure++;await append('review',row);}
   }
   for(const tower of Object.keys(buffers))await flush(tower);console.log('Scanned complete source '+seen.size+'; conversation occurrences='+ordinal+'; private parts verified.');
  }finally{await handle.close();await rm(path,{force:true});}
 }
 const completeIds=new Set([...manifests.self.sources,...manifests.self.duplicateSources].map(f=>f.fileId));const knownIds=new Set(files.map(f=>f.id));const runId=randomUUID();
 // Missing from inventory is only a removal candidate, never proof of deletion.
 for(const [tower,m] of Object.entries(manifests)){m.orphans=(previous[tower]?.sources||[]).filter(s=>!completeIds.has(s.fileId)).map(s=>({sourceFileId:s.fileId,state:knownIds.has(s.fileId)?'pending-or-unavailable':'missing-from-current-inventory',action:'review-required-no-delete'}));const hash=await save(tower,m);await api('/towers/commit','POST',{tower,manifestHash:hash,runId});console.log('SESSION TOWER '+JSON.stringify({tower,records:m.count,parts:m.parts.length,counts:m.counts,pending:m.pending.length,removalCandidates:m.orphans.length}));}
 console.log('Session scan complete; immutable data verified, manifests committed; no source changes, deletions, training or adapter activation.');
}finally{await rm('/tmp/session-towers-private',{recursive:true,force:true});}
