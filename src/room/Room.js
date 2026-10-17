import {DurableObject} from 'cloudflare:workers';
import {Storage} from '../storage.js';
import {Engine} from '../commands/index.js';
import {roomApi,json} from '../api.js';
import {verify,current} from '../auth/index.js';
import {snapshot,replay} from '../events/index.js';
export class Room extends DurableObject{
 constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.env=env;const storage=new Storage((q,...p)=>Array.from(ctx.storage.sql.exec(q,...p)),fn=>ctx.storage.transactionSync(fn));this.engine=new Engine(storage,()=>this.broadcast());}
 async fetch(req){const url=new URL(req.url),m=url.pathname.match(/^\/api\/rooms\/([^/]+)(\/.*)?$/);if(!m)return json({error:'Not found'},404);const [,rid,suffix='']=m;
 if(suffix==='/ws'&&req.headers.get('upgrade')?.toLowerCase()==='websocket'){if(req.headers.get('origin')!==url.origin)return json({error:'Origin rejected'},403);const pair=new WebSocketPair(),[client,server]=Object.values(pair);this.ctx.acceptWebSocket(server);server.serializeAttachment({unauthenticated:true,deadline:Date.now()+5000,room:rid});await this.ctx.storage.setAlarm(Date.now()+5000);return new Response(null,{status:101,webSocket:client});}
 return roomApi(req,this.engine,this.env,rid,suffix);
 }
 async webSocketMessage(ws,raw){try{if(typeof raw!=='string'||raw.length>120000)throw Error('Invalid message');const msg=JSON.parse(raw),a=ws.deserializeAttachment();if(a.unauthenticated){if(Date.now()>a.deadline||msg.type!=='auth')throw Error('Authentication required');const p=await verify(this.env.ROOM_SIGNING_KEY,msg.token,a.room);current(this.engine.read(),p);ws.serializeAttachment({principal:p,after:this.engine.read().cursor});ws.send(JSON.stringify({type:'snapshot',cursor:this.engine.read().cursor,state:snapshot(this.engine.read(),p)}));return;}const p=a.principal;current(this.engine.read(),p);if(msg.type==='command')ws.send(JSON.stringify(await this.engine.submit(p,msg.command)));else if(msg.type==='resume'){for(const e of replay(this.engine.read(),p,msg.after))ws.send(JSON.stringify(e));const x=ws.deserializeAttachment();x.after=this.engine.read().cursor;ws.serializeAttachment(x);}else throw Error('Unsupported message');}catch{ws.close(1008,'Authentication or message rejected');}}
 broadcast(){for(const ws of this.ctx.getWebSockets()){const a=ws.deserializeAttachment();if(!a?.principal)continue;try{current(this.engine.read(),a.principal);for(const e of replay(this.engine.read(),a.principal,a.after||0))ws.send(JSON.stringify(e));a.after=this.engine.read().cursor;ws.serializeAttachment(a);}catch{ws.close(1008,'Membership no longer valid');}}}
 async alarm(){let next=Infinity;for(const ws of this.ctx.getWebSockets()){const a=ws.deserializeAttachment();if(a.unauthenticated){if(a.deadline<=Date.now())ws.close(1008,'Authentication required');else next=Math.min(next,a.deadline);}}if(Number.isFinite(next))await this.ctx.storage.setAlarm(next);}
 webSocketError(ws){try{ws.close(1011,'Connection error');}catch{}}
}
