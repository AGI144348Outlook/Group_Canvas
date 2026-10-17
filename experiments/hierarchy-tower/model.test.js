import test from 'node:test';
import assert from 'node:assert/strict';
import {FLOORS,floorFor,notesFor,validNotes,routeFloor} from '../../public/tower/model.js';
import worker from './worker.js';
test('tower preserves the requested bottom-to-top hierarchy',()=>{assert.deepEqual(FLOORS.map(f=>f.id),['datasets','registries','matrices','indices','codices','algorithms','logics']);assert.equal(new Set(FLOORS.map(f=>f.id)).size,7);});
test('deep links identify a floor and leave unknown routes outside',()=>{assert.equal(routeFloor('#matrices'),floorFor('matrices'));assert.equal(routeFloor('#/registries'),floorFor('registries'));assert.equal(routeFloor('#outside'),null);assert.equal(routeFloor('#unknown'),null);});
test('personal notes are isolated by floor and malformed storage is excluded',()=>{const good={id:'a',floor:'datasets',title:'Source',body:'Original'};const other={...good,id:'b',floor:'indices'};assert.deepEqual(validNotes([good,other,null,{...good,floor:'unknown'},{...good,title:123}]),[good,other]);assert.deepEqual(notesFor([good,other],'datasets'),[good]);assert.deepEqual(validNotes({}),[]);});
test('static preview applies response boundaries without changing assets',async()=>{const response=await worker.fetch(new Request('https://example.com/'),{ASSETS:{fetch:async()=>new Response('Tower',{status:200,headers:{'content-type':'text/html'}})}});assert.equal(await response.text(),'Tower');assert.equal(response.headers.get('content-type'),'text/html');assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);});
