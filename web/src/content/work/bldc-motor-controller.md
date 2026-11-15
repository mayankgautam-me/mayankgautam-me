---
title: "BLDC motor controller"
summary: "A three-phase BLDC controller for a 36 V scooter drive: a four-layer KiCad board built around an STSPIN32G4, with field-oriented control firmware on FreeRTOS."
group: product
context: Independent
period: 2019 to now
order: 4
art: phases
tags: [STM32G4, STSPIN32G4, FOC, FreeRTOS, KiCad, BLDC]
---

## What it is

A three-phase brushless DC motor controller for a scooter drive, from schematic to firmware. It runs a 36 V nominal bus and drives the motor with field-oriented control using Hall sensors for rotor position.

The design is two boards in one KiCad project: the motor controller, and a smaller RF and display board that connects over CAN.

## Hardware

The motor controller is 130 x 70 mm on four copper layers (1.6 mm, 35 µm copper), with parts on both sides.

- **Controller and driver:** an STSPIN32G4, which puts an STM32G431 and a three-phase gate driver in one package.
- **Power stage:** three TI CSD88599Q5DC 60 V half-bridge power blocks.
- **Current sensing:** one 10 mΩ shunt per phase, read through the MCU's internal op-amps and ADCs.
- **Position and housekeeping:** Hall inputs, a bus voltage divider and an NTC for temperature.
- **Protection on the board:** a 20 A input fuse and a 48 V TVS on the supply.
- **Rails:** 24 V, 12 V and 5 V buck converters (LM76005 and LM76002) for loads, a servo and the second board.
- **Comms:** a CAN transceiver on the motor board, and a CAN FD controller with a Bluetooth module on the RF board.

## Firmware

The firmware is generated from ST's Motor Control Workbench (MCSDK 6.3.2) on STM32 HAL, with FreeRTOS around it.

- FOC runs at 16 kHz on TIM1, with a 1 kHz speed loop and Hall-based position and speed feedback.
- Current is sampled on three independent shunts. Dead time is set for the gate driver.
- FreeRTOS runs a medium-frequency task, a higher-priority safety task and a display task on a 1 kHz tick.
- A host talks to it with ST's Motor Control Protocol over ASPEP on a UART at 115200 baud. A second UART carries a text log.
- Protection covers software over- and undervoltage and over-temperature, a hardware overcurrent trip through the on-chip comparators into the timer break input, and the gate driver's fault line.
- Application extras: a start/stop input, a fold sequence driving a servo, and a small status display.

## Tools and testing

- KiCad 10 for schematic and layout, with ERC and DRC run from the command line and fab files generated for JLCPCB and LCSC assembly.
- Firmware builds with arm-none-eabi-gcc from a plain Makefile, and flashes over SWD with an ST-LINK.
- CI runs the checks on every push, and releases are tagged per part.
- The repo carries a written bring-up checklist and a list of known issues, found by comparing the board netlist with the firmware configuration.

## What I did

I designed the board and its schematic sheets, chose the parts, and prepared it for fabrication and assembly.

I set up the FOC firmware on the STSPIN32G4, the RTOS tasks, the host protocol and the scooter-specific functions. I also wrote the bring-up and manufacturing documentation and the build and release tooling.

Work in progress: the firmware's pin map, shunt value, bus divider and temperature model still follow ST's evaluation board. Aligning them with this board is the next step before driving a motor from it.
