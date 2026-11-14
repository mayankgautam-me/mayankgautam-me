import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = (await getCollection('blog')).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  return rss({
    title: 'Mayank Gautam: blog',
    description: 'Notes on embedded engineering, tools and the setup behind the work.',
    site: context.site ?? 'https://mayankgautam.me',
    items: posts.map((p) => ({
      title: p.data.draft ? `[Draft] ${p.data.title}` : p.data.title,
      description: p.data.description,
      pubDate: p.data.date,
      link: `/blog/${p.id}`,
      categories: p.data.tags,
    })),
  });
}
