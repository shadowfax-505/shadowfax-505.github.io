/** Small event-driven springs. No render loop runs while the page is resting. */
export function createTactileMotion() {
  const root=document.documentElement;
  const fine=matchMedia('(hover: hover) and (pointer: fine)');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const hero=document.querySelector<HTMLElement>('.hero');
  const art=document.querySelector<HTMLElement>('[data-hero-art]');
  const pulseButton=art?.querySelector<HTMLButtonElement>('[data-art-pulse]');
  const coordinates=art?.querySelector<HTMLElement>('[data-art-coordinates]');
  const cursor=art?.querySelector<SVGGElement>('[data-art-cursor]');
  const circles=Array.from(art?.querySelectorAll<SVGCircleElement>('[data-art-ripple]')||[]);
  const cards=Array.from(document.querySelectorAll<HTMLElement>('.work-card'));
  const contact=document.querySelector<HTMLElement>('.contact-main');
  const orb=contact?.querySelector<HTMLElement>('.contact-orb');
  type Spring={x:number;y:number;vx:number;vy:number;tx:number;ty:number;paint:(x:number,y:number)=>void;visible:boolean};
  const springs:Spring[]=[];
  const cleanup:Array<()=>void>=[];
  const watched=new Map<Element,Spring[]>();
  const pulses:Array<{element:SVGCircleElement;age:number;x:number;y:number}>=[];
  let frame=0,last=0,disposed=false,pulseIndex=0;
  const motion=()=>root.dataset.motion==='on'&&!reduced.matches&&!document.hidden;
  function listen(target:EventTarget,type:string,callback:EventListener,options?:AddEventListenerOptions){target.addEventListener(type,callback,options);cleanup.push(()=>target.removeEventListener(type,callback,options));}
  function make(element:Element,paint:Spring['paint']){const state:Spring={x:0,y:0,vx:0,vy:0,tx:0,ty:0,paint,visible:true};springs.push(state);watched.set(element,[...(watched.get(element)||[]),state]);return state;}
  function wake(){if(!frame&&motion()&&!disposed){last=performance.now();frame=requestAnimationFrame(tick);}}
  function target(s:Spring,x:number,y:number){if(!motion()||!s.visible)return;s.tx=x;s.ty=y;wake();}
  function rest(s:Spring){s.tx=s.ty=0;wake();}
  function tick(now:number){frame=0;if(!motion()||disposed)return;const dt=Math.max(0,Math.min((now-last)/1000,.035));last=now;let moving=false;
    for(const s of springs){if(!s.visible)continue;s.vx=(s.vx+(s.tx-s.x)*180*dt)*Math.exp(-17*dt);s.vy=(s.vy+(s.ty-s.y)*180*dt)*Math.exp(-17*dt);s.x+=s.vx*dt;s.y+=s.vy*dt;const active=Math.abs(s.x-s.tx)+Math.abs(s.y-s.ty)+Math.abs(s.vx)+Math.abs(s.vy)>.002;if(!active){s.x=s.tx;s.y=s.ty;s.vx=s.vy=0;}s.paint(s.x,s.y);moving ||= active;}
    for(let i=pulses.length-1;i>=0;i--){const p=pulses[i];p.age+=dt;const t=p.age/1.25;p.element.setAttribute('r',String(8+t*170));p.element.setAttribute('opacity',String(Math.max(0,(1-t)*.5)));if(t>=1)pulses.splice(i,1);else moving=true;}
    if(moving)frame=requestAnimationFrame(tick);
  }
  if(hero){const type=make(hero,(x,y)=>{hero.style.setProperty('--type-x',`${x*5}px`);hero.style.setProperty('--type-y',`${y*3}px`);hero.style.setProperty('--echo-x',`${-x*11}px`);hero.style.setProperty('--echo-y',`${-y*8}px`);hero.style.setProperty('--echo-opacity',String(Math.min(.28,(Math.abs(x)+Math.abs(y))*.22)));});
    listen(hero,'pointermove',((event:PointerEvent)=>{if(!fine.matches||event.pointerType==='touch')return;const b=hero.getBoundingClientRect();target(type,(event.clientX-b.left)/b.width-.5,(event.clientY-b.top)/b.height-.5);}) as EventListener,{passive:true});listen(hero,'pointerleave',()=>rest(type));}
  if(art){art.dataset.tactileReady='';const field=make(art,(x,y)=>{art.style.setProperty('--field-rx',`${-y*17}deg`);art.style.setProperty('--field-ry',`${x*20}deg`);art.style.setProperty('--field-rz',`${x*6}deg`);cursor?.setAttribute('transform',`translate(${270+x*500} ${215+y*390})`);});
    function pulse(x=0,y=0){if(!motion()||!field.visible||!circles.length)return;const element=circles[pulseIndex++%circles.length];const previous=pulses.findIndex(p=>p.element===element);if(previous>=0)pulses.splice(previous,1);element.setAttribute('cx',String(270+x*500));element.setAttribute('cy',String(215+y*390));pulses.push({element,age:0,x,y});field.vx+=x*4+1.2;field.vy+=y*4-1.2;art!.dispatchEvent(new CustomEvent('portfolio:hero-pulse',{detail:{x,y}}));wake();}
    listen(art,'pointermove',((event:PointerEvent)=>{if(!fine.matches||event.pointerType==='touch'||!motion())return;const b=art.getBoundingClientRect(),x=(event.clientX-b.left)/b.width-.5,y=(event.clientY-b.top)/b.height-.5;target(field,x,y);cursor?.setAttribute('opacity','.65');if(coordinates)coordinates.textContent=`X ${x>=0?'+':''}${x.toFixed(2)} / Y ${y>=0?'+':''}${y.toFixed(2)}`;}) as EventListener,{passive:true});
    listen(art,'pointerleave',()=>{rest(field);cursor?.setAttribute('opacity','0');if(coordinates)coordinates.textContent='+ 22.90 / 89.50';});
    let down:{x:number;y:number;id:number}|undefined;
    listen(art,'pointerdown',((event:PointerEvent)=>{if((event.target as Element).closest('button,[data-notebook]'))return;down={x:event.clientX,y:event.clientY,id:event.pointerId};}) as EventListener,{passive:true});
    listen(art,'pointerup',((event:PointerEvent)=>{if(!down||event.pointerId!==down.id)return;const tap=Math.hypot(event.clientX-down.x,event.clientY-down.y)<12;down=undefined;if(tap){const b=art.getBoundingClientRect();pulse((event.clientX-b.left)/b.width-.5,(event.clientY-b.top)/b.height-.5);}}) as EventListener,{passive:true});
    listen(art,'pointercancel',()=>{down=undefined;});
    if(pulseButton){pulseButton.hidden=false;listen(pulseButton,'click',()=>pulse());}
    const formObserver=new MutationObserver(()=>{if(motion())pulse();});formObserver.observe(art,{attributes:true,attributeFilter:['data-form-state']});cleanup.push(()=>formObserver.disconnect());
  }
  for(const card of cards){card.dataset.tactileReady='';const s=make(card,(x,y)=>{card.style.setProperty('--card-rx',`${-y*6}deg`);card.style.setProperty('--card-ry',`${x*7}deg`);card.style.setProperty('--card-layer-x',`${x*10}px`);card.style.setProperty('--card-layer-y',`${y*8}px`);card.style.setProperty('--card-light',String(Math.min(.35,(Math.abs(x)+Math.abs(y))*.6)));});
    listen(card,'pointermove',((event:PointerEvent)=>{if(!fine.matches||event.pointerType==='touch'||!motion())return;const visual=card.querySelector<HTMLElement>('.project-visual');if(!visual)return;const b=visual.getBoundingClientRect(),x=Math.max(-.5,Math.min(.5,(event.clientX-b.left)/b.width-.5)),y=Math.max(-.5,Math.min(.5,(event.clientY-b.top)/b.height-.5));card.style.setProperty('--card-x',`${(x+.5)*100}%`);card.style.setProperty('--card-y',`${(y+.5)*100}%`);target(s,x,y);}) as EventListener,{passive:true});listen(card,'pointerleave',()=>rest(s));listen(card,'focus',()=>{if(fine.matches)target(s,.18,-.15);});listen(card,'blur',()=>rest(s));}
  if(contact&&orb){const s=make(contact,(x,y)=>{orb.style.setProperty('--orb-x',`${x*12}px`);orb.style.setProperty('--orb-y',`${y*12}px`);orb.style.setProperty('--orb-angle',`${x*22-y*12}deg`);});listen(contact,'pointermove',((event:PointerEvent)=>{if(!fine.matches||event.pointerType==='touch')return;const b=orb.getBoundingClientRect(),dx=event.clientX-b.left-b.width/2,dy=event.clientY-b.top-b.height/2;const distance=Math.hypot(dx,dy),pull=Math.max(0,1-distance/260);target(s,dx/100*pull,dy/100*pull);}) as EventListener,{passive:true});listen(contact,'pointerleave',()=>rest(s));}
  function reset(){cancelAnimationFrame(frame);frame=0;pulses.length=0;circles.forEach(c=>c.setAttribute('opacity','0'));cursor?.setAttribute('opacity','0');if(coordinates)coordinates.textContent='+ 22.90 / 89.50';for(const s of springs){s.x=s.y=s.tx=s.ty=s.vx=s.vy=0;s.paint(0,0);}if(pulseButton)pulseButton.disabled=!motion();}
  const visibility=new IntersectionObserver(entries=>{for(const entry of entries)for(const s of watched.get(entry.target)||[]){s.visible=entry.isIntersecting;if(!s.visible){s.x=s.y=s.tx=s.ty=s.vx=s.vy=0;s.paint(0,0);}}},{rootMargin:'30px'});watched.forEach((_v,k)=>visibility.observe(k));
  const motionObserver=new MutationObserver(reset);motionObserver.observe(root,{attributes:true,attributeFilter:['data-motion']});listen(document,'visibilitychange',reset);listen(reduced,'change',reset);listen(fine,'change',reset);reset();
  return {dispose(){disposed=true;reset();visibility.disconnect();motionObserver.disconnect();cleanup.forEach(fn=>fn());}};
}
