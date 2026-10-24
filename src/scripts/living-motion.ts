/** Visible illustrations keep their own small rhythms; reading copy never drifts. */
export function createLivingMotion() {
  const aborter = new AbortController(), { signal } = aborter;
  const elements = [...document.querySelectorAll<HTMLElement>('.project-visual,.future-map,.hero,.section-heading,.recognition-intro,.contact-main,.research-atlas')];
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    (entry.target as HTMLElement).dataset.livingVisible = String(entry.isIntersecting);
  }), { threshold: .02 });
  elements.forEach(element => observer.observe(element));
  const root = document.documentElement;
  const visibility = () => { root.dataset.livingAwake = document.hidden ? 'false' : 'true'; };
  document.addEventListener('visibilitychange', visibility, { signal }); visibility();
  // Paths belong to the existing source diagrams; CSS only changes the distance along them.
  document.querySelectorAll<SVGPathElement>('[data-living-path]').forEach(path => {
    const host = path.closest('svg'), marker = host?.querySelector<SVGElement>(`[data-living-marker="${path.dataset.livingPath}"]`);
    if (marker) marker.style.offsetPath = `path('${path.getAttribute('d')}')`;
  });
  const headings = [...document.querySelectorAll<HTMLElement>('.section-heading')];
  let pending = false;
  const scroll = () => {
    pending = false; if (root.dataset.motion !== 'on') return;
    for (const heading of headings) {
      if (heading.dataset.livingVisible !== 'true') continue;
      const y = heading.getBoundingClientRect().top / innerHeight;
      heading.style.setProperty('--paper-reveal', String(Math.max(0, Math.min(1, 1 - y))));
    }
  };
  window.addEventListener('scroll', () => { if (!pending) { pending = true; requestAnimationFrame(scroll); } }, { signal, passive: true });
  scroll();
  return { dispose() { observer.disconnect(); aborter.abort(); elements.forEach(e => { delete e.dataset.livingVisible; }); } };
}
