import { createTactileMotion } from './tactile';
import { createPaperExperience } from './paper-entry';
import { createLivingMotion } from './living-motion';
import { createInkMotion } from './ink';
import { createNotebookMotion } from './notebook-motion';
type AnimationContext = { revert: () => void; add: (fn: () => void) => void };
type HeroController = { setEnabled: (enabled: boolean) => void; setForm: (index: number) => void; dispose: () => void };

const root = document.documentElement;
const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
const toggle = document.querySelector<HTMLButtonElement>('[data-motion-toggle]');
let enabled = root.dataset.motion === 'on';
let context: AnimationContext | undefined;
let hero: HeroController | undefined;
let animationGeneration = 0;
// Numbers mid-count when motion is switched off go back to their exact text.
let counted: [HTMLElement, string][] = [];
function restoreCounted() { counted.forEach(([element, text]) => { element.textContent = text; }); counted = []; }
let toastTimer: ReturnType<typeof setTimeout>;
const artwork = document.querySelector<HTMLElement>('[data-hero-art]');
const explore3d = document.querySelector<HTMLButtonElement>('[data-explore-3d]');
const formButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-form]'));
let activeForm = 0;
let loadingHero = false;
let selectedByHand = false;
const paper = createPaperExperience();
const living = createLivingMotion();
const ink = createInkMotion();
const notebookMotion = createNotebookMotion();
const returnPaper = artwork?.querySelector<HTMLButtonElement>('[data-return-paper]');

function notify(message: string) {
  const toast = document.querySelector<HTMLElement>('[data-toast]');
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.dataset.visible = 'true';
  toastTimer = setTimeout(() => { toast.dataset.visible = 'false'; }, 3500);
}

function updateToggle() {
  root.dataset.motion = enabled ? 'on' : 'off';
  toggle?.setAttribute('aria-pressed', String(!enabled));
  toggle?.setAttribute('aria-label', enabled ? 'Motion on — pause motion' : 'Motion off — enable motion');
  if (explore3d) explore3d.disabled = !enabled || loadingHero || artwork?.dataset.webgl === 'unavailable';
  const label = toggle?.querySelector('[data-motion-label]');
  if (label) label.textContent = enabled ? 'Motion on' : 'Motion off';
}

