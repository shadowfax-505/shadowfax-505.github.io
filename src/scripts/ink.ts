/** Deliberately placed pen flourishes: editorial linework, with restrained ink response. */
export function createInkMotion(){
  const root=document.documentElement,aborter=new AbortController(),{signal}=aborter;
  const ns='http://www.w3.org/2000/svg';
  const designs={
    rule:{view:'0 0 240 34',paths:['M3 22C49 18 131 19 230 15','M217 13c7 0 13 .7 19 2.1']},
    flourish:{view:'0 0 300 52',paths:['M4 35C61 17 172 17 274 24c11 .8 17-1 21-5','M24 40c59-11 147-11 203-10']},
    compass:{view:'0 0 100 100',paths:['M20 71C5 39 24 13 55 15c24 2 37 22 28 42-7 16-27 20-42 13','M29 74 73 26M68 26h6v6','M17 48h10m24-33v10m30 23h9']},
    arrow:{view:'0 0 180 42',paths:['M4 28c39-4 106-2 161-12','M152 9c4 3 9 6 15 7-5 3-8 7-11 11']},
  };
  type Kind=keyof typeof designs;
  type Mark={host:HTMLElement;svg:SVGSVGElement;x:number;y:number;tx:number;ty:number;vx:number;vy:number;visible:boolean};
  const marks:Mark[]=[];let frame=0,previous=0,disposed=false;
  const moving=()=>root.dataset.motion==='on'&&!document.hidden&&!disposed;
  const fine=matchMedia('(pointer:fine)');
  const selectors:[string,Kind][]=[
    ['.desktop-nav a','rule'],
    ['.section-heading h2,.recognition-intro h2,.about-grid h2,.research-brief aside h2,.page-intro h1','compass'],
    ['.case-short,.contact-main h2,.not-found h1','flourish'],
    ['.text-link,.project-open','arrow'],
  ];
  for(const [selector,kind] of selectors)document.querySelectorAll<HTMLElement>(selector).forEach(host=>{
    host.classList.add('ink-host');host.dataset.inkKind=kind;
    const design=designs[kind],svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',design.view);svg.setAttribute('aria-hidden','true');svg.classList.add('ink-mark');svg.dataset.inkVariant=kind;
    design.paths.forEach((d,i)=>{const path=document.createElementNS(ns,'path');path.setAttribute('d',d);path.setAttribute('pathLength','1');path.setAttribute('fill','none');path.style.setProperty('--pen-order',String(i));svg.append(path);});host.append(svg);
    const mark:Mark={host,svg,x:0,y:0,tx:0,ty:0,vx:0,vy:0,visible:false};marks.push(mark);
    host.addEventListener('pointermove',event=>{if(!fine.matches||!moving())return;const r=host.getBoundingClientRect();mark.tx=((event.clientX-r.left)/r.width-.5)*2;mark.ty=((event.clientY-r.top)/r.height-.5)*1.4;wake();},{signal,passive:true});
    host.addEventListener('pointerleave',()=>{mark.tx=mark.ty=0;wake();},{signal});
  });
  function tick(now:number){frame=0;if(!moving())return;const dt=previous?Math.min(.04,Math.max(0,(now-previous)/1000)):1/60;previous=now;let dirty=false;
    for(const m of marks){if(!m.visible)continue;m.vx+=(m.tx-m.x)*100*dt;m.vy+=(m.ty-m.y)*100*dt;const damping=Math.exp(-17*dt);m.vx*=damping;m.vy*=damping;m.x+=m.vx*dt;m.y+=m.vy*dt;m.svg.style.setProperty('--ink-x',m.x+'px');m.svg.style.setProperty('--ink-y',m.y+'px');if(Math.abs(m.tx-m.x)+Math.abs(m.ty-m.y)+Math.abs(m.vx)+Math.abs(m.vy)>.025)dirty=true;}
    if(dirty)frame=requestAnimationFrame(tick);
  }
  function wake(){if(!frame&&moving()){previous=0;frame=requestAnimationFrame(tick);}}
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){const m=marks.find(m=>m.host===entry.target);if(!m)continue;m.visible=entry.isIntersecting;m.host.classList.toggle('ink-visible',entry.isIntersecting);if(entry.isIntersecting)m.host.classList.add('ink-entered');}},{threshold:.1});
  marks.forEach(m=>observer.observe(m.host));
  function reset(){cancelAnimationFrame(frame);frame=0;for(const m of marks){m.x=m.y=m.tx=m.ty=m.vx=m.vy=0;m.svg.style.setProperty('--ink-x','0px');m.svg.style.setProperty('--ink-y','0px');}}
  const preference=new MutationObserver(reset);preference.observe(root,{attributes:true,attributeFilter:['data-motion']});document.addEventListener('visibilitychange',()=>{root.dataset.inkHidden=String(document.hidden);reset();},{signal});
  return {dispose(){disposed=true;reset();aborter.abort();observer.disconnect();preference.disconnect();marks.forEach(m=>{m.svg.remove();m.host.classList.remove('ink-host','ink-visible','ink-entered');delete m.host.dataset.inkKind;});}};
}
