import type { PaperController } from './paper';

type Notebook = { root:HTMLElement; surface:HTMLElement; id:string; count:number; index:number; desired:number };
/** Native notebook state comes first; WebGL only enhances the same page changes. */
export function createPaperExperience(){
  const root=document.documentElement,aborter=new AbortController(),{signal}=aborter;
  const books=new Map<string,Notebook>();
  let controller:PaperController|undefined,enabled=root.dataset.motion==='on',loading=false,disposed=false,generation=0,timer:ReturnType<typeof setTimeout>|undefined;
  function saved(){try{return history.state?.mrNotebooks||{};}catch{return {};}}
  function persist(){try{history.replaceState({...history.state,mrNotebooks:Object.fromEntries([...books].map(([id,b])=>[id,b.index]))},'');}catch{/* Navigation still works. */}}
  function sync(id:string,index:number,announce=true){
    const b=books.get(id);if(!b)return;b.index=Math.max(0,Math.min(b.count-1,index));b.root.dataset.page=String(b.index);
    b.root.querySelectorAll<HTMLElement>('[data-notebook-page]').forEach(el=>el.hidden=Number(el.dataset.notebookPage)!==b.index);
    b.root.querySelectorAll<HTMLElement>('[data-notebook-note]').forEach(el=>el.hidden=Number(el.dataset.notebookNote)!==b.index);
    const current=b.root.querySelector<HTMLElement>('[data-notebook-current]'),count=b.root.querySelector<HTMLElement>('[data-notebook-count]');
    const page=b.root.querySelector<HTMLElement>(`[data-notebook-page="${b.index}"]`),title=b.root.querySelectorAll('.notebook-index strong')[b.index]?.textContent||'';
    if(current)current.textContent=title;if(count)count.textContent=`${String(b.index+1).padStart(2,'0')} / ${String(b.count).padStart(2,'0')}`;
    const prev=b.root.querySelector<HTMLButtonElement>('[data-notebook-prev]'),next=b.root.querySelector<HTMLButtonElement>('[data-notebook-next]');
    if(prev)prev.disabled=b.index===0;if(next)next.disabled=b.index===b.count-1;
    b.surface.setAttribute('aria-label',`${b.root.dataset.notebookTitle}: ${title}. Page ${b.index+1} of ${b.count}. Click to turn; arrow keys browse.`);
    const art=b.root.closest<HTMLElement>('[data-hero-art]');if(art)art.dataset.heroPage=String(b.index);
    if(page) b.root.dataset.currentPageId=page.dataset.pageId;
    if(announce){const live=b.root.querySelector('[data-notebook-announcement]');if(live)live.textContent=`${title}. Page ${b.index+1} of ${b.count}.`;persist();}
  }
  // Without the WebGL sheet (no WebGL, or still loading) the outgoing leaf still turns, as a CSS 3D flip.
  function flip(b:Notebook,from:number,to:number){
    if(!enabled||from===to||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const page=b.root.querySelector<HTMLElement>(`[data-notebook-page="${from}"]`);if(!page)return;
    b.surface.querySelectorAll('.leaf-flip').forEach(el=>el.remove());
    const leaf=page.cloneNode(true) as HTMLElement;
    leaf.removeAttribute('data-notebook-page');leaf.hidden=false;leaf.setAttribute('aria-hidden','true');
    leaf.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
    leaf.classList.add('leaf-flip',to>from?'leaf-forward':'leaf-back');
    b.surface.append(leaf);
    const done=()=>leaf.remove();leaf.addEventListener('animationend',done,{once:true});setTimeout(done,1400);
  }
  function selectPage(id:string,index:number){const b=books.get(id);if(!b)return;const target=Math.max(0,Math.min(b.count-1,index));b.desired=target;if(controller?.hasSurface(id)&&enabled)controller.selectPage(id,target,target>=b.index?1:-1);else{const from=b.index;sync(id,target);flip(b,from,b.index);}}
  const excluded=(target:EventTarget|null)=>target instanceof Element&&Boolean(target.closest('a,button,input,textarea,select,summary,[data-drone-study]'));
  document.querySelectorAll<HTMLElement>('[data-notebook]').forEach(element=>{
    const surface=element.querySelector<HTMLElement>('[data-notebook-surface]');if(!surface)return;
    const id=element.dataset.notebookId!,count=Number(element.dataset.pageCount),index=Math.max(0,Math.min(count-1,Number(saved()[id])||0));
    const b:Notebook={root:element,surface,id,count,index,desired:index};books.set(id,b);sync(id,index,false);
    {const controls=element.querySelector<HTMLElement>('[data-notebook-controls]');controls?.removeAttribute('data-pending');controls?.removeAttribute('inert');}
    element.querySelector('[data-notebook-prev]')?.addEventListener('click',()=>selectPage(id,b.desired-1),{signal});
    element.querySelector('[data-notebook-next]')?.addEventListener('click',()=>selectPage(id,b.desired+1),{signal});
    let pointer:{id:number;x:number;y:number;width:number;dx:number;direction:number;dragging:boolean;touch:boolean;corner:number}|undefined,ignoreUntil=0;
    const release=()=>{if(pointer&&surface.hasPointerCapture(pointer.id))surface.releasePointerCapture(pointer.id);pointer=undefined;element.removeAttribute('data-paper-dragging');};
    surface.addEventListener('pointerdown',event=>{
      if(excluded(event.target)||event.button!==0||!event.isPrimary)return;
      const bounds=surface.getBoundingClientRect();pointer={corner:1-2*(event.clientY-bounds.top)/bounds.height,id:event.pointerId,x:event.clientX,y:event.clientY,width:surface.getBoundingClientRect().width,dx:0,direction:1,dragging:false,touch:event.pointerType!=='mouse'};
    },{signal,passive:true});
    surface.addEventListener('pointermove',event=>{
      if(excluded(event.target)&&!pointer)return;
      if(pointer&&pointer.id===event.pointerId){
        const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
        if(!pointer.dragging){
          if(Math.max(Math.abs(dx),Math.abs(dy))<9)return;
          if(pointer.touch&&Math.abs(dy)>Math.abs(dx)*1.1){ignoreUntil=performance.now()+300;release();controller?.cancel(id);return;}
          if(Math.abs(dx)<Math.abs(dy)*1.2)return;
          pointer.direction=dx<0?1:-1;
          if((pointer.direction===1&&b.index===b.count-1)||(pointer.direction===-1&&b.index===0)){release();return;}
          controller?.preview(id,pointer.direction,0);pointer.dragging=true;
          try{surface.setPointerCapture(event.pointerId);}catch{release();return;}
        }
        if(event.cancelable)event.preventDefault();pointer.dx=dx;
        const progress=Math.max(0,Math.min(.97,-pointer.direction*dx/pointer.width*1.35));
        controller?.bend(id,progress,pointer.direction,pointer.corner);element.dataset.paperDragging='true';
      }else if(event.pointerType==='mouse'){
        const r=surface.getBoundingClientRect(),x=(event.clientX-r.left)/r.width,y=(event.clientY-r.top)/r.height;
        const distance=Math.hypot(Math.min(x,1-x),Math.min(y,1-y));controller?.preview(id,x>.5?1:-1,Math.max(0,1-distance*3.4)*.23,1-y*2);
      }
    },{signal,passive:false});
    surface.addEventListener('pointerup',event=>{if(!pointer||pointer.id!==event.pointerId)return;const p=pointer;release();if(p.dragging){ignoreUntil=performance.now()+350;const turn=-p.direction*p.dx/p.width>1/3;if(turn)selectPage(id,b.index+p.direction);else controller?.cancel(id);}},{signal});
    surface.addEventListener('pointercancel',()=>{ignoreUntil=performance.now()+350;release();controller?.cancel(id);},{signal});
    surface.addEventListener('lostpointercapture',event=>{if(event.target===surface&&pointer){release();controller?.cancel(id);}},{signal});
    surface.addEventListener('focus',()=>controller?.preview(id,1,.09,-.6),{signal});
    surface.addEventListener('blur',()=>{if(!pointer)controller?.preview(id,1,0);},{signal});
    surface.addEventListener('pointerleave',()=>{if(!pointer)controller?.preview(id,1,0);},{signal});
    surface.addEventListener('click',event=>{if(event.defaultPrevented||excluded(event.target)||performance.now()<ignoreUntil||window.getSelection()?.toString())return;selectPage(id,b.desired+1);},{signal});
    element.addEventListener('keydown',event=>{
      if(event.target instanceof Element&&event.target.closest('[data-drone-study],input,textarea,select'))return;
      if(event.key==='Escape'){b.desired=b.index;ignoreUntil=performance.now()+350;release();controller?.cancel(id);return;}
      if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();selectPage(id,b.desired+(event.key==='ArrowRight'?1:-1));}
      if((event.key==='Enter'||event.key===' ')&&event.target===surface){event.preventDefault();selectPage(id,b.desired+1);}
    },{signal});
  });
  document.querySelectorAll<HTMLElement>('[data-notebook-topics]').forEach(atlas=>{
    const buttons=[...atlas.querySelectorAll<HTMLButtonElement>('[data-notebook-topic]')];
    buttons.forEach(button=>button.addEventListener('click',()=>{const selected=button.dataset.notebookTopic;buttons.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));atlas.querySelectorAll<HTMLElement>('[data-topic-panel]').forEach(p=>p.hidden=p.dataset.topicPanel!==selected);},{signal}));
    atlas.dataset.topicsReady='true';
  });
  root.dataset.notebooks='ready';
  async function load(){
    if(loading||controller||disposed||!enabled||document.hidden||books.size===0)return;
    loading=true;const ticket=generation;
    try{const {createLivingPaper}=await import('./paper');const next=await createLivingPaper(enabled,(id,index)=>sync(id,index));if(disposed||ticket!==generation){next.dispose();return;}controller=next;controller.setHeroMode(document.querySelector<HTMLElement>('[data-hero-art]')?.dataset.heroMode==='field'?'field':'paper');controller.setEnabled(enabled);}
    catch{root.dataset.paperEngine='unavailable';}finally{loading=false;}
  }
  function schedule(){clearTimeout(timer);if(enabled&&!controller&&!loading)timer=setTimeout(()=>void load(),350);}
  if(document.readyState==='complete')schedule();else window.addEventListener('load',schedule,{once:true,signal});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();},{signal});
  window.addEventListener('pagehide',()=>{generation++;clearTimeout(timer);controller?.dispose();controller=undefined;},{signal});
  window.addEventListener('pageshow',event=>{if(event.persisted){for(const b of books.values()){sync(b.id,Number(saved()[b.id])||0,false);b.desired=b.index;}schedule();}},{signal});
  return {
    selectPage,
    selectStudy(value:number){const buttons=document.querySelectorAll<HTMLButtonElement>('[data-notebook-topic]');buttons[Math.max(0,Math.min(buttons.length-1,value))]?.click();},
    setEnabled(value:boolean){enabled=value;controller?.setEnabled(value);if(value)schedule();},
    setHeroMode(mode:'paper'|'field'){const hero=document.querySelector<HTMLElement>('[data-hero-art]');if(hero)hero.dataset.heroMode=mode;controller?.setHeroMode(mode);},
    dispose(){disposed=true;generation++;clearTimeout(timer);controller?.dispose();aborter.abort();}
  };
}