async function animate() {
  const generation = ++animationGeneration;
  context?.revert();
  restoreCounted();
  context = undefined;
  hero?.setEnabled(enabled && artwork?.dataset.heroMode === 'field');
  paper.setEnabled(enabled);
  syncDrones();
  if (!enabled) return;
  try {
    const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
    if (!enabled || generation !== animationGeneration) return;
    gsap.registerPlugin(ScrollTrigger);
    context = gsap.context(() => {
      if (artwork) {
        gsap.from('.hero-line', { y: 28, rotation: -.6, duration: 1.1, stagger: .1, ease: 'power3.out' });
        gsap.from('.hero-kicker > span', { y: 10, opacity: 0, duration: .7, stagger: .08, ease: 'power2.out' });
        gsap.from('.board-studio', { y: 26, opacity: 0, duration: 1.2, delay: .15, ease: 'power3.out', clearProps: 'transform,opacity' });
        gsap.from('.hero-role, .hero-description, .hero-note, .hero-actions > *, .hero-availability', { y: 18, opacity: 0, duration: .9, delay: .3, stagger: .07, ease: 'power3.out', clearProps: 'transform,opacity' });
        gsap.from('.form-signal path', { strokeDasharray: 1, strokeDashoffset: 1, duration: 2.1, stagger: .013, ease: 'power2.inOut' });
      }
    });
    // Everything below the fold is built in idle time, so the first paint and input never wait for it.
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200));
    await new Promise<void>(resolve => idle(() => resolve(), { timeout: 1800 }));
    if (!enabled || generation !== animationGeneration || !context) return;
    context.add(() => {
      // The italic half of each heading arrives a beat after the roman half.
      document.querySelectorAll<HTMLElement>('h2[data-reveal] em, .method-head h3 em, .proof-title em').forEach(element => {
        gsap.from(element, { xPercent: -4, opacity: 0, duration: 1, delay: .18, ease: 'power3.out', scrollTrigger: { trigger: element, start: 'top 95%', once: true } });
      });
      // Numbers count up to their sourced value once, then the exact text is restored.
      document.querySelectorAll<HTMLElement>('.proof-item strong, .case-metric strong, .service-number, .method-number').forEach(element => {
        const text = element.textContent || '';
        if (!/\d/.test(text)) return;
        counted.push([element, text]);
        element.setAttribute('aria-label', text);
        const progress = { p: 0 };
        const paint = () => { element.textContent = text.replace(/\d+(\.\d+)?/g, m => { const v = Number(m) * progress.p; return m.includes('.') ? v.toFixed(1) : String(Math.round(v)).padStart(m.startsWith('0') ? m.length : 1, '0'); }); };
        paint();
        gsap.to(progress, { p: 1, duration: 1.5, ease: 'power3.out', onUpdate: paint, onComplete: () => { element.textContent = text; }, scrollTrigger: { trigger: element, start: 'top 92%', once: true } });
      });
      gsap.utils.toArray<HTMLElement>('.proof-grid, .method-steps, .service-grid, .case-metrics').forEach(group => {
        gsap.from(group.children, { y: 26, opacity: 0, duration: .8, stagger: .09, ease: 'power3.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: group, start: 'top 90%', once: true } });
      });
      // Rules draw across under each step and metric row.
      gsap.utils.toArray<HTMLElement>('.proof-grid, .method-steps, .case-metrics, .service-grid').forEach(group => {
        gsap.from(group, { '--rule-scale': 0, duration: 1.2, ease: 'power2.inOut', scrollTrigger: { trigger: group, start: 'top 92%', once: true } });
      });
      // Real captures and charts wipe in from the bottom, like a sheet being pulled out.
      document.querySelectorAll<HTMLElement>('.case-supplement img, .evidence-frame, .phones, .case-notebook .notebook-stage').forEach(element => {
        gsap.from(element, { clipPath: 'inset(0 0 100% 0)', y: 24, duration: 1.15, ease: 'power3.inOut', clearProps: 'clipPath,transform', scrollTrigger: { trigger: element, start: 'top 92%', once: true } });
      });
      gsap.utils.toArray<HTMLElement>('.next-project h2, .contact-main h2').forEach(element => {
        gsap.from(element, { y: 40, opacity: 0, duration: 1.1, ease: 'power3.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: element, start: 'top 92%', once: true } });
      });
      gsap.utils.toArray<HTMLElement>('.contact-orb').forEach(element => {
        gsap.from(element, { scale: .4, rotation: -90, opacity: 0, duration: 1.2, ease: 'back.out(1.6)', clearProps: 'transform,opacity', scrollTrigger: { trigger: element, start: 'top 95%', once: true } });
      });
      document.querySelectorAll<HTMLElement>('[data-reveal]').forEach(element => {
        // Keep notebook frames out of transformed stacking contexts; their mesh can overflow.
        const target=element.matches('.work-card') ? element.querySelector('.work-card-body') : element;
        gsap.from(target, { y: 30, duration: .85, clearProps:'transform', ease: 'power2.out', scrollTrigger: { trigger: element, start: 'top 95%', once: true } });
      });
      document.querySelectorAll<HTMLElement>('.work-card .project-visual').forEach(element => {
        gsap.from(element, { clipPath: 'inset(0 0 8% 0)', duration: 1.1, ease: 'power2.out', scrollTrigger: { trigger: element, start: 'top 95%', once: true } });
      });
      if (document.querySelector('.atlas-sheets')) {
        gsap.fromTo('.atlas-sheets', { y: 14, rotation: -1 }, { y: -14, rotation: 1.2, ease: 'none', scrollTrigger: { trigger: '.research-spread', start: 'top bottom', end: 'bottom top', scrub: .8 } });
      }
      if (document.querySelector('.recognition-star')) {
        gsap.fromTo('.recognition-star', { rotation: 0 }, { rotation: 70, ease: 'none', scrollTrigger: { trigger: '.recognition-section', start: 'top bottom', end: 'bottom top', scrub: .7 } });
      }
      if (document.querySelector('.future-map')) {
        gsap.from('.future-contours path', { strokeDasharray: 1, strokeDashoffset: 1, duration: 1.65, stagger: .025, ease: 'power2.inOut', scrollTrigger: { trigger: '.future-map', start: 'top 85%', once: true } });
      }
      document.querySelectorAll<HTMLElement>('.process-strip').forEach(element => {
        gsap.from(element.children, { y: 18, duration: .6, stagger: .1, ease: 'power2.out', scrollTrigger: { trigger: element, start: 'top 90%', once: true } });
      });
    });
  } catch {
    // All content stays visible if an optional animation module cannot load.
    context?.revert();
  }
}

async function prepareHero() {
  const element = document.querySelector<HTMLElement>('[data-hero-art]');
  if (!element || hero || !enabled || loadingHero) return;
  loadingHero = true;
  if (explore3d) { explore3d.disabled = true; explore3d.textContent = 'Opening 3D…'; }
  try {
    const { createHero } = await import('./hero');
    if (!hero && enabled) { hero = createHero(element, enabled); hero.setForm(activeForm); }
  } catch { element.dataset.webgl = 'unavailable'; }
  finally {
    loadingHero = false;
    if (element.dataset.webgl === 'unavailable') {
      notify('3D is unavailable here. You can still explore all three forms below.');
      if (explore3d) { explore3d.textContent = '3D unavailable'; explore3d.disabled = true; }
    } else if (hero) {
      paper.setHeroMode('field');
      explore3d?.setAttribute('hidden', '');
      returnPaper?.removeAttribute('hidden');
    }
    else if (explore3d) { explore3d.textContent = 'Particle study ↗'; explore3d.disabled = !enabled; }
  }
}

function selectForm(index: number) {
  activeForm = index;
  if (artwork) artwork.dataset.formState = String(index);
  formButtons.forEach((button,i) => button.setAttribute('aria-pressed', String(i === index)));
  const label = artwork?.querySelector('[data-form-label]');
  if (label) label.textContent = ['FOLDED SIGNAL', 'CIRCUIT TOPOLOGY', 'CONSTELLATION'][index];
  hero?.setForm(index);
}
formButtons.forEach(button => button.addEventListener('click', () => { selectedByHand = true; paper.selectPage('hero',0); selectForm(Number(button.dataset.form)); }));
artwork?.querySelector('[data-form-controls]')?.removeAttribute('hidden');
explore3d?.removeAttribute('hidden');
explore3d?.addEventListener('click', () => { if(hero) { paper.setHeroMode('field'); hero.setEnabled(enabled); explore3d.hidden=true; returnPaper?.removeAttribute('hidden'); } else void prepareHero(); });
returnPaper?.addEventListener('click', () => { hero?.setEnabled(false); paper.setHeroMode('paper'); returnPaper.hidden=true; if(explore3d) explore3d.hidden=false; });
window.addEventListener('scroll', () => {
  if (!artwork || !enabled || selectedByHand || artwork.dataset.heroPage !== '0') return;
  const height = artwork.closest<HTMLElement>('.hero')?.offsetHeight || 700;
  const next = Math.min(2, Math.floor(Math.min(1, window.scrollY / (height * .65)) * 3));
  if (activeForm !== next) selectForm(next);
}, { passive: true });

const tactile = createTactileMotion();


const future = document.querySelector<HTMLElement>('[data-future]');
const targetAnimations: Animation[] = [];
future?.querySelectorAll<SVGAElement>('[data-target-link]').forEach(link=>{
  link.addEventListener('click',()=>{
    const details=future.querySelector<HTMLDetailsElement>(`[data-target="${link.dataset.targetLink}"]`);
    if(details){
      details.open=true;
      // Restore the disclosure focus after the native fragment navigation.
      requestAnimationFrame(()=>details.querySelector('summary')?.focus({preventScroll:true}));
    }
  });
});
future?.querySelectorAll<HTMLDetailsElement>('[data-target]').forEach(details=>{
  details.addEventListener('toggle',()=>{
    const open = future.querySelector<HTMLDetailsElement>('details[open]');
    future.style.setProperty('--target-turn',`${Number(open?.dataset.target||0)*9}deg`);
    future.querySelectorAll<SVGGElement>('[data-future-point]').forEach(point=>point.classList.toggle('is-active',point.dataset.futurePoint === open?.dataset.target));
    if (details.open && enabled) {
      targetAnimations.forEach(animation=>animation.cancel());
      targetAnimations.length = 0;
      const body = details.querySelector<HTMLElement>('.future-target-body');
      if(body) targetAnimations.push(body.animate([{opacity:.4,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:350,easing:'cubic-bezier(.22,1,.36,1)'}));
    }
  });
});

type DroneController = { setEnabled: (enabled: boolean) => void; dispose: () => void };
const droneControllers = new Map<HTMLElement, DroneController>();
const visibleDrones = new Set<HTMLElement>();
const loadingDrones = new Set<HTMLElement>();
function syncDrones() {
  droneControllers.forEach((controller,element)=>controller.setEnabled(enabled && visibleDrones.has(element) && !document.hidden));
  if(!enabled || document.hidden) return;
  visibleDrones.forEach(element=>{
    if(droneControllers.has(element)||loadingDrones.has(element)||element.dataset.webgl==='unavailable') return;
    loadingDrones.add(element);
    import('./drone').then(({createDrone})=>{
      if(!enabled) return;
      const controller=createDrone(element);droneControllers.set(element,controller);
      controller.setEnabled(enabled && visibleDrones.has(element) && !document.hidden);
    }).catch(()=>{element.dataset.webgl='unavailable';}).finally(()=>loadingDrones.delete(element));
  });
}
const droneObserver=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    const element=entry.target as HTMLElement;
    element.dataset.visible=String(entry.isIntersecting);
    if(entry.isIntersecting) visibleDrones.add(element);else visibleDrones.delete(element);
  });syncDrones();
},{threshold:.05});
document.querySelectorAll<HTMLElement>('[data-drone-study]').forEach(element=>droneObserver.observe(element));
document.addEventListener('visibilitychange',syncDrones);

