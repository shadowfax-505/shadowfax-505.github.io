import type { FieldController } from './hero';
type DroneController = { setEnabled(on: boolean): void; dispose(): void };

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
let motion = root.dataset.motion !== 'off';

function store(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* private mode */ } }
const toast = document.querySelector<HTMLElement>('[data-toast]');
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function notify(message: string) {
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message; toast.dataset.visible = 'true';
  toastTimer = setTimeout(() => { toast.dataset.visible = 'false'; }, 3200);
}

/* ---------- theme ---------- */
const themeToggle = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : darkQuery.matches;
function themeChanged() {
  themeToggle?.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
  field?.refreshColors();
}
themeToggle?.addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  root.dataset.theme = next; store('mr-theme', next); themeChanged();
});
darkQuery.addEventListener('change', () => { if (!root.dataset.theme) themeChanged(); });

/* ---------- motion ---------- */
const motionToggle = document.querySelector<HTMLButtonElement>('[data-motion-toggle]');
function applyMotion() {
  root.dataset.motion = motion ? 'on' : 'off';
  motionToggle?.setAttribute('aria-pressed', String(!motion));
  motionToggle?.setAttribute('aria-label', motion ? 'Pause animation' : 'Resume animation');
  motionToggle?.setAttribute('title', motion ? 'Pause animation' : 'Resume animation');
  field?.setEnabled(motion);
  if (motion) void loadField();
  syncDrones();
}
motionToggle?.addEventListener('click', () => { motion = !motion; store('mr-motion', motion ? 'on' : 'off'); applyMotion(); });
reduced.addEventListener('change', () => { if (reduced.matches) { motion = false; applyMotion(); } });

/* ---------- particle field ---------- */
const fieldEl = document.querySelector<HTMLElement>('[data-field]');
let field: FieldController | undefined;
let fieldLoading = false;
let form = 0;
const formLabels = ['EMG · 6 ch', 'PCB · traces', 'Loop · ribbon'];
async function loadField() {
  if (!fieldEl || field || fieldLoading || !motion || !engaged) return;
  fieldLoading = true;
  try {
    const { createField } = await import('./hero');
    field = createField(fieldEl, motion);
    field.setForm(form);
  } catch { fieldEl.dataset.webgl = 'unavailable'; }
  finally { fieldLoading = false; }
}
fieldEl?.querySelectorAll<HTMLButtonElement>('[data-form]').forEach(button => button.addEventListener('click', () => {
  form = Number(button.dataset.form);
  fieldEl.querySelectorAll('[data-form]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  const label = fieldEl.querySelector('[data-field-label]'); if (label) label.textContent = formLabels[form];
  if (field) field.setForm(form); else { engage(); void loadField(); }
}));
// WebGL starts on the visitor's first interaction. Until then the server-rendered drawings show,
// so first paint never waits for three.js and passive page loads stay light.
let engaged = false;
const engageEvents = ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'scroll', 'keydown'] as const;
function engage() {
  if (engaged) return;
  engaged = true;
  engageEvents.forEach(e => window.removeEventListener(e, engage));
  if (motion) void loadField();
  syncDrones();
}
engageEvents.forEach(e => window.addEventListener(e, engage, { passive: true }));

/* ---------- drone ---------- */
const drones = new Map<HTMLElement, DroneController>();
const visibleDrones = new Set<HTMLElement>();
const loadingDrones = new Set<HTMLElement>();
function syncDrones() {
  if (!engaged) return;
  drones.forEach((c, el) => c.setEnabled(motion && visibleDrones.has(el) && !document.hidden));
  visibleDrones.forEach(el => {
    if (drones.has(el) || loadingDrones.has(el) || el.dataset.webgl === 'unavailable') return;
    loadingDrones.add(el);
    import('./drone').then(({ createDrone }) => {
      const c = createDrone(el); drones.set(el, c);
      c.setEnabled(motion && visibleDrones.has(el) && !document.hidden);
    }).catch(() => { el.dataset.webgl = 'unavailable'; }).finally(() => loadingDrones.delete(el));
  });
}
const droneObserver = new IntersectionObserver(entries => {
  entries.forEach(e => { const el = e.target as HTMLElement; el.dataset.visible = String(e.isIntersecting); if (e.isIntersecting) visibleDrones.add(el); else visibleDrones.delete(el); });
  syncDrones();
}, { rootMargin: '200px 0px', threshold: .01 });
document.querySelectorAll<HTMLElement>('[data-drone]').forEach(el => droneObserver.observe(el));
document.addEventListener('visibilitychange', syncDrones);

/* ---------- reveal on scroll ---------- */
const reveals = document.querySelectorAll<HTMLElement>('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  reveals.forEach(el => io.observe(el));
} else reveals.forEach(el => el.classList.add('is-in'));

/* ---------- copy email ---------- */
document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach(button => {
  button.hidden = false;
  button.addEventListener('click', async () => {
    const text = button.dataset.copy || '';
    try { await navigator.clipboard.writeText(text); notify('Email address copied'); }
    catch { notify(text); }
  });
});

/* ---------- print ---------- */
document.querySelectorAll<HTMLButtonElement>('[data-print]').forEach(b => { b.hidden = false; b.addEventListener('click', () => window.print()); });

/* ---------- mobile menu ---------- */
const menu = document.querySelector<HTMLDetailsElement>('.menu');
menu?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { menu.open = false; }));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu?.open) { menu.open = false; menu.querySelector('summary')?.focus(); } });
document.addEventListener('click', e => { if (menu?.open && e.target instanceof Node && !menu.contains(e.target)) menu.open = false; });

applyMotion();
themeChanged();
window.addEventListener('pagehide', e => { if (!e.persisted) { field?.dispose(); drones.forEach(d => d.dispose()); droneObserver.disconnect(); } });
