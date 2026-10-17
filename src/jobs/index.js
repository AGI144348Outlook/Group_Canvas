import {check,fields,text,id,object} from '../commands/util.js';
import {jobSummary} from '../events/index.js';
export function jobOp(s,p,op,a,now){
 fields(a,op==='python.queue'?['id','code','widgetId']:op==='python.claim'?['id','runner']:op==='python.complete'?['id','runner','lease','status','output']:['id'],['id']);text(a.id,160);check(a.id.length>0,'invalid','Job ID required');let j=s.jobs[a.id];
 if(op==='python.queue'){check(!j&&!s.tombstones[a.id],'collision','Job ID already used');text(a.code,16000);check(a.code.length>0,'invalid','Code is required');check(Object.values(s.jobs).filter(x=>['queued','running'].includes(x.status)).length<200,'limit','Too many active jobs');if(a.widgetId!==undefined)check(s.widgets[a.widgetId]?.kind==='python','invalid','Expected an existing Python widget');j=s.jobs[a.id]={id:a.id,requester:p.id,session:p.session,code:a.code,widgetId:a.widgetId??null,status:'queued',created:now,updated:now};
 }else{check(j,'not_found',s.tombstones[a.id]?'Job archived':'Job not found');
 if(op==='python.claim'){check(p.kind==='user'||p.kind==='guest','forbidden','Agents cannot run Python');check(j.requester===p.id&&j.session===p.session,'forbidden','Python runs only in its author session');text(a.runner,160);check(j.status==='queued'||j.status==='running'&&j.expires<=now,'conflict','Job is not claimable');j.status='running';j.runner=a.runner;j.lease=id();j.expires=now+40000;}
 if(op==='python.complete'){check(j.requester===p.id&&j.session===p.session&&j.status==='running'&&j.runner===a.runner&&j.lease===a.lease&&j.expires>now,'forbidden','Stale or invalid lease');check(['succeeded','failed'].includes(a.status)&&object(a.output),'invalid','Invalid result');text(JSON.stringify(a.output),32000);j.status=a.status;j.output=a.output;delete j.lease;}
 if(op==='python.cancel'){check(j.requester===p.id||p.role==='owner','forbidden','Only requester or owner can cancel');check(['queued','running'].includes(j.status),'conflict','Job already terminal');j.status='cancelled';delete j.lease;}
 j.updated=now;}
 const terminal=Object.values(s.jobs).filter(x=>!['queued','running'].includes(x.status)).sort((a,b)=>b.updated-a.updated);
 terminal.forEach((x,i)=>{if(i>=50||x.updated<now-7*86400000){s.tombstones[x.id]={id:x.id,status:x.status,archived:true};delete s.jobs[x.id];}});
 return jobSummary(j);
}
export function jobDetail(s,p,jid){const j=s.jobs[jid];if(!j){check(s.tombstones[jid],'not_found','Job not found');return s.tombstones[jid];}const out={...jobSummary(j),output:j.output};if(j.requester===p.id&&j.session===p.session&&['user','guest'].includes(p.kind)){out.code=j.code;if(j.status==='running'&&j.expires>Date.now()){out.lease=j.lease;out.runner=j.runner;}}return out;}
