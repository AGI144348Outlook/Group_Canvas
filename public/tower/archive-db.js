const DATABASE='group-canvas-citadel-archives-v1';
let opening;
export function openArchiveDB(){return opening||=(new Promise((resolve,reject)=>{const r=indexedDB.open(DATABASE,2);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('cloudUploads'))db.createObjectStore('cloudUploads',{keyPath:'id'});if(!db.objectStoreNames.contains('datasets')){db.createObjectStore('datasets',{keyPath:'id'});const c=db.createObjectStore('conversations',{keyPath:['datasetId','ordinal']});c.createIndex('datasetId','datasetId');db.createObjectStore('summaries',{keyPath:['datasetId','ordinal']});}};r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();opening=null;};resolve(r.result);};r.onerror=()=>{opening=null;reject(r.error);};r.onblocked=()=>reject(Error('Close other tower tabs so archive storage can open.'));}));}
function result(r){return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function complete(tx){return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Storage transaction aborted'));tx.onerror=()=>{};});}
export async function listDatasets(){const db=await openArchiveDB();return (await result(db.transaction('datasets').objectStore('datasets').getAll())).sort((a,b)=>b.created.localeCompare(a.created));}
export async function getDataset(id){const db=await openArchiveDB();return result(db.transaction('datasets').objectStore('datasets').get(id));}
export async function putDataset(dataset){const db=await openArchiveDB(),tx=db.transaction('datasets','readwrite');const done=complete(tx);tx.objectStore('datasets').put(dataset);await done;}
export async function commitConversation(record,dataset){const db=await openArchiveDB(),tx=db.transaction(['datasets','conversations','summaries'],'readwrite');const done=complete(tx);tx.objectStore('conversations').put(record);const {raw,...summary}=record;tx.objectStore('summaries').put(summary);tx.objectStore('datasets').put(dataset);await done;}
export async function conversationPage(datasetId,{after=-1,limit=30}={}){
 const db=await openArchiveDB(),store=db.transaction('summaries').objectStore('summaries');const range=IDBKeyRange.bound([datasetId,after+1],[datasetId,Number.MAX_SAFE_INTEGER]);return new Promise((resolve,reject)=>{const rows=[],r=store.openCursor(range);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const c=r.result;if(!c||rows.length>=limit){resolve(rows);return;}const {raw,...meta}=c.value;rows.push(meta);c.continue();};});
}
export async function getConversation(datasetId,ordinal){const db=await openArchiveDB();return result(db.transaction('conversations').objectStore('conversations').get([datasetId,ordinal]));}

export async function listCloudUploads(){const db=await openArchiveDB();return result(db.transaction('cloudUploads').objectStore('cloudUploads').getAll());}
export async function putCloudUpload(value){const db=await openArchiveDB(),tx=db.transaction('cloudUploads','readwrite');const done=complete(tx);tx.objectStore('cloudUploads').put(value);await done;}