toggle?.removeAttribute('hidden');
updateToggle();
toggle?.addEventListener('click', () => {
  enabled = !enabled;
  if (!enabled) targetAnimations.forEach(animation=>animation.cancel());
  try { localStorage.setItem('mr-motion', enabled ? 'on' : 'off'); } catch { /* Preference still applies for this page. */ }
  updateToggle();
  void animate();
});
preference.addEventListener('change', () => {
  // A newly enabled OS reduction takes priority without requiring another click.
  enabled = !preference.matches;
  try { if (localStorage.getItem('mr-motion') === 'off') enabled = false; } catch { /* Use the OS preference. */ }
  updateToggle();
  void animate();
});

document.querySelectorAll<HTMLButtonElement>('[data-copy-email]').forEach(button => {
  button.removeAttribute('hidden');
  button.addEventListener('click', async () => {
    const email = button.dataset.copyEmail || '';
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(email);
      else {
        const field = document.createElement('textarea');
        field.value = email;
        field.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.append(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        button.focus();
        if (!copied) throw new Error('Copy unavailable');
      }
      notify('Email address copied. Let’s talk.');
    } catch { notify(`Copy this address: ${email}`); }
  });
});

document.querySelectorAll<HTMLButtonElement>('[data-print]').forEach(button => {
  button.removeAttribute('hidden');
  button.addEventListener('click', () => window.print());
});

const menu = document.querySelector<HTMLDetailsElement>('.mobile-menu');
menu?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { menu.open = false; }));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu?.open) { menu.open = false; menu.querySelector('summary')?.focus(); }
});
document.addEventListener('click', event => {
  if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
});

const progress = document.querySelector<HTMLElement>('.reading-progress');
let progressPending = false;
function updateProgress() {
  progressPending = false;
  const travel = document.documentElement.scrollHeight - window.innerHeight;
  if (progress) progress.style.transform = `scaleX(${travel > 0 ? Math.min(1, window.scrollY / travel) : 0})`;
}
window.addEventListener('scroll', () => {
  if (!progressPending) { progressPending = true; requestAnimationFrame(updateProgress); }
}, { passive: true });
updateProgress();
void animate();
window.addEventListener('pagehide', event => {
  if (!event.persisted) { context?.revert(); hero?.dispose(); tactile.dispose(); paper.dispose(); living.dispose(); ink.dispose(); notebookMotion.dispose(); droneObserver.disconnect(); droneControllers.forEach(controller=>controller.dispose()); targetAnimations.forEach(animation=>animation.cancel()); }
});
