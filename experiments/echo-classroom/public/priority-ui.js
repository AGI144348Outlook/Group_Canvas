import {PriorityCards} from './priorities.js';
import {assess2} from './lesson2.js';
import {currentLearner,pauseClassroom} from './app.js';
import {registerPriorityReader,externalTurnPending} from './session-bridge.js';
const $=id=>document.getElementById(id),el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const KEY='echo-classroom-priorities-v1';let p=new PriorityCards(),lastCapture=0,lastEvent=null;
try{const s=JSON.parse(localStorage.getItem(KEY));if(s){p=new PriorityCards(null,s.state);lastCapture=Number.isInteger(s.lastCapture)?s.lastCapture:0;}}catch{}
registerPriorityReader(()=>p.state());
function inventory(){const out={};for(const e of currentLearner().events)if(e.kind==='attempt')out[e.word.toLowerCase()]={seen:true,qualifications:[]};return out;}
function save(){try{localStorage.setItem(KEY,JSON.stringify({state:p.state(),lastCapture}));}catch{$('priority-status').textContent='Notes are temporary; device storage is unavailable. Export to retain them.';}}
function describe(e){if(!e)return 'Notes are available now; Recess is opt-in and last priority.';return e.kind==='note-captured'?'First priority: captured '+e.card.template+' card '+e.card.id+'.':e.kind==='task-completed'?'Assigned inspection completed: '+e.entry.word+'. No vocabulary promoted.':e.kind==='recess-candidate'?'Recess selected “'+e.entry+'” and recorded a question. Teacher handover is now required.':e.kind==='blocked'?'Paused: '+e.reason.replaceAll('-',' ')+'.':e.kind;}
function tick(){lastEvent=p.tick(inventory(),!!currentLearner().pending||externalTurnPending());save();render();return lastEvent;}
function render(){
 $('recess-toggle').textContent=p.enabled?'Pause Recess':'Enable Recess';$('priority-count').textContent=p.notes.length+' note cards';$('priority-order').textContent=(currentLearner().pending?'Teacher turn pending · ':'')+p.note_queue.length+' notes queued · '+p.tasks.length+' assignments · Recess '+p.used+'/'+p.budget;
 $('priority-status').textContent=describe(lastEvent);$('handover').disabled=!p.handover&&!p.notes.some(n=>n.review==='unreviewed');$('priority-notes').replaceChildren();
 const pending=p.notes.filter(n=>n.review==='unreviewed'),recent=p.notes.filter(n=>n.review!=='unreviewed').slice(-3),notes=[...pending,...recent];
 if(!notes.length)$('priority-notes').append(el('p','small','No note cards yet. Present a lesson card, or request a note.'));
 for(const note of notes){const card=el('article','priority-note');card.append(el('span','event-kind',note.template.toUpperCase()+' · '+note.id+' · '+note.review),el('p','',note.body),el('small','',note.source+' · record status, not a truth stamp'));
 if(note.review==='unreviewed'){const row=el('div','secondary-actions');for(const [label,verdict]of [['Keep record','accepted'],['Reject record','rejected']]){const b=el('button','',label);b.onclick=()=>act(()=>{p.review(note.id,verdict);lastEvent={kind:'teacher-reviewed'};});row.append(b);}card.append(row);}$('priority-notes').append(card);}
 $('lesson2-check').disabled=!!currentLearner().pending;
}
function act(fn){pauseClassroom();try{fn();save();render();}catch(e){$('priority-status').textContent=e.message;}}
 $('note-form').onsubmit=e=>{e.preventDefault();act(()=>{p.requestNote($('note-type').value,$('note-body').value);$('note-body').value='';tick();});};
 $('priority-step').onclick=()=>act(tick);
 $('queue-task').onclick=()=>act(()=>{p.enqueueInspection('speaker');lastEvent={kind:'task-queued'};});
 $('recess-toggle').onclick=()=>act(()=>{p.setRecess(!p.enabled);lastEvent={kind:p.enabled?'recess-enabled':'recess-paused'};});
 $('handover').onclick=()=>act(()=>{for(const note of p.notes)if(note.review==='unreviewed')p.review(note.id,'accepted');p.handOver();lastEvent={kind:'handover-completed'};});
 $('lesson2-check').onclick=()=>{pauseClassroom();try{if(currentLearner().pending)throw Error('Complete the teacher turn first.');const r=assess2(currentLearner());$('lesson2-result').textContent=r.correct+' / '+r.total+' in this local session · 17 new layouts plus missing-role checks. Learner state stayed frozen; no green admission.';}catch(e){$('lesson2-result').textContent=e.message;}};
 window.addEventListener('echo-session-updated',()=>{const pending=currentLearner().pending;if(pending&&pending.id>lastCapture){try{p.requestNote('observation','Encountered “'+pending.word+'”; selected '+(pending.prediction.entity||'an unresolved reference')+'.','classroom-observation-adapter',[{turn:pending.id,status:'attempt-not-qualification'}]);lastCapture=pending.id;tick();}catch(e){$('priority-status').textContent=e.message;}}render();});
 window.addEventListener('echo-classroom-reset',()=>{p=new PriorityCards();lastCapture=0;lastEvent=null;save();render();$('lesson2-result').textContent='Check your retained reference associations without new feedback.';});
 fetch('/lesson2-evidence.json').then(r=>r.ok?r.json():Promise.reject()).then(d=>{$('lesson2-record').textContent='Recorded Python checkpoint: counter '+d.runs.counter.correct+'/'+d.runs.counter.total+'; UCB '+d.runs['echo-ucb'].correct+'/'+d.runs['echo-ucb'].total+'; untrained control '+d.runs['no-feedback'].correct+'/'+d.runs['no-feedback'].total+'. Zero new training turns.';}).catch(()=>{$('lesson2-record').textContent='Recorded Lesson 2 evidence could not be loaded.';});
render();document.body.dataset.prioritiesReady='true';
