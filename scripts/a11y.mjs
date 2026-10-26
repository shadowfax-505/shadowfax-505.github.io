// Runs axe-core (WCAG 2.2 A/AA rules) on every built page at desktop and phone widths, with reduced motion
// and with motion on (the intro preset as already seen, so the page itself is audited).
// Usage: with `npx astro preview` running, node scripts/a11y.mjs [http://127.0.0.1:4321]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const base = process.argv[2] || 'http://127.0.0.1:4321';
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = new URL('..', import.meta.url).pathname;
const axe = readFileSync(join(root, 'node_modules/axe-core/axe.min.js'), 'utf8');
const pages = [];
(function walk(dir, prefix) { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) { if (f !== '_astro' && f !== 'assets') walk(p, `${prefix}${f}/`); } else if (f === 'index.html') pages.push(`/${prefix}`); } })(join(root, 'dist'), '');

const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
let failures = 0;
const desktop = { width: 1440, height: 900 }, phone = { width: 390, height: 844, isMobile: true, hasTouch: true }, small = { width: 375, height: 812, isMobile: true, hasTouch: true };
for (const [label, viewport, motion] of [['desktop', desktop, 'reduce'], ['phone', phone, 'reduce'], ['phone-375', small, 'reduce'], ['desktop motion-on', desktop, 'no-preference'], ['phone-375 motion-on', small, 'no-preference']]) {
  for (const path of pages) {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: motion }]);
    if (motion !== 'reduce') await page.evaluateOnNewDocument(() => { try { sessionStorage.setItem('mr-intro', '1'); } catch {} });
    await page.goto(base + path, { waitUntil: 'networkidle0' });
    await page.evaluate(axe);
    const result = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }));
    for (const v of result.violations) {
      failures++;
      console.log(`${label} ${path}  ${v.impact}  ${v.id}: ${v.help}`);
      for (const n of v.nodes.slice(0, 3)) console.log(`    ${n.target.join(' ')}  ${(n.failureSummary || '').split('\n')[1]?.trim().slice(0, 140) ?? ''}`);
    }
    await page.close();
  }
}
await browser.close();
console.log(failures ? `${failures} violation group(s)` : 'No axe violations.');
process.exit(failures ? 1 : 0);
