import {contentText} from '../../public/tower/archive-parser.js';
export const POLICY={version:'1.0.0',persona:'Julian',others:['Nexus','Concord','Zenith'],gapHours:12,branches:'current_node-parent',channels:[null,'final'],contentTypes:['text','multimodal_text']};
export function keptBranch(value){
 const nodes=[],seen=new Set();let id=value?.current_node;
 if(!id||!value.mapping||typeof value.mapping!=='object')return {nodes:[],error:'missing-selected-endpoint'};
 while(id){if(seen.has(id))return {nodes:[],error:'branch-cycle'};seen.add(id);const node=value.mapping[id];if(!node)return {nodes:[],error:'missing-branch-node'};nodes.push({id,node});id=node.parent;}
 return {nodes:nodes.reverse(),error:null};
}
function visibility(message){
 if(!['user','assistant'].includes(message?.author?.role))return 'non-dialogue-role';
 if(message.metadata?.is_visually_hidden_from_conversation===true||message.metadata?.is_hidden===true)return 'hidden';
 if(!POLICY.channels.includes(message.channel??null))return 'non-final-channel';
 if(!POLICY.contentTypes.includes(message.content?.content_type))return 'unrecognized-content-type';
 return null;
}
function signals(text,role){
 const names=[POLICY.persona,...POLICY.others];
 // Mask code and visibly quoted lines. Such names still require review, not acceptance.
 const cleaned=text.replace(/```[\s\S]*?(?:```|$)/g,'').replace(/~~~[\s\S]*?(?:~~~|$)/g,'').replace(/^\s*>.*$/gm,'').replace(/["“][^"”]*["”]/g,'');
 const found=names.filter(name=>role==='user'?new RegExp(`^\\s*${name}(?![\\p{L}\\p{N}_])|(?<![\\p{L}\\p{N}_])${name}\\s*[,：:?!]`,'iu').test(cleaned):new RegExp(`\\b(?:I am|I'm|I’m|this is|as)\\s+${name}(?![\\p{L}\\p{N}_])`,'iu').test(cleaned));
 const raw=names.some(name=>new RegExp(`(?<![\\p{L}\\p{N}_])${name}(?![\\p{L}\\p{N}_])`,'iu').test(text));
 const quoted=cleaned!==text&&raw;
 return {found,ambiguous:found.length>1||quoted};
}
const time=message=>typeof message.create_time==='number'&&Number.isFinite(message.create_time)&&message.create_time>=0?message.create_time:null;
export function deriveConversation(value,source){
 const {nodes,error}=keptBranch(value);const out={self:[],julian:[],review:[],excluded:{},error};if(error)return out;
 let active=false,tainted=false,lastTime=null,prompt=null,evidence=null,session=0,pendingDirect=false;
 const skip=reason=>out.excluded[reason]=(out.excluded[reason]||0)+1;
 for(const {id,node} of nodes){const m=node.message;if(!m)continue;const denied=visibility(m);if(denied){skip(denied);continue;}
  const role=m.author.role,{text,nonText}=contentText(m),current=time(m),base={source,nodeId:id,parent:node.parent??null,children:node.children||[],messageId:m.id??null,role,created:current,text,nonText};
  if(role==='user'){pendingDirect=false;if(text.trim()){const flags=[];if(/```|~~~/.test(text))flags.push('code-fence');if(text.length>3000)flags.push('long-text');out.self.push({...base,flags});}else skip(nonText?'attachment-only-user':'empty-user');prompt=base;}
  const signal=signals(text,role),isJulian=signal.found.length===1&&signal.found[0]===POLICY.persona&&!signal.ambiguous;
  const switches=signal.found.length===1&&POLICY.others.includes(signal.found[0])&&!signal.ambiguous;
  if(switches){active=false;tainted=false;evidence=null;pendingDirect=false;}
  const gap=lastTime===null||current===null||current<lastTime||current-lastTime>POLICY.gapHours*3600;
  if(active&&gap)tainted=true;
  if(signal.ambiguous){if(active)tainted=true;out.review.push({...base,reason:'ambiguous-or-quoted-invocation',candidate:true});}
  if(isJulian){if(!active||tainted)session++;active=true;tainted=false;evidence={nodeId:id,rule:role==='user'?'addressing-prompt':'self-identification'};pendingDirect=role==='user';}
  if(role==='assistant'&&active){const tier=tainted||!prompt?'unsure':isJulian||pendingDirect?'direct':'inherited';const turn={source,session,prompt:prompt?{...prompt}:null,reply:base,tier,candidate:true,evidence:structuredClone(evidence),reason:tier==='unsure'?(!prompt?'missing-user-predecessor':'gap-or-ambiguous-continuity'):null};if(tier==='unsure')out.review.push(turn);else out.julian.push(turn);pendingDirect=false;}
  lastTime=current;
 }
 return out;
}
