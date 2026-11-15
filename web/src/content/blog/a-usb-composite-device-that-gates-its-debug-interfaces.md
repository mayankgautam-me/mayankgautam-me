---
title: "A USB composite device that gates its own debug interfaces"
description: "How an STM32F042 USB bridge shows or hides CMSIS-DAP, DFU and two serial ports on the main MCU's command, and the fail-safe rules that keep a blank chip reachable."
date: 2026-11-15T06:00:00+05:30
tags: [USB, STM32, embedded, firmware, security]
draft: false
---

Most boards that carry a debug probe leave it on all the time. Plug in USB and you get a debugger, a bootloader and a serial console, whatever the firmware is doing. That is fine on a bench. It is a problem on a device that ships.

This post describes a design I built: a small STM32F042 that acts as the USB bridge for a board whose main MCU is an nRF9151. The bridge exposes four USB functions, and the main MCU decides which of them the host can see. It is a general technique, so I leave out what the product is. The firmware started from the open-source [dap42](https://github.com/devanlai/dap42) project and uses libopencm3.

## Why gate debug interfaces

A USB-attached SWD probe is a full-privilege way into the main MCU. A DFU interface lets anyone reflash the bridge. A serial console can leak logs. If all of that is always enumerated, anyone who plugs in a cable sees it.

Turning them off permanently is not an answer either. During development, provisioning and recovery you need them. So the question is who decides, and when.

My rule: only the main MCU decides. Nothing the USB host sends can change what is visible. The main MCU knows its own state (locked, unlocked, in setup, in some emergency mode), so it is the right authority. The bridge is deliberately dumb: it shows what it is told.

## The composite device

One USB device, up to four functions, always in this interface order:

| Function | Wired to |
|---|---|
| CMSIS-DAP v2 | SWDIO and SWCLK of the main MCU, plus its reset line |
| DFU runtime | reboots the bridge into the STM32 ROM bootloader |
| COM0 (CDC-ACM) | USART1 to the main MCU's first UART |
| COM1 (CDC-ACM) | USART2 to the main MCU's second UART, the debug console |

The set is chosen by a one-byte mask: bit 0 COM0, bit 1 COM1, bit 2 DFU, bit 3 CMSIS-DAP. Bits 4 to 7 are reserved and ignored.

Hiding a function means not putting it in the descriptors. The device does not declare an interface and disable it; it re-enumerates with a configuration that lacks it. Interface numbers therefore shift with the set. On macOS a CDC port shows up as `/dev/cu.usbmodem<port><n>`, where n depends on how many functions come before it, so I tell people to pick ports by name, not by suffix. If every function is hidden, the device still enumerates, as one vendor interface with no endpoints, so the host never sees a dead port. The WinUSB descriptors follow the set too.

## The mask protocol

The control channel has to reach the bridge without adding a wire. I used the debug console line the main MCU already has: its uart1 TX goes into the bridge's USART2 RX, which is also the COM1 path.

So the bridge sees a byte stream that is mostly console text, with control frames mixed in. It uses an ordinary frame format:

```
SOF 0xAA | Type | Length (2, LE) | Payload | CRC-16/CCITT (2, LE)
```

The CRC (polynomial `0x1021`, initial `0xFFFF`) covers type, length and payload. Two frame types matter here:

- `PORTS` (`0x40`), main MCU to bridge, 7 bytes on the wire, one mask byte.
- `PORTS_ACK` (`0x41`), bridge to main MCU, 13 bytes, seven payload bytes.

The bridge strips valid PORTS frames out of the stream. Everything else, including a stray `0xAA` that does not start a valid frame, goes to COM1 unchanged. A partial frame is passed through 20 ms after its start byte, so console output that happens to contain `0xAA` is not held back. A frame with a bad CRC is treated as not-a-frame, and the bytes are rescanned from the byte after the SOF.

The main MCU sends PORTS every 2 seconds, and again within 300 ms of a change (up to three times). It is a level, not an event, so a lost frame is repaired by the next.

The ACK is where most of the diagnosis comes from. Its payload is:

| Byte | Field |
|---|---|
| 0 | applied mask, what the host sees now |
| 1 | requested mask, the last valid PORTS |
| 2-4 | bridge firmware version |
| 5 | reset flags, from `RCC_CSR` |
| 6 | enumeration count (bits 0-5) and reason for the latest (bits 6-7) |

Applied and requested are separate on purpose. They differ whenever a change is waiting, and the main MCU can see that and keep resending.

## Fail-safe rules

Here is the part I care most about. If the main MCU is blank, crashed or running bad firmware, it cannot send PORTS. If the bridge then hid everything, you could not reach the chip to fix it. A gate that locks you out of recovery is worse than none.

So the rules are:

- At power-up the bridge waits up to 3 seconds for the first PORTS before it enumerates. That avoids enumerating with the wrong set and then immediately re-enumerating.
- With no valid PORTS for 10 seconds (or none at all since power-up), the mask becomes `0x0F`: all four functions visible.
- In that state the requested mask in the ACK reads `0x0F`, so the logs make it obvious.

A blank nRF9151 therefore stays reachable over SWD, with no special procedure. The 10 s timeout against a 2 s repeat leaves room for several missed frames.

Opening COM1 at a different baud rate also changes the rate the PORTS frames are read at, so a host tool can accidentally corrupt the control channel. The failsafe covers that too: after 10 s of unreadable frames, everything shows again.

```
power-up --(up to 3 s)--> first valid PORTS --> mask = PORTS
   |                                               |
   +-- none yet --> failsafe, mask = 0x0F <--------+-- 10 s without valid PORTS
                          |
                          +-- valid PORTS --> mask = PORTS
```

## Re-enumeration without breaking a debug session

Changing the set means a soft disconnect and a fresh enumeration. The bridge disconnects USB for 150 ms and comes back with only the visible functions. If someone is in the middle of a debug session when that happens, the debugger loses its probe.

The bridge defers a change while a debugger may be using the probe:

- until 5 s after the last CMSIS-DAP command, and
- while nRESET is held low.

The first covers an active session, the second a target held in reset, where the probe may have gone quiet.

While a change is deferred, the bridge acknowledges the frame at once with applied different from requested, then acknowledges again when the change has been applied. The main MCU can distinguish "not heard" from "heard, waiting".

This means that when the main MCU removes CMSIS-DAP, the probe may stay for a few more seconds. That is intended. Removing the function under a running debugger gives confusing errors and sometimes half-programmed flash.

## Safe DFU entry

DFU is the dangerous one, since it replaces the bridge's own firmware. Entering the STM32 ROM bootloader is allowed only under strict conditions.

A request comes in one of two ways: the standard `DFU_DETACH` on the DFU interface, or a CMSIS-DAP vendor command (31) carrying the payload `DFU`. Both are honoured only if the DFU bit is in both the applied and the requested mask. Both masks, so a pending change cannot open a window by being half-applied. If the conditions are not met, the detach is stalled and the vendor command answers with `DAP_ERROR`. The firmware keeps running.

The bridge records the request in a backup register, resets, then drives BOOT0 high and jumps to the ROM. Two details matter:

- The 1-second independent watchdog only resets the chip and boots the application again. A watchdog reset never enters the bootloader.
- A hard fault resets at once instead of waiting for the watchdog.

A hang or crash must not be a way to get a flashing interface that the main MCU has not allowed. The cost is that a bridge image that hangs before it can accept a request, or a running main MCU that hides DFU, needs the hardware route: bridging BOOT0 to the supply on the board.

## The race we fixed

Version 1.0.0 fixed a spurious failsafe re-enumeration. With a healthy main MCU sending PORTS on schedule, the bridge could still drop to the all-functions set and re-enumerate. The failsafe is a timeout, so it must only fire when nothing valid has arrived for 10 s. It was firing when something had.

The fix was to stop it firing wrongly. The practical lesson is to treat a failsafe enumeration on a healthy system as a bug, and to make it visible. That is why the ACK reports the reason for each enumeration, so the bug shows up in the main MCU's log and not only on the USB bus.

## Diagnostics

The ACK carries enough that the main MCU can log a useful line for each event. Reset flags come straight from `RCC_CSR`, cleared at boot:

| Bit | Cause |
|---|---|
| 0 | power-on or brown-out |
| 1 | NRST pin (also set by every internal reset, so it means external only when alone) |
| 2 | software |
| 3 | independent watchdog, a hang |
| 4 | window watchdog |
| 5 | low-power |
| 6 | option byte load |
| 7 | fault, the software reset came from the hard fault handler |

The enumeration byte holds a 6-bit count since the last reset (0 before the first, then 1 to 63, wrapping to 1) and a 2-bit reason: a PORTS frame changed the set, failsafe, or first enumeration after reset.

On the main MCU this turns into three log lines: the bridge booted (and why), the bridge re-enumerated (reason and count), and the bridge is running at version X.Y.Z. Reason `1` in the count byte says a failsafe caused the change. Bit 3 or bit 7 in the reset flags says the bridge hung or faulted and restarted. The count dropping back to zero tells me the bridge restarted.

## A checklist

If you build something similar, this is what I would check:

- One authority decides visibility, and the USB host cannot change it.
- The control channel needs no extra wire and cannot be confused with normal traffic: framing, CRC, and everything else passed through untouched.
- Level-triggered, repeated state, not one-shot commands.
- Applied and requested are reported separately.
- A timeout fails safe to the most reachable state, not the most locked-down one, so a blank chip can be recovered.
- A wait at boot, so the first enumeration is already the right one.
- Changes are deferred while a debugger might be using the probe, and while the target is held in reset.
- Bootloader entry needs the function to be allowed in both masks, and a watchdog or fault reset never leads to it.
- A hardware recovery path exists for the bridge itself, and it is physical.
- Reset cause and an enumeration count with a reason are in every acknowledgement.
- A failsafe re-enumeration on a healthy system is treated as a bug and visible in the logs.

The design is small: a mask byte, a seven-byte frame, a few timers and a rule about which way to fail. Most of the work went into the cases where it must not do something: not re-enumerate under a debugger, not enter the bootloader on a hang, not lock out a blank chip.
