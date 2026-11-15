---
title: "A musical instrument"
summary: "A battery-powered one-octave keyboard with a built-in synthesizer and USB MIDI, on an ESP32-S3 running CircuitPython, from board to production files."
group: product
context: Independent
period: 2019 to now
order: 7
art: instrument
tags: [ESP32-S3, CircuitPython, KiCad, USB MIDI, I2S audio, Battery power]
---

## What it is

A battery-powered keyboard instrument with 13 keys covering one octave, C to C. It has a built-in synthesizer with a speaker and a headphone output, and it works as a USB MIDI device in both directions. It is one of the more than a dozen hardware products I have taken from concept to production as an independent Product Engineer.

## Hardware

I designed the board in KiCad 10 as a 4-layer PCB, about 160 x 65.8 mm and 1.6 mm thick, with ground poured on all four layers and stitched with vias.

- **Controller:** an ESP32-S3-WROOM-1U-N4R2 module (4 MB flash, 2 MB PSRAM) with an external antenna connector. Native USB goes straight to the USB-C port.
- **Keys:** each key is a bare two-contact copper pad, one contact ground and one a GPIO with a pull-up. A finger bridging the contacts pulls the input low. This is contact sensing, not capacitive sensing. The eight white keys have a second pad wired in parallel.
- **Audio:** a MAX98357A I2S class-D amplifier fed by its own TPS63070 buck-boost rail. Its output goes through ferrite beads to a 3.5 mm jack whose switched contacts drive the speaker pads.
- **Power:** a single-cell Li-ion battery, a BQ25180 charger with power path, a MAX17048 fuel gauge and a TPS7A0233 3.3 V regulator for the controller. The charger's TS/MR pin is the power button, and "off" is the charger's ship mode.
- **Interface:** four side switches (volume, octave, filter, waveform) and one addressable RGB LED for battery and charge state.

## Firmware and sound

The firmware is a CircuitPython 9.2.7 application on a custom board definition I wrote for CircuitPython, built in Docker with ESP-IDF and flashed with esptool.

- **Synth:** `synthio` at 44.1 kHz through I2S. Six voices, five waveforms (sine, triangle, square, sawtooth, pulse) and three filters (low-pass, band-pass, high-pass). Loudness is shared across sounding notes and low notes are turned down to protect the small speaker.
- **Scheduling:** four asyncio tasks. Key, switch and MIDI handling runs every 1 ms with 25 ms debounce. The charger, the power button and a 60-second inactivity timer run on slower loops. An unexpected error reloads the application after two seconds.
- **MIDI:** USB MIDI on channel 1. Key presses send Note On and Note Off, and incoming notes play on the synthesizer with velocity setting loudness.
- **USB:** by default the device shows up only as MIDI. Holding a key at start-up exposes a drive and the serial console for updates.
- **Power:** I configured the charger over I2C for 4.20 V and 500 mA, and the firmware handles standby, shut-off and the LED states.

## What I did

I did the whole product:

- Schematic, board layout and the project part library.
- Production files for JLCPCB fabrication and assembly: Gerbers, a BOM with a supplier part number on every line, placement data and an IPC netlist.
- The CircuitPython board definition and the application.
- Charger and fuel-gauge drivers.
- Host-side Python tools that play MIDI files and test patterns for testing the synth.
- The project's build and release automation: ERC and DRC checks, fab-file generation and tagged releases.
