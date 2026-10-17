// Android's keyboard can shrink the visual viewport without resizing the layout viewport.
export function installMobileUI(win,doc){
 const app=doc.getElementById('app'),tabs=[...doc.querySelectorAll('[data-mobile-view]')];
 const setView=view=>{
   app.dataset.mobileView=view;
   for(const tab of tabs){const selected=tab.dataset.mobileView===view;tab.setAttribute('aria-pressed',String(selected));}
   if(view!=='conversation'&&doc.activeElement?.closest('#canvasChat'))doc.activeElement.blur();
   win.dispatchEvent(new Event('resize'));
 };
 for(const tab of tabs)tab.addEventListener('click',()=>setView(tab.dataset.mobileView));
 let frame;
 const size=()=>{win.cancelAnimationFrame(frame);frame=win.requestAnimationFrame(()=>{
   const viewport=win.visualViewport;
   doc.documentElement.style.setProperty('--phone-height',`${Math.round(viewport?.height||win.innerHeight)}px`);
   doc.documentElement.style.setProperty('--phone-top',`${Math.round(viewport?.offsetTop||0)}px`);
 });};
 win.visualViewport?.addEventListener('resize',size);win.visualViewport?.addEventListener('scroll',size);win.addEventListener('resize',size);size();setView('canvas');
}
