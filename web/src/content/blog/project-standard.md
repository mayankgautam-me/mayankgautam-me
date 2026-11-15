---
title: "One set of make commands for every project"
description: "The project standard I use for firmware, boards, Cloudflare services and apps: the same make commands everywhere, encrypted secrets per GitHub owner, and shared CI workflows."
date: 2026-11-15
tags: [make, CI, secrets, Claude Code]
draft: false
---

My projects are a mix: Zephyr firmware on an nRF91, ESP32 boards, KiCad schematics, Cloudflare Workers, a Flutter app now and then, a Go service. For years each of them had its own way of doing things. One had a `flash.sh`, another a `Makefile` in the firmware folder, another an out-of-date "how to deploy" section in its README. Secrets lived in `.env` files, `.dev.vars` files, and once in a folder called `keys/` that should never have been committed.

The project standard is my answer to that. It is a Claude Code skill, kept in my public [workbench](https://github.com/mayankgautam-me/workbench) repository under `claude/skills/project-standard`, plus a public repository of shared CI workflows, [ci-templates](https://github.com/mayankgautam-me/ci-templates). This post is what it does, how it is laid out, and what it costs.

## The problem

The tools were never the issue: `west`, `idf.py`, `kicad-cli`, `wrangler` and the rest all work. The issue was that every project put different commands in front of them, and I had to remember which each time I came back after a few months.

The same went for where the secrets are, how CI is wired, how a release is tagged and where the docs go. Every project answered differently, and the answers lived in my head.

## One verb per stage

The idea is simple. Every project gets the same commands:

- `make <verb>` runs a stage for the whole project.
- `make <part>-<verb>` runs it for one part.
- Everything runs from the project root.

The verbs are grouped by stage of work, one set per stage:

- **Setup**: `setup`, `doctor`, `update`, `teardown`, `prune`.
- **Dev**: `dev`, `stop`, `status`, `logs`, `reset`.
- **Test**: `check`, `test`, `test-e2e`, `format`.
- **Cloudflare**: `cf-login`, `cf-provision`, `cf-status`, `cf-migrate`, `cf-secrets`, `cf-backup`, `cf-wipe`, `cf-destroy`.
- **Secrets**: `secrets-init`, `secrets-set`, `secrets-list`, `secrets-check`, `secrets-rotate`.
- **Deploy**: `deploy`, `smoke`, `test-remote`, `promote`, `rollback`.
- **CI**: `ci-lint`, `ci-status`, `ci-logs`, `ci-local`, `ci-setup`.
- **Firmware**: `<part>-build`, `-flash`, `-erase`, `-monitor`, `-debug`, `-release`.
- **Hardware**: `<part>-check` (ERC, then DRC), `-build` (Gerbers, BOM, PDF, STEP), `-bom`.
- **Apps**: `<part>-build`, `-release` for iOS, Android, macOS or Linux.
- **Release**: `<part>-bump`, `release-push`, `latest`.

`make help` lists only the commands the project's parts actually use, grouped by stage and then by part. A project with no firmware has no `flash`; one with no Cloudflare part has no `cf-*` group. `make help ALL=1` shows everything.

`make check` is the one I run most, before every commit and in CI: format check, lint, typecheck and unit tests across all parts. For firmware that is a build with `-Werror` and host or `native_sim` tests; for a KiCad board, ERC and DRC.

## Parts and kinds

A project is a list of parts, and each part has a kind. The list lives in `make/project.mk` as `name:kind[:dir]`:

```make
PROJECT   := myproject
PORT_BASE := 8100
PARTS := \
  firmware:zephyr \
  hardware:hardware \
  cloud-api:cloud-worker:cloud/api
firmware_BOARD := nrf9151dk/nrf9151/ns
```

There are fifteen kinds:

- `zephyr`: Zephyr or nRF Connect SDK firmware (west, MCUboot).
- `espidf`: ESP32 firmware (idf.py, esptool).
- `pio`: PlatformIO firmware.
- `arm-gcc`: bare-metal Cortex-M (arm-none-eabi-gcc, openocd).
- `circuitpython`: CircuitPython boards.
- `hardware`: KiCad 10 boards (kicad-cli).
- `cloud-worker`: a Cloudflare Worker with D1, KV, R2 or Queues.
- `web-pages`: a static or Astro site on a static-assets Worker.
- `app-flutter`: Flutter apps.
- `app-tauri`: Tauri desktop apps.
- `app-xcode`: Swift apps (xcodebuild).
- `app-android`: Android apps (gradle).
- `docker`: container images and compose services.
- `go`: Go services.
- `python`: Python packages and services (uv, ruff, pytest).

Each kind is one make file in `make/kinds/` that maps the verbs to the real tool. Firmware SDKs are pinned per part and installed once per machine into `~/.toolchains/<tool>-<version>`, so two projects on different NCS or IDF versions sit side by side. Dev ports are `PORT_BASE` plus an offset per part, so two projects can run `make dev` at the same time.

A part with nothing in its folder yet is "not started": `check` and `build` skip it, while `flash` and `release` refuse. So I can list a hardware part before there is a `.kicad_pro` in it.

## The layout, and who owns which file

Every project has the same shape. Folders are lowercase, and each part lives in the folder of its kind: `firmware/`, `hardware/`, `cloud/`, `web/` or `app/`. A project with two firmware parts gives each a subfolder named for its chip, such as `firmware/nrf9151/` and `firmware/stm32f042/`.

The important split is between managed files and files the project owns:

```
Makefile            3 lines: includes project.mk and common.mk   managed
make/common.mk      the stage commands, guards, help             managed
make/kinds/<k>.mk   one per kind the parts use                   managed
make/bin/*.sh       secrets, Cloudflare, release, toolchain      managed
make/VERSION        the standard version these came from         managed
make/project.mk     PROJECT, PORT_BASE, PARTS, settings          yours
make/local.mk       targets only this project needs              yours
secrets.schema      the name of every secret, never a value      yours
```

A managed file starts with a `# project-standard v1.0 (managed: ...)` line and is never edited in a project. It is refreshed by the skill's update mode. Anything a project needs beyond the standard goes in `make/local.mk`, with a `## ` comment so `make help` shows it under "project":

```make
.PHONY: render-case
render-case: ## Render the enclosure for the README
	@./scripts/render-case.sh
```

There is no `.env.example`. `secrets.schema` replaces it.

## Four modes: new, adopt, update, audit

The skill has four modes, and Claude picks one from what I ask.

**new** asks for the project name, the GitHub owner and the parts with their kinds, then runs `scaffold.sh`. The scaffold makes no network calls and runs no git. It writes the managed files, the project's own files, starter code per part, the docs and the two CI workflows. For every cloud part it asks whether there is a staging environment, and never assumes. Then come the GitHub repository (after I confirm), `make setup`, `make secrets-init` and `make doctor`.

**adopt** brings an existing project onto the standard. It is read-only until I say yes. It runs `audit.sh`, then builds a migration plan: the parts, the folder renames to lowercase, an old-to-new command table (`make -C Firmware/Node flash` becomes `make firmware-flash`, or "kept in make/local.mk"), where every secret file moves, how the old CI maps onto the new workflows, and where each existing doc goes. The work then happens in a git worktree, never in my checkout. A rename on macOS goes through a temporary name, because the file system is case-insensitive:

```sh
git mv Firmware Firmware.tmp && git mv Firmware.tmp firmware
```

An existing Worker keeps its name and resource ids, so the first deploy updates it instead of creating a new one.

**update** refreshes a standard project to the skill's current version. It re-copies the managed files and moves the `uses:` lines of the workflows to the current tag. It never touches `make/project.mk` or `make/local.mk`; if a managed file was edited by hand, those lines move into `make/local.mk` first.

**audit** runs `audit.sh <dir>` and reports. It changes nothing. Exit code 0 means standard and current, and `--json` gives the findings to a script. For a project that is not standard yet, it also lists the make targets its Makefiles define today, which is where adopt's command table comes from.

## Secrets: sops, age and one repo per owner

Secrets never live in a project. Each GitHub owner, my personal account or an organization, has one private secrets repository, `<owner>/secrets`, checked out at `~/.secrets-<owner>`. Files in it are encrypted with [sops](https://github.com/getsops/sops) and [age](https://age-encryption.org), one folder per project:

```
~/.secrets-<owner>/
  recipients/        the public halves of every key
  myproject/common.env.sops
  myproject/local.env.sops
  myproject/staging.env.sops
  myproject/production.env.sops
  myproject/keys/<name>.sops
```

Values are encrypted and names stay readable, so diffs still make sense.

Which secrets repo a project uses is worked out from its git remote. `make/common.mk` reads the owner from `origin`; in GitHub Actions, from the repository owner. A project of one owner never sees another owner's secrets.

The project commits only `secrets.schema`: one line per secret with its name, which environments have it, who uses it, and whether it can be generated:

```
# NAME                 envs                     used-by   gen  description
CLOUDFLARE_API_TOKEN   staging,production       auth,ci   no   the project's one token
JWT_SECRET             local,staging,production cf        32   HMAC key for sessions
mcuboot                keys                     firmware  mcuboot-ecdsa-p256  MCUboot signing key
```

Each Mac has two keys. A Secure Enclave key, unlocked with Touch ID, opens everything; a dev key in the Keychain opens only `common` and `local`, so `make dev` never asks for a fingerprint. A stolen laptop without my fingerprint opens only local development values. An offline recovery key, kept on paper, can enrol a Mac when no other is at hand.

A command gets its secrets through `secrets.sh exec --env <ENV> -- <command>`: it decrypts that environment into the command's environment and `exec`s it. Nothing is written to disk. For staging and production only the names the schema declares are exported, so a name planted in the encrypted file cannot reach a deploy.

No command ever prints a value. `secrets-set` reads from a hidden prompt or stdin, never from the command line; `secrets-list` shows names, environments and whether each one is present. Moving an old `.dev.vars` file in looks like this:

```sh
while IFS='=' read -r k v; do
  [ -n "$k" ] && printf '%s' "$v" | make secrets-set NAME="$k" ENV=staging
done < .dev.vars
```

## Cloudflare: names and the CONFIRM guard

Each project has one Cloudflare API token for all its environments. `make cf-login` opens the dashboard's token form pre-filled with the permissions the project needs, takes the token in a hidden prompt and stores it for staging and production. I never run `wrangler login`.

The bindings under each environment of a part's `wrangler.jsonc` are the single source of truth. `make cf-provision ENV=staging` creates whatever D1 databases, KV namespaces, R2 buckets and Queues are missing and writes the ids back into the file, keeping its comments. Resources are named by environment:

| Resource | Name |
|---|---|
| Worker | `<project>-<env>-<part>` |
| D1, R2, Queue | `<project>-<env>-<name>` |
| Dead-letter queue | the queue's name and `-dlq` |
| KV namespace | `<project>-<env>-<binding>` |

So `myproject-production-db` and `myproject-staging-db` are never confused. `cf-wipe` and `cf-destroy` refuse any D1, R2 or queue name that does not start with `<project>-<env>`, which keeps a wrong `ENV=` or a copied config away from another environment's data. Both take a backup first, encrypted with age into `~/Backups/<project>/`.

`ENV` is `local` by default, or `staging` or `production`. Anything that touches production, and every destroy, wipe or reset, needs `CONFIRM=<env>` on the command line:

```sh
make deploy ENV=staging
make web-deploy ENV=production CONFIRM=production
make cf-wipe ENV=staging CONFIRM=staging
```

`CONFIRM` only counts when it is typed on the command line. One exported in the shell, set in a file or passed through `MAKEFLAGS` does not: make reads the arguments of its own process to tell. `make -i` is refused, and every guard shares its shell line with the action it protects. `cf-destroy` on production also asks me to type the project name, and CI cannot destroy production at all. Chip erase needs `CONFIRM=erase`, and eFuse burns need `CONFIRM=fuse`. Claude asks before any of these and never types `CONFIRM` itself.

## CI: reusable workflows pinned to a tag

The CI logic lives in one public repository, `mayankgautam-me/ci-templates`, with one reusable workflow per kind at `.github/workflows/<kind>.yml`. Every step in them calls `make`, so CI runs what I run locally. A project has two short workflow files that call them, pinned to the tag `v1.0`:

```yaml
web:
  needs: changes
  if: needs.changes.outputs.web == 'true'
  uses: mayankgautam-me/ci-templates/.github/workflows/web-pages.yml@v1.0
  with:
    part: web
    part_dir: web
    production_only: true
```

`checks.yml` runs on pushes and pull requests. A `changes` job first decides which parts run: a part runs only when its folder, `make/`, the `Makefile`, `mise.toml` or the workflows changed. A push to main deploys staging for a cloud part that has one. Production never deploys on a branch push.

`release.yml` runs on a tag. Its manual run holds the production jobs, such as an OTA upload or store publishing, and they need an input `confirm` set to `production`. That mirrors `CONFIRM=` on the Mac. Free private repositories have no environment protection rules, so this input is the gate.

CI reads the secrets repository with a read-only SSH deploy key, and decrypts with a per-project age key stored as the repository secret `SOPS_AGE_KEY`. `make ci-setup` creates both and sets the repository variables, printing no values. Only `actions/*` actions are used, each pinned by commit SHA. `make ci-local JOB=<job>` runs one job in Docker with `act` before I push.

## Releases per part

Each part releases on its own, from its own tag `<part>-v<version>`. A project with firmware, a board and a Worker has three version lines, and that matches how they actually change.

```sh
make firmware-bump LEVEL=minor
make release-push
```

`bump` sets the version in the kind's own source file, moves the notes under `## [Unreleased]` in the part's `CHANGELOG.md` to a dated version section, commits only those files and makes the tag. It never pushes. `release-push` pushes the branch, then each tag in its own push, since GitHub starts no workflow for a push of more than three tags.

The tag starts `release.yml`, which checks, builds and makes the GitHub Release `<part> <version>` with the CHANGELOG section as its notes and the build files attached with a `SHA256SUMS`. For a cloud-worker or web-pages part, the tag push is also the production deploy, and the Release is made only after that deploy succeeds, so a Release means "this version is live".

## Documents and PLAN.md

Docs are Markdown in git, with Mermaid diagrams inside them. Binary documents are never committed: `.gitignore` ignores PDF, Word, Excel and PowerPoint files. A generated PDF, such as a schematic, is a release asset instead.

The scaffold writes each doc once, with headings and a hint per section, and never overwrites one. Every project gets `docs/README.md` as the index and `docs/architecture.md` with a Mermaid node per part. Every part gets a README and a CHANGELOG in Keep a Changelog format. Each kind adds its own: firmware gets `protocol.md` and `flashing.md`, a board gets `bringup.md` and `manufacturing.md`, a Worker gets `api.md` and `data.md`, an app gets `distribution.md`.

`PLAN.md` at the root lists the project's components and their tasks, one `## Name {#id}` heading per part with a `files:` line and `- [ ]` tasks. A mod in my Claude Code setup draws it as a project map. The scaffold writes it with a component per part and starter tasks.

## Testing the skill

The skill is mostly make and bash: about 830 lines in `common.mk`, 2,100 in `scaffold.sh` and 900 in `audit.sh`, and around 12,000 lines across the managed files and scripts together. It has to run on GNU make 3.81, the version macOS ships, and on make 4.x in CI images, and every script has to work with bash 3.2.

It is tested with [bats](https://github.com/bats-core/bats-core). There are thirteen test files and about 500 tests, covering the common make logic, secrets, Cloudflare, firmware, hardware, apps, CI, releases, the scaffold, the audit and the toolchain ledger. Every test runs inside its own temporary folder, with `HOME`, `TMPDIR` and the secrets directory redirected there and stub tools first on `PATH`. Nothing touches the real secrets repository, the Keychain, the Secure Enclave, Cloudflare or GitHub. The stubs record their arguments and stdin, so a test can check that Worker secrets reach `wrangler` on stdin and never in its arguments.

One test file is a static lint rather than a behaviour test. It reads every recipe in `common.mk` and the kind files and fails if a shell line that deploys, uploads or decrypts production secrets has no guard before the action on that same line.

## A worked example: this site

The repository for this website is itself a standard project with one part:

```make
PROJECT   := mayankgautam-me
PORT_BASE := 8000

PARTS := \
  web:web-pages

web_OUT := web/dist
web_URL_production := https://mayankgautam.me
```

The site is an Astro build in `web/`, served by a static-assets Worker on `mayankgautam.me`, its only address. It has no staging, so it is production-only: a push to main runs check and build and deploys nothing, and `make web-deploy ENV=production CONFIRM=production` deploys it. Its `secrets.schema` has two lines, the Cloudflare token and the account id. `make dev` runs the Astro dev server on port 8000, and `make check` runs the same checks CI does. It came in through adopt as static HTML and was later rebuilt in Astro; the make commands did not change.

## What it costs, and what it does not do

It costs a few things.

- **A lot of make and shell.** Twelve thousand lines is real code to maintain, and easy to get subtly wrong. The tests are why I trust it.
- **Touch ID, often.** Every staging and production secret needs a fingerprint, and every firmware build is signed with the real key, so `make build` asks once per firmware part. The image I test is the image I ship, but I press the sensor a lot.
- **GitHub's Free plan.** The included Actions usage is $12 a month, and macOS minutes are the most expensive, so macOS jobs are off unless a repository variable turns them on.

It also does not do some things, on purpose.

- It does not replace the tools. `west`, `wrangler` and the rest stay what they are; only the commands in front of them change.
- The `cf-*` commands manage D1, KV, R2 and Queues only. Durable Objects and other bindings go to wrangler on deploy as written. Durable Object storage and R2 objects are not in `cf-backup`, and `cf-wipe` refuses while an R2 bucket is declared until I copy its objects myself.
- `make teardown` never removes Homebrew packages; it lists them so I can decide.
- Not every template has run on GitHub yet. The spec lists that as a known gap, along with the Windows arm64 image.
- It does not draw boards or decide anything for me. Creating a repository, writing repository secrets, pushing tags and anything with `CONFIRM` stay my steps.

The skill and the CI templates are both public. The [workbench README](https://github.com/mayankgautam-me/workbench#readme) has the install steps, and `reference/standard.md` in the skill is the full spec.
