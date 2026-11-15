---
title: "Matching LTE and GNSS chip antennas with a NanoVNA: what worked and what lied"
description: "Measurements from matching two chip antennas on a small 6-layer tracker board: how I calibrated, which readings I trusted, and four things that made the NanoVNA lie."
date: 2026-11-15T09:00:00+05:30
tags: [RF, antenna, NanoVNA, LTE, GNSS]
draft: false
---

I spent a few days matching two chip antennas, one for LTE and one for GNSS, on a small LTE-M/NB-IoT and GNSS tracker board. The tool was a NanoVNA. It is good enough for the job, but on a board this small it also reports what the setup around the antenna is doing.

This post is what I would tell myself before starting. It covers the calibration, how to decide whether a reading is real, the four traps that cost me the most time, the networks I ended up with, and what the numbers say about how far a small antenna can be pushed. The numbers are all from my own bench. I say which are measured and which are predicted.

## Setup and calibration

The board is 60.75 x 15.9 mm with six layers. The RF trace runs on the bottom layer over an inner ground plane, with 0.1164 mm of prepreg between them (er about 4.1). A 0.22 mm trace over that stack is close to 52 ohm, which is near enough to 50 that I treated the feed as a plain 50 ohm line. The two antennas are Ignion chip antennas, one NN02-224 for LTE and one NN02-201 for GNSS, each fed at pad 1 with pad 2 left open. Between the modem and each antenna there is a ladder of 0402 pads where I could place series and shunt parts.

The instrument was a NanoVNA-F V3 on firmware 0.6.0, sweeping 801 points. I connected the board through about 63 cm of RG-316 pigtail, which is 6.10 ns round trip.

The order of operations matters:

1. Calibrate open, short and load at the VNA port with the pigtail off and `edelay 0`.
2. Only then connect the pigtail and set `edelay 6.1`.
3. Remove the pigtail loss in software. I measured the pigtail once with an open and once with a short, saved both as `.s1p` files, and used them to correct later sweeps.

Calibrating with the delay already applied corrupts the calibration, so "edelay 0 first, delay afterwards" is a fixed rule for me.

One more habit: after connecting anything, wait two full sweeps, about 8 seconds, before capturing. The first sweep after a change can still contain the old state.

## Reading S11 honestly

A VNA gives you S11, and it is easy to take every trace it draws as a property of the antenna. On this board I only trust a reading if two back-to-back sweeps agree to within 0.02 in |S11|. If they don't, something moved: a cable, a hand, a ferrite, the display. The reading is then about the setup and I fix the setup first.

I read impedance as well as SWR. SWR hides the sign of the reactance, and the reactance tells you which part to add: an antenna at 4 - j35 ohm needs series inductance.

When I design a network I design against a measurement of the antenna as it is used on the board, with the same ferrites and the same display connection I will have for every later sweep. I describe those two conditions next, because they were responsible for the biggest errors.

## Traps

### The coax braid radiates

On a 16 mm wide board the ground plane is a large part of the antenna. Chip antennas of this kind do not carry their own ground, they use the board's. When you connect a cable, the outer braid becomes an extension of that ground and joins in. The VNA then measures board plus cable.

Without any choke, the same board read 4.9, 12.4 and 54.5 ohm at 1710 MHz on three different sweeps. The board was the same each time. The difference was the cable and what was near it.

What I do now:

- Clip two or three ferrites on the pigtail within 5 cm of the board, and one more 10 to 15 cm along it.
- Tape the cable down so it does not move between sweeps.
- Keep my hands away from the cable and the board while it sweeps.
- Accept a reading only when two sweeps agree to |S11| < 0.02.

With the ferrites fitted, the LTE antenna at the antenna pad read, for example, 4.91 - j35.88 ohm at 1710 MHz and 3.96 - j12.78 ohm at 2110 MHz. Those are the values I designed against. They are low resistance and capacitive, which is typical for a short chip antenna below its resonance.

