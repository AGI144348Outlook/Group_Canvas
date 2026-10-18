import * as db from './archive-db.js';
import {importArchive} from './archive-import.js';
let paused=false,running=false;
self.onmessage=async({data})=>{
 if(data.type==='pause'){paused=true;return;}if(data.type!=='import'||running)return;running=true;paused=false;
 try{
  if(!navigator.locks)throw Error('This browser cannot safely coordinate archive imports. Update Chrome or use a current Android browser.');
  await navigator.locks.request('citadel-import:'+data.id,{ifAvailable:true},async lock=>{
   if(!lock)throw Error('This dataset is already importing in another tab. Pause or close that import first.');
   const file=data.remote?remoteFile(data.remote):data.file;
   await importArchive({file,id:data.id,db,emit:message=>self.postMessage(message),shouldPause:()=>paused});
  });
 }catch(e){self.postMessage({type:'failed',message:e.message});}finally{running=false;}
};

function remoteFile(remote){
 return {name:remote.source.name,size:remote.source.size,lastModified:0,chunkBytes:1024*1024,
  slice(start=0,end=remote.source.size){start=Math.max(0,Math.min(start,remote.source.size));end=Math.max(start,Math.min(end,remote.source.size));return {async arrayBuffer(){const response=await fetch(`/api/storage/uploads/${remote.id}/source?offset=${start}&length=${end-start}`,{headers:{authorization:'Bearer '+remote.token},signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('Stored source could not be read: HTTP '+response.status);const bytes=await response.arrayBuffer();if(bytes.byteLength!==end-start)throw Error('Stored source returned an incomplete range');return bytes;}};}
 };
}
