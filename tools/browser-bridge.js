// JSON-lines request transport for exercising real HTTP handlers without opening a port.
import readline from 'node:readline';
import {setup,env} from '../test/helpers.js';
import {roomApi,config,json} from '../src/api.js';
import {id} from '../src/commands/util.js';
const rooms=new Map();
const rl=readline.createInterface({input:process.stdin});
for await(const line of rl){try{const b=JSON.parse(line),url=new URL(b.url),req=new Request(url,{method:b.method||'GET',headers:b.headers||{},...(!['GET','HEAD'].includes(b.method||'GET')?{body:b.body||'{}'}:{})});let response;if(url.pathname==='/api/config')response=json(config(env,'sse'));else if(url.pathname==='/api/rooms'&&req.method==='POST'){const rid=id(),r=setup();r.db.prepare('DELETE FROM room_state').run();rooms.set(rid,r);response=await roomApi(req,r.engine,env,rid,'/initialize');}
 else{const [,rid,suffix]=url.pathname.match(/^\/api\/rooms\/([^/]+)(\/.*)$/)||[];const r=rooms.get(rid);if(!r)response=json({error:'Not found'},404);else if(suffix==='/stream')response=new Response('data: {"cursor":0,"messages":[]}\n\n',{headers:{'content-type':'text/event-stream'}});else response=await roomApi(req,r.engine,env,rid,suffix);}
 console.log(JSON.stringify({id:b.id,status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()}));}catch(e){console.log(JSON.stringify({error:String(e)}));}}
