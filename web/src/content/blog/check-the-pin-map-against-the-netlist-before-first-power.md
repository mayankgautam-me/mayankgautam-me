---
title: "Check the pin map against the netlist before first power"
description: "Firmware generated for a vendor evaluation board is wrong for your own board in ways that can hurt it; this is how I audit pins and analog constants against the netlist before the first power-on."
date: 2026-11-15T02:00:00+05:30
tags: [firmware, hardware, bring-up, STM32, nRF52]
draft: false
---

Firmware generated for a vendor's evaluation board is correct for exactly one board: the vendor's. If yours is a custom board with the same chip, the project still builds, flashes and looks plausible. Nothing in the toolchain tells you that the pin you configured as a button is, on your board, the enable line of a power converter.

I have run the same audit on two private boards, a BLDC motor controller and a small nRF52840 input device. Both were still on paper, with inherited firmware, and neither was powered yet. Both had a list of mismatches long enough that powering up would have been a gamble. This post is the method and what it found. Everything here comes from reading files, not from measuring a board.

## Why eval-board projects bite

A generator such as CubeMX, with ST's Motor Control SDK on top, starts from a board definition. It picks the evaluation board's pins, shunt value, divider, amplifier gain, temperature sensor and clock source. You then add your code to a project in which hundreds of decisions were made for hardware you do not have.

That is worse than an ordinary porting bug. The failures are silent: a wrong pin is not a compile error, and a wrong shunt value still produces a number. The mistake can also be safe on the vendor's board and unsafe on yours. And on custom hardware the net on a pin is whatever you drew, so an input, output or analog pin that was harmless on the vendor board can be a contention or a dead feature on yours.

## The method: export the netlist

The netlist is the ground truth for what connects to what. I export it rather than reading the schematic:

```sh
kicad-cli sch export netlist --format kicadxml -o board.xml board.kicad_sch
```

The XML is easy to script. Each net lists its nodes, and each node carries the reference designator, the pin number and, for a microcontroller symbol, a function name such as `PB8-BOOT0_22`. That lets you ask what is on PB8 rather than what is on pin 22.

## Pin by pin

I make one table with a row per pin the firmware touches: the pin, what the firmware does with it, and the net on that pin. A fourth column in words says where the board actually has that function. The first two come from the project's configuration (`.ioc` for CubeMX, a devicetree overlay for Zephyr), the third from the netlist. The fourth is judgement, and it is the one that matters.

Read each row as a question. Is the firmware driving this pin, and does anything else drive the net? Is the net called enable, good, reset, boot or sense? Those words turn a harmless GPIO into a hazard. Then go the other way: for every function the board needs, such as a Hall input or a converter enable, find the pin the firmware uses and check the nets agree.

Also check each pin against the datasheet. A net can be connected where you meant and still land on a pin that cannot do the job.

## Analog constants

The other half is the numbers that turn ADC counts into amperes, volts and degrees. They live in a parameters header or the configuration file and describe the vendor's resistors. For each one I find the components that set it on my schematic, do the arithmetic and write both values side by side.

A divider ratio is the simplest. With 180 kΩ over 10 kΩ the ratio is 10 / 190 = 0.0526. The firmware assumed 0.04. At a real 24 V the ADC pin sits at 24 × 0.0526 = 1.263 V, and the firmware computes 1.263 / 0.04 = 31.6 V. It reads 32 percent high, so an overvoltage threshold trips early and anything regulating on bus voltage regulates to the wrong place.

A shunt is the same kind of error with a bigger consequence. The amplifier output is I × R × gain, and the firmware inverts it with its own R. It assumed 5 mΩ; the board has 10 mΩ. The firmware divides by half the real resistance, so it reports twice the true current: a real 10 A reads 20 A. A limit set at 20 A acts at about 10 A, and a current loop regulating to a reference reaches its target at half the true current. Full scale moves too. With the firmware's gain of 7.33 and a bipolar 3.3 V range, it believes it can read 3.3 / (2 × 0.005 × 7.33) = 45 A; with 10 mΩ the real range is about 22.5 A. The opposite mistake, a firmware shunt larger than the board's, reads low and leaves a protection limit above the real one. That is the direction that burns things.

