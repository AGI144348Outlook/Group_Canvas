export class Fault extends Error { constructor(code,message){super(message);this.code=code;} }
export function check(ok,code,message){if(!ok)throw new Fault(code,message);}
export const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export const id=()=>crypto.randomUUID();
export const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':object(x)?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
export async function digest(text){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');}
export function text(x,max=4000){check(typeof x==='string'&&x.length<=max,'invalid',`Expected text up to ${max} characters`);return x;}
export function finite(x,min=-10000,max=10000){check(Number.isFinite(x)&&x>=min&&x<=max,'invalid','Number outside allowed range');return x;}
export function fields(p,allowed,required=[]){check(object(p),'invalid','Expected an object');check(Object.keys(p).every(k=>allowed.includes(k)),'invalid','Unknown field');check(required.every(k=>Object.hasOwn(p,k)),'invalid','Missing required field');}
export function jsonSize(x,max=100000){const raw=JSON.stringify(x);check(raw&&new TextEncoder().encode(raw).length<=max,'limit','Payload too large');check(!/"__proto__"\s*:|"constructor"\s*:|"prototype"\s*:/.test(raw),'invalid','Reserved object key');return x;}
