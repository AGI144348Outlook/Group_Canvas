import {sceneSchema} from '../../public/scene/model.js';
import {validateSceneSpec} from '../scenes/actions.js';
import {check,fields,text,finite,object} from '../commands/util.js';
export const kinds=['note','avatar','python','table','chart','drawing','quiz','shape','scene3d'];
const color=x=>{check(typeof x==='string'&&/^#[\da-fA-F]{6}$/.test(x),'invalid','Use a six-digit hex color');return x;};
export function layout(x){fields(x,['x','y','width','height','collapsed'],['x','y','width','height','collapsed']);finite(x.x,0);finite(x.y,0);finite(x.width,180,1800);finite(x.height,100,1800);check(typeof x.collapsed==='boolean','invalid','collapsed must be boolean');return x;}
export function spec(kind,s){check(kinds.includes(kind)&&object(s),'invalid','Unknown widget kind or spec');
 switch(kind){
 case 'scene3d':validateSceneSpec(s);break;
 case 'note':fields(s,['text'],['text']);text(s.text,16000);break;
 case 'avatar':fields(s,['glyph','name','mood'],['glyph','name']);text(s.glyph,16);text(s.name,100);if(s.mood!==undefined)text(s.mood,200);break;
 case 'python':fields(s,['code'],['code']);text(s.code,16000);break;
 case 'table':fields(s,['columns','rows'],['columns','rows']);check(Array.isArray(s.columns)&&s.columns.length<=20&&s.columns.length>0,'invalid','Invalid columns');s.columns.forEach(x=>text(x,100));check(Array.isArray(s.rows)&&s.rows.length<=200,'invalid','Invalid rows');s.rows.forEach(row=>{check(Array.isArray(row)&&row.length===s.columns.length,'invalid','Row width mismatch');row.forEach(x=>check(x===null||typeof x==='boolean'||typeof x==='string'&&x.length<=2000||typeof x==='number'&&Number.isFinite(x),'invalid','Invalid cell'));});break;
 case 'chart':fields(s,['labels','values'],['labels','values']);check(Array.isArray(s.labels)&&Array.isArray(s.values)&&s.labels.length===s.values.length&&s.values.length<=100,'invalid','Chart series mismatch');s.labels.forEach(x=>text(x,100));s.values.forEach(x=>finite(x,-1e9,1e9));break;
 case 'drawing':fields(s,['strokes'],['strokes']);check(Array.isArray(s.strokes)&&s.strokes.length<=200,'invalid','Invalid strokes');for(const a of s.strokes){fields(a,['points','color'],['points','color']);color(a.color);check(Array.isArray(a.points)&&a.points.length<=500,'invalid','Too many points');for(const p of a.points){check(Array.isArray(p)&&p.length===2,'invalid','Invalid point');p.forEach(x=>finite(x,0,2000));}}break;
 case 'shape':fields(s,['shape','color','text'],['shape','color']);check(['rect','circle','line','text'].includes(s.shape),'invalid','Invalid shape');color(s.color);if(s.text!==undefined)text(s.text,1000);break;
 case 'quiz':fields(s,['question','options','answerIndex'],['question','options','answerIndex']);text(s.question);check(Array.isArray(s.options)&&s.options.length>=2&&s.options.length<=8,'invalid','Use 2–8 options');s.options.forEach(x=>text(x,500));check(Number.isInteger(s.answerIndex)&&s.answerIndex>=0&&s.answerIndex<s.options.length,'invalid','Answer index outside options');break;
 }return s;
}
export const layoutSchema={type:'object',additionalProperties:false,required:['x','y','width','height','collapsed'],properties:{x:{type:'number',minimum:0,maximum:10000},y:{type:'number',minimum:0,maximum:10000},width:{type:'number',minimum:180,maximum:1800},height:{type:'number',minimum:100,maximum:1800},collapsed:{type:'boolean'}}};
const obj=(properties,required=Object.keys(properties))=>({type:'object',additionalProperties:false,required,properties});
const str={type:'string',maxLength:4000};
export const specs={note:obj({text:{type:'string',maxLength:16000}}),avatar:obj({glyph:{type:'string',maxLength:16},name:{type:'string',maxLength:100},mood:{type:'string',maxLength:200}},['glyph','name']),python:obj({code:{type:'string',maxLength:16000}}),table:obj({columns:{type:'array',minItems:1,maxItems:20,items:{type:'string',maxLength:100}},rows:{type:'array',maxItems:200,items:{type:'array',maxItems:20,items:{type:['string','number','boolean','null']}}}}),chart:obj({labels:{type:'array',maxItems:100,items:str},values:{type:'array',maxItems:100,items:{type:'number'}}}),quiz:obj({question:str,options:{type:'array',minItems:2,maxItems:8,items:{type:'string',maxLength:500}},answerIndex:{type:'integer',minimum:0}}),drawing:obj({strokes:{type:'array',maxItems:200,items:obj({color:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},points:{type:'array',maxItems:500,items:{type:'array',minItems:2,maxItems:2,items:{type:'number',minimum:0,maximum:2000}}}})}}),shape:obj({shape:{enum:['rect','circle','line','text']},color:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},text:{type:'string',maxLength:1000}},['shape','color'])};
specs.scene3d=sceneSchema;
export const createSchema=obj({id:{type:'string',minLength:1,maxLength:160},kind:{type:'string',enum:kinds},title:{type:'string',maxLength:100},layout:layoutSchema,spec:{anyOf:Object.values(specs)}});
export const updateSchema=obj({id:{type:'string'},expectedWidgetVersion:{type:'integer',minimum:0},title:{type:'string',maxLength:100},layout:layoutSchema,spec:{anyOf:Object.values(specs)}},['id','expectedWidgetVersion']);
export const deleteSchema=obj({id:{type:'string'},expectedWidgetVersion:{type:'integer',minimum:0}});

