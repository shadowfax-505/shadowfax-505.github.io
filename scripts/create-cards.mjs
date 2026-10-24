// Renders a 1200×630 share card for every case study into public/og/<slug>.png.
// Each card pairs the project's title and short line with its own notebook cover, captured from the built site.
// Usage: npm run build && npx astro preview --port 4321, then  node scripts/create-cards.mjs [http://127.0.0.1:4321]
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const base = process.argv[2] || 'http://127.0.0.1:4321';
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'public/og');
mkdirSync(out, { recursive: true });

const font = path => 'data:font/woff2;base64,' + readFileSync(join(root, 'node_modules', path)).toString('base64');
const fonts = `
@font-face{font-family:Manrope;src:url(${font('@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2')}) format('woff2');font-weight:200 800}
@font-face{font-family:'Instrument Serif';font-style:italic;src:url(${font('@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2')}) format('woff2')}
@font-face{font-family:'Plex Mono';src:url(${font('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2')}) format('woff2')}`;

// Title, short line and category come from the case study frontmatter and editorial data.
const editorial = readFileSync(join(root, 'src/data/editorial.ts'), 'utf8');
const shortFor = visual => editorial.match(new RegExp(`${visual}: \\{ short: '([^']+)'`))?.[1] ?? '';
const field = (text, key) => text.match(new RegExp(`^${key}: (.+)$`, 'm'))?.[1].trim().replace(/^'|'$/g, '') ?? '';
const projects = readdirSync(join(root, 'src/content/work')).filter(f => f.endsWith('.md')).map(f => {
  const text = readFileSync(join(root, 'src/content/work', f), 'utf8');
  return { slug: f.replace(/\.md$/, ''), title: field(text, 'title'), visual: field(text, 'visual'), category: field(text, 'category'), order: Number(field(text, 'order')) };
});

const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
for (const p of projects) {
  // The cover page of the project's notebook, static (motion off), at twice the size for a crisp card.
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto(`${base}/work/${p.slug}/`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  const cover = await page.$('.case-notebook [data-notebook-page="0"]');
  const shot = await cover.screenshot({ type: 'png' });
  const short = shortFor(p.visual);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
*{margin:0;box-sizing:border-box}html,body{width:1200px;height:630px;background:#eef0e8;color:#1b2126;overflow:hidden}
.wrap{position:absolute;inset:44px 50px;display:grid;grid-template-columns:1fr 560px;grid-template-rows:auto 1fr auto;column-gap:44px}
.top,.bottom{grid-column:1/-1;display:flex;justify-content:space-between;font:14px 'Plex Mono';letter-spacing:.06em;text-transform:uppercase}
.top{padding-bottom:18px;border-bottom:1px solid #c7ccc5}.top span:last-child{color:#176b4d}
.bottom{padding-top:16px;border-top:1px solid #c7ccc5;align-self:end}
.text{align-self:center}
h1{font:600 ${p.title.length > 16 ? 64 : 84}px/0.95 Manrope;letter-spacing:-.06em}h1 b{color:#176b4d;font-weight:600}
p{margin-top:22px;font:italic 400 44px/1.05 'Instrument Serif';color:#176b4d;letter-spacing:-.02em}
.cover{align-self:center;width:560px;height:386px;object-fit:cover;border:1px solid #c7ccc5;box-shadow:0 24px 50px -30px rgba(27,33,38,.55)}
</style></head><body><div class="wrap"><div class="top"><span>Muttakin Rahman / field notes 0${p.order}</span><span>${p.category}</span></div>
<div class="text"><h1>${p.title}<b>.</b></h1><p>${short}</p></div><img class="cover" src="data:image/png;base64,${Buffer.from(shot).toString('base64')}">
<div class="bottom"><span>Case study</span><span>shadowfax-505.github.io/work/${p.slug}</span></div></div></body></html>`;
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(out, `${p.slug}.png`) });
  console.log('card', p.slug);
}
await browser.close();
