import {listCloudUploads,putCloudUpload,listDatasets} from './archive-db.js';
import {sourceFingerprint} from './archive-parser.js';
const $=id=>document.getElementById(id),el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
let running=false,paused=false,selected=null;
function status(text,error=false){$('cloudStatus').textContent=text;$('cloudStatus').classList.toggle('import-error',error);}
async function api(path,{token,key,body,method='GET',hash}={}){const headers={};if(token)headers.authorization='Bearer '+token;if(key)headers['x-source-create-key']=key;if(hash)headers['x-part-sha256']=hash;if(body&&!(body instanceof Blob))headers['content-type']='application/json';const response=await fetch('/api/storage'+path,{method,headers,body:body instanceof Blob?body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(180000)});const data=await response.json();if(!response.ok)throw Error(data.error||'Storage request failed');return data;}
function controls(busy){running=busy;for(const id of ['cloudStart','cloudFile','cloudCode','cloudFoundation','cloudNew'])$(id).disabled=busy;$('cloudPause').hidden=!busy;}
async function refresh(){const sources=await listCloudUploads();$('cloudSourceList').replaceChildren();for(const source of sources){const item=el('article');item.className='dataset-row';item.append(el('h3',source.source.name),el('p',`${source.status} · ${(source.source.size/1024/1024).toFixed(1)} MiB · Foundation ${source.source.foundationId.slice(0,8)}`));const actions=el('div');actions.className='dataset-actions';const resume=el('button',source.status==='complete'?'Verify stored source':'Resume / check upload');resume.type='button';resume.disabled=running;resume.onclick=async()=>{selected=source;if(source.status==='complete'){try{const remote=await api('/uploads/'+source.id,{token:source.token});status(`Stored source is ${remote.status}. Private access verified.`);}catch(e){status(e.message,true);}return;}$('cloudFile').value='';status('Select the same source file, then tap Upload / resume. Completed chunks will be verified before they are skipped.');$('cloudFile').focus();};actions.append(resume);if(source.status==='complete'){const index=el('button','Index stored source →');index.type='button';index.onclick=()=>window.dispatchEvent(new CustomEvent('citadel-index-source',{detail:source}));actions.append(index);}item.append(actions);$('cloudSourceList').append(item);}}
async function upload(e){e.preventDefault();if(running)return;const file=$('cloudFile').files[0];if(!file)return;controls(true);paused=false;
 try{
  status('Checking the selected source…');const fingerprint=await sourceFingerprint(file);
  if(selected&&(selected.source.size!==file.size||selected.source.sampleHash!==fingerprint.sampleHash))throw Error('Choose the original source for this upload, or tap Start another source.');
  if(!selected){const foundationId=$('cloudFoundation').value||crypto.randomUUID();const created=await api('/uploads',{method:'POST',key:$('cloudCode').value,body:{...fingerprint,foundationId}});selected={...created,localCreated:new Date().toISOString()};await putCloudUpload(selected);$('cloudCode').value='';}
  let remote=await api('/uploads/'+selected.id,{token:selected.token});if(remote.status==='complete'){selected={...selected,...remote};await putCloudUpload(selected);status('This source is already stored.');return;}
  const total=Math.ceil(file.size/remote.partBytes);let confirmed=0;
  for(let number=1;number<=total;number++){
   if(paused)break;const offset=(number-1)*remote.partBytes,blob=file.slice(offset,Math.min(file.size,offset+remote.partBytes));status(`Checking chunk ${number} of ${total}…`);const bytes=await blob.arrayBuffer(),hash=await binaryHash(bytes);const existing=remote.parts.find(p=>p.partNumber===number);
   if(existing&&existing.sha256!==hash)throw Error('A saved chunk differs from this file. Nothing was overwritten; select the original source.');
   if(!existing){status(`Uploading chunk ${number} of ${total}…`);await api(`/uploads/${selected.id}/parts/${number}`,{method:'PUT',token:selected.token,body:blob,hash});}
   confirmed+=blob.size;$('cloudProgress').value=confirmed/file.size;
  }
  if(paused){selected={...selected,status:'paused'};await putCloudUpload(selected);status('Upload paused. Completed chunks remain private in storage.');}
  else{remote=await api('/uploads/'+selected.id+'/complete',{method:'POST',token:selected.token});selected={...selected,...remote};await putCloudUpload(selected);status('Source stored privately. Tap Index stored source to read it into this citadel foundation.');}
 }catch(e){status(e.message+' Saved chunks can be resumed.',true);}
 finally{controls(false);await refresh().catch(e=>status(e.message,true));}
}
async function binaryHash(bytes){const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function mountCloudSources(){
 $('cloudForm').onsubmit=upload;$('cloudPause').onclick=()=>{paused=true;status('Pausing after the current chunk is confirmed…');};$('cloudNew').onclick=()=>{selected=null;$('cloudFile').value='';status('Choose a file for a new private source.');};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)paused=true;});window.addEventListener('beforeunload',e=>{if(running){e.preventDefault();e.returnValue='';}});
 try{const config=await api('/config');$('cloudStart').disabled=!config.enabled;$('cloudAvailability').textContent=config.enabled?'Private Cloudflare source storage is available.':'Private cloud storage needs operator setup. Local import above remains available.';}catch(e){$('cloudStart').disabled=true;status(e.message,true);}
 const foundations=async()=>{if(running)return;const prior=$('cloudFoundation').value;const datasets=await listDatasets();$('cloudFoundation').replaceChildren(new Option('Create a separate foundation',''));for(const d of datasets)$('cloudFoundation').append(new Option(d.name,d.id));if(datasets.some(d=>d.id===prior))$('cloudFoundation').value=prior;};$('cloudFile').onchange=()=>foundations().catch(e=>status(e.message,true));await foundations();await refresh();
}
