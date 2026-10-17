import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,env,rid,owner,c,member,widget} from './helpers.js';
import {roomApi,tokenFor} from '../src/api.js';

async function call(e,suffix,method='GET',data,token,headers={}){
  const r=await roomApi(new Request('https://canvas.test/api/rooms/'+rid+suffix,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...headers},...(data!==undefined?{body:JSON.stringify(data)}:{})}),e,env,rid,suffix);
  const text=await r.text();
  let body=null;try{body=text?JSON.parse(text):null;}catch{body=text;}
  return {status:r.status,body};
}
const rpc=(id,method,params)=>({jsonrpc:'2.0',id,method,...(params?{params}:{})});
async function link(e,name='Claude'){
  const t=await tokenFor(env,rid,e.read().members.owner);
  const r=await call(e,'/connector','POST',{name},t);
  assert.equal(r.status,200,JSON.stringify(r.body));
  const suffix=new URL(r.body.url).pathname.replace('/api/rooms/'+rid,'');
  return {...r.body,suffix,token:t};
}

test('owner creates a connector link; a client with only the link completes the MCP handshake and builds',async()=>{
  const {engine:e}=setup(),l=await link(e);
  assert.match(l.suffix,/^\/mcp\/[0-9a-f]{64}$/);
  assert.equal(e.read().seats[l.seat].controller,'external');

  const init=await call(e,l.suffix,'POST',rpc(1,'initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'claude-ai',version:'1'}}));
  assert.equal(init.status,200);
  assert.equal(init.body.result.protocolVersion,'2025-06-18');
  assert.ok(init.body.result.instructions.includes('room_inspect'));
  assert.equal((await call(e,l.suffix,'POST',{jsonrpc:'2.0',method:'notifications/initialized'})).status,202);
  assert.deepEqual((await call(e,l.suffix,'POST',rpc(2,'ping'))).body.result,{});

  const tools=(await call(e,l.suffix,'POST',rpc(3,'tools/list'))).body.result.tools.map(t=>t.name);
  for(const name of ['room_inspect','say','widget_create','widget_update','widget_delete'])assert.ok(tools.includes(name),name);

  const made=await call(e,l.suffix,'POST',rpc(4,'tools/call',{name:'widget_create',arguments:widget('quiz1','quiz',{question:'2+2?',options:['3','4'],answerIndex:1})}));
  assert.equal(made.body.result.isError,false,made.body.result.content[0].text);
  assert.equal(e.read().widgets.quiz1.createdBy,l.seat);

  const said=await call(e,l.suffix,'POST',rpc(5,'tools/call',{name:'say',arguments:{text:'Hello from outside'}}));
  assert.equal(said.body.result.isError,false);
  assert.equal(e.read().threads.main.messages.at(-1).by,l.seat);

  const seen=JSON.parse((await call(e,l.suffix,'POST',rpc(6,'tools/call',{name:'room_inspect',arguments:{}}))).body.result.content[0].text);
  assert.ok(seen.widgets.quiz1);
  assert.equal(seen.members,undefined,'agent must not see the member list');
});

test('connector key is never stored or shown; bad, unknown and revoked links are refused',async()=>{
  const {engine:e}=setup(),l=await link(e),key=l.suffix.split('/').pop();
  assert.ok(!JSON.stringify(e.read()).includes(key),'raw key must not be persisted');
  const snap=await call(e,'/snapshot','GET',undefined,l.token);
  assert.ok(!JSON.stringify(snap.body).includes(key));

  assert.equal((await call(e,'/mcp/'+'0'.repeat(64),'POST',rpc(1,'tools/list'))).status,401);
  assert.equal((await call(e,'/mcp/not-a-key','POST',rpc(1,'tools/list'))).status,401);
  assert.equal((await call(e,l.suffix,'GET')).status,405);

  const removed=await e.submit(owner,c('seat.ai.remove',{id:l.seat}));
  assert.equal(removed.status,'accepted');
  assert.deepEqual(e.read().connectors,{});
  assert.equal((await call(e,l.suffix,'POST',rpc(2,'tools/list'))).status,401);
});

test('connector seats are editors at most and cannot do owner work',async()=>{
  const {engine:e}=setup(),l=await link(e);
  for(const [name,args] of [['widget_create',{...widget('x'),id:'x'}]]){
    const r=await call(e,l.suffix,'POST',rpc(1,'tools/call',{name,arguments:args}));
    assert.equal(r.body.result.isError,false);
  }
  const p={id:l.seat,room:rid,role:'editor',kind:'agent',epoch:0,session:'connector'};
  for(const op of ['seat.ai.add','member.invite','widget.clear_all','connector.create','python.claim']){
    const r=await e.submit(p,c(op,{},e.read().version));
    assert.equal(r.status,'rejected',op);
  }
  const unknown=await call(e,l.suffix,'POST',rpc(2,'tools/call',{name:'member_invite',arguments:{}}));
  assert.equal(unknown.body.result.isError,true);
});

test('only the owner can create connector links, and the count is capped',async()=>{
  const {engine:e}=setup(),bob=member(e,'bob','editor');
  const t=await tokenFor(env,rid,e.read().members.bob,bob.session);
  assert.equal((await call(e,'/connector','POST',{name:'X'},t)).status,403);
  for(let i=0;i<5;i++)await link(e,'AI '+i);
  const owner6=await tokenFor(env,rid,e.read().members.owner);
  assert.equal((await call(e,'/connector','POST',{name:'six'},owner6)).status,429);
});

test('external seats cannot be driven through the server AI turn path',async()=>{
  const {engine:e}=setup(),l=await link(e);
  const r=await call(e,'/turn','POST',{id:'t1',seat:l.seat,prompt:'make a game'},l.token);
  assert.equal(r.status,400);
  assert.equal(e.read().budget.turns,0);
});
