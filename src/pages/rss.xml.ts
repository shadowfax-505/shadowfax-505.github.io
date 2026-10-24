import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { profile } from '../data/profile';

export async function GET(context: APIContext) {
  const notes = (await getCollection('notes', ({ data }) => !data.draft)).sort((a, b) => +b.data.date - +a.data.date);
  return rss({
    title: `${profile.name} — notes`,
    description: 'Short engineering notes: what I built, what broke and what I measured.',
    site: context.site!,
    items: notes.map(n => ({ title: n.data.title, pubDate: n.data.date, description: n.data.summary, link: `/notes/${n.id}/` })),
  });
}
