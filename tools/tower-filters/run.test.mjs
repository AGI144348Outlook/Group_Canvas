import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const bytes=Buffer.from(JSON.stringify([{id:'conversation',current_node:'b',mapping:{a:{message:{author:{role:'user'},content:{parts:['Julian is here']}}},b:{parent:'a',message:{author:{role:'assistant'},content:{parts:['Concord']}}},c:{parent:'a',message:{author:{role:'user'},content:{parts:['other branch']}}}}}]));
const files=[{id:'source-a',source:{name:'conversations-000.json',size:bytes.length},status:'complete'},{id:'source-b',source:{name:'conversations-001.json',size:bytes.length},status:'complete'},{id:'source-c',source:{name:'conversations-002.json',size:bytes.length},status:'uploading'}],collections=[],data=new Map([['source-a',bytes],['source-b',bytes]]),parts=new Map();
process.env.CREATE_ROOM_KEY='synthetic-test-credential-not-a-secret';
const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
globalThis.fetch=async(url,options={})=>{const path=new URL(url).pathname.replace('/api/files',''),method=options.method||'GET',body=typeof options.body==='string'?JSON.parse(options.body):options.body;
 if(path==='/collections'){if(method==='POST'){collections.push(body);return json(body);}return json({collections});}
 if(path==='/files'){if(method==='POST'){const old=files.find(f=>f.id===body.id);if(old)return json(old);files.push({...body,status:'uploading'});return json(body);}return json({files:[...files],next:null});}
 const m=path.match(/^\/files\/([^/]+)\/(status|ticket|complete|parts\/\d+)$/);if(m){const [,id,op]=m;
 if(op==='status')return json({status:files.find(f=>f.id===id).status,partBytes:8*1024**2,parts:[]});
 if(op==='ticket')return json({path:'/download/'+id});
 if(op.startsWith('parts/')){if(createHash('sha256').update(body).digest('hex')!==options.headers['x-part-sha256'])throw Error('Bad part hash');parts.set(id,body);return json({});}
 if(op==='complete'){data.set(id,parts.get(id));files.find(f=>f.id===id).status='complete';return json({});}}
 if(path.startsWith('/download/'))return new Response(data.get(path.split('/').at(-1)));
 throw Error('Unexpected synthetic endpoint');};
await import('./run.mjs');
assert.equal(collections.length,2);
for(const collection of collections){const manifest=files.find(f=>f.collection===collection.id&&f.source.name.startsWith('tower-manifest-'));assert.ok(manifest);const parsed=JSON.parse(data.get(manifest.id));assert.equal(parsed.sources.length,2);assert.equal(parsed.pendingSources.length,1);assert.equal(parsed.records,2);assert.equal(parsed.conversationOccurrences,1);assert.equal(parsed.files.length,1);assert.equal(parsed.sources[1].duplicateOf,'source-a');assert.equal(parsed.sourceUnchanged,true);}
assert.equal(data.get('source-a'),bytes);console.log('Synthetic end-to-end: two verified derived manifests; exact duplicate recognized; pending source excluded; originals unchanged.');
