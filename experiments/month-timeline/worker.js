const ORIGIN='https://group-canvas-tower.agi144348.workers.dev';
function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});}
async function bounded(response,limit){const reader=response.body.getReader();const chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw Error('budget');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}const all=new Uint8Array(size);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length;}return all;}
export async function manifestReply(request,fetcher=fetch){
 const key=request.headers.get('x-filing-key');if(!key||key.length>256)return reply({error:'Enter your storage operator code.'},401);
 async function api(path,method='GET'){const r=await fetcher(ORIGIN+'/api/files'+path,{method,headers:{'x-filing-key':key},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Object.assign(Error('Private access failed'),{status:r.status});return JSON.parse(new TextDecoder().decode(await bounded(r,512*1024)));}
 try{
  const files=[];let after;for(let n=0;n<100;n++){const data=await api('/files'+(after?'?after='+encodeURIComponent(after):''));files.push(...data.files);after=data.next;if(!after)break;}if(after)throw Error('inventory budget');
  const matches=files.filter(f=>f.status==='complete'&&f.source?.name==='echo-gpt-block-months.json').sort((a,b)=>String(a.created).localeCompare(String(b.created)));
  if(!matches.length)return reply({error:'The private month index has not been prepared yet.'},404);
  const ticket=await api('/files/'+encodeURIComponent(matches.at(-1).id)+'/ticket','POST');
  if(typeof ticket.path!=='string'||!/^\/api\/files\/download\/[a-f0-9-]{72}$/.test(ticket.path))throw Error('ticket');
  const r=await fetcher(ORIGIN+ticket.path,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Object.assign(Error('private download'),{status:r.status});
  const data=JSON.parse(new TextDecoder().decode(await bounded(r,2*1024**2)));
  if(data.format!=='echo-gpt-block-months/1')throw Error('format');return reply(data);
 }catch(e){return reply({error:e.status===401?'Storage code was not accepted.':'Private month index could not be opened. Originals were not changed.'},e.status===401?401:503);}
}
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/'))return url.pathname==='/api/manifest'&&request.method==='GET'?manifestReply(request):reply({error:'Unsupported operation'},405);
 const response=await env.ASSETS.fetch(request);const headers=new Headers(response.headers);
 headers.set('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");headers.set('x-content-type-options','nosniff');headers.set('referrer-policy','no-referrer');
 return new Response(response.body,{status:response.status,headers});
}};
