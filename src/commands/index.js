import {createMannequinRoom} from '../../public/scene/prefabs.js';
import {createScene} from '../../public/scene/model.js';
import {sceneAction,guardSceneEdit} from '../scenes/actions.js';
import {Fault,check,fields,text,id,digest,canonical,jsonSize,finite} from './util.js';
import {current} from '../auth/index.js';
import {layout,spec} from '../widgets/schema.js';
import {emit,snapshot} from '../events/index.js';
import {jobOp} from '../jobs/index.js';
export const roles={viewer:0,member:1,editor:2,owner:3};
const required={'scene.create':2,'scene.act':2,'chat.say':1,'thread.open':1,'seat.move':1,'seat.ai.add':3,'seat.ai.remove':3,'seat.ai.configure':3,'connector.create':3,'member.invite':3,'member.set_role':3,'member.revoke':3,'widget.create':2,'widget.update':2,'widget.delete':2,'widget.clear_all':3,'python.queue':2,'python.claim':2,'python.complete':0,'python.cancel':2};
export function newRoom(room,owner,name='My canvas',title='A place to make things together'){
 return {id:room,title,version:0,cursor:0,members:{[owner]:{id:owner,role:'owner',kind:'user',epoch:0,name}},seats:{[owner]:{id:owner,principal:owner,name,kind:'human',glyph:'א',x:80,y:80}},widgets:{},threads:{main:{id:'main',members:'all',messages:[]}},jobs:{},tombstones:{},receipts:{},events:[],invites:{},turns:{},turnReceipts:{},budget:{day:new Date().toISOString().slice(0,10),turns:0,reservedTokens:0,usedTokens:0}};
}
export async function fingerprint(p,c){return digest(canonical({contract:c.contract,actor:p.id,room:p.room,op:c.op,payload:c.payload}));}
export function authorize(s,p,c){current(s,p);check(c.op in required,'invalid','Unknown operation');check(roles[p.role]>=required[c.op],'forbidden','Insufficient role');if(p.kind==='agent')check(required[c.op]<3&&c.op!=='python.claim','forbidden','Agent operation restricted');}
export function applyCommand(original,p,c,fp,now=Date.now()){
 try{fields(c,['contract','id','op','payload','expectedVersion'],['contract','id','op','payload']);check(c.contract==='gc/1','invalid','Unsupported contract');text(c.id,160);check(c.id.length>0,'invalid','Command ID required');jsonSize(c);authorize(original,p,c);
 const rk=canonical([p.id,c.id]),prior=original.receipts[rk];if(prior){check(prior.fingerprint===fp,'collision','Command ID reused for different intent');return {state:original,result:structuredClone(prior.result),duplicate:true};}
 check(Object.keys(original.receipts).length<20000,'limit','Prototype room command limit reached');
 const s=structuredClone(original),a=c.payload;let outcome={},audience='room';
 if(c.op.startsWith('widget.')||c.op==='scene.create'){check(Number.isInteger(c.expectedVersion)&&c.expectedVersion===s.version,'conflict','Workspace changed; refresh and retry');}
 switch(c.op){
 case 'scene.create':{fields(a,['id','title','layout','template'],['id','title']);check(a.template===undefined||['open','room'].includes(a.template),'invalid','Unknown scene template');text(a.id,160);check(a.id&&!s.widgets[a.id],'collision','Widget ID already exists');check(Object.keys(s.widgets).length<100,'limit','Maximum 100 widgets');outcome=s.widgets[a.id]={id:a.id,kind:'scene3d',title:text(a.title,100),layout:layout(a.layout||{x:45,y:45,width:760,height:610,collapsed:false}),spec:a.template==='room'?createMannequinRoom():createScene(),version:0,createdBy:p.id};break;}
 case 'scene.act':outcome=sceneAction(s,p,a,now);break;
 case 'widget.create':{fields(a,['id','kind','title','layout','spec'],['id','kind','title','layout','spec']);text(a.id,160);check(a.id&&!s.widgets[a.id],'collision','Widget ID already exists');check(Object.keys(s.widgets).length<100,'limit','Maximum 100 widgets');layout(a.layout);spec(a.kind,a.spec);text(a.title,100);outcome=s.widgets[a.id]={...a,version:0,createdBy:p.id};break;}
 case 'widget.update':case 'widget.delete':{fields(a,c.op==='widget.update'?['id','title','layout','spec','expectedWidgetVersion']:['id','expectedWidgetVersion'],['id','expectedWidgetVersion']);const w=s.widgets[a.id];check(w,'not_found','Widget not found');if(w.kind==='scene3d'&&(c.op==='widget.delete'||a.spec!==undefined))guardSceneEdit(w,p,now,s);check(a.expectedWidgetVersion===w.version,'conflict','Widget changed');if(c.op==='widget.delete'){delete s.widgets[a.id];outcome={id:a.id};}else{check(Object.keys(a).length>2,'invalid','No widget changes');if(a.layout!==undefined)w.layout=layout(a.layout);if(a.spec!==undefined){w.spec=spec(w.kind,a.spec);if(w.kind==='scene3d')w.sceneRuntime={version:(w.sceneRuntime?.version||0)+1,controller:null};}if(a.title!==undefined)w.title=text(a.title,100);w.version++;outcome=w;}break;}
 case 'widget.clear_all':fields(a,[]);s.widgets={};break;
 case 'chat.say':{fields(a,['thread','text'],['text']);text(a.text);check(a.text.trim(),'invalid','Empty message');const t=s.threads[a.thread||'main'];check(t,'not_found','Thread not found');check(t.members==='all'||t.members.includes(p.id),'forbidden','Private thread');const m={id:c.id,by:p.id,name:s.seats[p.id]?.name||p.id,text:a.text,time:now};t.messages.push(m);t.messages=t.messages.slice(-200);outcome={thread:t.id,message:m};audience={thread:t.id};break;}
 case 'thread.open':{fields(a,['members'],['members']);check(Array.isArray(a.members)&&a.members.length>=1&&a.members.length<=10,'invalid','Invalid members');const members=[...new Set([p.id,...a.members])].sort();check(members.every(x=>s.seats[x]),'invalid','Unknown seat');const t=Object.values(s.threads).find(x=>Array.isArray(x.members)&&canonical(x.members)===canonical(members));check(t||Object.keys(s.threads).length<100,'limit','Too many threads');outcome=t||{id:id(),members,messages:[]};s.threads[outcome.id]=outcome;audience={thread:outcome.id};break;}
 case 'seat.move':fields(a,['id','x','y'],['id','x','y']);check(a.id===p.id&&s.seats[a.id],'forbidden','Only own seat may move');s.seats[a.id].x=finite(a.x,0);s.seats[a.id].y=finite(a.y,0);outcome=s.seats[a.id];break;
 case 'seat.ai.add':{fields(a,['id','name','provider','model','persona'],['name','provider','model']);check(['demo','openai','anthropic','gemini'].includes(a.provider),'invalid','Unknown provider');text(a.model,100);text(a.name,100);text(a.persona??'',4000);check(Object.values(s.seats).filter(x=>x.kind==='ai').length<8,'limit','Maximum eight AI seats');const sid=a.id||id();text(sid,160);check(sid&&!s.seats[sid]&&!s.members[sid],'collision','Seat ID already used');s.seats[sid]={id:sid,kind:'ai',controller:'server',name:a.name,provider:a.provider,model:a.model,persona:a.persona||'',glyph:'ג',x:80,y:160};s.members[sid]={id:sid,kind:'agent',role:'editor',epoch:0,name:a.name};outcome=s.seats[sid];break;}
 case 'seat.ai.configure':{fields(a,['id','name','model','persona'],['id']);const seat=s.seats[a.id];check(seat?.kind==='ai','not_found','AI seat not found');for(const k of ['name','model','persona'])if(a[k]!==undefined)seat[k]=text(a[k],k==='persona'?4000:100);outcome=seat;break;}
 case 'connector.create':{fields(a,['hash','name','glyph'],['hash','name']);check(/^[0-9a-f]{64}$/.test(a.hash),'invalid','Expected connector-key hash');text(a.name,100);check(a.name.trim(),'invalid','Name required');text(a.glyph??'✦',4);s.connectors??={};check(!s.connectors[a.hash],'collision','Connector already exists');check(Object.keys(s.connectors).length<5,'limit','Maximum five connector links');check(Object.values(s.seats).filter(x=>x.kind==='ai').length<8,'limit','Maximum eight AI seats');const sid=id();s.seats[sid]={id:sid,kind:'ai',controller:'external',provider:'external',model:'mcp',name:a.name,persona:'',glyph:a.glyph||'✦',x:120,y:240};s.members[sid]={id:sid,kind:'agent',role:'editor',epoch:0,name:a.name,connector:true};s.connectors[a.hash]={seat:sid,created:now};outcome=s.seats[sid];break;}
 case 'seat.ai.remove':fields(a,['id'],['id']);check(s.seats[a.id]?.kind==='ai','not_found','AI seat not found');delete s.seats[a.id];delete s.members[a.id];for(const [h,x] of Object.entries(s.connectors||{}))if(x.seat===a.id)delete s.connectors[h];outcome={id:a.id};break;
 case 'member.invite':{fields(a,['role','maxUses','expiresIn','code'],['role','maxUses','expiresIn','code']);check(['viewer','member','editor'].includes(a.role),'invalid','Invalid invite role');check(Number.isInteger(a.maxUses)&&a.maxUses>=1&&a.maxUses<=20,'invalid','Invalid uses');finite(a.expiresIn,60,86400);check(/^[0-9a-f]{64}$/.test(a.code),'invalid','Expected invite-code hash');s.invites[a.code]={role:a.role,uses:0,maxUses:a.maxUses,expires:now+a.expiresIn*1000};outcome={expires:now+a.expiresIn*1000};audience={principal:p.id};break;}
 case 'member.set_role':case 'member.revoke':{fields(a,c.op==='member.revoke'?['id']:['id','role'],c.op==='member.revoke'?['id']:['id','role']);const m=s.members[a.id];check(m&&m.role!=='owner'&&m.kind!=='agent','forbidden','Cannot change owner or internal agent membership');m.epoch++;if(c.op==='member.revoke'){delete s.members[a.id];delete s.seats[a.id];}else{check(['viewer','member','editor'].includes(a.role),'invalid','Invalid role');m.role=a.role;}outcome={id:a.id};audience={principal:p.id};break;}
 default:if(c.op.startsWith('python.'))outcome=jobOp(s,p,c.op,a,now);else throw new Fault('invalid','Unknown operation');
 }
 if(c.op.startsWith('widget.')||c.op.startsWith('member.')||c.op==='scene.create')s.version++;
 const safeOutcome=structuredClone(outcome);if(safeOutcome.sceneRuntime?.controller)delete safeOutcome.sceneRuntime.controller.session;
 const result={type:'result',id:c.id,status:'accepted',version:s.version,outcome:safeOutcome};
 // Events are notifications, never raw command payloads or job code/results/leases.
 emit(s,c.op,p.id,c.op==='chat.say'?outcome:{id:outcome.id??null},audience);
 s.receipts[rk]={fingerprint:fp,result};return {state:s,result};
 }catch(e){if(!(e instanceof Fault))throw e;return {state:original,result:{type:'result',id:typeof c?.id==='string'?c.id:null,status:'rejected',code:e.code,reason:e.message}};}
}
export class Engine{
 constructor(store,notify=()=>{}){this.store=store;this.notify=notify;}
 read(){return this.store.read();}
 change(fn){return this.store.change(fn);}
 async submit(p,c){let fp;try{jsonSize(c);fp=await fingerprint(p,c);}catch(e){return {type:'result',id:c?.id??null,status:'rejected',code:'invalid',reason:'Invalid command'};}const out=this.store.change(s=>{const x=applyCommand(s,p,c,fp);return {state:x.state,value:{result:x.result,duplicate:x.duplicate}};});if(out.result.status==='accepted'&&!out.duplicate){try{this.notify();}catch{/* Committed result stays accepted. */}}return out.result;}
 snapshot(p){return snapshot(this.read(),p);}
}


