// Renders public/og.png (1200×630) with headless Chrome so it uses the site's own fonts.
// Usage: node scripts/create-social.mjs  (needs Google Chrome installed; dev-only)
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const font = (pkg, file) => `file://${root}node_modules/@fontsource/${pkg}/files/${file}`;
const html = `<!doctype html><html><head><style>
@font-face{font-family:Serif;src:url(${font('ibm-plex-serif', 'ibm-plex-serif-latin-400-normal.woff2')})}
@font-face{font-family:Sans;src:url(${font('ibm-plex-sans', 'ibm-plex-sans-latin-400-normal.woff2')})}
@font-face{font-family:Mono;src:url(${font('ibm-plex-mono', 'ibm-plex-mono-latin-500-normal.woff2')})}
body{margin:0;width:1200px;height:630px;background:#f6f4ef;color:#16181b;font-family:Sans;position:relative;overflow:hidden}
.grid{position:absolute;inset:0;background:radial-gradient(circle at 1px 1px,rgba(22,24,27,.13) 1px,transparent 1.2px) 0 0/22px 22px}
.l{position:absolute;left:64px;top:56px;width:560px}
.k{font:500 17px Mono;letter-spacing:.06em;text-transform:uppercase;color:#676c73;display:flex;align-items:center;gap:12px}
.d{width:11px;height:11px;border-radius:50%;background:#24764a}
h1{font:400 108px/0.98 Serif;letter-spacing:-.035em;margin:34px 0 26px}h1 i{font-style:normal;color:#c2410c}
p{font-size:27px;line-height:1.42;color:#3a3f45;margin:0}
.f{position:absolute;left:64px;bottom:52px;font:500 18px Mono;color:#16181b;letter-spacing:.02em}
img{position:absolute;right:-30px;top:120px;width:640px}
</style></head><body><div class="grid"></div>
<img src="file://${root}public/assets/afo/board-render.webp">
<div class="l"><div class="k"><span class="d"></span>Embedded systems · software · research</div>
<h1>Muttakin<br>Rahman<i>.</i></h1>
<p>Data-acquisition hardware, firmware and full&#8209;stack web applications.</p></div>
<div class="f">shadowfax-505.github.io</div></body></html>`;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630 });
// Load from a file:// URL so the page may read the local fonts and board render.
const file = join(mkdtempSync(join(tmpdir(), 'og-')), 'og.html');
writeFileSync(file, html);
await page.goto(`file://${file}`, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: `${root}public/og.png` });
await browser.close();
console.log('Wrote public/og.png');
