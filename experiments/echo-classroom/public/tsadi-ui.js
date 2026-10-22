import {TsadiTool,profile} from './tsadi.js';
import {currentLearner,pauseClassroom,refreshClassroom} from './app.js';
import {registerToolReader} from './session-bridge.js';
const $=id=>document.getElementById(id),el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;},KEY='echo-tsadi-tool-v1';
let tool=new TsadiTool();try{const s=JSON.parse(localStorage.getItem(KEY));if(s)tool=new TsadiTool(s);}catch{}
registerToolReader(()=>tool.state());
const names={'visitor-a':'Entity A','visitor-b':'Entity B','visitor-c':'Entity C'};
function status(text){$('tsadi-status').textContent=text;}
function save(){try{localStorage.setItem(KEY,JSON.stringify(tool.state()));}catch{status('Device storage unavailable; export to retain this tool session.');}}
function render(){const p=profile(),card=tool.cards.find(c=>c.id==='own:tsadi');
 $('tool-copy').disabled=tool.copied;$('tool-copy').textContent=tool.copied?'Own card copied · ע receipt verified':'Have Echo copy to his blank tool card';
 $('tool-slots').replaceChildren();for(const slot of p.slots){const b=el('button','slot '+slot.status,slot.word+' · '+(slot.status==='green'?'green':'locked'));b.type='button';b.disabled=slot.status!=='green';b.setAttribute('aria-label',slot.word+' question slot '+slot.status);b.onclick=()=>status('Who is enabled for this questioning exercise only.');$('tool-slots').append(b);}
 $('tool-procedure').replaceChildren();for(const line of p.procedure)$('tool-procedure').append(el('li','',line));
 $('own-tool-copy').textContent=tool.copied?'צ · questioning / blank-line expansion / paperclip':'Blank card · not yet copied';$('own-tool-id').textContent=card.id+' · revision '+card.revision+' · '+card.lines.length+' blank writing lines';$('own-tool-lines').replaceChildren();for(let i=0;i<Math.min(card.lines.length,12);i++)$('own-tool-lines').append(el('div','writing-line',card.lines[i]||'\u00a0'));
 $('tool-ask').disabled=!tool.copied||!!tool.pending||!!currentLearner().pending;$('tool-target').disabled=!!tool.pending;
 $('tool-expand').disabled=!tool.copied||card.lines.length>=29;$('tool-clip').disabled=!tool.copied;$('tool-question').textContent=tool.pending?'פ “'+tool.pending.expression+'”':'A question has not been submitted.';
 $('tool-answer-choices').replaceChildren();if(tool.pending)for(const id of tool.pending.scene.entities){const b=el('button','',names[id]);b.onclick=()=>act(()=>{const reply=tool.answer(tool.pending.id,id);status('Teacher reply recorded: '+names[reply.entity]+'. It is attributed to your reply; no vocabulary was promoted.');});$('tool-answer-choices').append(b);}
 $('tool-clip-result').textContent=tool.links.length?'Paperclip: practice:encounter ↔ practice:context · relation retained':'Two existing practice cards: an encounter and a context. No attachment yet.';
 $('tool-events').replaceChildren();for(const e of tool.events.slice(-8).reverse()){$('tool-events').append(el('p','small',e.kind==='question-egress'?'פצ: '+e.expression:e.kind==='teacher-reply'?'Teacher replied: '+names[e.entity]:e.kind==='expanded'?'צ expanded '+e.card+' from '+e.from+' to '+e.to+' lines.':e.kind==='verified-tool-copy'?'ת stamped ע after exact tool-card copy.':'צ attached two practice cards.'));}
}
function act(fn){pauseClassroom();try{fn();save();render();refreshClassroom();}catch(e){status(e.message);}}
 $('tool-copy').onclick=()=>act(()=>{tool.copyTool(profile());status('Exact front/back receipt verified. This is copying scaffolding, not a comprehension pass.');});
 $('tool-ask').onclick=()=>act(()=>{if(currentLearner().pending)throw Error('Complete the pending lesson teacher turn first.');tool.ask('Who',$('tool-target').value,{entities:['visitor-a','visitor-b','visitor-c'],speaker:null,addressee:null});status('Question submitted. Choose your reference entity below; the learner has not received that reference.');});
 $('tool-expand').onclick=()=>act(()=>{tool.expand('own:tsadi',2);status('Two blank lines added. Card identity, copied profile and earlier content retained.');});
 $('tool-clip').onclick=()=>act(()=>{tool.paperclip('practice:encounter','practice:context');status('Attached existing distinct practice cards. Repeating this does not duplicate the relation.');});
 $('tool-flip').onclick=()=>{const back=$('tool-back');back.hidden=!back.hidden;$('tool-front').hidden=!back.hidden;$('tool-flip').textContent=back.hidden?'Turn over: algorithm & word slots':'Show front: symbol & functions';};
 $('tsadi-tab').onclick=()=>{pauseClassroom();$('live-panel').hidden=true;$('evidence-panel').hidden=true;$('tsadi-panel').hidden=false;for(const id of ['live-tab','evidence-tab'])$(id).setAttribute('aria-selected','false');$('tsadi-tab').setAttribute('aria-selected','true');render();};
 for(const id of ['live-tab','evidence-tab'])$(id).addEventListener('click',()=>{$('tsadi-panel').hidden=true;$('tsadi-tab').setAttribute('aria-selected','false');});
 window.addEventListener('echo-session-updated',render);window.addEventListener('echo-classroom-reset',()=>{tool=new TsadiTool();save();render();status('Tool session reset with the classroom.');});
render();refreshClassroom();document.body.dataset.tsadiReady='true';
