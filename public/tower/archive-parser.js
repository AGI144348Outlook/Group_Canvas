// Incremental JSON-array framing. Memory is bounded by one conversation, not the archive.
export async function* conversationRecords(file,{offset=0,maxRecordBytes=32*1024*1024,chunkBytes=64*1024}={}){
 let phase=offset?'after':'start',depth=0,quoted=false,escape=false,start=0,parts=[],length=0;
 for(let base=offset;base<file.size;base+=chunkBytes){
  const bytes=new Uint8Array(await file.slice(base,Math.min(file.size,base+chunkBytes)).arrayBuffer());let segment=depth?0:-1;
  for(let i=0;i<bytes.length;i++){
   const b=bytes[i],pos=base+i;
   if(depth){
    if(quoted){if(escape)escape=false;else if(b===92)escape=true;else if(b===34)quoted=false;}
    else if(b===34)quoted=true;else if(b===123||b===91)depth++;else if(b===125||b===93)depth--;
    if(pos-start+1>maxRecordBytes)throw Error('One conversation exceeds the 32 MiB import limit. Progress before it is saved; this conversation needs a larger-capacity importer.');
    if(depth===0){parts.push(bytes.slice(segment,i+1));length+=i+1-segment;const raw=new Uint8Array(length);let at=0;for(const p of parts){raw.set(p,at);at+=p.length;}parts=[];length=0;segment=-1;phase='after';const text=new TextDecoder('utf-8',{fatal:true}).decode(raw);let value;try{value=JSON.parse(text);}catch{throw Error(`Invalid conversation JSON near byte ${start}.`);}yield {value,raw:text,start,end:pos+1};}
    continue;
   }
   if(b===32||b===10||b===13||b===9)continue;
   if(phase==='start'){if(b!==91)throw Error('Choose the extracted conversations.json file: expected a JSON array, not a ZIP or a single-conversation object.');phase='first';continue;}
   if(phase==='after'){if(b===44){phase='value';continue;}if(b===93){phase='done';continue;}throw Error(`Expected a comma or closing array at byte ${pos}.`);}
   if(phase==='first'&&b===93){phase='done';continue;}
   if(phase==='first'||phase==='value'){if(b!==123)throw Error(`Expected a conversation object at byte ${pos}.`);start=pos;segment=i;depth=1;phase='record';continue;}
   throw Error(`Unexpected content after the archive at byte ${pos}.`);
  }
  if(depth&&segment>=0){parts.push(bytes.slice(segment));length+=bytes.length-segment;}
 }
 if(phase!=='done')throw Error('The archive ended before its JSON array was complete. Earlier conversations remain saved.');
}
export function contentText(message){
 const content=message?.content;if(!content)return {text:'',nonText:0};const parts=Array.isArray(content.parts)?content.parts:[];
 const strings=parts.filter(p=>typeof p==='string');
 if(typeof content.text==='string'&&!strings.length)strings.push(content.text);
 return {text:strings.join('\n'),nonText:parts.filter(p=>typeof p!=='string').length||(!strings.length&&content.content_type&&content.content_type!=='text'?1:0)};
}
export function describeConversation(value,ordinal){
 if(!value||typeof value!=='object'||Array.isArray(value)||!value.mapping||typeof value.mapping!=='object'||Array.isArray(value.mapping))throw Error(`Conversation ${ordinal+1} has no valid message mapping. It was not silently skipped.`);
 const roles={},warnings=[];let nodes=0,messages=0,nonText=0;
 for(const node of Object.values(value.mapping)){nodes++;if(!node||typeof node!=='object')continue;if(node.parent&&!value.mapping[node.parent])warnings.push('Missing parent reference');if(node.message){messages++;const role=node.message.author?.role||'unknown';roles[role]=(roles[role]||0)+1;nonText+=contentText(node.message).nonText;}}
 if(!value.current_node)warnings.push('No selected branch marker');else if(!value.mapping[value.current_node])warnings.push('Selected branch marker references a missing node');
 return {ordinal,sourceId:value.id||value.conversation_id||null,title:typeof value.title==='string'?value.title:'Untitled conversation',created:value.create_time??null,updated:value.update_time??null,nodes,messages,roles,nonText,warnings:[...new Set(warnings)],currentNode:value.current_node||null};
}
export function selectedMessages(value,{all=false,role='all'}={}){
 let nodes=[],warnings=[];
 if(all){nodes=Object.entries(value.mapping).map(([id,node])=>({id,node}));}
 else{
  let id=value.current_node;const seen=new Set();if(!id)return {messages:[],warnings:['No selected branch is identified. Use All recorded nodes to inspect the preserved data.']};
  while(id){if(seen.has(id)){warnings.push('Cycle detected in branch; traversal stopped.');break;}seen.add(id);const node=value.mapping[id];if(!node){warnings.push('Missing node; traversal stopped.');break;}nodes.push({id,node});id=node.parent;}nodes.reverse();
 }
 const messages=nodes.filter(({node})=>node?.message).map(({id,node})=>({id,parent:node.parent??null,children:node.children||[],role:node.message.author?.role||'unknown',...contentText(node.message)})).filter(m=>role==='all'||m.role===role);
 return {messages,warnings};
}
export async function sourceFingerprint(file){
 // A resume identity check, not a cryptographic digest of the whole source file.
 const first=new Uint8Array(await file.slice(0,65536).arrayBuffer()),last=new Uint8Array(await file.slice(Math.max(0,file.size-65536)).arrayBuffer());const data=new Uint8Array(first.length+last.length);data.set(first);data.set(last,first.length);
 const digest=await crypto.subtle.digest('SHA-256',data);return {name:file.name,size:file.size,lastModified:file.lastModified,sampleHash:[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')};
}
export async function recordHash(raw){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
