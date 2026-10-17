import {check,fields,finite,text} from '../commands/util.js';
import {validateScene,validateObject,validatePart,distance,POSES,objectSchema,partSchema} from '../../public/scene/model.js';
export function validateSceneSpec(s){try{return validateScene(s);}catch(e){check(false,'invalid',e.message);}}
export const sceneOps=['acquire','release','move','pose','interact','object.add','object.update','object.remove','part.update'];
function held(w,p,now){const c=w.sceneRuntime?.controller;return c&&c.principal===p.id&&c.session===p.session&&c.expires>now;}
export function sceneAction(s,p,a,now){
 fields(a,['widgetId','action','expectedSceneVersion','dx','dz','yaw','pose','target','object','part'],['widgetId','action','expectedSceneVersion']);text(a.widgetId,160);check(sceneOps.includes(a.action),'invalid','Unknown scene action');
 const allowed={acquire:[],release:[],move:['dx','dz','yaw'],pose:['pose'],interact:['target'],'object.add':['object'],'object.update':['object'],'object.remove':['target'],'part.update':['part']}[a.action];fields(a,['widgetId','action','expectedSceneVersion',...allowed],['widgetId','action','expectedSceneVersion',...allowed.filter(x=>x!=='yaw')]);
 const w=s.widgets[a.widgetId];check(w?.kind==='scene3d','not_found','3D scene not found');const rt=w.sceneRuntime??={version:0,controller:null};check(a.expectedSceneVersion===rt.version,'conflict','Scene changed; inspect and retry');
 const ownerIsCurrent=rt.controller&&s.members[rt.controller.principal]?.epoch===rt.controller.epoch;const active=ownerIsCurrent&&rt.controller.expires>now;
 if(a.action==='acquire'){check(!active||held(w,p,now),'conflict','Mannequin is controlled by another operator');rt.controller={principal:p.id,session:p.session,epoch:p.epoch,expires:now+60000};}
 else if(a.action==='release'){check(held(w,p,now)||p.role==='owner','forbidden','Only controller or owner can release');rt.controller=null;}
 else if(['move','pose','interact'].includes(a.action)){
 check(active&&held(w,p,now),'forbidden','Take control of the mannequin first');
 if(a.action==='move'){finite(a.dx,-2,2);finite(a.dz,-2,2);check(Math.hypot(a.dx,a.dz)<=2,'invalid','Movement step is too large');if(a.yaw!==undefined)finite(a.yaw,-Math.PI*2,Math.PI*2);w.spec.avatar.position[0]+=a.dx;w.spec.avatar.position[2]+=a.dz;if(a.yaw!==undefined)w.spec.avatar.yaw=a.yaw;}
 if(a.action==='pose'){check(POSES.includes(a.pose),'invalid','Unknown pose');w.spec.avatar.pose=a.pose;}
 if(a.action==='interact'){const o=w.spec.objects.find(x=>x.id===a.target);check(o,'not_found','Object not found');check(distance([w.spec.avatar.position[0],1.3,w.spec.avatar.position[2]],o.position)<=2.5,'forbidden','Move within 2.5 units to interact');check(o.interaction!=='none','invalid','Object has no interaction');if(o.interaction==='toggle')o.active=!o.active;else o.rotation[1]=(o.rotation[1]+Math.PI/4)%(Math.PI*2);}
 rt.controller.expires=now+60000;
 }else{
 check(!active||held(w,p,now),'conflict','Release the active mannequin controller before editing its scene');
 try{if(a.action==='object.add'){validateObject(a.object);check(!w.spec.objects.some(x=>x.id===a.object.id),'collision','Object ID already exists');w.spec.objects.push(a.object);}if(a.action==='object.update'){validateObject(a.object);const i=w.spec.objects.findIndex(x=>x.id===a.object.id);check(i>=0,'not_found','Object not found');w.spec.objects[i]=a.object;}if(a.action==='object.remove'){const i=w.spec.objects.findIndex(x=>x.id===a.target);check(i>=0,'not_found','Object not found');w.spec.objects.splice(i,1);}if(a.action==='part.update'){validatePart(a.part);const i=w.spec.parts.findIndex(x=>x.id===a.part.id);check(i>=0,'not_found','Body part not found');w.spec.parts[i]=a.part;}}catch(e){if(e.code)throw e;check(false,'invalid',e.message);}
 }
 validateSceneSpec(w.spec);rt.version++;
 return {widgetId:w.id,id:w.id,sceneVersion:rt.version,controller:rt.controller?{principal:rt.controller.principal,expires:rt.controller.expires}:null,avatar:structuredClone(w.spec.avatar)};
}
export const actionSchema={type:'object',additionalProperties:false,required:['widgetId','action','expectedSceneVersion'],properties:{widgetId:{type:'string'},action:{enum:sceneOps},expectedSceneVersion:{type:'integer',minimum:0},dx:{type:'number',minimum:-2,maximum:2},dz:{type:'number',minimum:-2,maximum:2},yaw:{type:'number',minimum:-Math.PI*2,maximum:Math.PI*2},pose:{enum:POSES},target:{type:'string'},object:objectSchema,part:partSchema}};
export function guardSceneEdit(w,p,now,state){const c=w.sceneRuntime?.controller;if(c&&c.expires>now&&state?.members[c.principal]?.epoch===c.epoch)check(c.principal===p.id&&c.session===p.session,'conflict','Scene is controlled by another operator');}
