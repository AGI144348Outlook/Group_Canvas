import {contentText} from '../../public/tower/archive-parser.js';
export const characters=['Julian','Nexus','Concord','Zenith'];
export function filterConversation(value,provenance){
 if(!value?.mapping||typeof value.mapping!=='object'||Array.isArray(value.mapping))throw Error('Invalid conversation mapping');
 const prompts=[],mentions=[];
 for(const [nodeId,node] of Object.entries(value.mapping)){
  const message=node?.message;if(!message)continue;
  const {text,nonText}=contentText(message);
  const base={...provenance,conversationId:value.id||value.conversation_id||null,nodeId,parent:node.parent??null,children:node.children||[],currentNode:value.current_node??null,messageId:message.id??null,role:message.author?.role||'unknown',created:message.create_time??null,text,nonText};
  if(base.role==='user')prompts.push(base);
  const matches=characters.filter(name=>new RegExp(`(?<![\\p{L}\\p{N}_])${name}(?![\\p{L}\\p{N}_])`,'iu').test(text));
  if(matches.length)mentions.push({...base,characters:matches,classification:'mention-candidate',characterAuthorshipInferred:false});
 }
 return {prompts,mentions};
}
