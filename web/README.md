# web

Part of the `mayankgautam-me` repository, which is also the GitHub profile README; see [docs/README.md](../docs/README.md).

The personal website at https://mayankgautam.me: an [Astro](https://astro.build) static site, built to
`dist/` and served by a Cloudflare static-assets Worker (`website-production-web`).

## Purpose

Home, about, resume, portfolio, blog and contact pages for an embedded engineer. The content follows the
profile README at the repository root (`../README.md`), which is the source of truth.
Missing paths get `dist/404.html` (`not_found_handling` in `wrangler.jsonc`).

## Layout

    astro.config.mjs        site URL, build.format 'file', sitemap, code-block themes
    src/data/site.ts        links, experience, skills and education, from ../README.md
    src/content/work/       portfolio items (content collection): products and the 2017-2019 personal builds
    src/content/blog/       blog posts (content collection, Markdown); draft: true adds a "Draft" label
    src/content.config.ts   the collections' schemas
    src/pages/              one file per page; pages/portfolio/[slug].astro is /pages/portfolio/<slug>.html
    src/components/         nav, footer, project card, Art.astro (the inline-SVG drawings)
    src/styles/global.css   Tokyo Night tokens (dark default, light by prefers-color-scheme) and every component
    public/                 copied as is: favicon.svg, robots.txt

`build.format: 'file'` writes `about.html`, `pages/portfolio/<slug>.html` and so on, so every URL of the old
site still resolves. Links and canonical URLs use the form Cloudflare serves (`/about`), since its default
`html_handling` redirects `/about.html` there. `/rss.xml` is the blog feed; `/sitemap-index.xml` the sitemap.

Design rules: inline SVG only (no photos), Geist and Geist Mono self-hosted from `@fontsource-variable`, no
third-party requests. Scroll reveals are an enhancement: content is visible unless the head script adds
`reveal-on` (IntersectionObserver present, reduced motion off, page visible), and a stalled observer or a
background tab shows everything.

## Build and run

Packages are pinned in `package.json` and installed with pnpm (`make setup`).

    pnpm --dir web exec astro dev       # dev server with reload
    pnpm --dir web exec astro check     # type and template check
    pnpm --dir web exec astro build     # writes web/dist
    pnpm --dir web exec astro preview   # serves web/dist

`make dev` serves `web/dist` with wrangler, so build first. Until the project standard's web-pages kind runs
`astro build` in `make web-build` (support is on the way), build by hand before `make dev`, and do not release:
the release workflow would deploy without building.

## Writing

- A blog post is a Markdown file in `src/content/blog/` with `title`, `description`, `date`, `tags` and
  `draft`. It appears on `/blog`, in the feed and in the sitemap.
- A portfolio item is a Markdown file in `src/content/work/` with `title`, `summary`, `group` (`product` or
  `build`), `context`, `period`, `order` and `art` (a drawing name from `src/components/Art.astro`). The file
  name is its URL: `/pages/portfolio/<file name>.html`.

## Configuration

`web_OUT` in `make/project.mk` is the folder that gets deployed (`web/dist`), the same folder as
`assets.directory` in `wrangler.jsonc`.

## Release

Write what changed under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md) as you go. To release:

    make web-bump LEVEL=patch       # or minor, major, or VERSION=x.y.z
    make release-push              # the branch, then each new release tag in its own push

`web-bump` sets the version in `web/VERSION`, moves the Unreleased notes under it, commits them and
tags `web-v<version>`; it pushes nothing. Pushing the tag deploys production: the tag's workflow
(.github/workflows/release.yml) checks, builds and runs `make web-deploy ENV=production CONFIRM=production`,
then creates the GitHub Release "web <version>" with those notes and no files, so a Release is what is live.
A push to main deploys nothing (production-only: no staging).
A hotfix without a new version runs from the Actions tab: release.yml with part `web` and confirm `production`,
on the ref to deploy (locally: `make web-deploy ENV=production CONFIRM=production`).

## Interfaces

_What other parts and people use from this part (commands, endpoints, files, ports), in a line each; the details
go in the docs below._

## Docs

- [Changelog](CHANGELOG.md)
- [Architecture](../docs/architecture.md): how the parts connect