Amplifier gain comes from resistor networks, sometimes one per phase, so derive it from the sheet and compare. A temperature sensor needs the whole transfer function, not just the part type, as the first case shows.

## Clocks and enables

Two more groups are easy to miss. For clocks, check which oscillator the firmware selects and whether it is the one fitted, and whether the crystal's pins are used as GPIO. For enables, find every converter, load switch and gate driver, find its enable net and ask what drives it and when. If nothing drives it the way your schematic needs, the rail never comes up and everything downstream looks broken. If the firmware puts a different function on that pin, the rail does something at the wrong time.

## Case 1: a BLDC motor controller

The board has an STSPIN32G4, and the firmware came from the Motor Control workbench for ST's evaluation board. I compared the project's configuration and parameters headers with the netlist of the microcontroller.

| Firmware function | Pin | Net on my board |
|---|---|---|
| Start / stop button (interrupt input) | PC13 | 24 V converter enable |
| Second button (interrupt input) | PB10 | gate of a low-side load switch |
| Hall H3 (timer input) | PB8 | BOOT0, pulled to ground |
| Speed potentiometer (ADC) | PC3 | gate of another load switch |
| Potentiometer (analog) | PA4 | 5 V converter enable |
| Display lines (outputs) | PB9, PA5, PD2, PB5 | the real Hall H3 net, 5 V good, 12 V good, a load switch gate |

Why each could hurt:

- **Start button on the 24 V enable.** The firmware treats it as an input, so nothing drives the enable. The 24 V and 5 V converters are never turned on, and the 12 V converter, which feeds the Hall sensors, comes on only during a button-driven sequence. The board would look dead.
- **Hall H3 on BOOT0.** The firmware reads BOOT0 as the third Hall signal. The real one is on another pin, so commutation reads a pin that is not the sensor. BOOT0 is also sampled at reset on this family, so a signal wired there may change how the part boots depending on the option bytes. I have not checked that on hardware.
- **Display outputs on power-good nets.** Those lines are outputs of the converters. A pin driven as an output onto a net something else drives is contention, and one of the display lines also drives the real Hall H3 net.

The constants:

| Parameter | Firmware | Board |
|---|---|---|
| Shunt | 5 mΩ | 10 mΩ |
| Bus divider ratio | 0.04 | 180 kΩ over 10 kΩ, 0.0526 |
| Amplifier gain | 7.33 | set by resistor networks on the sheet; not yet derived |
| Temperature sensor | linear, 1.75 V at 50 °C, 25 mV/°C | NTC 10 kΩ, B 3380 K, to the supply, 4.7 kΩ to ground |

The shunt and divider arithmetic is above. I worked the sensor out separately, assuming the ideal B-parameter model. At 25 °C the divider gives 3.3 × 4.7 / (4.7 + 10) = 1.055 V, which the linear model reads as about 22 °C. At 50 °C the NTC is about 4.16 kΩ, the output about 1.75 V, and the two models agree. At 100 °C the NTC is about 1.02 kΩ, the output 2.71 V, and the linear model says 88 °C. So the reading is right in the middle and under-reads near the limit, where a thermal cutoff fires late.

The clock was the internal 16 MHz oscillator through the PLL, while the board has a 24 MHz crystal that was never used. That is probably tolerable for a first spin, but PWM and ADC timing then rides on an RC oscillator, and it shows the project does not describe this board.

I put the outcome in the firmware's changelog as a known issue: on this board its current and voltage readings are wrong, so do not drive a motor with it. No hardware paid for it.

## Case 2: a small nRF52840 input device

