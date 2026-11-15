---
title: "Every skill and plugin in my Claude Code setup, and why"
description: "The third-party skills and plugins I have installed in Claude Code, what each is for, how a session picks one, and how they are pinned."
date: 2026-11-15T13:00:00+05:30
tags: [Claude Code, skills, plugins, embedded]
draft: false
---

This is the full list of third-party skills and plugins in my Claude Code setup, with what each one is for, how I choose between them and how I keep them from changing under me. It is the detail behind the [overview of the whole setup](/blog/claude-code-setup).

None of this is mine. Every skill and plugin below was written by someone else and is installed from its public repository, so I credit each by its GitHub `owner/repo`. They keep their own licences; my repository only records which ones I use.

Twenty-one skills and twenty-four plugins sounds like a lot, but each is attached to a kind of work I do, and a route in my instructions says when to reach for it.

## How I think about the two kinds

A **skill** is a folder with a `SKILL.md`: instructions, and sometimes scripts or reference files, that Claude loads when the task matches the skill's description. Skills are installed one by one, with the `skills` CLI, from a GitHub repository.

A **plugin** is a bundle installed from a marketplace. It can carry skills, agents and slash commands. The ones I use most come from one marketplace, and each plugin adds both skills and named agents that I can hand work to.

The split matters for installing and pinning, and I come back to it at the end. For choosing, it does not matter: in my routing both are just "the thing to use for this kind of work".

## Design skills

Seven skills come from one repository, [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill). They exist to stop generated interfaces from looking like generated interfaces, and they are deliberately opinionated, so I do not load them together. My instructions say that when I start UI work without naming a style, Claude asks me which of four to use and then loads only that one.

- **`minimalist-ui`**: clean editorial interfaces with a warm monochrome palette, strong type contrast, flat grids, no gradients and no heavy shadows.
- **`design-taste-frontend`**: a general anti-slop skill for landing pages, portfolios and redesigns. It reads the brief, picks a direction and checks the result before finishing.
- **`high-end-visual-design`**: spells out fonts, spacing, shadows, card structure and animation for a polished, agency-like look.
- **`industrial-brutalist-ui`**: rigid grids, very large type, utilitarian colour and a terminal feel. For data-heavy pages that should look like a technical drawing.
- **`redesign-existing-projects`**: audits an existing site first, finds the generic patterns, then upgrades it without breaking what it does. It has its own route: when I ask to redesign something that exists, it comes first, not the four above.
- **`brandkit`**: generates brand-guideline boards and logo systems as images.
- **`stitch-design-taste`**: writes the `DESIGN.md` file that Google Stitch reads, so its output follows the same rules. I load it when I work with Stitch or a `DESIGN.md`.

My instructions ask me to choose among the first four rather than letting Claude guess, because a choice of style is a matter of taste and the default of a model tends to be the average of all of them.

## Hardware and PCB

