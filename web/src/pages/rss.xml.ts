import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';

// The feed carries each post in full, so a reader shows the whole article. Links and images that are
// relative on the site become absolute, since a feed reader has no base URL.
const md = new MarkdownIt({ html: true, linkify: true });

export async function GET(context: APIContext) {
  const site = (context.site ?? new URL('https://mayankgautam.me')).href.replace(/\/$/, '');
  const absolute = (html: string) => html.replace(/(href|src)="\/(?!\/)/g, `$1="${site}/`);
  const posts = (await getCollection('blog')).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  return rss({
    title: 'Mayank Gautam: blog',
    description: 'Notes on embedded engineering, tools and the setup behind the work.',
    site,
    xmlns: { atom: 'http://www.w3.org/2005/Atom', dc: 'http://purl.org/dc/elements/1.1/' },
    customData: [
      '<language>en</language>',
      `<atom:link href="${site}/rss.xml" rel="self" type="application/rss+xml" />`,
      `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    ].join(''),
    items: posts.map((p) => ({
      title: p.data.draft ? `[Draft] ${p.data.title}` : p.data.title,
      description: p.data.description,
      pubDate: p.data.date,
      link: `/blog/${p.id}`,
      categories: p.data.tags,
      // RSS <author> must be an email address; dc:creator carries the name instead.
      customData: '<dc:creator>Mayank Gautam</dc:creator>',
      content: absolute(
        sanitizeHtml(md.render(p.body ?? ''), {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
        }),
      ),
    })),
  });
}
