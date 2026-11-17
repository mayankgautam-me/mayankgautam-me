# mayankgautam-me: documents

This repository is two things: my GitHub profile README (`README.md` and `assets/` at the root, shown on
github.com/mayankgautam-me) and the source of my personal website, https://mayankgautam.me: an Astro site in
`web/`, built to `web/dist/` and served by a Cloudflare static-assets Worker. The rest of the root (`Makefile`, `make/`, `docs/`,
`.github/`) belongs to the website and follows the project standard: `make help` lists the commands.

    make setup                                      # tools and the site's packages
    make dev                                        # serve the site locally
    make web-bump LEVEL=patch && make release-push  # release: the tag deploys production


_Every document in this project. Add a line here when you add a doc._

Docs are Markdown; diagrams are Mermaid blocks inside them; images are SVG, or PNG (Git LFS), in
`docs/images/` or `docs/<part>/images/`. Binary documents (PDF, Word, Excel, PowerPoint) are never
committed: a generated PDF is attached to a release.

## Project

- [Profile README](../README.md): the GitHub profile page (not the website)
- [Architecture](architecture.md): the parts, how they connect, where each runs
- [Operations](operations.md): deploy, rollback, backup, checks
- [References](references.md): links to the docs and references the site works from

## Parts

### web

- [README](../web/README.md), [Changelog](../web/CHANGELOG.md)
