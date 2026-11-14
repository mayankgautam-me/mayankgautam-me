import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// The art names match the drawings in src/components/Art.astro.
export const ART = [
  'gateway', 'radio', 'wearables', 'phases', 'deck', 'voice', 'instrument', 'lifi', 'air', 'mesh',
  'midi', 'keys', 'face', 'gesture', 'clock', 'assistant', 'board', 'printer', 'balance', 'paint',
  'wheel', 'pendulum',
] as const;

// Portfolio items. Products come from README.md; personal builds from the 2017-2019 portfolio pages.
// Every item is built to /pages/portfolio/<id>.html, the URL the old site used.
const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    group: z.enum(['product', 'build']),
    context: z.string(),
    period: z.string(),
    order: z.number(),
    art: z.enum(ART),
    tags: z.array(z.string()).default([]),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    // draft: written by Claude from facts in the repositories, for the author to edit. It is still
    // built and listed, with a visible "Draft" label, so it can be reviewed on the site.
    draft: z.boolean().default(false),
  }),
});

export const collections = { work, blog };
