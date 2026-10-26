import { createTactileMotion } from './tactile';
import { createPaperExperience } from './paper-entry';
import { createLivingMotion } from './living-motion';
import { createInkMotion } from './ink';
import { createNotebookMotion } from './notebook-motion';
import { createReveals } from './reveal';
type HeroController = { setEnabled: (enabled: boolean) => void; setForm: (index: number) => void; dispose: () => void };

const root = document.documentElement;
const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
// The motion switch sits in the header on wide screens and in the menu on phones; both stay in step.
const toggles = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-motion-toggle]'));
let enabled = root.dataset.motion === 'on';
let hero: HeroController | undefined;
let animationGeneration = 0;
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
const reveals = createReveals();
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
  // A stable name, "Reduce motion", with its state in aria-pressed; the dot shows it to sighted visitors.
  for (const toggle of toggles) toggle.setAttribute('aria-pressed', String(!enabled));
  if (explore3d) explore3d.disabled = !enabled || loadingHero || artwork?.dataset.webgl === 'unavailable';
}

async function animate() {
  const generation = ++animationGeneration;
  reveals.stop();
  hero?.setEnabled(enabled && artwork?.dataset.heroMode === 'field');
  paper.setEnabled(enabled);
  syncDrones();
  if (!enabled) return;
  // Scroll reveals start in idle time, so the first paint and input never wait for them.
  // The hero entrance, the contour drawing and the star are CSS (src/styles/structure.css).
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200));
  await new Promise<void>(resolve => idle(() => resolve(), { timeout: 1800 }));
  if (!enabled || generation !== animationGeneration) return;
  reveals.start();
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
    else if (explore3d) { explore3d.textContent = 'See it as particles ↗'; explore3d.disabled = !enabled; }
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

toggles.forEach(toggle => toggle.removeAttribute('hidden'));
updateToggle();
toggles.forEach(toggle => toggle.addEventListener('click', () => {
  enabled = !enabled;
  if (!enabled) targetAnimations.forEach(animation=>animation.cancel());
  try { localStorage.setItem('mr-motion', enabled ? 'on' : 'off'); } catch { /* Preference still applies for this page. */ }
  updateToggle();
  void animate();
}));
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

// Wide Markdown tables scroll sideways on phones: wrap each in a labelled region keyboard users can focus and scroll.
document.querySelectorAll<HTMLTableElement>('.prose table').forEach(table => {
  if (table.parentElement?.classList.contains('table-scroll')) return;
  const region = document.createElement('div');
  region.className = 'table-scroll';
  region.tabIndex = 0;
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', `Table: ${table.querySelector('th')?.textContent?.trim() || 'data'} and more columns (scrolls sideways)`);
  table.replaceWith(region);
  region.append(table);
});

// On the home page the header marks the section being read, with the same red underline as hover.
if (location.pathname === '/') {
  const links = new Map<string, HTMLAnchorElement>();
  document.querySelectorAll<HTMLAnchorElement>('.desktop-nav a[href^="/#"]').forEach(link => links.set(link.getAttribute('href')!.slice(2), link));
  const visible = new Map<string, number>();
  const spy = new IntersectionObserver(entries => {
    for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
    let best = '', ratio = 0;
    visible.forEach((r, id) => { if (r > ratio) { ratio = r; best = id; } });
    links.forEach((link, id) => link.toggleAttribute('data-active', id === best));
  }, { rootMargin: '-35% 0px -50% 0px', threshold: [0, .25, .5, .75, 1] });
  links.forEach((_, id) => { const section = document.getElementById(id); if (section) spy.observe(section); });
}

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
  if (!event.persisted) { hero?.dispose(); tactile.dispose(); paper.dispose(); living.dispose(); ink.dispose(); notebookMotion.dispose(); reveals.stop(); droneObserver.disconnect(); droneControllers.forEach(controller=>controller.dispose()); targetAnimations.forEach(animation=>animation.cancel()); }
});
