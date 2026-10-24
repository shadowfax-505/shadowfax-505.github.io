import manropeURL from '@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2?url';
import serifURL from '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2?url';
import italicURL from '@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2?url';
import monoURL from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url';

/** Print artwork from the site's existing vectors, type and authentic images. No DOM screenshots. */
export type PaperPrint = { front: HTMLCanvasElement; reverse: HTMLCanvasElement };
const ink = '#1b2126', accent = '#176b4d', signal = '#a35a22', paper = '#eef0e8';
const serif = '"Instrument Serif", Georgia, serif';
const mono = '"IBM Plex Mono", monospace';
const sans = '"Manrope Variable", sans-serif';

let fontCSS:Promise<string>|undefined;
const dataURLs=new Map<string,Promise<string>>();
function dataURL(url:string){let promise=dataURLs.get(url);if(!promise){promise=fetch(url).then(r=>{if(!r.ok)throw new Error('Print asset unavailable');return r.blob();}).then(blob=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);}));dataURLs.set(url,promise);}return promise;}
function printFonts(){return fontCSS??=Promise.all([
  [manropeURL,'Manrope Variable','normal','100 900'],[serifURL,'Instrument Serif','normal','400'],
  [italicURL,'Instrument Serif','italic','400'],[monoURL,'IBM Plex Mono','normal','400'],
  ['/fonts/noto-sans-syloti-nagri-400.ttf','Noto Sans Syloti Nagri','normal','400'],
].map(async([url,family,style,weight])=>'@font-face{font-family:"'+family+'";font-style:'+style+';font-weight:'+weight+';src:url("'+await dataURL(url)+'");}')).then(styles=>styles.join(''));}
function printWidth(element:HTMLElement){const width=element.closest('[data-notebook-surface]')?.getBoundingClientRect().width||element.getBoundingClientRect().width||900;return Math.min(2560,Math.max(1000,Math.ceil(width*Math.min(devicePixelRatio,2.25)*1.15)));}
function sheet(width = 900, height = 1000, color = paper) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color; ctx.fillRect(0, 0, width, height);
  // Deterministic fibres, laid into the print so they remain attached while it bends.
  let seed = 2941;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  ctx.strokeStyle = '#726448'; ctx.lineWidth = .55;
  for (let i = 0; i < 3200; i++) {
    const x = random() * width, y = random() * height;
    ctx.globalAlpha = .018 + random() * .034;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + random() * 4 + .3, y + random() * 1.5); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  return { canvas, ctx };
}
function reverseOf(front: HTMLCanvasElement) {
  const { canvas, ctx } = sheet(front.width, front.height);
  // The reverse is the same stock: only a trace of this sheet's own ink shows through.
  ctx.save(); ctx.translate(front.width, 0); ctx.scale(-1, 1);
  ctx.globalAlpha = .035; ctx.drawImage(front, 0, 0); ctx.restore();
  return canvas;
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size = 12, color = '#756e60') {
  ctx.fillStyle = color; ctx.font = `${size}px ${mono}`; ctx.fillText(text, x, y);
}