Four skills come from one repository, [aklofas/kicad-happy](https://github.com/aklofas/kicad-happy). Together they cover the path from a KiCad project to boards on my desk.

- **`kicad`** analyses KiCad projects and PDF schematics: schematics, layouts, Gerbers, footprints, netlists and design rules. It reviews a design for bugs, traces nets, compares schematic to board, and runs ERC, DRC and manufacturing checks. Every finding carries a confidence label and the evidence behind it, which is the feature I care about most: a review that cannot say how sure it is is not much use. It analyses and reviews; it does not draw boards.
- **`bom`** manages the bill of materials around the schematic. Part numbers, prices and quantities are stored as properties on the KiCad symbols, and the skill finds gaps in sourcing and points to the distributor or fab skill that can fill each one. I use it for any question about parts, prices and stock.
- **`jlcpcb`** covers JLCPCB fabrication and assembly: BOM and placement files, basic versus extended parts, assembly limits, design rules and the ordering steps. This is my default fab.
- **`pcbway`** is the alternative for turnkey assembly or for parts that JLCPCB's parts library does not have, since PCBWay sources parts by manufacturer part number.

Two rules in my instructions go with these. I never let Claude edit a board or schematic file while KiCad has it open, and Claude asks before it changes a footprint or a net name. A review skill is safe; an editing agent that moves a net is not, unless I have said yes.

## Embedded and firmware

The firmware route is chosen from the project's files: an `.ioc` file or a linker script means STM32 or nRF52 and a Cortex-M agent, `sdkconfig` means ESP-IDF and a C agent, `platformio.ini` means a C++ agent, and `Cargo.toml` with `no_std` means embedded Rust. On top of the agent, these skills are loaded:

- **`embedded-systems`**, from [jeffallan/claude-skills](https://github.com/jeffallan/claude-skills): firmware for microcontrollers, RTOS applications, peripherals, interrupt handlers, DMA, timing bugs and power. It is the general layer under any firmware work, whatever the chip.
- **`embedded-rust`**, from [mohitmishra786/low-level-dev-skills](https://github.com/mohitmishra786/low-level-dev-skills): bare-metal Rust with `probe-rs` and `cargo-embed`, `defmt` logging, RTIC, `cortex-m-rt` start-up, `no_std` and `no_main` firmware, and the choice of panic handler. It suggests some tools with `curl | sh` installers; I install them with Homebrew instead and my instructions say so.
- **`openocd-jtag`**, from the same repository: configuring OpenOCD for JTAG and SWD, flashing, connecting GDB to a bare-metal target, hardware watchpoints and J-Link. I load it when I flash or debug on the chip.
- **`mqtt-development`**, from [mindrally/skills](https://github.com/mindrally/skills): guidelines for MQTT in IoT systems, such as topics, QoS and retained messages. It is the link between the device and the cloud side in my IoT work.

Firmware bugs go through `developer-essentials:debugging-strategies`, and firmware images and dumps go to the `reverse-engineering` plugin, both described below.

## App frameworks

- **`svelte-core-bestpractices`** and **`svelte-code-writer`**, both from [sveltejs/ai-tools](https://github.com/sveltejs/ai-tools). The first is guidance on modern Svelte 5: reactivity, events, styling and library integration. The second is a set of command-line tools that look up the Svelte documentation and run the analyser over a component; it asks to be used whenever a `.svelte` file or a `.svelte.ts` module is created or edited, and I let it, so a component is checked before I call it finished.
- **`tauri-development`**, from [mindrally/skills](https://github.com/mindrally/skills): guidelines for cross-platform desktop apps with TypeScript, Rust and web technologies. It assumes a React front end. My routing says that when the project uses Svelte I take only its Tauri and Rust guidance, together with the Rust agent for the Rust side.

## Research and discovery

- **`research`**, from [mattpocock/skills](https://github.com/mattpocock/skills). It starts a background agent that investigates a question against primary sources and saves the findings as a Markdown file in the repository. The point is that I keep working while it reads. My routing keeps it for research that belongs with a project (API facts, library choices, docs); anything else I do with plain web search and a link for each claim.
- **`find-skills`**, from [vercel-labs/skills](https://github.com/vercel-labs/skills). It searches for installable skills when I ask "is there a skill for this". It is also the first step of adding something, as described near the end.

## Security

- **`security-audit`**, from [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill): security guidance and review for codebases, APIs, services, command-line tools and libraries. Its description says to run the full workflow only for an explicit audit or pen-test request, or a report, and I keep to that: it is for when I ask for it, not for every change. A security check of pending changes on a branch goes through the built-in `security-review` command instead.

Static analysis, dependency checks and threat modelling come from the `security-scanning` plugin below.

## The claude-code-workflows plugins

Twenty-four plugins come from the marketplace [wshobson/agents](https://github.com/wshobson/agents), which my settings register as `claude-code-workflows`. The marketplace has many more; I enable only the ones that match my routes. Each is listed with what I use it for, following the routing in my instructions.

- **`agent-teams`**: agents and commands for teams that work in parallel, such as `team-feature`, `team-review` and `team-debug`. Only when I ask for a team, because teams spend far more than one agent.
- **`arm-cortex-microcontrollers`**: the `arm-cortex-expert` agent for firmware on Cortex-M chips (Teensy, STM32, nRF52, SAMD). It is the default firmware agent, including for Zephyr projects on a Cortex-M SoC.
- **`backend-development`**: API design, event sourcing and CQRS, durable workflows with Temporal, and the `feature-development` command for a backend feature end to end. Its architect agent does schema design and migrations.
- **`code-documentation`**: `code-explain` and `doc-generate`. I use `code-explain` after mapping an unfamiliar codebase, for the parts that need explaining.
- **`code-refactoring`**: `refactor-clean` for larger refactors and `tech-debt` for an inventory of debt.
- **`comprehensive-review`**: the architecture review agent when I analyse an existing project, `full-review` for a multi-dimension review of a whole change, and `pr-enhance` for the PR description.
- **`data-engineering`**: data pipelines, dbt, Airflow, Spark and data-quality checks, for telemetry ingest and storage in IoT work.
- **`developer-essentials`**: a mixed bag I use constantly: advanced Git workflows, SQL optimisation, auth patterns, error-handling design, end-to-end testing, `debugging-strategies` for bugs with several plausible causes, and monorepo tooling.
- **`documentation-generation`**: OpenAPI specs, architecture decision records and changelogs. I write ADRs only when I ask for them.
- **`error-debugging`**: `error-analysis` for errors and stack traces, `error-trace` for adding logging and error tracking.
- **`frontend-mobile-development`**: Next.js App Router, React state, Tailwind design systems, React Native architecture and a component scaffolder with tests.
- **`frontend-mobile-security`**: the XSS scan, used only when I ask for it.
- **`full-stack-orchestration`**: `full-stack-feature`, for a feature that crosses frontend, backend and database.
- **`llm-application-dev`**: the `ai-engineer` agent, RAG, embeddings and vector search, prompt work, evaluations and LangGraph agents. Anything that calls the Claude API also loads the built-in `claude-api` skill.
- **`llm-finetuning`**: an eval-gated fine-tuning workflow. Its rule is that no evaluation harness means no training, and I like that rule. It also re-checks a checkpoint before it is promoted.
- **`machine-learning-ops`**: training and deployment pipelines.
- **`multi-platform-apps`**: the Flutter and iOS agents, the mobile-developer agent for React Native and Android, and `multi-platform` for one feature shipped on several platforms at once.
- **`reverse-engineering`**: `firmware-analyst` for firmware images and dumps, plus patterns for binary analysis, memory forensics and unknown wire or radio protocols. I use it for authorised work on devices I own or build.
- **`security-compliance`**: GDPR, SOC 2 and HIPAA checks, for platforms that hold personal or customer data.
- **`security-scanning`**: static analysis, dependency vulnerabilities, hardening, and STRIDE threat modelling, which I run for any new device or platform design.
- **`shell-scripting`**: defensive Bash, ShellCheck configuration and Bats tests.
- **`systems-programming`**: the Go, Rust, C and C++ agents, and patterns for Go concurrency, Rust async (Embassy included) and memory safety. The ESP-IDF route uses the C agent and the PlatformIO route the C++ agent.
- **`ui-design`**: design tokens and design systems, components, responsive layout, accessibility audits, design review, and mobile design for iOS, Android and React Native.
- **`unit-testing`**: `test-generate`, for tests of code that was just written. My instructions add that an agent which did not write the code should write them.

## Other plugins

- **`brag`**, from [latent-spaces/brag](https://github.com/latent-spaces/brag). It turns the current project's website into a short launch video with HyperFrames, reading the project's code directly rather than a live URL. I use it when I have built something and want a clip to show it.
- **`cc-plugin-you-should-know`**, from the built-in marketplace that ships with Claude Code. It is enabled in my settings and I did not install it; I have no further claim about it than that.

My settings also register a marketplace for [sergebulaev/linkedin-skills](https://github.com/sergebulaev/linkedin-skills), but the plugin is not enabled, so it plays no part in any session.

## My own mods and skills

Some of what is installed is mine, and I will not list it here again. The four mods (status band, session tint, project map and git graph) are described in [Claude Code mods](/blog/claude-code-mods), and the `project-standard` and `project-profile` skills in [One project standard](/blog/project-standard).

## How one gets picked

Installing a skill does not make Claude use it well. Claude sees every skill's description, but a description is a guess about when to load it, written by someone who does not know my work. I put my own routing on top of it, in two places.

1. **My global `CLAUDE.md`** has a "Skill routing" section. It is a list of kinds of work, and for each the agent or skill to use: "reviewing a KiCad schematic: `kicad`", "Svelte: `svelte-core-bestpractices` and `svelte-code-writer`", "RAG: `llm-application-dev:rag-implementation`". It also settles ties: where two installed skills do the same job, the one listed there wins, and a skill I name in a request always wins.
2. **A session-start hook** looks at the project's files up to three levels deep, works out what kind of project it is, and prints a short "Project profile" at the top of the session. A Svelte file gives the Svelte route, a `.kicad_pro` file the KiCad route, `west.yml` the Zephyr route. The hook has no route text of its own: it prints the lines of `CLAUDE.md` that end in a marker such as `<!--route:kicad-->`. So a route is changed in one place only.

The result is that I start a session in a firmware project and the first thing on screen says which agent and which skills fit, before I type anything. The `project-profile` skill runs the same detection by hand. The full account is in [Claude Code instructions and routing](/blog/claude-code-instructions-and-routing).

Two habits go with the routes. Claude hands work to a named agent where the route names one, instead of loading the skill and doing it in the main session. And a route to a skill I have not installed does nothing useful, which is why the list and the routes have to stay in step.

## How they are installed and pinned

Everything is recorded in the public [workbench](https://github.com/mayankgautam-me/workbench) repository, and `bootstrap.sh claude` installs it.

**Skills** are listed in `claude/skills.txt`, one `owner/repo@skill` per line, which is where the names above come from. For each line that is not yet in `~/.claude/skills`, the script runs the `skills` CLI with `npx`, globally, for Claude Code:

```bash
npx skills add owner/repo@skill -g -y -a claude-code
```

**Plugins** are the enabled entries in `settings.json`. The script registers the `claude-code-workflows` marketplace from the `wshobson/agents` repository, then installs every enabled plugin that is not yet installed.

**Pinning** is the weak spot. Neither installer can pin a commit: a new install takes whatever the upstream repository holds today. So `claude/versions.lock` records what is installed, one line per item: the content hash of each skill's folder, the commit of the marketplace, and the version of each enabled plugin. Here is the shape of it, with the hashes cut short:

```text
marketplace claude-code-workflows 46891e7e…
plugin agent-teams@claude-code-workflows 1.0.3
plugin ui-design@claude-code-workflows 1.0.5
skill kicad 95ee658e…
skill research 0a6796c5…
```

The lock does not stop an upgrade. It lets me see one. `bootstrap.sh check` compares the lock with what is installed and prints any line that differs, with a note that upstream moved or an install failed. After I have read an upstream change and decided to keep it, I rewrite the lock from what is installed and commit it:

```bash
zsh ~/.workbench/bootstrap.sh lock
```

Reading what changed is the part a tool cannot do for me. A skill is instructions that Claude follows, so an upstream edit changes how Claude behaves in my projects, and some of these skills come with scripts. I treat an update the way I treat a dependency bump, and I read it first.

## How I add one

1. **Find it.** I ask for a skill with `find-skills`, or I look at the plugin marketplace. I read its `SKILL.md` before installing, including any scripts and any command it tells Claude to run.
2. **Install it** with the `skills` CLI, or `claude plugin install` for a plugin, and enable it.
3. **Record it.** A skill gets a line in `skills.txt`. A plugin is already recorded by `settings.json`.
4. **Route it.** If it does a job an existing route covers, I decide which wins. If it is a new kind of work, I add a route to `CLAUDE.md`, with a marker if the session-start hook should print it.
5. **Lock it** with `bootstrap.sh lock`, then commit the skill list, the settings, the routing and the lock together.

Removing one is the same steps backwards, including the route. A skill I stop using but leave installed costs me nothing on disk and a little on every session, because its description is still read.

## What I would tell someone starting out

Install fewer than you think. Every skill adds a description Claude reads in every session, and two skills that overlap make the model choose between them without telling you. Write down which one wins. And record what you installed, even if the tool will not pin it, because the first time an upstream change shifts a behaviour you will want to know when it happened.
