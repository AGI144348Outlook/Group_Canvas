import {DatabaseSync} from 'node:sqlite';
import {Storage} from '../src/storage.js';
import {Engine,newRoom} from '../src/commands/index.js';
export const rid='11111111-1111-4111-8111-111111111111';
export const owner={id:'owner',room:rid,role:'owner',kind:'user',epoch:0,session:'tab-owner'};
export const env={ROOM_SIGNING_KEY:'a-test-only-secret-at-least-32-chars',DAILY_TURNS:'30',DAILY_TOKENS:'100000'};
export function setup(notify){const db=new DatabaseSync(':memory:');const store=new Storage((q,...a)=>db.prepare(q).all(...a),fn=>{db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}});store.change(()=>({state:newRoom(rid,'owner','Timothy')}));const engine=new Engine(store,notify);return {engine,db,store};}
export function member(engine,id='bob',role='editor',kind='guest'){engine.change(s=>{s.members[id]={id,role,kind,epoch:0,name:id};s.seats[id]={id,kind:'human',principal:id,name:id};return {state:s};});return {id,room:rid,role,kind,epoch:0,session:'tab-'+id};}
export const c=(op,payload,version=0,id=crypto.randomUUID())=>({contract:'gc/1',id,op,payload,expectedVersion:version});
export const widget=(id='w',kind='note',spec={text:'Hello'})=>({id,kind,title:'Test',layout:{x:80,y:80,width:300,height:250,collapsed:false},spec});