/** Resolve vector paint, not layout or HTML. External content is never captured. */
async function vectorImage(source: SVGSVGElement, form?: number, pixels=1800): Promise<HTMLImageElement> {
  const clone = source.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const originals = [...source.querySelectorAll('*')], copies = [...clone.querySelectorAll('*')];
  copies.forEach((element, i) => {
    const computed = getComputedStyle(originals[i]);
    for (const property of ['fill', 'stroke', 'stroke-width', 'font-family', 'font-size', 'font-style', 'font-weight', 'letter-spacing']) {
      const value = computed.getPropertyValue(property); if (value) element.setAttribute(property, value);
    }
    element.removeAttribute('style');
  });
  clone.querySelectorAll('.hero-interaction-marks,.atlas-flow-packets,.atlas-stock-marker,.living-evidence-packets,.living-gas-packet,.living-alarm,.living-fan,.living-web,.living-sweep,.living-sweep-glow').forEach(e => e.remove());
  if (form !== undefined) {
    clone.querySelectorAll('.hero-form').forEach((group, i) => {
      if (i !== form) group.remove(); else { group.setAttribute('opacity', '1'); group.querySelectorAll('path').forEach(p => { p.removeAttribute('stroke-dasharray'); p.removeAttribute('stroke-dashoffset'); }); }
    });
  }
  const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent=await printFonts();clone.prepend(style);
  await Promise.all([...clone.querySelectorAll('image')].map(async image=>{const href=image.getAttribute('href');if(href&&!href.startsWith('data:'))image.setAttribute('href',await dataURL(href));}));
  clone.removeAttribute('class'); clone.removeAttribute('style');
  const view = source.viewBox.baseVal;
  clone.setAttribute('width', String(pixels)); clone.setAttribute('height', String(Math.ceil(pixels*(view.height||500)/(view.width||800))));
  const svg = new XMLSerializer().serializeToString(clone).replace(/var\(--accent\)/g, accent).replace(/var\(--signal\)/g, signal).replace(/var\(--paper\)/g, paper).replace(/currentColor/g, ink);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image(); img.src = url; await img.decode(); return img;
  } finally { URL.revokeObjectURL(url); }
}

