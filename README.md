# mayankgautam.me

Source of my personal website, https://mayankgautam.me: a static site served by a Cloudflare static-assets Worker.
Apache licensed.

| Part | Folder | What |
|---|---|---|
| web | [web/](web/README.md) | the site (`web/public/`), deployed to mayankgautam.me |

## Commands

This project follows the project standard: `make help` lists the commands.

    make setup                                    # tools and the site's packages
    make dev                                      # serve the site locally
    make web-bump LEVEL=patch && make release-push  # release: the tag deploys production

Docs: [docs/README.md](docs/README.md). Hosting and DNS: [docs/operations.md](docs/operations.md).
