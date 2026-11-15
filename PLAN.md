# mayankgautam-me

Components and tasks of this project, drawn as the project map. A component is `## Name {#id}` with
`tech:`, `files:` and `kind:` lines; tasks are `- [ ]` (todo), `- [~]` (in progress), `- [x]` (done)
or `- [!]` (blocked).

## Project {#project}
tech: make (project-standard), mise, Homebrew, GitHub Actions, sops + age
files: [Makefile, make/**, Brewfile, mise.toml, secrets.schema, .github/**, .gitignore, .gitattributes, CLAUDE.md, PLAN.md, tests/**, docs/*.md, docs/images/**, scripts/**]
kind: tooling
- [ ] make setup and make doctor pass on this Mac {#project-setup}
- [x] Secrets created with make secrets-init {#project-secrets}
- [x] CI keys stored with make secrets-ci and the first CI run green {#project-ci}

## Profile {#profile}
tech: GitHub profile README, SVG header
files: [README.md, assets/**]
kind: docs
- [x] Website source merged into this repository under web/ {#profile-merge-website}

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
- [x] Pick a design: one sample home page per style; chosen: the high-end layout in Tokyo Night colours, no photos {#web-design-samples}
- [x] Rebuild the site in Astro, six pages (Home, About, Resume, Portfolio, Blog with a first post, Contact with links only), content aligned with LinkedIn and the GitHub README {#web-astro}
- [x] make dev, make check and CI work with the Astro build (needs project-standard 1.8: Astro in the web-pages kind); old URLs keep working {#web-astro-build}
- [x] Checked in the browser at desktop and phone widths, light and dark {#web-redesign-check}
- [x] Released and deployed to production (asks first) {#web-redesign-deploy}
- [x] Theme toggle in the nav: system, light, dark; remembered per browser, no flash on load {#web-theme-toggle}
- [ ] Theme toggle deployed to production (the owner runs the deploy) {#web-theme-deploy}
- [x] Portfolio product pages filled from the projects' docs, technical and unnamed {#web-portfolio-products}
- [~] Portfolio employer pages (air quality, 5G gateway, oneM2M) filled the same way {#web-portfolio-employer}
- [ ] Portfolio personal build pages filled from the owner's facts (waits on the owner) {#web-portfolio-builds}
- [~] Blog: Mac setup post and a Claude Code setup series of five posts covering every part {#web-blog-series}
- [~] Blog: list of further post ideas from the repos, without naming projects {#web-blog-ideas}