export async function printHero(element: HTMLElement): Promise<PaperPrint[]> {
  const source = element.querySelector<SVGSVGElement>('.hero-fallback');
  if (!source) throw new Error('Missing source artwork');
  const images = await Promise.all([0, 1, 2].map(form => vectorImage(source, form)));
  const results: PaperPrint[] = [];
  for (const [i, image] of images.entries()) {
    const { canvas, ctx } = sheet(1080, 800);
    ctx.strokeStyle = '#9b8d7019'; ctx.lineWidth = 1;
    for (let x = 70; x < 1080; x += 42) { ctx.beginPath(); ctx.moveTo(x, 50); ctx.lineTo(x, 750); ctx.stroke(); }
    for (let y = 50; y < 800; y += 42) { ctx.beginPath(); ctx.moveTo(70, y); ctx.lineTo(1010, y); ctx.stroke(); }
    label(ctx, `FIG. 001 / ${['SIGNAL', 'CIRCUIT', 'CONSTELLATION'][i]}`, 70, 68, 15, accent);
    ctx.drawImage(image, 85, 75, 910, 650);
    label(ctx, 'AN IDEA, GIVEN A LITTLE ROOM TO MOVE.', 70, 744, 12);
    results.push({ front: canvas, reverse: reverseOf(canvas) });
    // Give input and document rendering a turn between printed forms.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return results;
}

export async function printAtlas(element: HTMLElement): Promise<PaperPrint[]> {
  await document.fonts.load('60px "Noto Sans Syloti Nagri"', 'ꠇꠈꠉ');
  const results: PaperPrint[] = [];
  for (let i = 0; i < 3; i++) {
    const { canvas, ctx } = sheet(820, 1040, i === 1 ? '#eef0e7' : paper);
    for (let y = 86; y < 985; y += 64) { ctx.strokeStyle = '#b3a89135'; ctx.beginPath(); ctx.moveTo(45, y); ctx.lineTo(775, y); ctx.stroke(); }
    ctx.strokeStyle = '#176b4d40'; ctx.beginPath(); ctx.moveTo(83, 35); ctx.lineTo(83, 1005); ctx.stroke();
    label(ctx, `RESEARCH / 0${i + 1}`, 110, 65, 14);
    if (i === 0) {
      ctx.fillStyle = accent; ctx.font = '345px "Noto Sans Syloti Nagri", sans-serif'; ctx.fillText('ꠇ', 220, 430);
      ctx.save(); ctx.translate(540, 210); ctx.rotate(.12); ctx.fillStyle = signal; ctx.font = `italic 48px ${serif}`; ctx.fillText('a script,', 0, 0); ctx.fillText('remembered.', -30, 49); ctx.restore();
      const glyphs = [...element.querySelectorAll<HTMLElement>('[data-atlas-glyph]')];
      glyphs.forEach((glyph, n) => { ctx.fillStyle = n % 4 === 0 ? accent : ink; ctx.font = '60px "Noto Sans Syloti Nagri", sans-serif'; ctx.fillText(glyph.textContent || '', 140 + (n % 6) * 96, 625 + Math.floor(n / 6) * 110); });
      label(ctx, 'SYLHETI NAGRI / MODERN TYPE SPECIMEN', 110, 955, 13);
      label(ctx, 'HISTORICAL QUESTIONS. NEW WAYS TO READ.', 110, 985, 11);
    } else {
      const title = i === 1 ? ['enough,', 'at the right time.'] : ['a line becomes', 'a language.'];
      ctx.fillStyle = i === 1 ? signal : accent; ctx.font = `66px ${sans}`; ctx.fillText(title[0], 95, 183); ctx.font = `italic 90px ${serif}`; ctx.fillText(title[1], 95, 272);
      const svg = element.querySelector<SVGSVGElement>(i === 1 ? '.atlas-inventory svg' : '.atlas-compiler svg');
      if (svg) ctx.drawImage(await vectorImage(svg), 10, 330, 800, 560);
      label(ctx, i === 1 ? 'INVENTORY / ILLUSTRATIVE POLICY SKETCH' : 'SOURCE → STRUCTURE → MEANING', 110, 955, 12);
      label(ctx, 'A RESEARCH QUESTION, NOT A RESEARCH RESULT.', 110, 985, 10);
    }
    results.push({ front: canvas, reverse: reverseOf(canvas) });
  }
  return results;
}

export async function printProject(visual: HTMLElement): Promise<PaperPrint[]> {
  const stage=visual.closest<HTMLElement>('[data-notebook-surface]')!,bounds=stage.getBoundingClientRect();
  const width=bounds.width||900,height=bounds.height||620,pixels=printWidth(visual);
  // Measure only this original artwork in its existing style context, including hidden covers.
  // Reprint its semantic vector, type and image parts; never rasterize an HTML document.
  const context=document.createElement('div');context.className=visual.closest('.work-card,.case-notebook')?.className||'case-notebook';
  context.setAttribute('aria-hidden','true');context.inert=true;
  context.style.cssText=`position:fixed;display:block!important;margin:0!important;padding:0!important;gap:0!important;left:-20000px;top:0;width:${width}px;height:${height}px;contain:layout style paint;pointer-events:none;visibility:hidden`;
  const page=document.createElement('div');page.className='notebook-page';page.style.cssText='position:relative;width:100%;height:100%;';
  const copy=visual.cloneNode(true) as HTMLElement;copy.style.cssText='position:relative!important;inset:auto!important;width:100%!important;height:100%!important;min-height:0!important;aspect-ratio:auto!important;transform:none!important;clip-path:none!important;margin:0!important;visibility:visible';
  copy.querySelectorAll<HTMLElement>('[id]').forEach(el=>el.removeAttribute('id'));
  copy.querySelectorAll<HTMLElement>('*').forEach(el=>{el.style.setProperty('animation','none','important');el.style.setProperty('transition','none','important');el.style.setProperty('translate','none','important');});
  const drone=copy.querySelector<HTMLElement>('[data-drone-study]');if(drone){delete drone.dataset.webgl;drone.querySelectorAll('canvas,[data-drone-controls],[data-drone-orbit]').forEach(el=>el.remove());}
  page.append(copy);context.append(page);document.body.append(context);
  try{
    const rect=copy.getBoundingClientRect(),{canvas,ctx}=sheet(pixels,Math.round(pixels*height/width),getComputedStyle(copy).backgroundColor);ctx.scale(pixels/width,pixels/width);
    const local=(el:Element)=>{const r=el.getBoundingClientRect();return{x:r.left-rect.left,y:r.top-rect.top,width:r.width,height:r.height};};
    const font=(el:Element)=>{const c=getComputedStyle(el);ctx.font=`${c.fontStyle} ${c.fontWeight} ${c.fontSize} ${c.fontFamily}`;ctx.fillStyle=c.color;ctx.letterSpacing=c.letterSpacing==='normal'?'0px':c.letterSpacing;return c;};
    const box=(el:HTMLElement,paint:(w:number,h:number)=>void)=>{
      const r=local(el),w=el.offsetWidth,h=el.offsetHeight,m=new DOMMatrix(getComputedStyle(el).transform==='none'?undefined:getComputedStyle(el).transform);
      ctx.save();ctx.translate(r.x+r.width/2,r.y+r.height/2);ctx.rotate(Math.atan2(m.b,m.a));ctx.translate(-w/2,-h/2);paint(w,h);ctx.restore();
    };
    for(const el of copy.querySelectorAll<HTMLElement>('.paper-back,.browser-frame,.artifact-annotation,.civic-records>span'))box(el,(w,h)=>{
      const c=getComputedStyle(el);if(c.backgroundColor!=='rgba(0, 0, 0, 0)'){ctx.fillStyle=c.backgroundColor;ctx.fillRect(0,0,w,h);}if(parseFloat(c.borderTopWidth)){ctx.strokeStyle=c.borderTopColor;ctx.lineWidth=parseFloat(c.borderTopWidth);ctx.strokeRect(.5,.5,w-1,h-1);}
    });
    const browser=copy.querySelector<HTMLElement>('.browser-frame'),image=browser?.querySelector<HTMLImageElement>('img');
    if(browser&&image){await image.decode();box(browser,(w,h)=>{const bar=browser.querySelector<HTMLElement>('.browser-bar'),bh=bar?.offsetHeight||23;ctx.drawImage(image,1,bh,w-2,h-bh-1);if(bar){ctx.strokeStyle=getComputedStyle(bar).borderBottomColor;ctx.beginPath();ctx.moveTo(0,bh);ctx.lineTo(w,bh);ctx.stroke();font(bar);ctx.textBaseline='middle';ctx.fillText('researchhub / discover',10,bh/2);ctx.fillText('↗',w-18,bh/2);}});}
    for(const svg of copy.querySelectorAll<SVGSVGElement>('svg')){
      const r=local(svg);if(!r.width||!r.height||svg.closest('.browser-frame,[data-drone-controls]'))continue;
      const v=svg.viewBox.baseVal;if(!v.width||!v.height)continue;const scale=Math.min(r.width/v.width,r.height/v.height),w=v.width*scale,h=v.height*scale;
      ctx.drawImage(await vectorImage(svg,undefined,pixels),r.x+(r.width-w)/2,r.y+(r.height-h)/2,w,h);
    }
    const face=copy.querySelector<HTMLElement>('.focus-face');
    if(face)box(face,(w,h)=>{
      const c=getComputedStyle(face);ctx.strokeStyle=c.borderTopColor;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(w/2,h/2,w/2-.5,h/2-.5,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([1,4]);ctx.globalAlpha=.35;ctx.beginPath();ctx.ellipse(w/2,h/2,w/2-9,h/2-9,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.ellipse(w/2,h/2,w*.42,h*.42,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
      const timer=face.querySelector<HTMLElement>('strong')!;font(timer);ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillText('25:00',w/2,timer.offsetTop+timer.offsetHeight/2);
      const notes=[...face.querySelectorAll<HTMLElement>(':scope>.eyebrow')];notes.forEach(note=>{font(note);ctx.fillText(note.textContent||'',w/2,note.offsetTop+note.offsetHeight/2);});
      const track=face.querySelector<HTMLElement>('.focus-track');if(track){ctx.fillStyle='#1b212630';ctx.fillRect((w-track.offsetWidth)/2,track.offsetTop,track.offsetWidth,2);ctx.fillStyle=ink;ctx.fillRect((w-track.offsetWidth)/2,track.offsetTop,track.offsetWidth*.43,2);}ctx.textAlign='left';
    });
    const annotation=copy.querySelector<HTMLElement>('.artifact-annotation');
    if(annotation)box(annotation,()=>{
      const c=font(annotation),x=parseFloat(c.paddingLeft),y=parseFloat(c.paddingTop),size=parseFloat(c.fontSize);
      ctx.textBaseline='alphabetic';ctx.fillText('follow an idea',x,y+size*.8);
      const em=annotation.querySelector('em')!;font(em);ctx.fillText(em.textContent||'',x,y+size*.9+parseFloat(getComputedStyle(em).fontSize)*.8);
    });
    const side=copy.querySelector<HTMLElement>('.zen-side-note');
    if(side)box(side,(w)=>{
      const c=font(side),size=parseFloat(c.fontSize);ctx.textBaseline='middle';
      if(c.writingMode.startsWith('vertical')){ctx.translate(w-size*.55,0);ctx.rotate(Math.PI/2);ctx.fillText('DESKTOP',0,0);ctx.fillText('+ ANDROID',0,size*1.4);}
      else{ctx.fillText('DESKTOP',0,size*.7);ctx.fillText('+ ANDROID',0,size*2.1);}
    });
    const walker=document.createTreeWalker(copy,NodeFilter.SHOW_TEXT);
    for(let node=walker.nextNode();node;node=walker.nextNode()){
      const el=node.parentElement!,text=node.textContent||'';
      if(!text.trim()||el.closest('svg,.focus-face,.browser-frame,.artifact-annotation,.zen-side-note,[data-drone-controls],.drone-badge,.drone-legend'))continue;
      const c=font(el);ctx.textBaseline='alphabetic';
      if(c.writingMode.startsWith('vertical')){
        const range=document.createRange();range.selectNodeContents(node);const r=range.getBoundingClientRect();
        if(r.width&&r.height){ctx.save();ctx.translate(r.left-rect.left+r.width/2,r.top-rect.top);ctx.rotate(Math.PI/2);ctx.textBaseline='middle';ctx.fillText(c.textTransform==='uppercase'?text.trim().toUpperCase():text.trim(),0,0);ctx.restore();}continue;
      }
      // DOM ranges retain the original line breaks, even in compact captions.
      // They measure our own text only; the print remains a semantic composition.
      const range=document.createRange(),lines:{text:string;x:number;y:number}[]=[];
      for(let i=0;i<text.length;i++){
        range.setStart(node,i);range.setEnd(node,i+1);const r=range.getBoundingClientRect();if(!r.width||!r.height)continue;
        const last=lines.at(-1);if(last&&Math.abs(last.y-r.top)<1)last.text+=text[i];else lines.push({text:text[i],x:r.left,y:r.top});
      }
      for(const line of lines){const value=line.text.replace(/\s+/g,' '),metrics=ctx.measureText(value);ctx.fillText(c.textTransform==='uppercase'?value.toUpperCase():value,line.x-rect.left,line.y-rect.top+(metrics.fontBoundingBoxAscent||parseFloat(c.fontSize)*.8));}
    }
    return [{front:canvas,reverse:reverseOf(canvas)}];
  }finally{context.remove();}
}

/** Print one notebook leaf on demand; content remains independently readable in HTML. */
export async function printNotebookPage(root: HTMLElement, index: number): Promise<PaperPrint> {
  const page = root.querySelector<HTMLElement>(`[data-notebook-page="${index}"]`);
  if (!page) throw new Error('Notebook page is missing');
  const kind = page.dataset.printKind;
  if (kind && kind !== 'vector' && kind !== 'hero') {
    const visual = page.querySelector<HTMLElement>('.project-visual');
    if (visual) return (await printProject(visual))[0];
  }
  const source = page.querySelector<SVGSVGElement>('svg');
  if (!source) throw new Error('Notebook artwork is missing');
  if (source.classList.contains('art-glyph')) await document.fonts.load('60px "Noto Sans Syloti Nagri"', 'ꠇꠈꠉ');
  const pixels=printWidth(page);const view=source.viewBox.baseVal;const rect=root.querySelector('[data-notebook-surface]')!.getBoundingClientRect();const { canvas, ctx } = sheet(pixels, Math.round(pixels*(rect.width>0?rect.height/rect.width:view.height/view.width)),getComputedStyle(source).backgroundColor==='rgba(0, 0, 0, 0)'?paper:getComputedStyle(source).backgroundColor);
  const image = await vectorImage(source, kind === 'hero' ? Number(root.closest<HTMLElement>('[data-hero-art]')?.dataset.formState || 0) : undefined,pixels);
  const scale=Math.min(canvas.width/view.width,canvas.height/view.height);const w=view.width*scale,h=view.height*scale;ctx.drawImage(image,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
  return { front: canvas, reverse: reverseOf(canvas) };
}
