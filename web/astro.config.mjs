// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Static site served by a Cloudflare static-assets Worker (wrangler.jsonc, assets.directory ./dist).
// build.format 'file' keeps the old URLs: /about.html, /pages/portfolio/<slug>.html.
export default defineConfig({
  site: 'https://mayankgautam.me',
  trailingSlash: 'ignore',
  build: { format: 'file' },
  // Fetch a page when its link is hovered or touched, so most clicks open from the cache.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  // code blocks: Tokyo Night in dark, GitHub Light in light (no Tokyo Night Day theme ships with Shiki)
  markdown: { shikiConfig: { themes: { dark: 'tokyo-night', light: 'github-light' }, defaultColor: false } },
  integrations: [
    sitemap({ filter: (page) => !page.includes('/404') }),
  ],
});
