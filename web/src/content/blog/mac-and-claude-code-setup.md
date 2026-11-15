---
title: "My Mac setup, in one repository"
description: "How one public repository sets up my Mac: apps, shell, terminal, git, runtimes, macOS settings and Claude Code, with one clone and one command."
date: 2026-11-15T18:00:00+05:30
tags: [macOS, dotfiles, Homebrew, zsh, Claude Code]
draft: false
---

Everything that sets up my Mac lives in one public repository, [workbench](https://github.com/mayankgautam-me/workbench): the apps, the dotfiles, the macOS settings, the terminal and my Claude Code setup. On a new or freshly formatted Mac, one clone and one command bring it back. On the Mac I already use, one command tells me what has drifted.

It is one person's setup, published as it is used. Take the parts you want.

## Why one repository

I used to keep a dotfiles folder, a list of apps in my head and a handful of `defaults write` commands in old notes. A reinstall meant a day of remembering. Putting all of it in one place has two effects. A new Mac is a short, boring procedure. And the repository is the source of truth for the Mac I use now, so a change I want lasts only if I make it there.

The repository is public, so nothing in it is secret. Keys, tokens and project secrets live elsewhere, and the repository has a pre-commit hook that refuses any commit adding my absolute home path. Paths in it use `~` or `$HOME`.

## One clone, one command

After installing Homebrew (it asks for a password, so I do it myself) and signing in to the App Store:

```bash
git clone https://github.com/mayankgautam-me/workbench.git ~/.workbench
zsh ~/.workbench/bootstrap.sh all
```

`bootstrap.sh` has one step per kind of thing, and each can run alone:

- `apps` installs the Brewfile.
- `home` links the dotfiles into `~` and installs the mise runtimes.
- `macos` applies my macOS defaults and imports the Terminal profile.
- `claude` links the Claude Code setup into `~/.claude`.
- `all` runs those four in order.
- `check` lists what differs from the repository.
- `lock` records the versions of the Claude skills and plugins I use.

Every step is safe to run again. A file that a link would replace is moved to `~/.workbench-backup/<time>/` first, never deleted. After `all`, I log out and in once for key repeat and Dark mode to take full effect.

## Apps

The Brewfile is the bare minimum, on purpose. It holds:

- the shell and its tools: zsh-autosuggestions, zsh-syntax-highlighting, fzf, fzf-tab, starship, eza, bat, vivid, zoxide, ripgrep, fd, jq
- Neovim and tmux
- git, gh and git-lfs
- mise, for runtimes
- sops, age and age-plugin-se, for an encrypted secrets repository
- shellcheck and bats-core, for this repository's own checks
- a few apps: Claude, OrbStack, KiCad, GitHub Desktop, Caffeine, and the Maple Mono NF font
- a few App Store apps through `mas`: Xcode, Telegram, WhatsApp, CleanMyMac and Grammarly for Safari

Anything a project needs beyond that comes from the project's own `make setup`. That keeps this list short and keeps projects reproducible without my machine. Two details in `bootstrap.sh apps` are worth knowing. A cask whose app is already in `/Applications` is adopted instead of reinstalled. And nothing is ever uninstalled: `check` only notes what is installed but not in the Brewfile, so I can decide whether it belongs.

## Shell and prompt

`~/.zshrc` is plain and commented in sections: history, shell behaviour, colours, completion, tools, aliases, and prompt and plugins last.

- History is 50,000 lines, shared between sessions, with duplicates and commands that start with a space left out.
- Up and Down search history by what is already typed.
- Tab completion goes through fzf-tab, so it is a fuzzy menu with previews of directories and files.
- `eza` and `bat` replace `ls` and `cat` through aliases, `vivid` generates the Tokyo Night file colours, and `zoxide` gives `z` for jumping to folders.
- fzf gives Ctrl-R, Ctrl-T and Alt-C, with `fd` as its file source.
- Rust and Go tool directories go on `PATH` there, and Homebrew's environment is set in `~/.zprofile`.

The prompt is starship, in `~/.config/starship.toml`. I wanted it minimal but detailed: plain coloured text, no backgrounds or boxes. The left side shows where I am (from the repository root, in bold, when inside one) and the git state: branch, staged, modified, untracked, stashed, ahead and behind. The right side shows the exit code of a failed command, how long a slow command took, background jobs, the Node, Python, Rust and Go versions when relevant, and the time. The colours are a Tokyo Night palette defined at the top of the file.

## Terminal

I use Apple's Terminal.app, with a profile named "Tokyo Night" in the Maple Mono NF font. The profile is a `.terminal` file in `macos/`. `bootstrap.sh macos` opens it to import it, then sets it as the default and startup profile. Using the stock terminal means one less app to install and update, and the profile is the only thing that makes it mine.

## tmux and Neovim

`~/.tmux.conf` changes the prefix to Ctrl-a, turns the mouse on, numbers windows and panes from 1 and renumbers windows when one closes. Splits and new windows open in the current directory (prefix `|` and `-`), panes move with prefix h, j, k and l, vi keys work in copy mode, and prefix `r` reloads the file. The status bar is at the top, in the same plain Tokyo Night colours.

`~/.config/nvim/init.lua` is a short config with no plugins: relative line numbers, system clipboard, two-space indents, smart-case search, a few window and save keys on a space leader, and a brief highlight on yank. When I need more than that, I would rather add it deliberately than carry a plugin manager I do not use.

## Git

There is one git config, in `~/.config/git/config`, with my name, my default commit email and the GitHub CLI as the credential helper. For my work folders, `includeIf "gitdir:..."` blocks load a small extra file that sets only `user.email`, so a repository commits with a different commit email depending on which folder it sits in. I never think about it, and a commit never goes out with the wrong address. The bootstrap moves a stray `~/.gitconfig` aside, because git would let it override this file, and `check` reports one if it appears.

The ssh config is in the repository too, but only its structure: an OrbStack include and a `ProxyCommand` that reaches a couple of devices through a Cloudflare tunnel. Keys are never in it.

## Runtimes with mise

Node and Python come from mise, not Homebrew. The global file, `~/.config/mise/config.toml`, has two lines: Node 24 and Python 3.13. A project that needs another version pins it in the project. `bootstrap.sh home` runs `mise install` at the end, and `.zshrc` activates mise so the right versions are on `PATH` in each folder.

## macOS settings

`macos/defaults.sh` is a table of `domain | key | type | value` rows, one per setting, followed by a few lines of code that apply it. I like the table because the script can also read it back: `bash macos/defaults.sh --check` prints each setting whose current value differs, and exits with an error if any does. What it sets:

- **Dock**: auto-hide with no delay, small icons, no recent apps, and the bottom-right hot corner shows the Desktop.
- **Finder**: hidden files and all extensions shown, path and status bars, list view, folders first, search the current folder, no `.DS_Store` files on network volumes.
- **Keyboard**: fast key repeat, a short initial delay, no press-and-hold accents, and no autocorrect, smart quotes or smart dashes.
- **Look and screenshots**: Dark mode, PNG screenshots without the window shadow, saved into `~/Pictures/Screenshots`.
- **TextEdit**: opens plain text instead of rich text.
- **Terminal**: the Tokyo Night profile as default.

One caveat, from the TextEdit row. TextEdit is a sandboxed app, and macOS only lets a program write another app's settings if it is allowed to reach that app's data. So `defaults write` for TextEdit can fail from a script run another way. The script collects the keys it could not write and says so; running it from Terminal and allowing the access prompt fixes it.

## Keeping it in sync

The dotfiles are symlinks. `~/.zshrc` points at `~/.workbench/home/.zshrc`, and so on for every file under `home/`, which mirrors `~`. Editing a dotfile in place edits the repository, so there is no separate copy to forget to update, and `git diff` shows what I changed.

`zsh ~/.workbench/bootstrap.sh check` then compares the Mac with the repository and reports:

- Brewfile entries that are missing
- dotfiles that are not linked
- a `~/.gitconfig` that overrides the git config
- macOS settings that differ
- the Claude Code CLI, if it is missing
- the commit guard, if it is off

It exits with an error when something needs fixing, so it works as a health check. It also prints notes that need no fix: apps installed outside the Brewfile, uncommitted changes in the repository, and a `versions.lock` that differs from what is installed. Drift usually means I changed something on the Mac and have not decided yet whether it belongs in the repository. Either I add it, or I let `bootstrap.sh` put it back.

## Claude Code

The `claude/` folder of the repository is linked into `~/.claude` by `bootstrap.sh claude`. It holds my global `CLAUDE.md`, `settings.json`, four mods for the Claude desktop app, a hook that tells Claude what kind of project it is in, two skills, a list of the third-party skills I install, and `versions.lock`. The step also installs the Claude Code CLI with Anthropic's installer, then the missing skills and plugins.

That is a lot to explain here, so it has its own posts:

- [My Claude Code setup](/blog/claude-code-setup), the overview.
- [Instructions and routing](/blog/claude-code-instructions-and-routing): the global `CLAUDE.md` and how a project is matched to agents and skills.
- [One project standard](/blog/project-standard): the same layout and `make` commands in every project.
- [The mods](/blog/claude-code-mods): status band, session tint, project map and git graph.
- [Skills and plugins](/blog/claude-code-skills-and-plugins): what I install and how it is pinned.

## A new Mac, start to finish

1. Sign in to the App Store, then install Homebrew from [brew.sh](https://brew.sh).
2. Clone the repository to `~/.workbench`.
3. Run `zsh ~/.workbench/bootstrap.sh all`.
4. Log out and in again.
5. Run `zsh ~/.workbench/bootstrap.sh check`. It should say `check: clean`.

After that I open a project, run its `make setup`, and start work.

The repository is under the GNU GPL, version 3. The [README](https://github.com/mayankgautam-me/workbench#readme) has the full steps.
