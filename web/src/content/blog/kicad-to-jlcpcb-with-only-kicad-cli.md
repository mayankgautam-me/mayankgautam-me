---
title: "From KiCad to JLCPCB with only kicad-cli"
description: "A tag-driven release pipeline that gates on ERC and DRC, builds Gerbers, BOM and CPL in JLCPCB's format, and refuses to run while KiCad has the board open."
date: 2026-11-15T04:00:00+05:30
tags: [KiCad, JLCPCB, PCB, automation, kicad-cli]
draft: false
---

Releasing a board by hand means the same clicks in the same order every time: plot Gerbers, generate drill files, export positions, fix the column names for the fab, export a BOM, zip it all, hope the right layers were ticked. I replaced that with a pipeline driven by a git tag. It uses nothing but `kicad-cli`, `make`, a little awk and `zip`. No GUI plugins.

This post walks through the pipeline step by step, including the commands. It has handled a 4-layer board with parts on both sides and a panelised six-face board.

## Why kicad-cli only

A release should be a function of one thing: the commit the tag points at. Click-driven exports also depend on the state of the KiCad session: which plot settings were last used, which layers were ticked, whether the file was saved.

`kicad-cli` fixes most of that. Every export is one command with explicit flags, so the command line is the documentation. It runs the same on my laptop and in CI. And it has no opinion about what is open on screen, which is also its weakness, and I come back to that below.

The one plugin I still use is the interactive BOM generator, for checking pin 1 marks before ordering. It is optional: if the script is missing, the build prints a warning and skips it. Nothing a fab house needs depends on it.

## The shape of the pipeline

Four steps, each its own `make` target:

```sh
make hardware-check             # ERC and DRC with schematic parity
make hardware-build             # outputs into hardware/outputs/
make hardware-release-assets    # zip, checksums, reports
make hardware-bump LEVEL=patch  # new revision, commit, tag
```

`bump` writes the revision to a `VERSION` file, moves the changelog's unreleased notes under the new version, commits, and creates a tag named after the part and the revision. Nothing is pushed at that point. Pushing the tag starts a workflow in CI that runs the check, the build and the asset step, then creates a release with the files attached.

Locally I run the first three by hand before tagging. In CI the tag's workflow runs the check, the build and the asset step again on a clean checkout, so the release does not depend on my machine.

The board's revision comes from the `VERSION` file. If there is none, the pipeline falls back to the `rev` in the PCB's title block (`Version 2` becomes `2`) and refuses to continue when it finds neither. A release with no revision in its name is a release nobody can trace.

## ERC, DRC and schematic parity as gates

The first step is a hard gate:

```sh
kicad-cli sch erc --exit-code-violations --severity-error \
  --format report -o outputs/Board-erc.rpt Board.kicad_sch

kicad-cli pcb drc --schematic-parity --exit-code-violations --severity-error \
  --format report -o outputs/Board-drc.rpt Board.kicad_pcb
```

Two flags matter here. `--exit-code-violations` makes the command return a non-zero exit code when there are violations, which is what turns a report into a gate. `--schematic-parity` makes DRC compare the board against the schematic, so a footprint that was swapped, a net that was renamed or a part that exists on one side only fails the check. That catches the classic mistake of editing the schematic, forgetting to update the PCB, and ordering the old netlist.

`--severity-error` means only error-level violations fail the run; warnings are written to the report but do not stop it. That only works if the severities in the project file are set deliberately. In my boards some checks are demoted to warnings and a few are ignored, for example courtyard and library-mismatch checks, which are noisy when footprints come from a shared library. I would rather have a gate that is green on a clean board than one I learn to ignore.

Both reports are kept and attached to the release, so the state of the checks at release time is on record.

The script runs both commands before it stops, so one run shows the ERC and DRC failures together.

## The BOM and CPL from symbol fields

The fab needs two files besides the Gerbers: a BOM that says what to place, and a CPL (component placement list) that says where. JLCPCB wants specific column names for both, and wants each line tied to an LCSC part number.

The part number lives in the schematic. Every symbol that gets placed has a custom field called `LCSC Part`. That is the single source of truth: the BOM is generated from it, so the BOM cannot drift from the schematic.

