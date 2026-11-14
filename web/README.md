# web

The personal website at https://mayankgautam.me: plain HTML, CSS and JavaScript, served by a
Cloudflare static-assets Worker (`website-production-web`) with no build step.

## Purpose

An about page, resume, portfolio of hardware and software projects, and contact details.
Missing paths get `public/404.html` (`not_found_handling` in `wrangler.jsonc`).

## Build and run

Served from `public/` (or the build output set in `wrangler.jsonc`). `make dev` serves it locally,
`make web-deploy ENV=production CONFIRM=production` publishes it (production-only: no staging).

## Configuration

`web_OUT` in `make/project.mk` is the folder that gets deployed (default `web/public`).

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
