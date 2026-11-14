# website: operations

_The runbook for the deployed parts: web._

## Environments

| Part | Staging | Production |
|---|---|---|
| web | (none: production-only) | https://mayankgautam.me (Worker `website-production-web`, Cloudflare account mayankgautam-me) |

## Deploy

_The order and the checks of a release. A push to main deploys staging (not a production-only part);
the part's tag (`make <part>-bump`, `make release-push`) deploys production, then makes its GitHub
Release. By hand: `make <part>-deploy ENV=production CONFIRM=production`, or release.yml from the
Actions tab with part and confirm `production`; an image: `make <part>-release`._

### www

`www.mayankgautam.me` is a second custom domain of the same Worker, so Cloudflare keeps its DNS record. A
Redirect Rule on the mayankgautam.me zone (Rules > Redirect Rules: hostname equals `www.mayankgautam.me`,
dynamic redirect to `concat("https://mayankgautam.me", http.request.uri.path)`, 301, query string kept) sends it
to the apex; redirect rules run before Workers.

### DNS

The zone also holds the iCloud Mail records (MX, SPF, `apple-domain` TXT). The Worker's custom domains add only
the apex and `www` records.

## Rollback

_How to go back: `make versions ENV=production`, `make rollback ENV=production CONFIRM=production`,
and what a rollback does not undo (migrations, data)._

## Backup and restore

_What is backed up (`make cf-backup ENV=production` for Cloudflare data), where, how often, and the
restore steps._

## Checks

_How to tell production is healthy: `make smoke ENV=production`, dashboards, alerts, logs (`make logs`); CI runs: `make ci-status`, `make ci-logs` (gh)._

## Incidents

_What to look at first, who to tell, and how to rotate a leaked secret (`make secrets-rotate`)._
