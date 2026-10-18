import {listDatasets,putDataset,getDataset,conversationPage,getConversation} from './archive-db.js';
import {selectedMessages,sourceFingerprint} from './archive-parser.js';
const $=id=>document.getElementById(id),el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
let worker=null,current=null,preparing=false,chosen=null,viewRecord=null,viewDataset=null,rows=[],after=-1,viewerPage=0,viewGeneration=0;
function status(text,error=false){$('importStatus').textContent=text;$('importStatus').classList.toggle('import-error',error);}
function progress(d){current=d;$('importProgress').value=d.source.size?d.offset/d.source.size:0;$('importCounts').textContent=`${d.count.toLocaleString()} conversations · ${d.userMessages.toLocaleString()} user messages · ${d.assistantMessages.toLocaleString()} assistant messages`;status(d.status==='importing'?'Importing locally. Keep this tab open.':d.status==='complete'?'Import complete. Text is preserved; personality curation has not been applied.':d.status==='paused'?'Paused safely. Select the same source file to resume.':d.error||d.status,d.status==='error');}
function controls(running){$('startImport').disabled=running;$('archiveFile').disabled=running;$('datasetName').disabled=running;$('newDatasetImport').disabled=running;$('pauseImport').hidden=!running;for(const b of document.querySelectorAll('.resume-import'))b.disabled=running;}
async function refreshDatasets(){
 const data=await listDatasets();$('datasetList').replaceChildren();let users=0,messages=0;
 for(const d of data){users+=d.userMessages;messages+=d.messages;const card=el('article','dataset-row');const title=el('h3','',d.name),details=el('p','',`${d.status} · ${d.count.toLocaleString()} conversations · ${d.userMessages.toLocaleString()} user messages`);card.append(title,details);if(d.warningCount)card.append(el('p','import-warning',`${d.warningCount} structural warnings recorded; inspect source records.`));const actions=el('div','dataset-actions');const browse=el('button','','Browse text →');browse.type='button';browse.onclick=()=>openDataset(d.id);actions.append(browse);if(d.status!=='complete'){const resume=el('button','resume-import','Resume');resume.type='button';resume.disabled=!!worker;resume.onclick=()=>{current=d;chosen=null;$('archiveFile').value='';$('datasetName').value=d.name;progress(d);$('startImport').textContent='Resume selected archive';status('Reselect the original conversations.json file, then tap Resume selected archive.');$('archiveFile').focus();};actions.append(resume);}card.append(actions);$('datasetList').append(card);}
 if(!data.length)$('datasetList').append(el('p','storage-note','No conversation datasets imported on this browser yet.'));
 $('archiveRegistrySummary').textContent=`${data.length} dataset identities · ${messages.toLocaleString()} messages · ${users.toLocaleString()} user messages. Source conversation and node identities remain in the preserved mappings. These are import records, not approved personality profiles.`;
}
async function startImport(e){
 e.preventDefault();if(worker||preparing)return;const file=$('archiveFile').files[0];if(!file){status('Choose the extracted conversations.json file first.',true);return;}if(!file.name.toLowerCase().endsWith('.json')){status('Choose a .json file. If your export is a ZIP, extract it with your phone’s Files app first.',true);return;}
 preparing=true;controls(true);status('Checking source file and available storage…');
 try{
  if(!current||current.status==='complete'){
   const source=await sourceFingerprint(file);const id=crypto.randomUUID();current={id,towerId:id,name:$('datasetName').value.trim()||file.name,source,created:new Date().toISOString(),updated:new Date().toISOString(),status:'ready',offset:0,count:0,messages:0,userMessages:0,assistantMessages:0,warningCount:0};await putDataset(current);
  }
  chosen=file;const activeWorker=new Worker(new URL('./archive-worker.js',import.meta.url),{type:'module'});worker=activeWorker;preparing=false;
  activeWorker.onmessage=async({data})=>{if(data.dataset)progress(data.dataset);if(data.type==='failed')status(data.dataset?.error||data.message,true);if(data.type==='done'||data.type==='failed'){activeWorker.terminate();worker=null;controls(false);$('startImport').textContent=data.dataset?.status==='complete'?'Import another archive':'Resume selected archive';if(data.dataset?.status==='complete'){$('archiveFile').value='';chosen=null;}await refreshDatasets().catch(e=>status(e.message,true));}};
  activeWorker.onerror=()=>{activeWorker.terminate();worker=null;controls(false);status('The import worker stopped. Saved conversations remain available. Tap Resume after reselecting your file.',true);refreshDatasets().catch(()=>{});};
  activeWorker.postMessage({type:'import',id:current.id,file});
 }catch(e){preparing=false;controls(false);status(e.message,true);}
}
async function openDataset(id){
 viewDataset=await getDataset(id);rows=[];after=-1;$('archiveBrowseTitle').textContent=viewDataset.name;$('archiveConversationList').replaceChildren();$('archiveBrowse').hidden=false;$('conversationView').hidden=true;await loadMore();$('archiveBrowse').scrollIntoView({block:'start'});
}
async function loadMore(){if(!viewDataset)return;$('moreConversations').disabled=true;try{const page=await conversationPage(viewDataset.id,{after,limit:25});rows.push(...page);if(page.length)after=page.at(-1).ordinal;for(const r of page){const b=el('button','conversation-row');b.type='button';b.append(el('strong','',r.title),el('span','',`#${r.ordinal+1} · ${r.messages} messages · ${r.roles.user||0} user · ${r.warnings.length} warnings`));b.onclick=()=>openConversation(r);$('archiveConversationList').append(b);}$('moreConversations').hidden=after+1>=viewDataset.count;}finally{$('moreConversations').disabled=false;}}
async function openConversation(meta){const generation=++viewGeneration;const record=await getConversation(meta.datasetId,meta.ordinal);if(generation!==viewGeneration)return;viewRecord=record;viewerPage=0;$('messageRole').value='user';$('messageBranch').value='selected';$('conversationTitle').textContent=record.title;$('conversationView').hidden=false;renderMessages();$('conversationView').scrollIntoView({block:'start'});}
function renderMessages(){if(!viewRecord)return;const value=JSON.parse(viewRecord.raw);const all=$('messageBranch').value==='all',role=$('messageRole').value;const {messages,warnings}=selectedMessages(value,{all,role});const offset=viewerPage*40;const page=messages.slice(offset,offset+40);$('messageList').replaceChildren();for(const m of page){const item=el('article','archive-message');item.append(el('strong','',m.role),el('small','',`Node ${m.id} · Parent ${m.parent||'none'}`),el('p','',m.text||'[No plain-text content]'));if(m.nonText)item.append(el('p','import-warning',`${m.nonText} non-text content item(s): source references are preserved in JSON; attachment files are not imported.`));$('messageList').append(item);}
 const range=messages.length?`${offset+1}–${Math.min(offset+40,messages.length)} of ${messages.length}`:'No matching messages';$('messagePageStatus').textContent=range;$('previousMessages').disabled=viewerPage===0;$('nextMessages').disabled=offset+40>=messages.length;
 $('branchWarning').textContent=[all?'All recorded nodes are shown in source mapping order. They are not one chronological conversation.':'Selected branch follows current_node and parent relationships.',...warnings,...viewRecord.warnings,`SHA-256 of the preserved conversation: ${viewRecord.hash}`].join('\n');
}
function download(name,type,text){const url=URL.createObjectURL(new Blob([text],{type})),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export async function mountArchiveImporter(){
 $('importForm').onsubmit=startImport;$('pauseImport').onclick=()=>{worker?.postMessage({type:'pause'});status('Pausing after the current saved conversation…');};
 $('newDatasetImport').onclick=()=>{if(worker||preparing)return;current=null;chosen=null;$('archiveFile').value='';$('datasetName').value='';$('startImport').textContent='Import conversation archive';status('Choose a source file for a new, separate dataset foundation.');};
 $('moreConversations').onclick=()=>loadMore().catch(e=>status(e.message,true));$('closeArchiveBrowse').onclick=()=>{$('archiveBrowse').hidden=true;viewGeneration++;viewRecord=null;};
 $('messageRole').onchange=$('messageBranch').onchange=()=>{viewerPage=0;renderMessages();};$('previousMessages').onclick=()=>{viewerPage--;renderMessages();};$('nextMessages').onclick=()=>{viewerPage++;renderMessages();};
 $('exportConversation').onclick=()=>{if(viewRecord)download(`conversation-${viewRecord.ordinal+1}.json`,'application/json',viewRecord.raw);};
 $('exportDatasetManifest').onclick=()=>{if(viewDataset)download('citadel-dataset-manifest.json','application/json',JSON.stringify({format:'citadel-archive-import/1',dataset:viewDataset,note:'Manifest only, not an archive backup. Keep your original export. Fingerprint samples first and last 64 KiB, not the full file.'},null,2));};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&worker)worker.postMessage({type:'pause'});});
 window.addEventListener('beforeunload',e=>{if(worker){e.preventDefault();e.returnValue='';}});
 await refreshDatasets();const estimate=await navigator.storage?.estimate?.();if(estimate?.quota)$('storageEstimate').textContent=`Browser storage: approximately ${Math.max(0,Math.floor((estimate.quota-(estimate.usage||0))/1024/1024))} MiB available. Availability can change; keep your original export.`;
 $('requestPersistence').onclick=async()=>{try{const retained=await navigator.storage?.persist?.();$('storageEstimate').textContent=retained?'Persistent browser storage granted. Clearing site data can still remove imports; retain your original export.':'Persistent storage was not granted. Your browser may evict local data; retain your original export.';}catch(e){status(e.message,true);}};
}
export function showArchiveFloor(id){$('archiveImportPanel').hidden=id!=='datasets';$('archiveRegistryPanel').hidden=id!=='registries';}

