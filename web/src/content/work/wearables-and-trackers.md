---
title: "Wearables, Bluetooth tags and cellular trackers"
summary: "A BLE wearable alarm, a cellular tracker and an NFC and BLE tag: boards, Zephyr firmware, apps and the cloud behind them."
group: product
context: Independent
period: 2019 to now
order: 3
art: wearables
tags: [Wearables, BLE, LTE-M/NB-IoT, GNSS, Zephyr, nRF Connect SDK, KiCad]
---

Small battery-powered devices that talk to a phone or a server are among the more than a dozen hardware products I have taken from concept to production as an independent Product Engineer. Three of them are described here. All run Zephyr on Nordic SoCs, and each has its own KiCad board, firmware and companion software.

## A BLE wearable alarm

A wearable alarm that wakes you with a vibration pattern and an RGB LED instead of sound. An iOS app sets the alarms over Bluetooth Low Energy, and the device keeps them on its own, so it works with the phone away.

- nRF52840 in a module, running Zephyr on nRF Connect SDK v3.0.0, with MCUboot and ED25519-signed dual-slot images.
- A battery-backed RV-3028-C7 RTC raises the alarm interrupt, so the MCU can sleep between alarms.
- BQ25180 charger with ship and shutdown modes, MAX17048 fuel gauge, TPS63070 buck-boost and a TPS7A0233 LDO, a DRV8837 motor driver and an SK6812 RGB LED.
- One GATT service for battery level, time, alarm management, vibration test and power modes, with Secure Connections only pairing.
- A SwiftUI app (iOS 16+) over CoreBluetooth. Firmware updates go over MCUmgr SMP from a public Cloudflare R2 bucket, with no backend.

## A cellular tracker

A small tracker built around the nRF9151, which provides LTE-M, NB-IoT and GNSS and also runs the application. The board is 6 layers and about 61 by 16 mm, with separate LTE and GNSS chip antennas, a GNSS LNA and SAW filter, a BQ25180 charger and a small OLED with two buttons.

- Zephyr on nRF Connect SDK v3.2.1, non-secure under TF-M, MCUboot signing with ECDSA P-256. PSM, eDRX and RAI keep the modem's power down.
- A telemetry cycle uploads battery, signal and cell data, then a GNSS fix, with an alert queue for retries and an emergency mode that reports more often.
- An STM32F042 on the board is the USB interface: a CDC bridge to the modem's two UARTs, plus a CMSIS-DAP probe that programs the nRF9151. It started from the dap42 project and uses libopencm3.
- A browser dashboard talks to the device over Web Serial through an encrypted channel (ECDH P-256, AES-128-GCM) for login, settings and firmware updates.
- A Cloudflare Worker (Hono, D1, KV, R2, a queue and a Durable Object) takes telemetry and alerts, and serves the dashboard, webhooks and share links.

## A Bluetooth tag

A credit-card-sized tag for marking items on a production line. A phone tap on NFC or a QR scan opens a web page, which pairs over Web Bluetooth and edits the record stored on the tag. It is at the design stage: the board and parts are chosen and the firmware is planned.

- nRF54L15, an ST25DV NFC EEPROM whose field-detect output wakes the MCU, and a 2.9 inch e-ink panel that keeps its status with no power.
- BQ25120A charger, MAX17048 fuel gauge and a LiPo cell, with an RGB LED that lights the transparent body.
- Planned firmware behaviour: sleep at a few microamps, advertise for about a minute after a wake, and commit each write to flash after a CRC check.
- A SvelteKit site on Cloudflare Pages is the editor.

I also worked on a small fidget cube with an nRF52840, an Azoteq trackpad controller and a six-face folding board. That one is a USB device with no radio, so it sits outside this page.

## What I did

- Chose the parts and drew the boards in KiCad, then prepared them for JLCPCB fabrication and assembly.
- Wrote the Zephyr firmware and board definitions, including secure boot and over-the-air updates where the product has them.
- Built the companion apps and the Cloudflare back ends, and kept the protocols between device, phone and cloud documented.
- Set up each project with one set of build, test and release commands, with secrets kept out of the repositories.
