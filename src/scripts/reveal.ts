// Scroll reveals with one IntersectionObserver and CSS transitions, instead of a scroll trigger per element:
// nothing is measured at startup, and an element only changes when it comes into view.
type Reveal = { start: () => void; stop: () => void };

const kinds = ['rv', 'rv-in', 'rv-now', 'rv-rise', 'rv-em', 'rv-wipe', 'rv-clip', 'rv-clip-small', 'rv-rule', 'rv-pop', 'rv-draw'];

export function createReveals(): Reveal {
  const marked: HTMLElement[] = [];
  const counters: [HTMLElement, string][] = [];
  const frames = new Set<number>();
  let io: IntersectionObserver | undefined;

  // What each observed element will do; it is only hidden once the observer reports it off screen,
  // so anything already visible when this starts never blinks.
  const pending = new Map<HTMLElement, { kind: string; index?: number }>();
  const countable = new Map<HTMLElement, string>();
  function mark(element: Element | null, kind: string, index?: number) {
    if (!(element instanceof HTMLElement) || !io || pending.has(element)) return;
    pending.set(element, { kind, index });
    io.observe(element);
  }
  // Counts the number up from zero, then puts the exact text back. In a ratio such as 69 / 70 only the
  // first number counts against a fixed total, so no frame shows a score the work did not get.
  function count(element: HTMLElement, text: string) {
    const started = performance.now();
    const slash = text.indexOf('/');
    const head = slash < 0 ? text : text.slice(0, slash), tail = slash < 0 ? '' : text.slice(slash);
    const paint = (p: number) => { element.textContent = head.replace(/\d+(\.\d+)?/g, m => { const v = Number(m) * p; return m.includes('.') ? v.toFixed(1) : String(Math.round(v)).padStart(m.startsWith('0') ? m.length : 1, '0'); }) + tail; };
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / 1400);
      if (t >= 1) { element.textContent = text; return; }
      paint(1 - Math.pow(1 - t, 3));
      const id = requestAnimationFrame(next => { frames.delete(id); step(next); });
      frames.add(id);
    };
    paint(0);
    const id = requestAnimationFrame(now => { frames.delete(id); step(now); });
    frames.add(id);
  }

  // A jump link lands on finished content: everything inside the target section is shown at once.
  function settle(target: Element | null) {
    if (!target || !io) return;
    for (const element of [...pending.keys()]) if (target.contains(element)) { pending.delete(element); io.unobserve(element); }
    for (const element of marked) if (target.contains(element) && !element.classList.contains('rv-in')) { element.classList.add('rv-now', 'rv-in'); io.unobserve(element); }
    for (const [element, text] of counters) if (target.contains(element)) { countable.delete(element); io.unobserve(element); element.textContent = text; delete element.dataset.countTo; }
  }
  function onJump(event: Event) {
    const link = (event.target as Element).closest?.('a[href*="#"]') as HTMLAnchorElement | null;
    if (!link || link.pathname !== location.pathname || !link.hash) return;
    settle(document.getElementById(decodeURIComponent(link.hash.slice(1))));
  }
  const onHash = () => settle(location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null);

  return {
    start() {
      if (io) return;
      document.addEventListener('click', onJump);
      addEventListener('hashchange', onHash);
      io = new IntersectionObserver(entries => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          const total = countable.get(element);
          if (total !== undefined) {
            countable.delete(element);
            if (entry.isIntersecting) { io!.unobserve(element); continue; }
            element.dataset.countTo = total;
            continue;
          }
          const plan = pending.get(element);
          if (plan) {
            pending.delete(element);
            if (entry.isIntersecting) { io!.unobserve(element); continue; }
            element.classList.add('rv', plan.kind);
            if (plan.index !== undefined) element.style.setProperty('--i', String(Math.min(plan.index, 4)));
            marked.push(element);
            continue;
          }
          if (!entry.isIntersecting) continue;
          io!.unobserve(element);
          element.classList.add('rv-in');
          const text = element.dataset.countTo;
          if (text !== undefined) count(element, text);
        }
      }, { rootMargin: '0px 0px -6% 0px' });

      document.querySelectorAll<HTMLElement>('[data-reveal]').forEach(element => {
        // Notebook frames stay untransformed: the WebGL sheet is aligned to their rectangles.
        mark(element.matches('.work-card') ? element.querySelector('.work-card-body') : element, 'rv-rise');
      });
      document.querySelectorAll('h2[data-reveal] em, .method-head h3 em, .proof-title em').forEach(element => mark(element, 'rv-em'));
      document.querySelectorAll<HTMLElement>('.proof-grid, .method-steps, .service-grid, .case-metrics, .note-grid, .process-strip').forEach(group => {
        [...group.children].forEach((child, i) => mark(child, 'rv-rise', i));
        if (!group.matches('.process-strip, .note-grid')) mark(group, 'rv-rule');
      });
      // A clipped frame cannot be clicked while it wipes in, so frames with controls rise instead.
      document.querySelectorAll('.case-supplement img, .evidence-frame, .phones').forEach(element => mark(element, element.querySelector('.chart-interactive, [data-resolver]') ? 'rv-rise' : 'rv-wipe'));
      document.querySelectorAll('.case-notebook .notebook-stage').forEach(element => mark(element, 'rv-clip'));
      document.querySelectorAll('.work-card .project-visual').forEach(element => mark(element, 'rv-clip-small'));
      document.querySelectorAll('.next-project h2, .contact-main h2').forEach(element => mark(element, 'rv-rise'));
      document.querySelectorAll('.contact-orb').forEach(element => mark(element, 'rv-pop'));
      document.querySelectorAll('.future-map').forEach(element => mark(element, 'rv-draw'));
      // Step numbers (01–05) are labels, not quantities: they rise with their card instead of counting.
      document.querySelectorAll<HTMLElement>('.proof-item strong, .case-metric strong').forEach(element => {
        const text = element.textContent || '';
        if (!/\d/.test(text) || !io) return;
        counters.push([element, text]);
        element.setAttribute('aria-label', text);
        countable.set(element, text);
        io.observe(element);
      });
    },
    stop() {
      document.removeEventListener('click', onJump);
      removeEventListener('hashchange', onHash);
      io?.disconnect(); io = undefined;
      pending.clear(); countable.clear();
      frames.forEach(id => cancelAnimationFrame(id)); frames.clear();
      marked.splice(0).forEach(element => { element.classList.remove(...kinds); element.style.removeProperty('--i'); });
      counters.splice(0).forEach(([element, text]) => { element.textContent = text; delete element.dataset.countTo; });
    },
  };
}
