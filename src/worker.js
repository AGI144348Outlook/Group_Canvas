import {Room} from './room/Room.js';
import {config,json} from './api.js';
export {Room};
export default {async fetch(req,env){const url=new URL(req.url);if(url.pathname==='/api/config')return json(config(env,'websocket'));
 if(url.pathname==='/api/rooms'&&req.method==='POST'){const rid=crypto.randomUUID(),stub=env.ROOMS.get(env.ROOMS.idFromName(rid));url.pathname=`/api/rooms/${rid}/initialize`;return stub.fetch(new Request(url,req));}
 const m=url.pathname.match(/^\/api\/rooms\/([a-f0-9-]{36})(\/.*)?$/);if(m)return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);if(url.pathname.startsWith('/api/'))return json({error:'Not found'},404);return env.ASSETS.fetch(req);
}};
