---
title: "My Claude Code setup, part by part"
description: "What is in the Claude Code half of my workbench repository, how it gets installed on a Mac, and where each part is explained in detail."
date: 2026-11-15T17:00:00+05:30
tags: [Claude Code, dotfiles, tooling]
draft: false
---

I use Claude Code for firmware, KiCad reviews, web services, AI pipelines and the apps that sit next to devices. The setup around it has grown: a global instruction file, a settings file, a hook, two skills of my own, four mods for the desktop app, and a list of third-party skills and plugins. All of it now lives in the `claude/` folder of my public [workbench](https://github.com/mayankgautam-me/workbench) repository.

This post is the map. It says what each part is in one paragraph and points to the post that goes into it. The [Mac post](/blog/mac-and-claude-code-setup) covers the rest of the repository: apps, dotfiles and macOS settings.

It is one person's setup, published as it is used. The instructions and settings are personal and are better read as an example than copied. The mods stand on their own.

## Why it is in a repository

`~/.claude` collects a lot: sessions, history, caches, login data, installed plugins. A few files in it are mine and worth keeping: `CLAUDE.md`, `settings.json`, my hooks and skills. Before this setup those lived only on one Mac, and every change was a change nobody could review or undo.

Putting them in git fixes three things:

- **A new Mac gets the same Claude.** One command links the files back and reinstalls the skills and plugins.
- **Every change is a commit.** When Claude edits its own instructions or settings, I see a diff.
- **Drift is visible.** `bootstrap.sh check` says when a link is missing, when the CLI is missing, or when an installed skill or plugin no longer matches what was recorded.

The rule in my `CLAUDE.md` is that a change to any tracked file is committed and pushed to `main` straight away, with files staged by name because several sessions may be working in the same checkout. It is the one repository where I let Claude commit to `main` without asking.

## How it is installed

On a new Mac, after Homebrew and the clone, the Claude part is one step:

```bash
zsh ~/.workbench/bootstrap.sh claude
```

It does these things, in order:

1. **Links the files.** `CLAUDE.md`, `settings.json`, `skills.txt`, `versions.lock`, `mods`, `hooks`, `skills/project-profile` and `skills/project-standard` are each symlinked from `~/.workbench/claude/` to the same name under `~/.claude`. A file a link would replace is moved to a dated backup folder first. Editing `~/.claude/CLAUDE.md` therefore edits the repository.
2. **Recovers a rewritten `settings.json`.** Some apps write `settings.json` as a plain file, which breaks the link. The script notices that (it leaves a marker file when it links), copies the new content into the repository, relinks it and tells me to review the diff.
3. **Installs the Claude Code CLI** from Anthropic's installer if it is missing.
4. **Installs the third-party skills** listed in `skills.txt`, one `owner/repo@skill` per line, with `npx skills add`. Skills already present are skipped.
5. **Adds the plugin marketplaces.** One is [wshobson/agents](https://github.com/wshobson/agents), where most of my plugins come from. The other is `local-mods`, which is just the `~/.claude/mods` link, so its path is the same on every Mac and never has to be written into `settings.json`.
6. **Installs every enabled plugin** that `settings.json` lists and that is not installed yet.

Neither the skills installer nor the plugin installer can pin a commit. So there is a second command:

```bash
zsh ~/.workbench/bootstrap.sh lock
```

It writes `versions.lock`: one sorted line per skill (with the folder hash the installer recorded), one for the marketplace commit and one per enabled plugin with its version. It is 46 lines today. `check` compares the lock with what is installed and prints the lines that differ, which is how one Mac tells me upstream has moved since I last looked. It does not stop anything from updating; it only makes the change visible, and I rewrite the lock after reviewing it.

## The global CLAUDE.md

`CLAUDE.md` is the instruction file every session reads. Mine is about 240 lines. It starts with facts about the machine (Apple Silicon, zsh, Homebrew, mise for Node and Python, which commands are aliased) and my preferences (short replies, look at a screenshot before saying something looks right, ask when a choice is a matter of taste). Then come the rules that matter most day to day: always ask which branch to work on, never run `sudo` myself, delegate most work to subagents in their own worktrees, keep a project's `PLAN.md` in step with the work, and a routing table that says which agent or skill handles which kind of work, from firmware to KiCad to Flutter. The routing lines carry markers that the session-start hook reads. The whole file, section by section, is in [My Claude Code instructions and how they route work](/blog/claude-code-instructions-and-routing).

## settings.json and permissions

`settings.json` is short on purpose. It allows a handful of read-only Homebrew commands and reading or editing two dotfiles, adds `~/.config` as an extra working directory, and denies one thing outright: `Bash(sudo *)`. Anything that needs root, I run myself from a command Claude gives me. It also turns off the commit and pull request attribution lines, registers the session-start hook, starts agent worktrees from the current `HEAD` rather than the default branch, lists the enabled plugins and the extra marketplaces, and sets a larger auto-compact window for the model I use most. Details are in the [instructions post](/blog/claude-code-instructions-and-routing).

## The session-start hook

`hooks/detect-project.sh` runs when a session starts. It looks at file names three levels deep, and inside a few manifest files, and works out what kind of project the folder is: Flutter, React Native, Swift, Android, Tauri, Svelte, Next.js, Go, Rust, Zephyr, Cortex-M, ESP-IDF, PlatformIO, embedded Rust, KiCad, AI or ML work, data pipelines, MQTT. For each one it finds, it prints the matching route. The hook holds no route text itself; it copies the lines of `CLAUDE.md` that end in a marker such as `<!--route:kicad-->`. That keeps one place to change a route. A bats suite of 39 tests builds small fake projects and checks what is printed, and also checks that every marker in `CLAUDE.md` is one the hook can print and the other way round. How the detection and the tests work is in the [instructions post](/blog/claude-code-instructions-and-routing).

## The project-profile and project-standard skills

Two skills are mine and live in the repository.

`project-profile` is small: it re-runs the detection hook on demand, for when I change folder in the middle of a session or add a new part to a project, and tells Claude to follow what it prints.

`project-standard` is large. It gives every project the same layout and the same `make` commands for each stage of work: `make setup`, `make dev`, `make test`, secrets, Cloudflare, deploy, CI, firmware for Zephyr, ESP-IDF, PlatformIO, arm-gcc and CircuitPython, KiCad hardware, apps and releases. The tools underneath stay what they are; only the commands in front of them are the same everywhere. It has four modes: `new` scaffolds a project, `adopt` moves an existing one over (only when I ask), `update` refreshes the managed files and `audit` reports the differences. Secrets live in one encrypted repository, decrypted only into the environment of the command that needs them. The CI jobs it uses are kept as templates in the skill. The detection hook adds one line to every profile saying whether a folder is on the standard. All of that has its own post: [One set of make commands for every project](/blog/project-standard).

## The four mods

Mods are plugins with a hooks module that draws into the Claude desktop app. I wrote four. They are the part of the setup other people are most likely to want, and they install on their own without the rest.

- **Status band** is a band above the message box with four gauges: context used, the five-hour and weekly plan limits, and the session's cost. Under them, a row per running subagent and per background command. It folds to one row.
- **Session tint** gives each session its own Tokyo Night colour, worked out from the session id, so several sessions side by side are easy to tell apart. It colours the rule above the message box, my prompts, the spinner and the line that closes a turn. `/tint <name>` changes it.
- **Agent map** (the project map) draws a project's `PLAN.md` as cards: one per component, with its tasks, a progress bar and arrows for dependencies. While Claude works, it shows which agent is in which component, on which files. It also checks `PLAN.md` after every edit and reports lines the map cannot read.
- **Git graph** draws the repository's commits as a graph, modelled on the Git Graph extension for VS Code, with worktrees, stashes, a branch filter and a find box. Every git action shows its exact command and waits for a yes before it runs.

Each mod has the same shape: pure logic in `core.ts`, the drawing and hooks in `register.tsx`, and tests run by `claude plugin test`. How they are built, and what the mod API made easy or hard, is in [Four mods for the Claude Code desktop app](/blog/claude-code-mods).

## Installed skills and plugins

Most of what Claude can do beyond the defaults comes from other people's work.

The plugins are 24 from the `claude-code-workflows` marketplace ([wshobson/agents](https://github.com/wshobson/agents)): backend development, systems programming (the C, C++, Rust and Go agents), the ARM Cortex-M agent, multi-platform apps, UI design, security scanning, reverse engineering, LLM application development, data engineering, testing and review. Each brings agents and skills that the routing table in `CLAUDE.md` names by their full ids, such as `systems-programming:rust-pro`.

The skills in `skills.txt` are 21 lines from a handful of repositories. For hardware there are a KiCad analysis skill with its BOM, JLCPCB and PCBWay companions, `embedded-systems`, `embedded-rust`, `openocd-jtag` and an MQTT skill. Then there are design skills for frontend work, the Svelte skills, a Tauri skill, a research skill and a security audit skill.

The routing table decides which of these are used where, so having many installed does not mean all of them load. What each one is for, and which ones overlap, is in [The skills and plugins I keep installed](/blog/claude-code-skills-and-plugins).

## The screenshots

The images in the repository's READMEs are generated, not captured from the screen. `docs/screenshots/make/make.sh` copies a demo test into each mod, runs `claude plugin test` so the mod draws demo content, lays the drawing out as a page with the app's cell sizes, and has a small Swift program render the page to a PNG with WebKit. The project map image is the mod's own SVG, drawn from a demo `PLAN.md`. The layout, colours and text are the mods'; buttons and fonts are stand-ins for the app's own. The point is that the pictures can be regenerated after every change and never show a real project. My `CLAUDE.md` says to rerun the script and commit the new images whenever a mod's look changes.

## What I would tell someone starting

- **Start with the mods, not the whole setup.** Add the `mods` folder as a marketplace and install the ones you want. Nothing of yours is replaced.
- **Keep your instructions in git.** Even without anything else from here, a linked `CLAUDE.md` and `settings.json` in a repository is worth it for the diffs alone.
- **Route by project, not by memory.** Writing down which agent handles which kind of work, and having a hook print it at session start, means each session starts from the same choices instead of whatever I remember to ask for.
- **Expect the mod API to move.** It is new. A mod that stops loading after an update is most likely an API change.

Everything was built and checked on one Apple Silicon Mac with the desktop app and a dark theme. `bootstrap.sh` has not yet been run end to end on a second machine, which is the next thing I want to prove.

The repository is under the GNU GPL, version 3: [github.com/mayankgautam-me/workbench](https://github.com/mayankgautam-me/workbench).
