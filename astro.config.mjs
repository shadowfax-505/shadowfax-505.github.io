import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync } from 'node:fs';

// The notes index stays out of the sitemap until the first note is published.
const hasNotes = (() => {
  try { return readdirSync('./src/content/notes').some(f => f.endsWith('.md') && !/^draft:\s*true/m.test(readFileSync(`./src/content/notes/${f}`, 'utf8'))); }
  catch { return false; }
})();

export default defineConfig({
  site: 'https://shadowfax-505.github.io',
  output: 'static',
  build: { inlineStylesheets: 'always' },
  trailingSlash: 'always',
  integrations: [sitemap({ filter: page => hasNotes || !page.includes('/notes/') })],
  // three.js (~700 kB) is loaded lazily after first paint, only where a 3D view is on screen.
  vite: { build: { assetsInlineLimit: 2048, chunkSizeWarningLimit: 800 } },
});
