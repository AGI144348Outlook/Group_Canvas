import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,join} from 'node:path';
import {Readable} from 'node:stream';
import {Storage} from './storage.js';
import {Engine} from './commands/index.js';
import {id,Fault,check} from './commands/util.js';
import {roomApi,json,config,authenticate} from './api.js';
import {replay} from './events/index.js';
import {current} from './auth/index.js';
const root=resolve(process.env.GC_DATA_DIR||'.data');await mkdir(root,{recursive:true});
let secret=process.env.ROOM_SIGNING_KEY;if(!secret){try{secret=await readFile(join(root,'signing.key'),'utf8');}catch{secret=id()+id();await writeFile(join(root,'signing.key'),secret,{mode:0o600});}}
const env={...process.env,ROOM_SIGNING_KEY:secret};const rooms=new Map();
function room(rid){check(/^[a-f0-9-]{36}$/.test(rid),'not_found','Invalid room ID');if(rooms.has(rid))return rooms.get(rid);const db=new DatabaseSync(join(root,rid+'.sqlite'));db.exec('PRAGMA journal_mode=WAL');const sql=(q,...a)=>db.prepare(q).all(...a);const tx=fn=>{db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}};const subscribers=new Set();const engine=new Engine(new Storage(sql,tx),()=>{for(const fn of subscribers)try{fn();}catch{}});const r={engine,subscribers};rooms.set(rid,r);return r;}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
export const server=http.createServer(async(incoming,out)=>{let cleanup=()=>{};try{const url=new URL(incoming.url,'http://'+incoming.headers.host);let response;let chunks=[],size=0;for await(const chunk of incoming){size+=chunk.length;if(size>120000){out.writeHead(413);out.end('Request too large');return;}chunks.push(chunk);}const req=new Request(url,{method:incoming.method,headers:incoming.headers,...(!['GET','HEAD'].includes(incoming.method)?{body:Buffer.concat(chunks)}:{})});
 if(url.pathname==='/api/config')response=json(config(env,'sse'));
 else if(url.pathname==='/api/rooms'&&req.method==='POST'){const rid=id(),r=room(rid);response=await roomApi(req,r.engine,env,rid,'/initialize');}
 else if(url.pathname.startsWith('/api/rooms/')){const m=url.pathname.match(/^\/api\/rooms\/([^/]+)(\/.*)?$/);check(m,'not_found','Not found');const [,rid,suffix='']=m,r=room(rid);
 if(suffix==='/stream'&&req.method==='GET'){const p=await authenticate(req,r.engine,env,rid);out.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive','x-accel-buffering':'no'});let cursor=Number(url.searchParams.get('after')||0);const send=()=>{try{current(r.engine.read(),p);const messages=replay(r.engine.read(),p,cursor);cursor=r.engine.read().cursor;out.write('data: '+JSON.stringify({cursor,messages})+'\n\n');}catch{out.end();cleanup();}};const timer=setInterval(send,10000);cleanup=()=>{clearInterval(timer);r.subscribers.delete(send);};out.on('close',cleanup);r.subscribers.add(send);send();return;}
 response=await roomApi(req,r.engine,env,rid,suffix);
 }else{check(req.method==='GET','not_found','Not found');let path=url.pathname==='/'?'/index.html':url.pathname;check(/^\/[\w./-]+$/.test(path)&&!path.includes('..'),'not_found','Not found');try{const data=await readFile(resolve('public','.'+path));response=new Response(data,{headers:{'content-type':mime[extname(path)]||'application/octet-stream','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});}catch{response=json({error:'Not found'},404);}}
 out.writeHead(response.status,Object.fromEntries(response.headers));if(response.body)Readable.fromWeb(response.body).pipe(out);else out.end();
 }catch(e){if(!out.headersSent)out.writeHead(e instanceof Fault?400:500,{'content-type':'application/json'});out.end(JSON.stringify({error:e instanceof Fault?e.message:'Internal server error'}));cleanup();}});
server.on('error',error=>{console.error(error.code==='EPERM'?'This environment forbids listening sockets. Run npm start on your computer, or use the Cloudflare adapter.':`Cannot start Group Canvas: ${error.message}`);process.exit(1);});
const port=Number(process.env.PORT||8787);server.listen(port,'127.0.0.1',()=>console.log(`Group Canvas prototype: http://127.0.0.1:${server.address().port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close();process.exit(0);});
