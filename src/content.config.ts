import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

import { statuses, type Status } from './data/status';

const status = z.enum(Object.keys(statuses) as [Status, ...Status[]]);

const link = z.object({ label: z.string(), url: z.url() });
const image = z.object({ src: z.string(), alt: z.string(), width: z.number(), height: z.number(), caption: z.string().optional() });

const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    kind: z.enum(['selected', 'early']),
    order: z.number(),
    year: z.coerce.string(),
    role: z.string(),
    stack: z.array(z.string()),
    statuses: z.array(status).min(1),
    metrics: z.array(z.object({ value: z.string(), label: z.string(), status: status.optional() })).default([]),
    cover: image.optional(),
    figures: z.array(image).default([]),
    links: z.array(link).default([]),
  }),
});

const research = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/research' }),
  schema: z.object({
    title: z.string(),
    area: z.string(),
    question: z.string(),
    method: z.string(),
    status: status,
    order: z.number(),
  }),
});

const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { work, research, notes };
