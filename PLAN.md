# mayankgautam-me

Components and tasks of this project, drawn as the project map. A component is `## Name {#id}` with
`tech:`, `files:` and `kind:` lines; tasks are `- [ ]` (todo), `- [~]` (in progress), `- [x]` (done)
or `- [!]` (blocked).

## Project {#project}
tech: make (project-standard), mise, Homebrew, GitHub Actions, sops + age
files: [Makefile, make/**, Brewfile, mise.toml, secrets.schema, .github/**, .gitignore, .gitattributes, LICENSE, CLAUDE.md, PLAN.md, tests/**, docs/*.md, docs/images/**, scripts/**]
kind: tooling
- [ ] make setup and make doctor pass on this Mac {#project-setup}
- [x] Secrets created with make secrets-init {#project-secrets}
- [x] CI keys stored with make secrets-ci and the first CI run green {#project-ci}

## Profile {#profile}
tech: GitHub profile README, SVG header
files: [README.md, assets/**]
kind: docs
- [x] Website source merged into this repository under web/ {#profile-merge-website}
- [x] README header shows the MG mark beside the name {#profile-mg-header}

## Web {#web}
tech: static HTML site in web/public, a static-assets Worker on mayankgautam.me: wrangler
files: [web/**]
kind: web-pages
- [x] Adopt the project standard: site moved to web/public, wrangler.jsonc, CI on GitHub Actions {#web-adopt}
- [x] Cloudflare token stored with make cf-login (account mayankgautam-me) {#web-cf-login}
- [x] First production deploy with make web-deploy ENV=production CONFIRM=production {#web-first-deploy}
- [x] Redirect Rule www.mayankgautam.me -> https://mayankgautam.me on the zone {#web-www-redirect}
- [x] Live site checked in the browser {#web-live-check}
- [x] Replace the GitLab link on the pages with GitHub {#web-gitlab-link}
- [x] New MG logo (an M whose diagonal runs into a G): favicon and nav mark {#web-mg-logo}
- [x] Pick a design: one sample home page per style; chosen: the high-end layout in Tokyo Night colours, no photos {#web-design-samples}
- [x] Rebuild the site in Astro, six pages (Home, About, Resume, Portfolio, Blog with a first post, Contact with links only), content aligned with LinkedIn and the GitHub README {#web-astro}
- [x] make dev, make check and CI work with the Astro build (needs project-standard 1.8: Astro in the web-pages kind); old URLs keep working {#web-astro-build}
- [x] Checked in the browser at desktop and phone widths, light and dark {#web-redesign-check}
- [x] Released and deployed to production (asks first) {#web-redesign-deploy}
- [x] Theme toggle in the nav: system, light, dark; remembered per browser, no flash on load {#web-theme-toggle}
- [x] Theme toggle deployed to production {#web-theme-deploy}
- [x] Page loads show a progress bar on link clicks, and links prefetch on hover {#web-load-feedback}
- [x] The load bar carries over to the arriving page and finishes there, so it shows on every link {#web-load-carry}
- [x] Client-side navigation (Astro ClientRouter): the page stays live, so the load bar moves from the click until the next page swaps in {#web-client-router}
- [x] Portfolio product pages filled from the projects' docs, technical and unnamed {#web-portfolio-products}
- [x] Portfolio employer pages (air quality, 5G gateway, oneM2M) filled the same way {#web-portfolio-employer}
- [x] Portfolio personal build pages kept short (the owner chose to keep them as they are) {#web-portfolio-builds}
- [x] Blog: Mac setup post and a Claude Code setup series of five posts covering every part {#web-blog-series}
- [x] Blog: list of further post ideas from the repos, without naming projects {#web-blog-ideas}
- [x] Blog: seven engineering posts from the ideas (BLE audio, LED budget, antenna matching, USB-serial secure channel, cellular power saving, composite USB debug, presence and D1 reads), plus KiCad to JLCPCB, Durable Object ingest, pin map vs netlist {#web-blog-engineering}

