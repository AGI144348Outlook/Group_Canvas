import {FLOORS,floorFor,notesFor,validNotes,routeFloor} from './model.js';
const $=id=>document.getElementById(id),make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
let active=null,notes=[],storageAvailable=true,openNote=null;
try{notes=validNotes(JSON.parse(localStorage.getItem('gc-tower-notes-v1')||'[]'));}catch{storageAvailable=false;}
function notify(text){$('notice').textContent=text;$('notice').hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('notice').hidden=true,6000);}
function save(){try{localStorage.setItem('gc-tower-notes-v1',JSON.stringify(notes));storageAvailable=true;return true;}catch{storageAvailable=false;notify('Browser storage is unavailable. Export your notes before leaving.');return false;}}
for(const floor of [...FLOORS].reverse()){
 const b=make('button','floor floor-'+floor.id);b.type='button';b.setAttribute('aria-label',`Enter ${floor.name}, level ${floor.number}`);b.append(make('span','floor-number',floor.number));const facade=make('span','facade');const windows=make('span','windows');windows.setAttribute('aria-hidden','true');for(let i=0;i<5;i++)windows.append(make('i'));facade.append(windows,make('span','floor-name',floor.name),make('span','floor-action','ENTER ↗'));b.append(facade,make('span','floor-side'));b.onclick=()=>location.hash=floor.id;$('floors').append(b);
 const map=make('button','map-floor');map.type='button';map.append(make('span','map-number',floor.number),make('span','',floor.name),make('span','','↗'));map.onclick=()=>{$('floorMapDialog').close();location.hash=floor.id;};$('floorMap').append(map);
}
function renderRoute(){
 const f=routeFloor(location.hash);active=f;$('outside').hidden=!!f;$('interior').hidden=!f;
 document.title=f?`${f.name} · The Archive Tower`:'The Archive Tower · Group Canvas';
 if(!f){window.scrollTo(0,0);return;}
 $('floorAddress').textContent=`LEVEL ${f.number} / 06`;$('floorKicker').textContent=f.tag;$('floor-title').textContent=f.name;$('floorGlyph').textContent=f.mark;$('floorDescription').textContent=f.summary;$('floorPurpose').textContent=f.purpose;$('collectionTitle').textContent=f.artifact;$('search').value='';setTab(false);renderArtifacts();renderConnections();
 const i=FLOORS.indexOf(f);for(const [id,index,arrow] of [['lowerFloor',i-1,'↓'],['upperFloor',i+1,'↑']]){const next=FLOORS[index];$(id).disabled=!next;$(id).textContent=next?`${arrow} ${next.name}`:i===0?'Foundation':'Top level';$(id).onclick=()=>{if(next)location.hash=next.id;};}
 window.scrollTo(0,0);$('floor-title').focus({preventScroll:true});
}
function setTab(connections){$('artifactsView').hidden=connections;$('connectionsView').hidden=!connections;$('viewArtifacts').setAttribute('aria-pressed',String(!connections));$('viewConnections').setAttribute('aria-pressed',String(connections));}
function records(){return [...active.examples.map(([title,body,category],i)=>({id:`sample-${active.id}-${i}`,title,body,category,sample:true})),...notesFor(notes,active.id).map(n=>({...n,category:'Your field note',sample:false}))];}
function renderArtifacts(){
 if(!active)return;const q=$('search').value.trim().toLocaleLowerCase();const all=records();$('artifactCount').textContent=all.length;$('artifactList').replaceChildren();
 for(const r of all.filter(r=>(r.title+' '+r.body).toLocaleLowerCase().includes(q))){const b=make('button','artifact-card');b.type='button';b.append(make('span','artifact-kind',r.sample?'ILLUSTRATIVE SAMPLE':'PERSONAL NOTE'));const row=make('span','artifact-row');row.append(make('strong','',r.title),make('span','','↗'));b.append(row,make('span','artifact-excerpt',r.body),make('span','artifact-meta',r.category));b.onclick=()=>openArtifact(r);$('artifactList').append(b);}
 if(!$('artifactList').children.length)$('artifactList').append(make('p','empty-state','No matches on this floor. Try another word or add your own note.'));
}
function openArtifact(r){openNote=r.sample?null:r.id;$('artifactCategory').textContent=r.sample?'ILLUSTRATIVE SAMPLE / NOT LIVE DATA':'YOUR FIELD NOTE';$('artifactTitle').textContent=r.title;$('artifactBody').textContent=r.body;$('artifactDetails').replaceChildren();for(const [key,value] of [['Level',active.name],['Record ID',r.id],['Source',r.sample?'Interface demonstration':'Entered by you on this browser']]){$('artifactDetails').append(make('dt','',key),make('dd','',value));}$('deleteNote').hidden=r.sample;$('artifactDialog').showModal();}
function renderConnections(){
 $('connectionList').replaceChildren();for(const f of [...FLOORS].reverse()){const li=make('li',f===active?'current':'');const b=make('button');b.type='button';b.append(make('span','map-number',f.number),make('span','',f.name),make('span','',f===active?'YOU ARE HERE':'↗'));b.onclick=()=>location.hash=f.id;li.append(b);$('connectionList').append(li);}
}
$('backOutside').onclick=()=>location.hash='outside';$('openGuide').onclick=()=>$('guideDialog').showModal();$('openFloorMap').onclick=()=>$('floorMapDialog').showModal();$('viewArtifacts').onclick=()=>setTab(false);$('viewConnections').onclick=()=>setTab(true);$('search').oninput=renderArtifacts;
$('newCard').onclick=()=>{$('noteForm').reset();$('noteDialog').showModal();};$('noteForm').onsubmit=e=>{e.preventDefault();const title=$('noteTitle').value.trim(),body=$('noteBody').value.trim();if(!title||!body)return;notes.push({id:crypto.randomUUID(),floor:active.id,title,body,created:new Date().toISOString()});const stored=save();$('noteDialog').close();renderArtifacts();if(stored)notify('Note saved on this browser.');};
$('deleteNote').onclick=()=>{notes=notes.filter(n=>n.id!==openNote);save();$('artifactDialog').close();renderArtifacts();};
$('exportNotes').onclick=()=>{const blob=new Blob([JSON.stringify({format:'group-canvas-tower-notes/1',exported:new Date().toISOString(),notes},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=make('a');a.href=url;a.download='archive-tower-notes.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>b.closest('dialog').close();
window.addEventListener('hashchange',renderRoute);renderRoute();if(!storageAvailable)notify('Browser storage is unavailable. Notes can be exported from a floor.');
