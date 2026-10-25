// Checks the built site in dist/ for structure, claims and leaks.
// Usage: npm run build && node scripts/verify-content.mjs [--online]
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const online = process.argv.includes('--online');
// Before the first deploy the site and its repository do not exist yet; pass --published to include them.
const published = process.argv.includes('--published');
const failures = [];
const fail = (page, msg) => failures.push(`${page}: ${msg}`);
let checks = 0;
const ok = (cond, page, msg) => { checks++; if (!cond) fail(page, msg); };

const pages = [];
(function walk(dir) { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.html')) pages.push(p); } })(dist);
const expected = ['index.html', 'cv/index.html', 'research/index.html', '404.html', 'notes/index.html',
  ...['afo-recorder', 'civiclens', 'researchhub', 'zenflow', 'drone', 'gas-safety'].map(s => `work/${s}/index.html`)];
for (const e of expected) ok(existsSync(join(dist, e)), e, 'page missing');

// Words that make a portfolio read as generated filler, and leftovers from the previous site.
const banned = [/\bjourney\b/i, /\bpassion(ate)?\b/i, /\bcrafting\b/i, /\bseamless/i, /cutting-edge/i, /\bleverag/i, /\binnovative\b/i, /\bdelve/i, /\btapestry\b/i,
  // The field-journal vocabulary (field journal, imagined robot study) is the owner's own design and stays allowed.
  /complex ideas into working systems/i, /concept reconstruction/i];
// Unpublished research must not leak results or private locations.
const privateStrings = ['caco-inventory', 'gist.github', 'givingvole8', '0.901', '0.683', '34%→58%', '34% to 58%', '97.9%', '98.0%', '713,624', '1,255/1,255', '73,129', '62,618', '42–121', 'FreshRetailNet', 'RegSpeech'];

const externalLinks = new Set();
for (const file of pages) {
  const rel = file.slice(dist.length);
  const html = readFileSync(file, 'utf8');
  const text = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
  ok(/<title>[^<]{10,}<\/title>/.test(html), rel, 'title missing or short');
  ok(/<meta name="description" content="[^"]{50,}"/.test(html), rel, 'description missing or short');
  if (rel === '404.html') ok(!/rel="canonical"/.test(html), rel, '404 page must not declare a canonical URL');
  else ok(/<link rel="canonical" href="https:\/\/shadowfax-505\.github\.io\//.test(html), rel, 'canonical not on shadowfax-505.github.io');
  // Case studies have their own share card (scripts/create-cards.mjs); every other page uses the site card.
  const card = rel.match(/^work\/([^/]+)\/index\.html$/)?.[1];
  const ogPath = card ? `og/${card}.png` : 'og.png';
  ok(html.includes(`<meta property="og:image" content="https://shadowfax-505.github.io/${ogPath}"`), rel, `og:image should be /${ogPath}`);
  ok(existsSync(join(dist, ogPath)), rel, `missing share card ${ogPath}`);
  ok((html.match(/<h1[\s>]/g) || []).length === 1, rel, 'needs exactly one h1');
  ok(/<html lang="en"/.test(html), rel, 'lang missing');
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); checks++; } catch { fail(rel, 'JSON-LD does not parse'); }
  }
  for (const re of banned) ok(!re.test(text), rel, `banned phrase ${re}`);
  for (const s of privateStrings) ok(!html.includes(s), rel, `private string "${s}"`);
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    ok(/\balt="/.test(tag), rel, `img without alt: ${tag.slice(0, 80)}`);
    ok(/\bwidth="\d+"/.test(tag) && /\bheight="\d+"/.test(tag), rel, `img without dimensions: ${tag.slice(0, 80)}`);
    const src = tag.match(/\bsrc="([^"]+)"/)?.[1];
    if (src?.startsWith('/')) ok(existsSync(join(dist, src)), rel, `missing image ${src}`);
  }
  for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) {
    const p = m[1]; if (p === '/') continue;
    ok(existsSync(join(dist, p)) || existsSync(join(dist, p, 'index.html')), rel, `broken internal link ${p}`);
  }
  for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) externalLinks.add(m[1].replace(/&amp;/g, '&'));
}

// Size budgets, so the site stays fast as it grows. Raise one only on purpose.
const KB = 1024;
for (const file of pages) ok(statSync(file).size <= 450 * KB, file.slice(dist.length), `HTML over 450 KB (${Math.round(statSync(file).size / KB)} KB)`);
(function walkAssets(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f), rel = p.slice(dist.length), size = statSync(p).size;
    if (statSync(p).isDirectory()) { walkAssets(p); continue; }
    if (/\.js$/.test(f)) ok(size <= 650 * KB, rel, `script over 650 KB (${Math.round(size / KB)} KB)`);
    else if (/\.(webp|png|jpe?g|svg)$/.test(f)) ok(size <= (rel.startsWith('og/') ? 200 : 300) * KB, rel, `image over budget (${Math.round(size / KB)} KB)`);
    else if (/\.glb$/.test(f)) ok(size <= 1024 * KB, rel, `3D model over 1 MB (${Math.round(size / KB)} KB)`);
  }
})(dist);

// Claims that must stay exactly as sourced.
const drone = readFileSync(join(dist, 'work/drone/index.html'), 'utf8');
ok(drone.includes('dainikshiksha.com'), 'work/drone', 'must link the Dainik Shiksha article');
ok(/five-student team/.test(drone) && /team member/i.test(drone), 'work/drone', 'must present the drone as a team build');
ok(/reconstruction/i.test(drone) && /photos lost/i.test(drone), 'work/drone', 'must label the 3D model as a reconstruction');
const afo = readFileSync(join(dist, 'work/afo-recorder/index.html'), 'utf8');
ok(/Hardware pending/.test(afo) && /No physical board has been measured yet/.test(afo), 'work/afo-recorder', 'must state that hardware is unmeasured');
ok(/simulated/i.test(afo), 'work/afo-recorder', 'must label simulated evidence');
const research = readFileSync(join(dist, 'research/index.html'), 'utf8');
const researchText = research.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
ok(!/\d+(\.\d+)?\s?%/.test(researchText), 'research', 'percentages on the research page');
ok(/Waudby-Smith/.test(research), 'research', 'inventory study must credit Waudby-Smith et al.');

if (online) {
  for (const url of externalLinks) {
    if (!published && (url.startsWith('https://shadowfax-505.github.io') || url.includes('/shadowfax-505.github.io'))) continue;
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 link-check' } });
      // LinkedIn answers automated requests with 999; that is bot blocking, not a broken link.
      ok(res.status < 400 || (res.status === 999 && url.includes('linkedin.com')), 'links', `${res.status} ${url}`);
    } catch (e) { fail('links', `${e.message} ${url}`); }
  }
}

console.log(`${pages.length} pages, ${checks} checks${online ? `, ${externalLinks.size} external links` : ''}`);
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('All content checks pass.');
