// Pure scene data and coordinate math shared by renderer, server validation and tests.
export const POSES=['neutral','wave','point','sit'];
export const PRIMITIVES=['box','sphere','cylinder'];
export const INTERACTIONS=['none','toggle','spin'];
const node=(id,parent,position,type,size,color,offset=[0,0,0])=>({id,parent,position,rotation:[0,0,0],geometry:{type,size,offset},color});
export function createScene(){
 const skin='#d9ba8c',coat='#527c69',dark='#304a42';
 return {format:1,avatar:{id:'gimel',name:'Gimel',position:[0,0,0],yaw:0,pose:'neutral'},parts:[
 node('torso',null,[0,1.35,0],'box',[.62,.65,.32],coat),
 node('neck','torso',[0,.4,0],'cylinder',[.11,.15,.11],skin),
 node('head','neck',[0,.25,0],'sphere',[.25,.29,.24],skin),
 node('leftArm','torso',[-.43,.26,0],'cylinder',[.1,.48,.1],coat,[0,-.24,0]),
 node('leftForearm','leftArm',[0,-.48,0],'cylinder',[.085,.43,.085],skin,[0,-.215,0]),
 node('leftHand','leftForearm',[0,-.45,0],'sphere',[.11,.14,.08],skin),
 node('rightArm','torso',[.43,.26,0],'cylinder',[.1,.48,.1],coat,[0,-.24,0]),
 node('rightForearm','rightArm',[0,-.48,0],'cylinder',[.085,.43,.085],skin,[0,-.215,0]),
 node('rightHand','rightForearm',[0,-.45,0],'sphere',[.11,.14,.08],skin),
 node('leftLeg',null,[-.17,1.02,0],'cylinder',[.12,.48,.12],dark,[0,-.24,0]),
 node('leftShin','leftLeg',[0,-.48,0],'cylinder',[.1,.43,.1],dark,[0,-.215,0]),
 node('leftFoot','leftShin',[0,-.41,-.08],'box',[.22,.13,.4],dark),
 node('rightLeg',null,[.17,1.02,0],'cylinder',[.12,.48,.12],dark,[0,-.24,0]),
 node('rightShin','rightLeg',[0,-.48,0],'cylinder',[.1,.43,.1],dark,[0,-.215,0]),
 node('rightFoot','rightShin',[0,-.41,-.08],'box',[.22,.13,.4],dark)
 ],objects:[
 {id:'lamp',name:'Lamp · tap to switch',primitive:'cylinder',position:[3,.75,-2],rotation:[0,0,0],size:[.28,1.5,.28],color:'#d7b66b',interaction:'toggle',active:false},
 {id:'block',name:'Block · tap to turn',primitive:'box',position:[-2,.5,-3],rotation:[0,0,0],size:[1,1,1],color:'#7b9db8',interaction:'spin',active:false}
 ]};
}
export function worldToLocal(position,origin){return position.map((v,i)=>v-origin[i]);}
export function localToWorld(position,origin){return position.map((v,i)=>v+origin[i]);}
export function worldToCamera(position,origin,yaw=0){const [x,y,z]=worldToLocal(position,origin),c=Math.cos(yaw),s=Math.sin(yaw);return [c*x-s*z,y,s*x+c*z];}
export function gridOffset(origin,spacing=1){return origin.map(x=>((x%spacing)+spacing)%spacing);}
export function distance(a,b){return Math.hypot(...a.map((v,i)=>v-b[i]));}
export function poseAngles(pose,time=0,moving=false){
 const out={};const set=(id,x=0,y=0,z=0)=>{out[id]=[x,y,z];};
 if(moving){const phase=Math.sin(time*8)*.38;set('leftLeg',phase);set('rightLeg',-phase);set('leftArm',-phase*.7);set('rightArm',phase*.7);}
 if(pose==='wave'){set('rightArm',0,0,-2.5);set('rightForearm',0,0,-.3-Math.sin(time*5)*.2);}
 if(pose==='point'){set('rightArm',Math.PI/2,0,0);set('head',0,-.2,0);}
 if(pose==='sit'){set('leftLeg',Math.PI/2);set('rightLeg',Math.PI/2);set('leftShin',-Math.PI/2);set('rightShin',-Math.PI/2);}
 return out;
}
function fail(message){throw Error(message);}
function fields(x,allowed,required=allowed){if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(x,k)))fail('Unknown or missing scene field');}
function str(x,max=100){if(typeof x!=='string'||x.length<1||x.length>max)fail('Invalid scene text');}
function ident(x){str(x,64);if(!/^[a-zA-Z0-9_-]+$/.test(x)||['__proto__','constructor','prototype'].includes(x))fail('Invalid entity ID');}
function vec(x,min,max){if(!Array.isArray(x)||x.length!==3||x.some(v=>!Number.isFinite(v)||v<min||v>max))fail('Invalid scene vector');}
function color(x){if(typeof x!=='string'||!/^#[0-9a-fA-F]{6}$/.test(x))fail('Expected hex color');}
export function validateObject(o){fields(o,['id','name','primitive','position','rotation','size','color','interaction','active']);ident(o.id);str(o.name);if(!PRIMITIVES.includes(o.primitive)||!INTERACTIONS.includes(o.interaction)||typeof o.active!=='boolean')fail('Invalid object primitive or interaction');vec(o.position,-1e6,1e6);vec(o.rotation,-Math.PI*2,Math.PI*2);vec(o.size,.03,10);color(o.color);return o;}
export function validatePart(p){fields(p,['id','parent','position','rotation','geometry','color']);ident(p.id);if(p.parent!==null)ident(p.parent);vec(p.position,-8,8);vec(p.rotation,-Math.PI*2,Math.PI*2);fields(p.geometry,['type','size','offset']);if(!PRIMITIVES.includes(p.geometry.type))fail('Invalid part primitive');vec(p.geometry.size,.03,6);vec(p.geometry.offset,-6,6);color(p.color);return p;}
export function validateScene(s){
 fields(s,['format','avatar','parts','objects']);if(s.format!==1)fail('Unsupported scene format');fields(s.avatar,['id','name','position','yaw','pose']);ident(s.avatar.id);str(s.avatar.name);vec(s.avatar.position,-1e6,1e6);if(s.avatar.position[1]!==0)fail('Initial scene uses ground-plane navigation');if(!Number.isFinite(s.avatar.yaw)||Math.abs(s.avatar.yaw)>Math.PI*2||!POSES.includes(s.avatar.pose))fail('Invalid avatar orientation or pose');
 if(!Array.isArray(s.parts)||s.parts.length<1||s.parts.length>40||!Array.isArray(s.objects)||s.objects.length>60)fail('Scene component limit exceeded');
 const byId=new Map();for(const p of s.parts){validatePart(p);if(byId.has(p.id))fail('Duplicate body part');byId.set(p.id,p);}
 for(const p of s.parts){const seen=new Set([p.id]);let parent=p.parent;while(parent!==null){if(!byId.has(parent)||seen.has(parent))fail('Unknown parent or body hierarchy cycle');seen.add(parent);parent=byId.get(parent).parent;}}
 const ids=new Set([s.avatar.id]);for(const o of s.objects){validateObject(o);if(ids.has(o.id))fail('Duplicate entity');ids.add(o.id);}return s;
}
// Schema is declarative data only. Rendering and behavior remain platform-defined.
const obj=(properties,required=Object.keys(properties))=>({type:'object',additionalProperties:false,properties,required});
const vector=(min,max)=>({type:'array',minItems:3,maxItems:3,items:{type:'number',minimum:min,maximum:max}});
const identity={type:'string',minLength:1,maxLength:64,pattern:'^[a-zA-Z0-9_-]+$'},colorSchema={type:'string',pattern:'^#[0-9a-fA-F]{6}$'};
export const objectSchema=obj({id:identity,name:{type:'string',minLength:1,maxLength:100},primitive:{enum:PRIMITIVES},position:vector(-1e6,1e6),rotation:vector(-Math.PI*2,Math.PI*2),size:vector(.03,10),color:colorSchema,interaction:{enum:INTERACTIONS},active:{type:'boolean'}});
export const partSchema=obj({id:identity,parent:{type:['string','null'],maxLength:64},position:vector(-8,8),rotation:vector(-Math.PI*2,Math.PI*2),geometry:obj({type:{enum:PRIMITIVES},size:vector(.03,6),offset:vector(-6,6)}),color:colorSchema});
export const sceneSchema=obj({format:{const:1},avatar:obj({id:identity,name:{type:'string',minLength:1,maxLength:100},position:vector(-1e6,1e6),yaw:{type:'number',minimum:-Math.PI*2,maximum:Math.PI*2},pose:{enum:POSES}}),parts:{type:'array',minItems:1,maxItems:40,items:partSchema},objects:{type:'array',maxItems:60,items:objectSchema}});
