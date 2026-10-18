// An inspectable symbolic plasticity experiment, not a learned personality.
const copy=value=>structuredClone(value);
const requireValue=(ok,message)=>{if(!ok)throw Error(message);};
export function createJulianLab({identity='julian-test',maxCards=64,maxEvents=512}={}){
 return {format:'julian-plasticity/1',identity,limits:{maxCards,maxEvents},cards:{},assignments:{},returns:{},events:[],cursor:0};
}
export function transition(state,command){
 requireValue(state.format==='julian-plasticity/1','Unsupported lab format');
 requireValue(command&&typeof command.id==='string'&&command.id.length>0,'Command ID required');
 const previous=state.events.find(e=>e.command.id===command.id);
 if(previous){requireValue(JSON.stringify(previous.command)===JSON.stringify(command),'Command ID collision');return copy(state);}
 requireValue(state.events.length<state.limits.maxEvents,'Event budget reached; preserve this experiment before continuing');
 const next=copy(state),p=command.payload||{},card=next.cards[p.card];
 switch(command.op){
 case 'propose':{
  requireValue(typeof p.card==='string'&&p.card&&!card,'New card ID required');
  requireValue(Object.keys(next.cards).length<next.limits.maxCards,'Card budget reached');
  requireValue(typeof p.text==='string'&&p.text.length>0&&p.text.length<=10000,'Bounded profile text required');
  requireValue(Array.isArray(p.sources)&&p.sources.length>0,'Source references required');
  for(const ref of p.sources)requireValue(ref&&['synthetic','archive'].includes(ref.kind)&&typeof ref.source==='string'&&ref.source&&typeof ref.node==='string'&&ref.node,'Source/node reference and provenance kind required');
  next.cards[p.card]={id:p.card,text:p.text,sources:copy(p.sources),status:'candidate',trials:[]};break;
 }
 case 'trial':
  requireValue(card,'Card not found');requireValue(['supported','contradicted','unresolved'].includes(p.outcome),'Explicit trial outcome required');requireValue(typeof p.reference==='string'&&p.reference,'Trial evidence reference required');
  card.trials.push({outcome:p.outcome,reference:p.reference,event:command.id});if(card.status==='candidate')card.status='trial';break;
 case 'assign':
  requireValue(card,'Card not found');requireValue(command.actor==='user','Only explicit user action can assign a profile');requireValue(typeof p.context==='string'&&p.context,'Context required');
  requireValue(card.status!=='dormant','Restore the dormant card before assignment');next.assignments[p.context]=p.card;break;
 case 'suspend':
  requireValue(card,'Card not found');requireValue(command.actor==='user','User action required');card.status='dormant';for(const [context,id] of Object.entries(next.assignments))if(id===p.card)delete next.assignments[context];break;
 case 'restore':
  requireValue(card?.status==='dormant','Dormant card required');requireValue(command.actor==='user','User action required');card.status=card.trials.length?'trial':'candidate';break;
 case 'checkpoint':
  requireValue(typeof p.topic==='string'&&p.topic&&!next.returns[p.topic],'New return topic required');requireValue(typeof p.position==='string'&&p.position,'Indexed continuation position required');next.returns[p.topic]={topic:p.topic,position:p.position,status:'waiting',visits:[]};break;
 case 'return':{
  const topic=next.returns[p.topic];requireValue(topic?.status==='waiting','Waiting topic required');requireValue(typeof p.position==='string'&&p.position,'Continuation position required');topic.visits.push({from:topic.position,to:p.position,event:command.id});topic.position=p.position;break;
 }
 default:throw Error('Unknown operation');
 }
 next.events.push({sequence:next.events.length+1,command:copy(command)});return next;
}
export function compareCards(state,ids){
 return ids.map(id=>{const card=state.cards[id];requireValue(card,'Card not found');return {id,status:card.status,synthetic:card.sources.some(s=>s.kind==='synthetic'),evidence:{supported:card.trials.filter(t=>t.outcome==='supported').length,contradicted:card.trials.filter(t=>t.outcome==='contradicted').length,unresolved:card.trials.filter(t=>t.outcome==='unresolved').length},assignedContexts:Object.entries(state.assignments).filter(([,value])=>value===id).map(([context])=>context)};});
}
export function nextReturn(state){
 // Least-visited scheduling prevents a repeatedly returned topic capturing every slot.
 return Object.values(state.returns).filter(t=>t.status==='waiting').sort((a,b)=>a.visits.length-b.visits.length||a.topic.localeCompare(b.topic))[0]?.topic||null;
}
export function replayLab(initial,events){return events.reduce((s,event)=>transition(s,event.command),copy(initial));}
