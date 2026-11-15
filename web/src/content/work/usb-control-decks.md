---
title: "USB control decks"
summary: "A USB HID control deck, built end to end: STM32F042 board, firmware and a desktop configuration app."
group: product
context: Independent
period: 2019 to now
order: 5
art: deck
tags: [USB HID, STM32, KiCad, Embedded C, Tauri, Rust, Svelte]
---

## What it is

A USB control deck is a desk device with 13 buttons, a rotary encoder, a four-position combo selector and 35 RGB LEDs. It enumerates as a vendor-defined USB HID device, and a desktop app configures it over the same cable. The deck also works without the app, because its settings live in its own flash.

I took one of these decks through the whole chain: schematic, board, firmware and the configuration app. It is among the more than a dozen hardware products I have taken from concept to production as an independent Product Engineer.

## Hardware

- STM32F042K6 with USB, 4-layer 1.6 mm board designed in KiCad 10.
- Two 74HC165 shift registers read the inputs, and the LEDs are SK6812 pixels. A buzzer completes the board.
- Revision 3 fed the LEDs from the 3.3 V regulator. Revision 4 feeds them from VBUS, which gives the pixels a larger current budget.
- Fabrication and assembly at JLCPCB. Each revision is released with its Gerbers, BOM, pick-and-place file, 3D models and ERC and DRC reports.

## Firmware

The firmware is C on the STM32Cube HAL, built with PlatformIO, and ships as one image per board revision.

- **USB:** one vendor-defined HID interface with fixed 64-byte reports. Commands and events share a frame format: magic byte, version, type, sequence number, length and payload.
- **Inputs:** the shift registers are sampled and debounced over three samples. The combo selector sweeps through detents, so a position is reported only after a settle delay, adjustable from 0 to 500 ms.
- **LEDs:** pixels are driven by timer PWM with DMA. The 35 LEDs are exposed as five groups with colour and brightness, not per pixel.
- **Power:** every frame is current-limited against a per-revision budget (135 mA on rev 3, 380 mA on rev 4). The indicator strip gets priority, because stock colours at full brightness drew about 570 mA and browned the chip out into a reset.
- **Persistence:** settings sit in the last 1 KB flash page as a 64-byte record. A magic number discards stale layouts, and a version byte lets the firmware migrate records in place.
- **Diagnostics:** log lines and a boot report travel on the same HID pipe.
- **Updates:** the app sends a command, the chip reboots into the ST ROM bootloader through the boot option bytes, and the image is written over USB DFU. The new firmware restores the option bytes on its first boot.

## Desktop app

A Tauri 2 app for macOS, Linux and Windows, with a Rust core and a SvelteKit and TypeScript interface.

- Rust owns the HID transport through hidapi, with a reader thread that reconnects on its own and hands raw frames to the front end.
- The front end encodes and decodes the protocol, draws the board, and edits button modes, indicator bindings and LED groups by clicking the picture.
- A command console and an event log show decoded frames, and a firmware panel runs the DFU update with dfu-util.
- The app makes no network calls.

## What I did

- Designed the board and handled its fabrication and assembly files.
- Wrote the firmware, including the protocol, the power limiter and the flash record format.
- Wrote the protocol specification, with a Python example client.
- Built the desktop app.
- Set up the per-part builds, CI and releases, so firmware, board and app each ship from their own tag.
