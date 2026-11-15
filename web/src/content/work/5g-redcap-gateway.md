---
title: "5G RedCap, Wi-Fi and BLE gateway"
summary: "A gateway board with a Wi-Fi 6 and BLE SoC, an M.2 socket for a 5G module, isolated RS-485 and USB-C power, plus Zephyr firmware that brings up cellular and Wi-Fi in parallel."
group: product
context: Deep-tech startup
period: 2024 to now
order: 1
art: gateway
tags: [5G RedCap, SiWG917, Zephyr, KiCad, Wi-Fi 6, RS-485, BLE]
---

## What it is

A gateway that connects field equipment to the network over 5G, Wi-Fi or both. A Silicon Labs SiWG917 handles Wi-Fi 6 and BLE, an M.2 socket takes a 5G module, and an isolated RS-485 port reaches the equipment. Two 50-pin stacking connectors join it to a carrier board.

## Hardware

The board is a KiCad project of ten sheets. The revision I read has 316 symbols, 242 fitted and 84 marked not fitted.

- **Power:** USB-C power delivery through an HUSB238 sink, with a TPS2121 priority mux against an external supply. A PoE module (Ag5300) front end is drawn but left unfitted on this variant. Two TPSM82903 buck modules make the 3.3 V logic rail and a separate 2 A rail for the modem, with a TPS22810 load switch.
- **Wireless:** the SiWG917 with an external antenna switch, a 2.4 GHz filter, 40 MHz and 32.768 kHz crystals and a coin-cell backup domain. The RF part follows Silicon Labs' own radio board design.
- **Cellular:** an M.2 socket with a dual-SIM mux (TS3A44159), level shifting (TXB0106) and five antenna connectors with ESD parts. The bill of materials lists two SIMCom 5G sub-6 modules as options.
- **Memory and I/O:** PSRAM, an I2C EEPROM, an MCP23017 expander and a USB-C port.
- **RS-485:** an SN65HVD1473 behind an ISOW7841 isolator, with surge protection and common-mode chokes.
- **Ethernet:** a W5500 and magjack are on a sheet of their own, unfitted on this variant.

The repo has a written thermal budget for a 15 W load from -40 to +85 C. It finds the cellular module the largest single heat source at roughly 4 to 6 W, and flags one connector rated only to -20 C.

## Design review

A sheet-by-sheet review checks each programmable part against its datasheet. ERC reports no violations, but the review still lists 8 critical findings before fabrication, such as a crystal on the wrong pads, an antenna-select mismatch with the firmware and a modem reset driven at 3.3 V into a 1.8 V input. A separate change list aligns the RF front end with the reference design.

## Firmware

The firmware is a Zephyr 4.3 application for the SiWG917 on Silicon Labs' radio board, built with west and a Makefile.

- A cellular thread talks to the modem over a UART at 115200 baud with AT commands: it detects the modem, reads identity and SIM state, checks registration on 2G/3G, LTE and 5G, activates a data context, then tests with a ping and a DNS lookup.
- A Wi-Fi thread scans, connects with retries, gets an address by DHCP and reads RSSI, using Zephyr's network management events.
- A connection manager waits on kernel events from both and prefers cellular, falling back to Wi-Fi.

## What I did

I worked on the board and its design documents, and on the firmware. The firmware is a bring-up application, not a finished product.
