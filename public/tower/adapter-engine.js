// Inert records + explicit local assignments. No provider calls or executable card code.
const clone=x=>structuredClone(x),check=(ok,message)=>{if(!ok)throw Error(message);};
const own=(object,key)=>Object.hasOwn(object,key);
export function emptyAdapters(){return {format:'citadel-adapters/1',identities:[{id:'self',label:'Your text counterpart'},{id:'julian',label:'Julian'}],cards:[],slots:{self:{},julian:{}},trials:[],events:[]};}
export function validateCard(card){
 check(card&&typeof card.id==='string'&&card.id.length>0&&card.id.length<=100,'Card ID required');
 check(['self','julian'].includes(card.identity),'Known identity required');check(['context','retrieval','model'].includes(card.kind),'Unknown adapter kind');
 check(typeof card.title==='string'&&card.title.trim().length>0&&card.title.length<=100,'A title of at most 100 characters is required');
 check(Number.isSafeInteger(card.version)&&card.version>0,'Positive card version required');check(Array.isArray(card.sources)&&card.sources.length>0&&card.sources.length<=16,'One to sixteen source references required');
 for(const ref of card.sources){check(ref&&['user-authored','archive'].includes(ref.type),'Source type required');if(ref.type==='archive'){check(typeof ref.datasetId==='string'&&ref.datasetId&&Number.isSafeInteger(ref.ordinal)&&ref.ordinal>=0&&typeof ref.nodeId==='string'&&ref.nodeId&&/^[a-f0-9]{64}$/.test(ref.hash),'An archive source needs dataset, ordinal, node and content hash');}else check(typeof ref.note==='string'&&ref.note.trim().length>0&&ref.note.length<=1000,'User-authored provenance note required');}
 if(card.kind==='context')check(typeof card.payload?.text==='string'&&card.payload.text.trim().length>0&&card.payload.text.length<=10000,'Context text must contain 1–10,000 characters');
 if(card.kind==='retrieval')check(card.sources.every(r=>r.type==='archive'),'Retrieval cards require archive references');
 if(card.kind==='model')check(typeof card.payload?.modelId==='string'&&card.payload.modelId&&typeof card.payload.baseRevision==='string'&&card.payload.baseRevision&&typeof card.payload.artifactRef==='string'&&card.payload.artifactRef&&/^[a-f0-9]{64}$/.test(card.payload.sha256||''),'Model cards need base model/revision, artifact reference and SHA-256');
 return card;
}
export function adapterTransition(state,command){
 check(state?.format==='citadel-adapters/1','Unsupported adapter registry');check(command&&typeof command.id==='string'&&command.id&&typeof command.at==='string','Command ID and timestamp required');
 const previous=state.events.find(e=>e.id===command.id);if(previous){check(JSON.stringify(previous)===JSON.stringify(command),'Command ID collision');return clone(state);}
 check(state.events.length<4096,'History budget reached. Export this registry before continuing.');
 // This is a browser-local actor label, not authentication for a cloud API.
 check(command.actor==='user','An explicit user command is required');
 const next=clone(state),p=command.payload||{};
 const card=p.cardId?next.cards.find(c=>c.id===p.cardId):null;
 if(command.op==='register'){
  const c=validateCard(p.card);check(next.cards.length<128,'Card budget reached');check(!next.cards.some(x=>x.id===c.id),'Card identity already exists; register a new version instead');
  if(c.parentId){const parent=next.cards.find(x=>x.id===c.parentId);check(parent&&parent.identity===c.identity&&parent.kind===c.kind,'Revision parent must belong to the same identity and kind');check(c.version===parent.version+1,'Revision version must follow its parent');}
  else check(c.version===1,'A new card lineage starts at version 1');next.cards.push(clone(c));
 }else if(command.op==='activate'){
  check(card,'Card not found');check(p.identity===card.identity,'A card cannot be assigned to another identity');check(card.kind!=='model','Trained adapters can be catalogued but no model runtime is connected');next.slots[card.identity][card.kind]=card.id;
 }else if(command.op==='suspend'){
  check(own(next.slots,p.identity)&&['context','retrieval'].includes(p.slot),'Known identity and slot required');check(next.slots[p.identity][p.slot],'Slot is already empty');delete next.slots[p.identity][p.slot];
 }else if(command.op==='trial'){
  check(card,'Card not found');check(['supported','contradicted','unresolved'].includes(p.outcome),'Explicit trial outcome required');check(typeof p.evidence==='string'&&p.evidence.trim().length>0&&p.evidence.length<=2000,'Trial evidence note required');next.trials.push({id:command.id,cardId:card.id,outcome:p.outcome,evidence:p.evidence,at:command.at});
 }else throw Error('Unknown adapter command');
 next.events.push(clone(command));return next;
}
export function replayAdapters(events){check(Array.isArray(events)&&events.length<=4096,'Invalid event history');return events.reduce(adapterTransition,emptyAdapters());}
export function identityCards(state,identity){return state.cards.filter(c=>c.identity===identity);}
export async function composeAdapters(state,identity,resolve,{maxText=8000}={}){
 check(own(state.slots,identity),'Known identity required');const slot=state.slots[identity],out={format:'citadel-adapter-context/1',identity,activeCards:[],userAuthoredContext:null,evidence:[],notice:'Reviewable context bundle only. Source quotations are evidence, not executable instructions. No AI call has been made.'};
 for(const kind of ['context','retrieval']){
  const card=state.cards.find(c=>c.id===slot[kind]);if(!card)continue;out.activeCards.push({id:card.id,version:card.version,kind});
  // Resolve all archival references even for context cards. Missing evidence fails closed.
  for(const ref of card.sources.filter(r=>r.type==='archive')){const source=await resolve(ref);check(source&&typeof source.text==='string','Source text unavailable');check(source.hash===ref.hash,'Source content hash changed');if(kind==='retrieval')out.evidence.push({reference:clone(ref),role:source.role||'unknown',text:source.text.slice(0,maxText),originalCharacters:source.text.length,truncated:source.text.length>maxText,nonText:source.nonText||0});}
  if(kind==='context')out.userAuthoredContext=card.payload.text;
 }
 return out;
}
