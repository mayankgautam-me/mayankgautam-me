---
title: "Air-quality monitoring"
summary: "A battery and solar air-quality node: an STM32L476 reading eleven channels from gas, particulate and CO2 sensors, a custom board with its own charger and rails, and readings published to a oneM2M backend."
group: product
context: Deep-tech startup
period: 2024 to now
order: 9
art: air
tags: [STM32L4, Altium, Electrochemical sensors, ESP32, oneM2M, Low power]
---

## What it is

A sensor node that measures air quality and reports it to a oneM2M backend. It wakes on a timer, reads its sensors, joins Wi-Fi, publishes one reading and goes back to deep sleep. A dashboard and a notification feed sit on the backend side; the oneM2M platform work is described on its own page.

It reports eleven channels: temperature, humidity, NO2, O3, CO, SO2, H2S, NO, PM2.5, PM10 and CO2.

## Hardware

The board is an Altium project with one sheet per function: power input, charger, regulation, load switching, ADC, gas sensors, particulate, environmental sensors and system I/O.

- **Power:** a solar input and an adapter input, each with a fuse and a TVS, feed an LTC4417 priority mux. An LT3652 charges the battery from either, with an NTC on the pack. A MAX17048 fuel gauge, a comparator-based undervoltage cutout and a TPS22990 battery disconnect protect the cell.
- **Rails:** a TPS61088 boost makes 5.6 V, and three LDOs (TPS7A20 family) make 5.0 V, 4.5 V and 3.3 V. The 4.5 V rail biases the gas sensors and is switched on with a delay.
- **Gas sensing:** electrochemical cells are read through an ADS1258, a 24-bit 16-channel delta-sigma ADC, with a REF5040 4.096 V reference. There is an unfitted Pt1000 excitation option.
- **Other sensors:** a BME280, an SPS30 particulate sensor on I2C and a CO2 module, with an MCP23017 expander for enables and a status RGB LED.

## Firmware

The MCU is an STM32L476, built with PlatformIO and STM32Cube. An ESP32-C3 running Espressif's AT firmware is the Wi-Fi modem, driven over UART, and the repo carries a Docker build for that image.

Each wake does the same sequence: power the sensors that the current mask enables, let them warm up, join Wi-Fi, derive an identity from the MAC address, register with the backend, read its desired settings, take the readings, publish, report battery and the applied settings, then set an RTC wake-up and sleep. Nothing important lives in RAM across sleeps, so the device checks the backend for what it has already provisioned each time.

There are drivers for the electrochemical channels (with temperature-dependent correction on the NO2 channel), a UART particulate sensor, a UART CO2 sensor, DHT11 and DHT22, and a flash-backed settings store.

## Backend

Settings flow down and readings flow up. The operator can change the sampling interval, location and which sensors are enabled, and the dashboard shows when the device has confirmed the change.

On top of that, a small framework consumes the notifications and stores readings in SQLite or MySQL. Its air-quality plugin looks at the correlation between the eleven channels over a window of recent readings, switches off sensors that a correlated neighbour can reconstruct, and stretches or shortens the sampling interval with how volatile the air is.

A device simulator runs the same sequence against a local backend, so the whole chain can be tested without hardware.

## What I did

I worked across the whole chain, from the schematic to the dashboard: the board, the firmware on the STM32 and the ESP32 modem, and the device-to-backend flow. I also worked on the simulator and the tooling that builds and runs it.

Not finished: the firmware's over-the-air update step is a stub that recognises the command but does not fetch an image.