### The display loads the antenna

The NanoVNA-F has a large display and a case, and with the display connected, the instrument is another conductor near the board. At the antenna pad at 1710 MHz I measured:

| Condition | Z at 1710 MHz |
|---|---|
| Display off or removed | 54.5 - j112 ohm |
| Display connected | 3.55 - j34.6 ohm |

That is not a small shift. It is a different antenna. The conclusion I took is that tuning with the display off gives a match for a setup that does not exist at the time of use, and the sensible way round is to always tune with the board in the state I actually measure in and to keep that state identical across sweeps. The "as used" measurements in this post all have the display connected and the ferrites fitted.

### Adjacent inductors couple

Two of the series and shunt positions sit about 1.5 mm apart. At 1.5 GHz and above, two 0402 inductors that close see each other. A network calculator treats them as independent parts, so its prediction is wrong in a way you cannot fix by fiddling with values.

Two examples from my sweeps:

- LTE high band, two inductors in adjacent positions: predicted SWR 3.38, measured 9.05.
- GNSS, 5.6 nH series with 8.2 nH shunt: predicted 1.25, measured 8.0.

Capacitors did not do this. When I used capacitors the results landed on the prediction. My rule now is to prefer capacitors where the topology allows it, change one part at a time, measure after each change, and refit the model to the measurement instead of trusting the earlier prediction.

### Rework drifts the result

Every time I removed and replaced a part I added solder, moved the part by a fraction of a millimetre and heated the board. On a 0402 pad that matters. After six rework cycles on one board, the worst-case SWR across the band I was tuning measured 6.29. The same part values on a fresh build had measured 3.05.

I did not isolate which effect dominated. The practical consequence is simple: do the exploration on a sacrificial board, then build the final board with as few solder cycles as possible, and confirm the result on that board without changing anything.

## Choosing the matching networks

### LTE, high band

At the antenna pad the impedance is a few ohms resistive and tens of ohms capacitive, so the network has to raise the real part and cancel the reactance. The final network, from the radio side to the antenna, is a 2.7 nH series inductor, a 1.8 nH shunt inductor and a 1.1 nH series inductor next to the antenna. The first series position on the radio side is a 0 ohm link that I fitted last, after the pigtail came off. I used Murata LQW15A wire-wound parts (Q about 65) and an LQG15HS multilayer part for the 1.1 nH value.

This network uses inductors, with the coupling risk above, so I trusted only what I measured on the board.

I tried one variant that improved one band and hurt another. A 0.9 pF shunt capacitor brought the 1850 to 1990 MHz range to a better match, with worst SWR 2.09 on the uplink and 1.44 on the downlink, but it pushed the 1710 to 1780 MHz uplink to 4.52. Raising the series inductor to 3.3 or 4.3 nH with that capacitor produced resonances inside the band, with worst SWR 9.4. I rejected all three.

### GNSS

The GNSS antenna resonates low, near 1525 MHz, so at 1575.42 MHz it looks like 35.4 - j78.1 ohm, SWR 5.38. A series inductor of 12 nH followed by a shunt capacitor of 1.5 pF brought that to SWR 2.3. An earlier attempt at 10 nH and 1 pF landed almost in the same place, which tells me the result is not sensitive to the exact values. After the change the match is centred near 1607 MHz, which is higher than I wanted. I accepted that because the GNSS path is receive only, and the cost of a slightly off-centre match is already small.

## Results per band

Mismatch loss is the fraction of incident power that is reflected and never reaches the antenna. From |S11| or SWR:

```
|G| = (SWR - 1) / (SWR + 1)
mismatch loss (dB) = -10 * log10(1 - |G|^2)
```

Worked example, using the LTE B4/B66 uplink worst case of SWR 3.05:

```
|G|  = (3.05 - 1) / (3.05 + 1) = 2.05 / 4.05 = 0.506
|G|^2 = 0.256
loss = -10 * log10(1 - 0.256) = -10 * log10(0.744) = 1.28 dB
```