The second board is a small input device around an nRF52840, with firmware adapted from a reference design. The findings were a different kind.

- **A driver for the wrong part.** The touch-pad driver was written for one controller and the board carries a newer one from the same maker. The driver only warns on a product-number mismatch, so it would carry on with the old register map. Whether the new part answers that way is unknown until tested.
- **VBUS not connected.** The USB connector's VBUS reached a pin with no net. The nRF52840 detects a USB host through VBUS, so detection would fail, taking out both the serial console and the bootloader's USB drive. This one is visible in the netlist as a net literally named unconnected.
- **No way into the bootloader.** The UF2 bootloader enters its USB mode on a double tap of reset. The reset line went only to the programming header, with no button. The firmware overlay also deleted the reset configuration and used that pin as a user button, so one pin is both reset and an input.
- **Pins that cannot do the job.** Two analog signals were wired to pins with no analog-input function on this chip, so the ADC cannot read them however the firmware is written. The netlist shows a valid connection and the datasheet says it is useless.

None of these can damage anything. All of them would cost a board spin or a day of confusion, and all showed in the netlist and the datasheet before anything was built.

## Automating part of it

The mechanical part, matching pins to nets, is a short script. This one reads the XML netlist and a CubeMX `.ioc` file and prints one row per pin the firmware touches:

```python
import re, sys, xml.etree.ElementTree as ET

net_xml, ioc, ref = sys.argv[1:4]
net_of = {}                       # port name -> net on that pin
for net in ET.parse(net_xml).getroot().iter("net"):
    for node in net.iter("node"):
        m = re.match(r"(P[A-K]\d+)", node.get("pinfunction", ""))
        if node.get("ref") == ref and m:
            net_of[m[1]] = net.get("name").split("/")[-1]

fw = {}                           # port name -> what the firmware calls it
for line in open(ioc):
    m = re.match(r"(P[A-K]\d+)[^.]*\.(GPIO_Label|Signal)=(.*)", line.strip())
    if m:
        fw.setdefault(m[1], {})[m[2]] = m[3]

for pin, d in sorted(fw.items(), key=lambda kv: (kv[0][1], int(kv[0][2:]))):
    print(f"{pin:5} {d.get('GPIO_Label', d['Signal']):30} {net_of.get(pin, '-')}")
```

Run on the motor controller it printed, among other rows:

```
PA4   MB_POTENTIOMETER               5V_ENB
PA5   GPIO_Output                    5V_GOOD
PB8   M1_HALL_H3                     BOOT
PC13  Start/Stop [PushButton]        24V_ENB
```

That is most of the finding in four lines. The script cannot judge: it does not know that a Hall input should not be on `BOOT`. A cheap improvement is to flag any net whose name contains `ENB`, `GOOD`, `BOOT` or `RST`. I still read the output by eye. The analog constants are not worth scripting beyond a table of firmware value, schematic value and formula.

## A checklist before first power

1. Export a fresh netlist from the current schematic.
2. For every pin the firmware configures, write the net on that pin beside it.
3. Flag every firmware output on a net something else drives, every input on an enable or gate, and anything on BOOT, reset or debug pins.
4. For every converter, load switch and gate driver, check the firmware drives its enable, and when.
5. For every function the board needs, confirm the firmware uses the pin the board wired.
6. Check each pin's capabilities in the datasheet: analog input, timer channel, USB detect, reset.
7. Compute shunt, gain, divider ratio and temperature transfer function from the schematic, compare with the firmware, and write down what each wrong value does to the reading.
8. Check the clock source, crystal frequency and the pins it uses.
9. Check that a way into the bootloader exists: a reset button, boot pin or connector.
10. Check each driver against the part actually fitted.
11. Record every mismatch in the bring-up notes, and hold first power until each is fixed or accepted. Until then the firmware carries a warning that says so.

An hour with two files side by side moves a wrong shunt value from "the motor is warm" to a line in a table.