```sh
kicad-cli sch export bom -o Board-bom-jlcpcb.csv \
  --fields 'Value,Reference,Footprint,LCSC Part' \
  --labels 'Comment,Designator,Footprint,LCSC Part #' \
  --group-by 'Value,Footprint,LCSC Part' \
  --exclude-dnp Board.kicad_sch
```

`--fields` picks the columns, `--labels` renames them to what JLCPCB expects (`Comment`, `Designator`, `Footprint`, `LCSC Part #`), and `--group-by` merges identical parts into one line with all their designators. The field name is a variable in the make file, so a project that uses a different field name only changes one line.

I also export a plain BOM with KiCad's default columns. That one is for me: it lists everything, including parts the fab does not place.

The CPL starts from KiCad's position file:

```sh
kicad-cli pcb export pos -o Board-pos.csv \
  --format csv --units mm --side both --exclude-dnp Board.kicad_pcb
```

KiCad's position file has its own columns. JLCPCB wants `Designator, Mid X, Mid Y, Layer, Rotation`, with units on the coordinates and `Top` or `Bottom` for the side. A short awk script does the conversion:

```sh
awk -F, 'NR == 1 { print "Designator,Mid X,Mid Y,Layer,Rotation"; next }
  { gsub(/"/, "");
    side = ($NF == "top") ? "Top" : "Bottom";
    printf "%s,%smm,%smm,%s,%s\n", $1, $(NF-3), $(NF-2), side, $(NF-1) }'
```

One detail is worth copying: the script reads the columns counting from the end of each line, not from the start. A value can contain a comma, and counting from the left would then shift every column after it. The fields I need are always the same distance from the end.

The script applies no per-part rotation fixes. So for each order I check every part in JLCPCB's placement preview and write down any correction. I have not automated that, and I do not claim the CPL is right without looking.

## DNP and hand-fitted parts

Not every part on the board should be placed by the assembler. Two kinds come up:

- Parts I fit by hand. Examples are tactile switches I prefer to choose myself, a rotary switch, and a debug header that is only needed when I attach a probe.
- Things that are on the board but are not parts at all: mounting holes and the mouse-bite holes described below.

Both are excluded from the BOM and the CPL with `--exclude-dnp` on the BOM export and on the position export. A part marked do-not-populate disappears from both, so the two files cannot disagree about which parts exist.

The full BOM, without `--exclude-dnp`, still lists everything, so I know what to buy separately for the hand-fitted parts.

Through-hole parts are a separate decision. On one board JLCPCB fits the connectors and a few switches, so those stay in the BOM, and the ones I solder myself are left out.

## Gerbers and drills

The Gerber export is a single command with a layer list:

```sh
kicad-cli pcb export gerbers -o outputs/gerbers/ \
  --layers "F.Cu,In1.Cu,In2.Cu,B.Cu,F.Paste,B.Paste,F.SilkS,B.SilkS,F.Mask,B.Mask,Edge.Cuts" \
  Board.kicad_pcb

kicad-cli pcb export drill -o outputs/gerbers/ \
  --format excellon --excellon-units mm \
  --generate-map --map-format gerberx2 Board.kicad_pcb
```

The inner copper layers are not hard-coded. The script greps the `.kicad_pcb` for layer names matching `In<n>.Cu` and builds the list from what it finds, so a 2-layer board and a 4-layer board use the same make file. Forgetting an inner layer by hand is easy; forgetting one in a script that reads the board is not.

The drill file is Excellon in millimetres with a Gerber X2 drill map, written into the same folder so the zip holds the Gerbers and the drill file together.

## Checksums and the release

The release step collects the files into a folder named after the version, zips the Gerbers and drill files, and writes a `SHA256SUMS` file for the folder. The zip is the file I upload to JLCPCB. I also keep a copy under a `production/` folder, named `<Board>_v<rev>.zip`.

The zip is made with `zip -q -X` (the `-X` leaves out extra file attributes) from inside the Gerber folder, so the files sit at the top level of the archive. If `zip` is missing, it falls back to Python's `zipfile` module.

Release assets are then:

- the fab zip
- the full BOM and the JLCPCB BOM
- the position file and the JLCPCB CPL
- the schematic as PDF
- the ERC and DRC reports
- the IPC-D-356 netlist, when this `kicad-cli` build can export it
- STEP and WRL models, and the interactive BOM when it was built

