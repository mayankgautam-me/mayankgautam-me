---
title: "Four Claude Code mods: status band, session tint, project map and git graph"
description: "What four small mods for the Claude desktop app show, when they update, how they work inside, and what I learned building them."
date: 2026-11-15
tags: [Claude Code, mods, tooling]
draft: false
---

Claude Code has a way to change its own interface: a plugin can ship a hooks module that reacts to what the session does and draws things in the app. I call my plugins mods. I built four and use them every day: a status band, a session tint, a project map and a git graph.

This post goes through each one: what it shows, when it updates, how it works inside, what you can set, and where it falls short. The [overview post](/blog/claude-code-setup) covers the rest of my setup. The code is in the public [workbench repository](https://github.com/mayankgautam-me/workbench), under `claude/mods`, and each mod has its own README. The images below are generated from each mod's own output with demo content, not captured from the app.

## Status band

The status band sits above the message box and shows how much of the session's limits are used and what is running.

![The status band with four gauges: context, 5-hour limit, weekly limit and session cost, and two agents at work below](https://raw.githubusercontent.com/mayankgautam-me/workbench/main/claude/docs/screenshots/status-band.png)

It has four gauges, each a bar, a figure and a line of detail: **context** (how much of the model's window the conversation fills, in percent and tokens), the **5-hour** plan limit with its reset time, the **weekly** limit, and the **session** cost. A gauge turns amber from 70% and red from 90%. Below them, a row per subagent shows what it is doing, how long it has run and its tool calls, and a row per background command shows whether it is running or finished. Secrets in a command are masked before it is shown.

**When it updates.** A one-second timer starts with the session; every second tick it reads the usage figures again, and while an agent or task is running it redraws each second so the elapsed times count up. At the end of a turn the session reports which background tasks are still running, and the band is set against that list.

**How it works.** It uses a handful of hooks: `session.start` to register the `/band` command and read the first figures, `agent.spawn` and `tool.call` to follow agents, `turn.complete` and `classic.Stop` to close a turn, and `ui.render` for the component above the prompt. The figures come from the session's own usage call. Before the first reply of a session the app has no context reading, so the mod fills the gauge with the local estimate that `/context` makes, which sends nothing, and marks it as an estimate. The plan limits are saved between sessions, so a new session opens with the last figures.

**Settings.** There is one command, `/band`, which shows or hides the band. The mark at its right end folds it to one row (the four gauges side by side, with counts of agents and tasks in front), and the choice is remembered between sessions. The band drops detail as it narrows.

![The band folded to one row, with the gauges side by side and counts of agents and tasks in front](https://raw.githubusercontent.com/mayankgautam-me/workbench/main/claude/docs/screenshots/status-band-folded.png)

**A limitation.** The plan limits are shown as the app reports them, and until the first reply there is no real context reading, only the estimate. The session cost is the app's own figure; on a subscription plan it is an equivalent, not a charge.

## Session tint

When I have several sessions open side by side, the transcripts look alike. Session tint gives each session its own colour so I can tell them apart at a glance.

![Three sessions side by side, each with a thin rule above the message box and its prompts in a different colour](https://raw.githubusercontent.com/mayankgautam-me/workbench/main/claude/docs/screenshots/session-tint.png)

The colour goes on four things: a thin rule above the message box, my own prompts in the transcript, the spinner while Claude works, and the line that closes a turn with how long the turn took. On a folded status band, the rule becomes a bar at the start of the band, and the band's text takes the colour too.

**When it updates.** The colour is chosen when the session starts and does not change unless I ask.

**How it works.** It is the smallest of the four, about 240 lines. The colour is worked out from the session id with a small hash (FNV-1a), taken modulo the nine palette names, so the same session always gets the same colour, including after a resume. A colour I choose by hand is kept in the mod's store by session id, capped at 200 entries. The hooks are `ui.render` on four components of the app (above the prompt, user messages, spinner, turn duration) plus `session.start` and the commands.

**Settings.** `/tint <name>` sets the colour and `/tint auto` goes back to the one chosen from the session id. The names are blue, purple, cyan, green, yellow, orange, red, teal and pink, all Tokyo Night accents (teal is my own addition to the names the built-in `/color` takes).

**A limitation.** The palette is fixed and made for a dark theme.

## Project map

The project map draws a project's `PLAN.md` as cards, and shows live which agent is working in which part. The panel and its button exist only in a project that has a `PLAN.md` at its root.

![The project map: cards for each component with progress bars and tasks, a session card on top listing three agents, and two background tasks](https://raw.githubusercontent.com/mayankgautam-me/workbench/main/claude/docs/screenshots/project-map.png)

At rest, each component is a card with its name, its technology, how many tasks are done and a progress bar. Tasks are grouped by status; "In progress" is always listed, and "Blocked", "To do" and "Done" are one line each until unfolded. Arrows run from each component to the ones that need it. Files touched this session appear on their card, filled for edited and hollow for read.

![The map at rest, with the To do group unfolded on one card](https://raw.githubusercontent.com/mayankgautam-me/workbench/main/claude/docs/screenshots/project-map-rest.png)

While Claude works, a session card on top lists every agent with what it is doing and which component it is in. The card being worked in has a lit edge, a spinner and a word for the activity. When an agent moves between components, a dashed line in its colour joins the two cards. Background tasks are rows too: cyan while running, green when done, red when failed, grey when stopped.

**The PLAN.md format.** The map reads one strict format, and anything written another way is ignored:

```markdown
## Web app {#web}
tech: SvelteKit
files: [apps/web/**, package.json]
needs: [api]
- [x] Sign-in page {#web-sign-in}
- [~] Settings page {#web-settings}
- [ ] Dark theme {#web-dark}
```

A component is a `##` heading with an id. Under it, one per line, come `tech:`, `files:` (globs from the project root), `needs:` (drawn as arrows), `links:` (kept, not drawn) and `kind:`. Tasks are list items marked `[ ]` to do, `[~]` in progress, `[x]` done or `[!]` blocked. A `##` heading without an id is not drawn. The first component whose globs claim a file gets it; a file nobody claims goes on an "Unplanned files" card.

**When it updates.** It reads `PLAN.md` again whenever the file changes, whoever changed it. Which component a tool call belongs to is decided by the file it touches, matched against the `files:` globs; a shell command lights the component whose files it names.

**How it works.** It lists the project's files with `git ls-files -co --exclude-standard`. It hooks `tool.call` and `agent.spawn` to place agents and `turn.start`, `turn.complete` and `classic.Stop` to follow turns. After every edit to `PLAN.md` it checks the file and adds what the map cannot read to the edit's result, as `PLAN.md:<line>: error: ...` or `note: ...`, so Claude fixes it in the same turn. And in every project with a `PLAN.md` it adds a short section to the system prompt: put the work into the plan before starting, mark the task being worked on `[~]`, mark it `[x]` when done. If files are edited while no task is in progress, it reminds Claude once per turn.

**Settings.** `/map` shows or hides the panel, `/map refresh` reads everything again, `/map init` asks Claude to write a `PLAN.md` from the project's structure, and `/map check` runs the format check.

**A limitation.** The map is one drawing, so it cannot be clicked; task groups are unfolded from a row above it. In a terminal there is no drawing, and the panel lists components and tasks as text. At most 250 tasks are read from one file.

## Git graph

The git graph draws the repository's commits as a graph and lets me act on them. It is modelled on the Git Graph extension for VS Code, which I missed. The panel exists only when the session is inside a git repository.

![The git graph: commit rows with lanes and branch labels, a toolbar with a branch filter, and a card for the selected commit](https://raw.githubusercontent.com/mayankgautam-me/workbench/main/claude/docs/screenshots/git-graph.png)

Each commit is a row, with lanes for branches and merges and labels for branches, remote branches and tags. Other worktrees, such as the ones agents work in, are named on the commit they have checked out. Uncommitted changes are a row of their own on top, and stashes hang off the commit they were made on. The toolbar has a branch filter, switches for remotes, tags and worktrees, Fetch, Pull and Push (with how far ahead and behind the branch is), and a find box. Selecting a row opens a card with the full message and the files changed.

**Actions that wait for a yes.** Nothing runs on one press. Every action shows the exact git command it will run and waits for **Run**, and actions that rewrite, delete or discard are marked in red.

![A merge action showing the exact git command and a Run button](https://raw.githubusercontent.com/mayankgautam-me/workbench/main/claude/docs/screenshots/git-graph-confirm.png)

Actions cover checkout, cherry-pick, revert, merge, rebase and reset on a commit, and rename, delete and push on a branch, among others. An action is offered only where git will accept it: cherry-pick is not offered on a commit already in the current branch, and Pull only appears when the branch has an upstream. Three choices differ from plain git: merge, rebase and pull use `--autostash`, pull always merges, and a merge commit is cherry-picked or reverted against its first parent. When an operation stops on a conflict, a bar offers Continue and Abort.

What an action did is said in a toast at the bottom of the panel; a failure stays until dismissed.

![A done toast and a refusal toast at the bottom of the panel](https://raw.githubusercontent.com/mayankgautam-me/workbench/main/claude/docs/screenshots/git-graph-toasts.png)

**When it updates.** The graph is read again after a git command Claude runs through its Bash tool, at the end of each turn, and on `/graph refresh`. It reads 150 commits at a time.

**How it works.** The mod runs `git` through the engine's process call, with `core.editor=true` so a merge or revert never waits for an editor. It hooks `tool.call` for the Bash tool and `turn.complete` to know when to read again, and `ui.scroll` for the wheel. Whether git really accepts each command is checked separately: a script runs every action offered against scratch repositories in six states, among them a detached HEAD and a merge stopped on a conflict.

**Settings.** `/graph` shows or hides the panel and `/graph refresh` reads the repository again. The column width and the toggles are on the toolbar.

**Limitations.** Fetch, Pull and Push run without a terminal, so a remote that asks for a password will fail; an SSH agent or credential helper is needed. The app draws nothing of a panel over 100,000 characters, so the panel draws only the rows in view. And scrolling needed a workaround: the app hands a panel its wheel only while its window can move that way, so the drawing is two rows taller than the panel and put back on the middle after each tick. That can show as a slight flicker.

## How a mod is built and installed

Every mod has the same shape:

```
mods/<mod>/.claude-plugin/plugin.json   name, version, description
mods/<mod>/hooks/core.ts                pure logic, no access to the app
mods/<mod>/hooks/register.tsx           the hooks: what is drawn, what reacts to what
mods/<mod>/types/index.d.ts             the values the mod keeps in session state
mods/<mod>/tests/                       tests run by `claude plugin test`
```

`plugin.json` names the plugin, and `hooks/hooks.json` points at the module to load. `register.tsx` registers handlers with `on('event', ...)`: events such as `session.start`, `tool.call`, `turn.complete`, `command.run` and `ui.render`. A `ui.render` handler returns what to draw in a named place, such as the area above the prompt or a side panel, using React components. State a mod wants to share is kept in atoms, which are named values other mods can read.

That is how the four work together without depending on each other. The status band and the session's rule each carry the toggle buttons for the map and the graph. A press counts up a value; the map or graph watches it and shows or hides its panel. Without the others installed, each read falls back to a default.

To install, add the repository's `mods` folder as a plugin marketplace called `local-mods`, then install the ones you want:

```bash
claude plugin marketplace add ~/workbench/claude/mods
claude plugin install status-band@local-mods
```

Restart the app: a mod is loaded when the app starts, and `/reload-plugins` alone does not pick up a new or updated one. After changing a mod, I raise the version in its `plugin.json` and run `claude plugin update`, because without the version change the app keeps loading the copy it has. The steps are in the [repository's README](https://github.com/mayankgautam-me/workbench/tree/main/claude).

## What I learned

**Keep the logic out of the hooks.** Each mod has a `core.ts` that never touches the app, and a `register.tsx` that wires it in. are easy to test; the wiring is thin. When something breaks after an app update, the wiring is the first place to look.

**The API is new.** It may change between releases; a mod that stops loading after an update is most likely that. I only looked at them on one Mac, in the desktop app, in a dark theme.

**Tests do not tell you how it looks.** They cover the logic and what each mod draws, not how it appears on screen, so I look at a real result for anything visual.

**Make every action say what it will do.** The git graph's confirm step, with the exact command shown, is the feature I trust most.

**A map needs a rule.** It is only useful if `PLAN.md` stays current, so the mod tells Claude to plan first and checks the file after each edit.

**Write the host's limits down.** The panel size limit, the wheel behaviour and the characters the app refuses each cost me time, so they are in the READMEs as limits.

If you try them, each mod works alone; install the one you want. The code is under the GPL, version 3, in the [workbench repository](https://github.com/mayankgautam-me/workbench), and the [overview post](/blog/claude-code-setup) says how it fits with the rest of my setup.
