import {crossesSphere} from '../../public/scene/environment.js';
import {distance} from '../../public/scene/model.js';
import {emit} from '../events/index.js';
export function runTriggers(state,widget,principal,from,to,now){
 const rt=widget.sceneRuntime;rt.triggers??={};rt.log??=[];
 for(const t of widget.spec.triggers||[]){const previous=rt.triggers[t.id]||{inside:false,fired:0,lastFired:0};const inside=distance(to,t.center)<=t.radius;const crossed=crossesSphere(from,to,t.center,t.radius);const fire=!previous.inside&&crossed&&(!t.once||previous.fired===0)&&(previous.fired===0||now-previous.lastFired>=(t.cooldownMs||3000));
  if(fire){for(const a of t.actions){if(a.type==='narrate'){const msg={id:`scene-${widget.id}-${t.id}-${state.cursor+1}`,by:principal.id,name:'Environment',text:a.text,time:now,source:{kind:'scene.trigger',scene:widget.id,trigger:t.id}};state.threads.main.messages.push(msg);state.threads.main.messages=state.threads.main.messages.slice(-200);emit(state,'chat.say',principal.id,{thread:'main',message:msg},{thread:'main'});}else{const o=widget.spec.objects.find(o=>o.id===a.target);if(a.type==='reveal')o.visible=true;else o.active=a.value;}}
   previous.fired++;previous.lastFired=now;rt.log.push({trigger:t.id,time:now,position:[...to]});rt.log=rt.log.slice(-16);
  }previous.inside=inside;rt.triggers[t.id]=previous;
 }
}