window.addEventListener('citadel-index-source',async({detail:remote})=>{
 if(worker||preparing){status('Pause the current index before opening another source.',true);return;}
 try{
  const id=remote.source.foundationId;let dataset=await getDataset(id);
  if(dataset&&(dataset.source.size!==remote.source.size||dataset.source.sampleHash!==remote.source.sampleHash))throw Error('This foundation already references a different source. Choose a separate foundation for the upload.');
  if(dataset?.status==='complete'){await openDataset(id);status('This source is already indexed in this browser.');return;}
  if(!dataset){dataset={id,towerId:id,name:remote.source.name,source:{...remote.source,lastModified:0,remoteUploadId:remote.id},created:new Date().toISOString(),updated:new Date().toISOString(),status:'ready',offset:0,count:0,messages:0,userMessages:0,assistantMessages:0,warningCount:0};await putDataset(dataset);}
  current=dataset;controls(true);const activeWorker=new Worker(new URL('./archive-worker.js',import.meta.url),{type:'module'});worker=activeWorker;
  activeWorker.onmessage=async({data})=>{if(data.dataset)progress(data.dataset);if(data.type==='failed')status(data.dataset?.error||data.message,true);if(data.type==='done'||data.type==='failed'){activeWorker.terminate();worker=null;controls(false);await refreshDatasets().catch(e=>status(e.message,true));}};
  activeWorker.onerror=()=>{activeWorker.terminate();worker=null;controls(false);status('Stored-source indexing stopped. Its committed records remain available. Use Index stored source to resume.',true);};
  activeWorker.postMessage({type:'import',id,remote});$('importStatus').scrollIntoView({block:'center'});
 }catch(e){controls(false);status(e.message,true);}
});
