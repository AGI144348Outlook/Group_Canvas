import {check,fields,finite,text} from '../commands/util.js';
import {validateScene,validateObject,validatePart,distance,POSES,objectSchema,partSchema} from '../../public/scene/model.js';
import {atmosphere,validateTrigger,atmosphereSchema,triggerSchema} from '../../public/scene/environment.js';
import {BUILTINS,instantiate} from '../../public/scene/prefabs.js';
import {runTriggers} from './triggers.js';
export function validateSceneSpec(s){try{return validateScene(s);}catch(e){check(false,'invalid',e.message);}}
const construction=['object.add','object.update','object.remove','part.update','prefab.define','prefab.spawn','atmosphere.set','trigger.add','trigger.remove'];
export const sceneOps=['acquire','release','move','pose','interact',...construction,'batch'];
const extras={acquire:[],release:[],move:['dx','dz','yaw'],pose:['pose'],interact:['target'],'object.add':['object'],'object.update':['object'],'object.remove':['target'],'part.update':['part'],'prefab.define':['prefabId','definition'],'prefab.spawn':['prefabId','instanceId','position','yaw'],'atmosphere.set':['atmosphere'],'trigger.add':['trigger'],'trigger.remove':['target'],batch:['actions']};
function held(w,p,now){const c=w.sceneRuntime?.controller;return c&&c.principal===p.id&&c.session===p.session&&c.expires>now;}
function identifier(x){text(x,64);check(/^[a-zA-Z0-9_-]{1,64}$/.test(x)&&!['__proto__','constructor','prototype'].includes(x),'invalid','Invalid ID');}
function argumentsFor(a,nested=false){check(sceneOps.includes(a.action),'invalid','Unknown scene action');const base=nested?['action']:['widgetId','action','expectedSceneVersion'];fields(a,[...base,...extras[a.action]],[...base,...extras[a.action].filter(x=>!['yaw'].includes(x))]);}
function construct(s,w,a){
 if(a.action==='object.add'){validateObject(a.object);check(!w.spec.objects.some(x=>x.id===a.object.id),'collision','Object ID already exists');w.spec.objects.push(a.object);}
 if(a.action==='object.update'){validateObject(a.object);const i=w.spec.objects.findIndex(x=>x.id===a.object.id);check(i>=0,'not_found','Object not found');w.spec.objects[i]=a.object;}
 if(a.action==='object.remove'){const i=w.spec.objects.findIndex(x=>x.id===a.target);check(i>=0,'not_found','Object not found');w.spec.objects.splice(i,1);}
 if(a.action==='part.update'){validatePart(a.part);const i=w.spec.parts.findIndex(x=>x.id===a.part.id);check(i>=0,'not_found','Body part not found');w.spec.parts[i]=a.part;}
 if(a.action==='atmosphere.set')w.spec.atmosphere=atmosphere(a.atmosphere);
 if(a.action==='trigger.add'){validateTrigger(a.trigger,new Set(w.spec.objects.map(o=>o.id)));w.spec.triggers??=[];check(!w.spec.triggers.some(t=>t.id===a.trigger.id),'collision','Trigger ID already exists');w.spec.triggers.push(a.trigger);}
 if(a.action==='trigger.remove'){const i=(w.spec.triggers||[]).findIndex(t=>t.id===a.target);check(i>=0,'not_found','Trigger not found');w.spec.triggers.splice(i,1);if(w.sceneRuntime.triggers)delete w.sceneRuntime.triggers[a.target];}
 if(a.action==='prefab.define'){identifier(a.prefabId);s.scenePrefabs??={};check(!Object.hasOwn(BUILTINS,a.prefabId)&&!Object.hasOwn(s.scenePrefabs,a.prefabId),'collision','Prefab definition already exists');check(Object.keys(s.scenePrefabs).length<16,'limit','Maximum sixteen custom prefab definitions');fields(a.definition,['name','objects'],['name','objects']);text(a.definition.name,100);check(Array.isArray(a.definition.objects)&&a.definition.objects.length>0&&a.definition.objects.length<=12,'limit','A custom prefab needs 1–12 objects');const ids=new Set();for(const o of a.definition.objects){validateObject(o);check(!ids.has(o.id),'invalid','Duplicate prefab part');ids.add(o.id);}s.scenePrefabs[a.prefabId]=structuredClone(a.definition);}
 if(a.action==='prefab.spawn'){identifier(a.prefabId);identifier(a.instanceId);check(Array.isArray(a.position)&&a.position.length===3,'invalid','Expected position vector');a.position.forEach(x=>finite(x,-1e6,1e6));if(a.yaw!==undefined)finite(a.yaw,-Math.PI*2,Math.PI*2);const def=Object.hasOwn(BUILTINS,a.prefabId)?BUILTINS[a.prefabId]:(Object.hasOwn(s.scenePrefabs||{},a.prefabId)?s.scenePrefabs[a.prefabId]:null);check(def,'not_found','Prefab not found');const objects=instantiate(def,a.instanceId,a.position,a.yaw||0);const ids=new Set(w.spec.objects.map(o=>o.id));for(const o of objects){validateObject(o);check(!ids.has(o.id)&&o.id!==w.spec.avatar.id,'collision','Instance ID collides with existing entity');ids.add(o.id);}w.spec.objects.push(...objects);}
}
export function sceneAction(s,p,a,now){
 try{
 argumentsFor(a);text(a.widgetId,160);const w=s.widgets[a.widgetId];check(w?.kind==='scene3d','not_found','3D scene not found');const rt=w.sceneRuntime??={version:0,controller:null};check(a.expectedSceneVersion===rt.version,'conflict','Scene changed; inspect and retry');
 const ownerIsCurrent=rt.controller&&s.members[rt.controller.principal]?.epoch===rt.controller.epoch;const active=ownerIsCurrent&&rt.controller.expires>now;
 if(a.action==='acquire'){check(!active||held(w,p,now),'conflict','Mannequin is controlled by another operator');rt.controller={principal:p.id,session:p.session,epoch:p.epoch,expires:now+60000};}
 else if(a.action==='release'){check(held(w,p,now)||p.role==='owner','forbidden','Only controller or owner can release');rt.controller=null;}
 else if(['move','pose','interact'].includes(a.action)){
  check(active&&held(w,p,now),'forbidden','Take control of the mannequin first');
  if(a.action==='move'){finite(a.dx,-2,2);finite(a.dz,-2,2);check(Math.hypot(a.dx,a.dz)<=2,'invalid','Movement step is too large');if(a.yaw!==undefined)finite(a.yaw,-Math.PI*2,Math.PI*2);const from=[...w.spec.avatar.position];w.spec.avatar.position[0]+=a.dx;w.spec.avatar.position[2]+=a.dz;if(a.yaw!==undefined)w.spec.avatar.yaw=a.yaw;runTriggers(s,w,p,from,w.spec.avatar.position,now);}
  if(a.action==='pose'){check(POSES.includes(a.pose),'invalid','Unknown pose');w.spec.avatar.pose=a.pose;}
  if(a.action==='interact'){const o=w.spec.objects.find(x=>x.id===a.target);check(o,'not_found','Object not found');check(o.visible!==false,'forbidden','Object is not revealed');check(distance([w.spec.avatar.position[0],1.3,w.spec.avatar.position[2]],o.position)<=2.5,'forbidden','Move within 2.5 units to interact');check(o.interaction!=='none','invalid','Object has no interaction');if(o.interaction==='toggle')o.active=!o.active;else o.rotation[1]=(o.rotation[1]+Math.PI/4)%(Math.PI*2);}
  rt.controller.expires=now+60000;
 }else{
  check(!active||held(w,p,now),'conflict','Release the active mannequin controller before editing its scene');
  if(a.action==='batch'){check(Array.isArray(a.actions)&&a.actions.length>0&&a.actions.length<=12,'limit','Use 1–12 construction actions');for(const child of a.actions){argumentsFor(child,true);check(construction.includes(child.action)&&child.action!=='prefab.define','invalid','Batches allow construction only, without nested batches or prefab definitions');construct(s,w,child);}}
  else construct(s,w,a);
 }
 validateSceneSpec(w.spec);rt.version++;
 return {widgetId:w.id,id:w.id,sceneVersion:rt.version,controller:rt.controller?{principal:rt.controller.principal,expires:rt.controller.expires}:null,avatar:structuredClone(w.spec.avatar),objectCount:w.spec.objects.length};
 }catch(e){if(e.code)throw e;check(false,'invalid',e.message);}
}
const common={dx:{type:'number',minimum:-2,maximum:2},dz:{type:'number',minimum:-2,maximum:2},yaw:{type:'number',minimum:-Math.PI*2,maximum:Math.PI*2},pose:{enum:POSES},target:{type:'string'},object:objectSchema,part:partSchema,prefabId:{type:'string',maxLength:64},instanceId:{type:'string',maxLength:40},position:{type:'array',minItems:3,maxItems:3,items:{type:'number',minimum:-1e6,maximum:1e6}},definition:{type:'object',additionalProperties:false,required:['name','objects'],properties:{name:{type:'string',maxLength:100},objects:{type:'array',minItems:1,maxItems:12,items:objectSchema}}},atmosphere:atmosphereSchema,trigger:triggerSchema};
export const actionSchema={type:'object',additionalProperties:false,required:['widgetId','action','expectedSceneVersion'],properties:{widgetId:{type:'string'},action:{enum:sceneOps},expectedSceneVersion:{type:'integer',minimum:0},...common,actions:{type:'array',minItems:1,maxItems:12,items:{type:'object',additionalProperties:false,required:['action'],properties:{action:{enum:construction.filter(x=>x!=='prefab.define')},...common}}}}};
export function guardSceneEdit(w,p,now,state){const c=w.sceneRuntime?.controller;if(c&&c.expires>now&&state?.members[c.principal]?.epoch===c.epoch)check(c.principal===p.id&&c.session===p.session,'conflict','Scene is controlled by another operator');}
