/** A small motion score for each printed study. SVG stays vector sharp at rest. */
export function createNotebookMotion() {
  const root=document.documentElement,aborter=new AbortController(),{signal}=aborter;
  const ns='http://www.w3.org/2000/svg',fine=matchMedia('(pointer:fine)');
  type Item={el:SVGElement;base:string;kind:string;index:number;cx:number;cy:number};
  type Trace={path:SVGPathElement;ink:SVGPathElement;dot:SVGCircleElement;length:number};
  type Score={book:HTMLElement;stage:HTMLElement;page:HTMLElement;svg:SVGSVGElement;items:Item[];traces:Trace[];time:number;visible:boolean;x:number;y:number;tx:number;ty:number;vx:number;vy:number;energy:number;reaction:SVGCircleElement;px:number;py:number;age:number};
  const scores:Score[]=[],observers:MutationObserver[]=[];let frame=0,last=0,disposed=false;
  const running=()=>root.dataset.motion==='on'&&!document.hidden&&!disposed;
  const eligible=(s:Score)=>s.visible&&!s.page.hidden&&s.book.dataset.paperPainted!=='true';
  function element<K extends keyof SVGElementTagNameMap>(tag:K,attributes:Record<string,string>){const el=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attributes))el.setAttribute(k,v);return el;}
  document.querySelectorAll<SVGSVGElement>('[data-notebook-art]').forEach(svg=>{
    const page=svg.closest<HTMLElement>('[data-notebook-page]')!,book=svg.closest<HTMLElement>('[data-notebook]')!,stage=book.querySelector<HTMLElement>('[data-notebook-surface]')!;
    const items=[...svg.querySelectorAll<SVGElement>('[data-nm]')].map(el=>({el,base:el.getAttribute('transform')||'',kind:el.dataset.nm!,index:Number(el.dataset.nmIndex)||0,cx:Number(el.getAttribute('cx'))||0,cy:Number(el.getAttribute('cy'))||0}));
    const traces:Trace[]=[];
    svg.querySelectorAll<SVGPathElement>('[data-nm-trace]').forEach((path,i)=>{
      const length=path.getTotalLength();if(!length)return;
      const color=path.getAttribute('stroke')||svg.dataset.motionColor||'#176b4d';
      const ink=element('path',{d:path.getAttribute('d')||'',stroke:color,'stroke-width':'2.4',fill:'none','stroke-linecap':'round','stroke-dasharray':`${Math.min(36,length*.2)} ${length}`,opacity:'.72'});
      const dot=element('circle',{r:i? '2.8':'4',fill:color,opacity:'.8'});
      path.parentElement!.append(ink,dot);traces.push({path,ink,dot,length});
    });
    const reaction=element('circle',{cx:'642',cy:'354',r:'12',stroke:svg.dataset.motionColor||'#176b4d','stroke-width':'1.1',fill:'none',opacity:'0'});svg.append(reaction);
    const score:Score={book,stage,page,svg,items,traces,time:0,visible:false,x:0,y:0,tx:0,ty:0,vx:0,vy:0,energy:0,reaction,px:642,py:354,age:10};scores.push(score);
  });
  const books=[...document.querySelectorAll<HTMLElement>('[data-notebook]')];
  function wake(){if(!frame&&running()&&scores.some(eligible)){last=0;frame=requestAnimationFrame(tick);}}
  function paint(s:Score,dt:number){
    s.time+=dt*(1+s.energy*.55);s.energy*=Math.exp(-1.9*dt);s.age+=dt;
    s.vx=(s.vx+(s.tx-s.x)*140*dt)*Math.exp(-16*dt);s.vy=(s.vy+(s.ty-s.y)*140*dt)*Math.exp(-16*dt);s.x+=s.vx*dt;s.y+=s.vy*dt;
    const t=s.time,amplitude=1+s.energy*1.3;
    for(const item of s.items){const {el,base,kind,index,cx,cy}=item,phase=t*.85+index*.9;
      if(kind==='parallax')el.setAttribute('transform',`${base} translate(${(s.x*12).toFixed(2)} ${(s.y*9+Math.sin(t*.75)*2.5).toFixed(2)})`);
      if(kind==='layer')el.setAttribute('transform',`${base} translate(${(s.x*(index+1)*4+Math.sin(phase)*2).toFixed(2)} ${(Math.sin(phase)*4*amplitude+s.y*(index+1)*3).toFixed(2)})`);
      if(kind==='device')el.setAttribute('transform',`${base} translate(${(s.x*8).toFixed(2)} ${(Math.sin(phase)*4*amplitude+s.y*7).toFixed(2)})`);
      if(kind==='flight')el.setAttribute('transform',`${base} translate(${(Math.sin(t*.55)*12+s.x*27).toFixed(2)} ${(Math.cos(t*.8)*8+s.y*22).toFixed(2)}) rotate(${(Math.sin(t*.6)*2+s.x*5).toFixed(2)})`);
      if(kind==='rotor')el.setAttribute('transform',`${base} rotate(${(t*135+index*45)%360} ${cx} ${cy})`);
      if(kind==='orbit')el.setAttribute('transform',`${base} rotate(${(t*(index?-8:7)+s.x*8).toFixed(2)} ${cx} ${cy})`);
      if(kind==='ledger'){el.setAttribute('stroke-dasharray','330');el.setAttribute('stroke-dashoffset',String(Math.max(0,1-Math.min(1,(t-index*.12)/1.25))*330));el.setAttribute('opacity',String(.24+Math.max(0,Math.cos(t*1.5-index*1.2))*.34));}
      if(kind==='focus')el.setAttribute('stroke-dashoffset',String(-t*14));
      if(kind==='wave')el.setAttribute('d',Array.from({length:130},(_,i)=>`${i?'L':'M'}${66+i*5.9},${(394-Math.sin(i*.14+t*.7)*32-(i%30)*3.6-Math.sin(i*.07-t*.9)*6*amplitude-s.y*8).toFixed(2)}`).join(' '));
    }
    for(let i=0;i<s.traces.length;i++){const tr=s.traces[i],progress=(t/(4.8+i*.75)+i*.31)%1;tr.ink.setAttribute('stroke-dashoffset',String(-progress*tr.length));const p=tr.path.getPointAtLength(progress*tr.length);tr.dot.setAttribute('cx',p.x.toFixed(2));tr.dot.setAttribute('cy',p.y.toFixed(2));tr.dot.setAttribute('r',String((i?2.8:4)+s.energy*2));}
    s.reaction.setAttribute('cx',String(s.px));s.reaction.setAttribute('cy',String(s.py));s.reaction.setAttribute('r',String(12+Math.min(1,s.age/1.2)*100));s.reaction.setAttribute('opacity',String(Math.max(0,(1-s.age/1.2)*.65)));
    s.book.dataset.illustrationTime=t.toFixed(2);
  }
  function tick(now:number){frame=0;if(!running())return;if(last&&now-last<32){frame=requestAnimationFrame(tick);return;}const dt=last?Math.min(.05,(now-last)/1000):1/30;last=now;let active=false;for(const s of scores)if(eligible(s)){paint(s,dt);active=true;}if(active){root.dataset.notebookMotionFrames=String(Number(root.dataset.notebookMotionFrames||0)+1);frame=requestAnimationFrame(tick);}}
  function reset(s:Score){s.x=s.y=s.tx=s.ty=s.vx=s.vy=s.energy=0;s.age=10;s.items.forEach(({el,base,kind})=>{if(kind!=='wave')el.setAttribute('transform',base);if(kind==='ledger'){el.setAttribute('stroke-dashoffset','0');el.setAttribute('opacity','.28');}});s.reaction.setAttribute('opacity','0');}
  function replay(book:HTMLElement){const s=scores.find(s=>s.book===book&&!s.page.hidden);if(s){s.time=0;s.energy=1;s.age=0;s.px=642;s.py=354;paint(s,0);wake();}else{book.querySelector('[data-drone-study]')?.dispatchEvent(new CustomEvent('portfolio:replay-drone'));book.querySelectorAll<HTMLElement>('.project-visual,.hero-fallback').forEach(el=>el.getAnimations({subtree:true}).forEach(a=>a.currentTime=0));book.closest('[data-hero-art]')?.dispatchEvent(new CustomEvent('portfolio:hero-pulse'));}book.dataset.illustrationReplay=String(Number(book.dataset.illustrationReplay||0)+1);}
  for(const book of books){
    const stage=book.querySelector<HTMLElement>('[data-notebook-surface]')!,button=book.querySelector<HTMLButtonElement>('[data-notebook-play]');
    button?.removeAttribute('hidden');
    button?.addEventListener('click',()=>{if(running())replay(book);},{signal});
    stage.addEventListener('pointermove',event=>{if(!fine.matches||!running()||event.pointerType!=='mouse')return;const s=scores.find(s=>s.book===book&&!s.page.hidden);if(!s)return;const r=stage.getBoundingClientRect();s.tx=(event.clientX-r.left)/r.width-.5;s.ty=(event.clientY-r.top)/r.height-.5;s.energy=Math.max(s.energy,.28);wake();},{signal,passive:true});
    stage.addEventListener('pointerleave',()=>{for(const s of scores)if(s.book===book)s.tx=s.ty=0;wake();},{signal});
    stage.addEventListener('pointerdown',event=>{if(!running()||(event.target as Element).closest('button,a,[data-drone-study]'))return;const s=scores.find(s=>s.book===book&&!s.page.hidden);if(!s)return;const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(s.svg.getScreenCTM()!.inverse());s.px=point.x;s.py=point.y;s.age=0;s.energy=1;wake();},{signal,passive:true});
    let previousPage=book.dataset.page;const observer=new MutationObserver(()=>{if(previousPage!==book.dataset.page){previousPage=book.dataset.page;const s=scores.find(s=>s.book===book&&!s.page.hidden);if(s){s.time=0;s.energy=.65;s.age=10;}}wake();});observer.observe(book,{attributes:true,attributeFilter:['data-page','data-paper-painted']});observers.push(observer);
  }
  const visibility=new IntersectionObserver(entries=>{for(const entry of entries)for(const s of scores)if(s.stage===entry.target)s.visible=entry.isIntersecting;wake();},{threshold:.01});books.forEach(b=>visibility.observe(b.querySelector('[data-notebook-surface]')!));
  function preference(){cancelAnimationFrame(frame);frame=0;for(const s of scores)reset(s);books.forEach(b=>{const button=b.querySelector<HTMLButtonElement>('[data-notebook-play]');if(button)button.disabled=!running();});wake();}
  const changes=new MutationObserver(preference);changes.observe(root,{attributes:true,attributeFilter:['data-motion']});document.addEventListener('visibilitychange',preference,{signal});preference();
  return {dispose(){disposed=true;cancelAnimationFrame(frame);aborter.abort();visibility.disconnect();changes.disconnect();observers.forEach(o=>o.disconnect());scores.forEach(s=>{reset(s);s.reaction.remove();s.traces.forEach(t=>{t.ink.remove();t.dot.remove();});});}};
}
