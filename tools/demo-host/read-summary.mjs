// Read back derived metadata for QA. No credentials, identifiers or titles are logged.
import {writeFile,mkdir} from 'node:fs/promises';
const origin='https://group-canvas-tower.agi144348.workers.dev',key=process.env.CREATE_ROOM_KEY;
if(!key)throw Error('Existing operator credential unavailable');
async function api(path,method='GET'){const r=await fetch(origin+'/api/files'+path,{method,headers:{'x-filing-key':key},signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error('Private readback unavailable');return r.json();}
let files=[],after;for(let page=0;page<100;page++){const r=await api('/files'+(after?'?after='+encodeURIComponent(after):''));files.push(...r.files);after=r.next;if(!after)break;}if(after)throw Error('Inventory budget');
async function bytes(file){const ticket=await api('/files/'+file.id+'/ticket','POST'),r=await fetch(origin+ticket.path,{signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error('Derived read unavailable');return Buffer.from(await r.arrayBuffer());}
const candidates=files.filter(f=>f.status==='complete'&&f.source.name==='echo-timeline-provenance.json');if(!candidates.length)throw Error('No timeline provenance');
const provenance=JSON.parse((await bytes(candidates[candidates.length-1])).toString());const allowed=['format','conversations','dated_messages','undated_messages','source_objects','first','last','sourceFilesRead','exactDuplicateFilesSkipped','openaiConversationOccurrences','pendingFiles','sourceUnchanged','derivedReadbackVerified','outputBytes','transcriptTextCopied','autonomousLearning'];const summary=Object.fromEntries(allowed.filter(k=>k in provenance).map(k=>[k,provenance[k]]));
await mkdir('demo-host-result',{recursive:true});await writeFile('demo-host-result/timeline-summary.json',JSON.stringify(summary,null,2));console.log('TIMELINE SUMMARY '+JSON.stringify(summary));
const index=files.find(f=>f.id===provenance.derived.fileId);if(!index)throw Error('Derived index missing');const content=await bytes(index);
const {createHash}=await import('node:crypto');if(createHash('sha256').update(content).digest('hex')!==provenance.derived.sha256)throw Error('Derived digest differs');await writeFile('/tmp/private-timeline-for-qa.json',content,{mode:0o600});
