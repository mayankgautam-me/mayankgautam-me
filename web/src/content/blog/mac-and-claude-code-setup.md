---
title: "My Mac and Claude Code setup, in one repository"
description: "How one clone and one command set up my Mac, from the apps and dotfiles to the Claude Code mods I use every day."
date: 2026-11-15
tags: [macOS, Claude Code, dotfiles]
draft: false
---

Everything that sets up my Mac lives in one public repository, [workbench](https://github.com/mayankgautam-me/workbench): the apps, the dotfiles, the macOS settings, the terminal and my Claude Code setup. On a new or freshly formatted Mac, one clone and one command bring it back. On the Mac I already use, one command tells me what has drifted.

It is one person's setup, published as it is used. Take the parts you want.

## One clone, one command

After installing Homebrew, the whole setup is:

```bash
git clone https://github.com/mayankgautam-me/workbench.git ~/.workbench
zsh ~/.workbench/bootstrap.sh all
```

`all` runs four steps in order, and each of them can also run alone:

- **apps** installs the Brewfile: formulas, casks and App Store apps. A cask whose app is already in `/Applications` is adopted, not reinstalled.
- **home** links every file in `home/` to the same place under `~` and installs the runtimes that mise manages.
- **macos** applies my macOS defaults and imports the Tokyo Night profile for Terminal.
- **claude** links the Claude Code setup into `~/.claude`, installs the Claude Code CLI, then the missing skills and plugins.

Every step is safe to run again. A file that a link would replace is moved to a dated backup folder first, never deleted.

`bootstrap.sh check` lists what differs from the repository: missing apps, missing links, macOS settings, the Claude CLI. It exits with an error if anything needs fixing, so it works as a quick health check.

## What is in it

The apps are the bare minimum: the shell and its tools, git, mise, the tools for my encrypted secrets repository, and a few apps. Anything a project needs beyond that comes from the project's own `make setup`.

The dotfiles cover zsh, tmux, starship, Neovim, mise's global runtimes, the ssh config (never keys) and git, with one commit email per folder of projects.

The macOS settings set up the Dock, Finder, a fast key repeat without autocorrect or smart punctuation, Dark mode, screenshots as PNG, plain-text TextEdit, and the Tokyo Night Terminal profile in Maple Mono NF.

## The Claude Code part

This is the part most people will want. It has four mods for the Claude desktop app:

- **Status band**: a band above the message box with the context used, plan limits, session cost and the agents and background tasks at work.
- **Session tint**: a colour for each session, so several open sessions are easy to tell apart.
- **Project map**: draws a project's `PLAN.md` as cards with their tasks and dependencies, and shows live which agent is working in which part.
- **Git graph**: the repository's commits as a graph, with git actions that each show their command and wait for a yes.

A session-start hook looks at a project's files, works out what kind of project it is (firmware, KiCad, Flutter, Swift, Rust and so on) and tells Claude which agents and skills fit it. The routes it prints live as marked lines in my global `CLAUDE.md`, so there is one place to change them.

The mods also install on their own, without the rest of the setup: add the repository's `mods` folder as a plugin marketplace and install the ones you want.

## A guard against leaking my home path

Because the repository is public, `bootstrap.sh` turns on a pre-commit hook that refuses any commit adding my absolute home path. Paths in the repository use `~` or `$HOME` instead.

The repository is under the GNU GPL, version 3. The [README](https://github.com/mayankgautam-me/workbench#readme) has the full steps.