That is the 1.3 dB I quote below. It counts only the reflection, so it says nothing about how much the antenna radiates or loses to heat. It also assumes the measurement is at the right reference plane, which is why the traps above matter.

For the LTE network, measured as used (ferrites, display connected):

| Band | Worst SWR | Mismatch loss |
|---|---|---|
| B4/B66 uplink, 1710 to 1780 MHz | 3.05 | 1.3 dB |
| B2 uplink, 1850 to 1910 MHz | 2.68 | 1.0 dB |
| B2 downlink, 1930 to 1990 MHz | 3.37 | 1.5 dB |
| B4/B66 downlink, 2110 to 2155 MHz | 5.16 | 2.6 dB |

The headline figure is 1.3 dB on B2, B4 and B66. The downlink side of B4/B66 is the weak spot at 2.6 dB and I did not manage to improve it without giving up the uplink.

For GNSS, measured at 1575.42 MHz:

| Case | SWR | Mismatch loss |
|---|---|---|
| Antenna alone | 5.38 | 2.8 dB |
| 12 nH series + 1.5 pF shunt | 2.3 | 0.75 dB |

By the same formula, the rework-drifted SWR of 6.29 is about 3.2 dB, against 1.3 dB at 3.05.

For comparison on a different band, a path with no matching at all measured about 9.8 dB of mismatch loss, and a network tuned for that band brought it to 1.9 dB. I mention it only to show how large the swing can be, and I did not repeat the experiment on other bands.

## The bandwidth limit of a small antenna

The low band is where the antenna stops cooperating. At around 700 MHz the antenna's Q, estimated from the direct measurement at its feed, is about 28. To cancel that much reactance with a series inductor I would need about 22 nH. A part that size, at that frequency, has a loss comparable to the antenna's own resistance of 4.7 ohm. The inductor ends up dissipating as much as the antenna radiates.

My measured cost for the lowest LTE band I looked at was about 4.4 dB of loss. That is not a mismatch problem that better parts will fix. It follows from the antenna being a small fraction of a wavelength: it has a small radiation resistance and a large reactance, and the gap between them gets wider the lower you go.

Two consequences came out of my data:

- The high band is cheap. Between 1710 and 1910 MHz I reached SWR of about 3 at 1 to 2.5 dB loss.
- One network cannot cover both the low and high bands. The best compromise I found lost 6 to 8 dB in each. I decided to tune for one set of bands and restrict the modem to them, which is a firmware decision and not an antenna one.

Also, where the network goes matters. Matching at the antenna side of the ladder worked, and matching at the radio side did not, because by then the pads and trace had already transformed the antenna impedance down to 1 to 2 ohm, which cost another 2 to 3 dB.

## A checklist

What I would do again, in order:

1. Know the feed. Check the trace impedance against the stack-up, and note how much trace is between the pad and the connector.
2. Calibrate at the VNA port with the pigtail off and `edelay 0`. Apply the electrical delay after.
3. Measure the pigtail open and short once, and use them to remove its loss.
4. Fit ferrites, tape the cable, and keep the same display and cable state for every sweep.
5. Wait two full sweeps after any change. Accept a reading only when two sweeps agree to |S11| < 0.02.
6. Measure the antenna alone, as used, and design the network against that data, not against the datasheet.
7. Match at the antenna end of the ladder.
8. Prefer capacitors. Where you need inductors, keep them apart from each other, change one part at a time, and measure each step.
9. Do the exploration on a sacrificial board. Build the final one with few solder cycles.
10. Convert SWR to mismatch loss and compare against what the band needs. A 1.3 dB mismatch loss is a good result for an antenna of this size. A 4 dB one is a reason to change the antenna or the band list, not the inductor.
11. Keep every sweep as a `.s1p` file with a name that says what was fitted.

The NanoVNA cannot tell you when the cable, the display or your hand is part of what it is measuring, so I check that first.
