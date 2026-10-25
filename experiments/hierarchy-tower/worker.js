import {filingAPI} from './filing-service.js';
import {r2ReadAPI} from './r2-read-service.js';
export {FileCabinet} from './filing-service.js';
import {storageAPI} from './upload-service.js';
export {TowerUpload} from './upload-service.js';
export default {
 async fetch(request,env){
  if(new URL(request.url).pathname==="/api/files/r2-read")return r2ReadAPI(request,env);
  if(new URL(request.url).pathname.startsWith("/api/files/"))return filingAPI(request,env);
  if(new URL(request.url).pathname.startsWith("/api/storage/"))return storageAPI(request,env);
  const response=await env.ASSETS.fetch(request);
  const headers=new Headers(response.headers);
  headers.set('x-content-type-options','nosniff');
  headers.set('referrer-policy','no-referrer');
  headers.set('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  return new Response(response.body,{status:response.status,headers});
 }
};
