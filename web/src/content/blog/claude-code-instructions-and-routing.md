---
title: "My Claude Code instructions and how they route work"
description: "My global CLAUDE.md section by section, the session-start hook that turns its routing table into a per-project profile, and the settings.json around them."
date: 2026-11-15
tags: [Claude Code, tooling, workflow]
draft: false
---

This is the detailed post on the instructions side of my Claude Code setup: the global `CLAUDE.md` that every session reads, the hook that prints a project profile at session start, the `project-profile` skill, and `settings.json`. The [overview post](/blog/claude-code-setup) has the map of the whole setup; the files themselves are in the `claude/` folder of [workbench](https://github.com/mayankgautam-me/workbench).

## The global CLAUDE.md

`~/.claude/CLAUDE.md` is a symlink into the repository, so every edit to it is a commit I can read. It is about 240 lines, in sections. I go through them in order.

### This machine and dotfiles

The first sections are plain facts Claude would otherwise guess wrong: an Apple Silicon Mac, zsh, Homebrew at `/opt/homebrew`, and Node and Python managed by mise, not Homebrew. Two lines save the most trouble:

> `ls`, `cat` and `vim` are aliased to `eza`, `bat` and `nvim` in interactive shells. In scripts and when parsing output, call `/bin/ls` and `/bin/cat`.

Without it, a script that parses `ls` would get `eza`'s output instead. The dotfiles section lists where each config lives, says every one is a symlink into the repository, and asks for a shell change to be checked with `zsh -ic exit` before it is reported done.

### Preferences

Four lines: a minimal visual style in Tokyo Night colours, no boxes or pills; look at the real result with a screenshot before saying anything visual looks right; ask with concrete options when a choice is a matter of taste; keep replies short and lead with the result. The screenshot rule is there because a prompt or a panel cannot be judged from its config alone.

### Git

No `Co-Authored-By` lines and no "Generated with Claude Code" lines. `settings.json` also sets both attribution strings to empty, so this is enforced twice.

The rule that matters most to me is the branch question:

> Always ask me which branch to work on. In a project's git repository, before the first change of a piece of work, say which branch is checked out and ask, with these as options: stay on it, commit to `main`, or a new branch (suggest a name).

It is asked once per piece of work, not before every commit, and again when the work changes or the branch changes under us. An answer in one project or session does not carry to another. Agents work in their own worktrees, so for them the question is which branch their work is brought into. The only exception is the workbench repository itself, which is always committed to `main`.

### Security settings

> I run commands that need `sudo` or change security settings myself. Give me the exact command in a code block and say what it does and how to undo it.

The instruction alone is not enough, so `settings.json` denies `Bash(sudo *)`. When Claude needs root, I get a command, an explanation and the undo, and I run it in my own terminal, where Touch ID handles the password.

### This setup is a git repo

This section tells Claude how to look after the setup itself: what lives where in the repository, that everything committed is public (no secrets, no tokens, no absolute home paths, no private remote addresses; a pre-commit hook refuses home paths), that a change to how something works updates the README in the same commit, and the bookkeeping steps that are easy to forget: update `skills.txt` after installing a skill, rerun `bootstrap.sh lock` after updating a skill or plugin, bump a mod's version and run `claude plugin update` after changing it, regenerate the screenshots after changing how a mod looks. Any tracked change is committed and pushed straight away, staging files by name because other sessions may be editing the same checkout.

### Agents first

This is the longest rule section and the one that shapes a session most. The main session plans, hands work to subagents, checks what comes back and reports. It does the work itself only when it is small: a question, a known lookup, an edit to one or two files.

- Finding out (mapping code, searches across many files, docs) goes to `Explore` or the research skill's background agent.
- Building goes to the agent the route names: firmware, Go, Rust, Flutter, iOS, backend, AI.
- Independent parts of one task get one agent each, started together.
- Tests for new code and review of finished work go to an agent that did not write it.
- A bug with several plausible causes gets one agent per cause.

Every agent that writes files in a git repository works in its own worktree, so my checkout stays as I left it until the work is checked. When an agent finishes, the main session reads the diff, runs the tests in the worktree, brings the work into my branch and removes the worktree. Two agents never write the same files. And one line I would keep in any setup:

> An agent's report is a claim, not a result.

The main session owns `PLAN.md` for the project: it writes the tasks before agents start and marks them as work comes back, and agents do not edit it. Agent teams, which cost far more, stay off unless I ask.

### Skill routing

The routing table is sorted by my kinds of work: analysing an existing project; backend, frontend and database; hardware (KiCad, firmware and debugging); research; AI pipelines; IoT devices and platforms; multiplatform apps. After those come sections that apply everywhere: design and UI, security, review and debugging, testing, shell and git, this setup, the project standard, `PLAN.md`, and a short "Rarely used" list.

Each line names the skill or agent for a task, for example:

```markdown
- `pubspec.yaml` (Flutter): the `multi-platform-apps:flutter-expert` agent. <!--route:flutter-->
```

The firmware section picks the agent from the project files: a CubeMX `.ioc`, a linker script or a `thumbv*` target means the ARM Cortex-M agent; `sdkconfig` means ESP-IDF and the C agent; `platformio.ini` or `.ino` means the C++ agent; a `no_std` `Cargo.toml` means the Rust agent with the embedded Rust skill. When the files don't make the family clear, Claude asks. KiCad gets its own rules, including never editing a board or schematic while KiCad has it open.

Two general rules sit above the table: a skill or style I name in a request always wins, and where two installed skills do the same job, the one listed here is used. For new UI work, Claude asks me which of four design skills to use, once per project.

The `<!--route:name-->` at the end of a line is an HTML comment, so it is invisible when the file is rendered. There are 26 marked lines today. They are what the hook reads.

### Projects with a PLAN.md

The last long section is the contract for `PLAN.md`, the file the project map mod draws. Work goes into the plan before any code: tasks as `- [ ]` under the right component, a new component with `files:` globs if the work is a new part. Then the marks move as work happens, one task at a time: `- [~]` while being worked on, `- [x]` the moment it is done and checked, `- [!]` with a reason when blocked. Before a turn ends, every `[~]` is looked at again, so the map never shows work that is not happening. The section also spells out the exact format the map reads, because a component written any other way silently disappears from it.

## The session-start hook

`hooks/detect-project.sh` is registered as a `SessionStart` hook with a 10 second timeout. It reads the session's folder from the hook's JSON on standard input, or takes one as an argument when run by hand. It exits quietly for a folder that does not exist and for the home folder itself.

It then lists files three levels deep, skipping `node_modules`, `.git`, `build`, `target`, `dist`, virtual environments, `Pods`, `.dart_tool` and `.pio`, and runs rules of two kinds: a file name matches, or a matching file contains some text. Some rules are deliberately careful. A linker script alone does not mean Cortex-M, because ESP-IDF and RISC-V projects have them too; it counts only when a build file names `cortex-m`, `mthumb` or `arm-none-eabi`. A Tauri app's `Cargo.toml` is not also reported as a Rust service. Any firmware match also adds the routes common to all firmware.

The hook has no route text of its own. For each match it pulls the marked lines from `CLAUDE.md`:

```bash
route() {
  grep -F -- "<!--route:$1-->" "$routes" 2>/dev/null |
    sed -e 's/ *<!--route:[^>]*-->[[:space:]]*$//' -e 's/^[[:space:]]*- //' | paste -sd' ' -
}
```

Several lines with the same marker become one sentence. A route name that has no marked line prints a warning in its place rather than nothing.

Last, it checks the first two lines of `make/common.mk` for `project-standard v<N>`. A standard project is named with its version; a git repository or a folder with a `Makefile` that is not on the standard gets the standard route, which tells Claude to say so once and offer to adopt it.

For a test folder with a `platformio.ini`, a `.kicad_pcb` and a `.git`, it prints this (the KiCad and standard lines shortened here):

```text
Project profile, detected from files in ~/Projects/demo.
Use these agents and skills by default in this session; anything I name in a request wins.
- Arduino / PlatformIO firmware: `platformio.ini` or `*.ino` (Arduino / PlatformIO): the `systems-programming:cpp-pro` agent, plus the Cortex-M agent when the board is Cortex-M.
- Any firmware: Any firmware work, on top of the agent above: `embedded-systems` (RTOS, peripherals, interrupts, DMA, power). Flashing and on-chip debugging over JTAG / SWD, GDB to a bare-metal target: `openocd-jtag`.
- KiCad design: Reviewing or debugging a KiCad schematic, PCB layout, Gerbers or a PDF schematic: `kicad`. ...
- Not on the project standard: Every project uses the `project-standard` skill's layout and `make` commands, ...
```

A folder that matches nothing prints nothing, so a session in a random folder starts clean.

## Its tests

`hooks/tests/detect.bats` has 39 tests. Each builds a small project in a temporary folder with a helper that writes a file and its folders, runs the hook, and checks the output. There is one per project type, plus the edge cases: a plain `package.json` is not React Native, a linker script alone is not Cortex-M, Zephyr is not reported as Cortex-M a second time, files inside `node_modules` and build folders are ignored, a project of several kinds lists each.

Three tests keep the hook and `CLAUDE.md` in step. One checks that every route the hook names is marked in `CLAUDE.md`, one that every marker in `CLAUDE.md` is one the hook can print, and one that a multi-line route comes out as one line. The tests point the hook at a fixture file through a `CLAUDE_ROUTES` variable where they need to. The last test runs shellcheck on the hook. The rule in `CLAUDE.md` is to run the suite after changing any route:

```bash
bats ~/.workbench/claude/hooks/tests
```

## The project-profile skill

`skills/project-profile/SKILL.md` is a page long. It runs the same script on the current folder, or another one passed as an argument, then tells Claude to say in a line or two what was found and to use the named agents and skills for the rest of the session. If nothing is found, it falls back to the routing section of `CLAUDE.md`. It exists for the cases the hook misses: changing folder in the middle of a session, or adding a new part to a project.

## settings.json

The file is under a hundred lines. The parts worth noting:

- **Permissions.** Allowed without asking: `brew info`, `brew list` and `brew search`, reading `~/.zshrc`, and reading or editing `~/.tmux.conf`. Denied: `Bash(sudo *)`. `~/.config` is an extra working directory, so config files there can be edited without a prompt for each one.
- **Attribution.** Both the commit and the pull request attribution strings are empty.
- **Hooks.** One: the `SessionStart` hook above, called through `$HOME` so the file has no machine-specific path.
- **Worktrees.** `"worktree": { "baseRef": "head" }` starts an agent's worktree from my current `HEAD`, so it includes my unpushed commits. Uncommitted changes still do not come along, which is why `CLAUDE.md` says to commit what an agent needs before starting it.
- **Plugins and marketplaces.** The enabled plugins are listed by id: the four mods from `local-mods`, 24 plugins from `claude-code-workflows`, and a couple of others. The extra marketplaces are listed by their public git sources. The mods' own marketplace is not listed here; `bootstrap.sh` adds it from the `~/.claude/mods` link, so its path stays out of the file.
- **Model settings.** A larger auto-compact window for the model I use most, and two notification switches: one for when input is needed, one for agents.

## What works and what does not

What works:

- **One place for routes.** The hook keeps no copy of the routes, so they cannot drift apart. A route is changed in one line of `CLAUDE.md`, and the tests fail if a marker goes missing or is left unused.
- **The branch question.** It costs one answer per piece of work, and nothing lands on `main` unless I picked it.
- **Denying `sudo` in settings, not just in prose.** The instruction explains why; the deny makes it hold.
- **"An agent's report is a claim."** Reading the diff and running the tests before reporting means what I am told is done has been checked by something other than the agent that did it.

What does not, or not yet:

- **The file is long.** At about 240 lines, every session pays for all of it, including the routes for kinds of work the session will never touch. The hook helps by repeating only the relevant routes at the top, but the full table is still loaded.
- **Detection is shallow on purpose.** Three levels deep and a few manifests keeps it fast, but a monorepo with its firmware four levels down is not seen. The skill is the workaround.
- **Routes name things that must be installed.** A route to a plugin I have not installed does nothing useful. Anyone taking this file should trim the routes to what they have.
- **Instructions are still instructions.** Rules such as the `PLAN.md` marking are followed by the model, not enforced. The mod checks the file's format after each edit, but nothing checks that a mark matches the work, which is why the rules spell out when each mark changes.

The next post in the series covers the [project standard](/blog/project-standard), which the last line of every profile refers to.