The checksum file lets me check, later, that the files I download or upload are the ones that were built.

Required files make the step fail when missing. Optional ones print a `skip` line. That split matters: a missing iBOM should not stop a release, a missing BOM should.

Outside CI the step also refuses to run when the board's folder has uncommitted changes. A release is made from its tag, so it should be buildable from what is committed.

## Guarding against an open KiCad

`kicad-cli` reads the files on disk. It knows nothing about the editor. If KiCad has the board open with unsaved changes, the CLI happily exports the older version on disk, and you get Gerbers that do not match the screen. It is the sort of failure you notice only after the boards arrive.

KiCad creates lock files (`*.lck`) in the project folder while a project is open. The pipeline looks for them:

```sh
locks=$(ls -d "$d"/*.lck 2>/dev/null || true)
[ -z "$locks" ] || die "KiCad has the board open ($locks): save and close it before a release"
```

The two stages treat this differently. The build only warns, because I often want to look at outputs while I work, and a warning is enough to remind me they may be stale. The release refuses outright. A release goes to a fab house and costs money, so it is not the place to be lenient.

A lock file is a heuristic, not a guarantee, and I have not tested how it behaves after a KiCad crash.

## Stackup choice

The boards use JLCPCB's default 4-layer 1.6 mm stackup, code JLC04161H-7628. In the PCB file it is a symmetric stack: 35 um copper on all four layers, a 0.1 mm prepreg on each outer side and a 1.24 mm core between the two inner layers, all FR4 with a relative permittivity of 4.5 in the file.

I ordered it with no impedance control, including for USB. The USB pair is routed with the default net class (0.2 mm track, 0.1 mm gap) and has no impedance target. That is a decision I made, not a measurement. For a faster interface, or a longer run, I would pick the fab's controlled-impedance option and define the target in the board setup first.

The project's design rules are set up for JLCPCB's 4-layer capabilities (0.1 mm minimum clearance and track width, 0.25 mm minimum via, 0.3 mm copper to edge). The stackup is written into the board file, and the order has to name the same build.

I do not record why each rule is relaxed or which capability page it was checked against, and I should.

## Panelising with mouse bites

One of the boards has six faces that are separated at their edges. Instead of asking the fab to panelise it, I made the board file itself the panel: six faces arranged in two columns and three rows, joined by 14 tabs.

Each tab has two rows of mouse bites, one on each side of the gap between faces. The two rows are 3.0 mm apart. A row is three 0.4 mm non-plated holes at 0.65 mm pitch. That makes 14 tabs times two rows times three holes, or 84 holes.

The holes are board-only footprints, not drill hits added by hand. That has useful consequences:

- They are placed with the same tools as everything else, so spacing is exact and repeatable.
- DRC sees them. A mouse bite too close to copper is a real manufacturing problem, and it is caught like any other clearance error.
- They carry the do-not-populate flag, so `--exclude-dnp` drops them from the BOM and the CPL. Without that, 84 phantom parts would show up in the assembly files.

Silkscreen labels at each tab name the pair of edges that meet there. What I have not recorded is the order settings for that board (quantity, whether the fab takes it as one board or a customer panel, edge plating) or how the faces are joined afterwards, so I will not claim more here.

## A checklist before pushing the tag

This is what I run through each time.

1. KiCad is closed, and everything is saved.
2. `make hardware-check` is clean: ERC and DRC with parity, no errors.
3. Every placed symbol has an `LCSC Part`, and stock is checked at the supplier.
4. Parts I fit by hand are marked DNP, and I know where I am buying them.
5. `make hardware-build` ran, and the JLCPCB BOM and CPL list the same designators.
6. Pin 1 and polarity of ICs and LEDs checked against the interactive BOM.
7. The stackup in the board file matches the build I am ordering, and impedance control is a decision, not an accident.
8. The working tree is clean, and `make hardware-bump` made the commit and the tag.
9. Push the tag, wait for CI, and download the release.
10. Compare the downloaded files with `SHA256SUMS`, then upload the zip, the BOM and the CPL to the fab.
11. On the fab's page, check the placement preview for rotations, and write down any corrections.

The commands are small, and none of them is clever. What the pipeline buys is that every step that can be forgotten is either done by the script or refused by it.
