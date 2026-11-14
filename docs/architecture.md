# mayankgautam-me: architecture

_The parts, how they talk to each other, and where each one runs._

## Parts

```mermaid
flowchart LR
  web["web<br/>web-pages"]
  visitor["visitor"] -->|HTTPS mayankgautam.me| web
```

## Data flow

_What data moves between the parts, in which direction and format, for the main use cases._

## Where each part runs

| Part | Kind | Runs on | Folder |
|---|---|---|---|
| web | web-pages | Cloudflare static-assets Worker `website-production-web` | `web/` |

## External services

- Cloudflare (personal account mayankgautam-me, free plan): registrar, DNS and the Worker.
- GitHub (`mayankgautam-me/mayankgautam-me`, public, also the profile README): the code and the Actions that deploy it.
- iCloud Mail: mail for the domain (its records are in the Cloudflare zone).
