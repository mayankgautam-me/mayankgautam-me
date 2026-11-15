---
title: "Budgeting LED current so a USB device does not brown out"
description: "How I cap the current of 35 addressable LEDs on a USB desk controller, frame by frame, with the arithmetic for two board revisions and the mistake that made the lights pulse."
date: 2026-11-15T10:00:00+05:30
tags: [embedded, firmware, power, LEDs, USB]
draft: false
---

I am building a USB desk controller with addressable LEDs: buttons, knobs, a small buzzer, and 35 SK6812MINI-E LEDs behind them. One is a logo, and eight form a status strip behind a silicone diffuser. This post is about keeping those LEDs inside the current the supply can give, so the chip does not reset.

The technique is general. Work out a current budget per board revision, estimate every frame's draw before sending it, and scale the frame to fit. What matters is which part of the frame you protect and which number you protect it with. I got the second one wrong at first.

## The symptom

On a USB port the supply is a hard wall. A port promises 500 mA and the device has no say. When the load goes past what the port or regulator can give, the rail sags, the microcontroller's supply drops below its reset threshold, and the chip restarts: a power-on reset (POR). From outside, the device vanishes from the bus and comes back.

Mine did this in one situation. The status strip animates by blanking and relighting its LEDs every 100 to 150 ms. When that animation started at the same moment as the buzzer, the combined transient reset the chip. A board in its factory-reset state, with everything lit, sits near 570 mA, which is 70 mA past what a 500 mA port offers. The firmware was free to ask for more than the supply had, and sometimes it did.

Addressable LEDs are the worst load for this, because the host decides the current. Each LED takes red, green and blue values from 0 to 255 and the draw follows them. If the app can set any colour on any LED, the firmware has to assume it will eventually set all of them to white.

## The current math, per revision

The LEDs are not off when dark. The firmware assumes about 1 mA per LED at idle:

```
35 LEDs x 1 mA = 35 mA
```

That floor cannot be scaled away. A frame dimmed to black still costs 35 mA.

**Rev A: LEDs on the 3.3 V regulator.** The LEDs ran from a 200 mA LDO that also feeds the MCU and USB (about 25 mA), the shift registers that read the buttons, and the buzzer. I set the LED budget to 135 mA:

```
MCU + USB                      ~25 mA
LED budget                     135 mA
                               ------
                               160 mA, plus shift registers and buzzer
rail, near                     ~170 mA of 200 mA
lit-pixel share: 135 - 35      100 mA
```

That leaves about 30 mA of headroom on the regulator, and I did not want to spend it.

**Rev B: LEDs on VBUS.** On the next revision I moved the LEDs to the 5 V from the USB connector, so they stop competing with the MCU for the LDO. The port offers 500 mA. The MCU, USB and buzzer take their share, with margin, and the budget is 380 mA:

```
port                           500 mA
LED budget                     380 mA
left for MCU, USB, buzzer      120 mA, with margin
lit-pixel share: 380 - 35      345 mA
```

Lit pixels get 345 mA instead of 100, about three and a half times as much. Each budget is a compile-time constant chosen by the board revision.

These are budgets from a datasheet-style estimate and the firmware's model, not measurements. I have not yet recorded the idle current or rail voltages of a good board, and I would rather say so than quote a number I did not measure.

## Scaling a frame before it is sent

The firmware builds a frame buffer and sends the whole chain at once. Between building and sending there is one gate: estimate the current, and if it is over budget, scale the pixels down.

The estimate is a sum of per-LED draws, each a function of that LED's red, green and blue values. The sketch below is my own illustration of the shape, with a rough linear model of about 20 mA per channel at full value:

```c
#define N_LEDS     35
#define IDLE_MA    1            /* per LED, cannot be scaled away */
#define BUDGET_MA  380          /* chosen by the board revision */

static uint16_t led_ma(const uint8_t rgb[3])
{
    uint32_t sum = rgb[0] + rgb[1] + rgb[2];
    return (uint16_t)((sum * 20u) / 255u);
}

uint8_t frame_scale(uint8_t px[N_LEDS][3])
{
    uint16_t idle = N_LEDS * IDLE_MA;
    uint16_t lit = 0;
    for (int i = 0; i < N_LEDS; i++) lit += led_ma(px[i]);

    if (idle + lit <= BUDGET_MA) return 255;   /* fits, send as is */
    if (BUDGET_MA <= idle)       return 255;   /* nothing to scale */

    uint16_t avail = BUDGET_MA - idle;
    uint8_t  s = (uint8_t)(((uint32_t)avail * 255u) / lit);

    for (int i = 0; i < N_LEDS; i++)
        for (int c = 0; c < 3; c++)
            px[i][c] = (uint8_t)(((uint16_t)px[i][c] * s) / 255u);
    return s;
}
```

The line that sets `avail` is the important one. The budget includes the idle floor, so the scale applies only to what is left after it. Scaling the whole total by `budget / total` would dim the frame too much, because it would also shrink the part that cannot shrink.

A scale of 255 means the frame fit. Anything lower means the limiter dimmed it, which is worth reading later.

One more choice: group brightness in the app is a share of what the limiter allows, not an absolute drive level. A value of 255 means "as bright as the budget allows for this group". The cap is recomputed every frame, so defaulting everything to full is safe.

## Priorities, and the peak-not-instant lesson

A uniform scale is simple but not what I wanted. The strip sits behind a diffuser that swallows much of its light. If the limiter dims it with everything else, it becomes unreadable when it is showing a state.

So the strip is exempt. The other groups give up headroom first, and the strip is touched only if it alone would exceed the budget. The strip is a contiguous block of LEDs, so everything else is one contiguous range as well: two ranges, no per-pixel bookkeeping. The limiter does this:

1. Sum the idle floor, the strip's draw and the others' draw. If it fits, send the frame untouched.
2. Otherwise take the budget, subtract the idle floor and a reserve for the strip. The rest is the allowance for the other groups.
3. Scale the other groups to that allowance and leave the strip alone.
4. If the strip's reserve alone is more than what is available, drop the others to zero and scale the strip to fit. That is the pathological case, and it still beats a reset.

The interesting part is the strip's reserve. My first version used the strip's draw in the current frame. It was the obvious choice and it was wrong.

The strip's animation blanks and relights its LEDs every 100 to 150 ms. In frames where the strip was dark, its draw was low, so the other groups got the freed headroom. A moment later the strip lit, the reserve rose, and the others were scaled back down. Every other group pulsed in time with the strip's animation. The buttons breathed with a rhythm that had nothing to do with their own state.

The fix is to reserve the animation's peak instead: the most LEDs the animation lights at once, times the current of the strip's colour at its current brightness. That number does not change from frame to frame. It changes only when the strip's colour, brightness or on/off state changes, so the other groups get a constant allowance and stop pulsing. On top of that the reserve is never less than what the strip is drawing right now.

The general lesson is that a fast-changing input to an allocator becomes a fast-changing output on the screen. Allocate on the envelope, not on the sample.

## The hardware fix in the next revision

A firmware limiter bounds the draw of a frame. It cannot help with a short, and it cannot help with a transient inside a frame. So Rev B also changes the hardware. The LEDs move from the LDO to VBUS, as above, and the board adds decoupling that Rev A lacked: 100 nF at each LED and 10 uF on VBUS. Rev A had no capacitor at each LED and no bulk capacitor on the supply.

I should be careful about what I claim. These are the standard remedy for a supply that sags when the load steps, and that is why they are there. I have not measured the rail with and without them, so I cannot say how much of the brown-out each one fixes. The two fixes address different things: the limiter bounds the average draw, the capacitors smooth what happens within it.

There is a risk in the move. On Rev B, VBUS feeds the LEDs directly and also the regulator's input, so a short on VBUS is limited only by the supply. For first power-on I use a bench supply at 5 V with the current limit at 100 mA.

Because the revisions have different budgets, a wrong firmware image is a real hazard: Rev B firmware on a Rev A board would ask a 200 mA regulator for far more than it can give. So firmware images are per revision, and the build refuses to run without one chosen. It is a small thing, and it moves a power mistake from the bench to the build.

## Diagnostics

A limiter that works silently is hard to trust. The firmware exposes three things to the app's diagnostics:

- **Budget**: the compile-time limit in mA. If a board reports 135 and I expected Rev B, I flashed the wrong image.
- **Scale**: the scale of the last committed frame. 255 means the frame fit. Lower means the limiter dimmed it.
- **Reset flags**: the cause of the last reset. A POR that is not warm means the supply collapsed.

The bring-up test is plain. Light everything at full white and read the budget and scale. A scale below 255 is expected here, since this is the frame the limiter exists for. Then watch the reset flags while the strip animates and the buzzer fires. No cold POR means the supply held.

## A checklist

1. Write down the supply for each revision: regulator or port, its limit, and who else is on it.
2. Compute the LEDs' idle floor and treat it as unscalable.
3. Subtract everything else on that supply, with margin, and keep the result in one constant per revision.
4. Estimate each frame's current before sending it, and scale the lit part to budget minus floor.
5. Decide which group the viewer needs most, exempt it, and let the others yield.
6. Reserve the peak of any animated group, not its value in this frame.
7. Handle the case where the protected group alone exceeds the budget.
8. Put decoupling at each LED and a bulk capacitor on the supply; do not expect firmware to replace them.
9. Build firmware per revision and make the build fail without one.
10. Expose the budget, the scale and the reset flags, and read them during bring-up.
11. Measure the idle current and rails of a good board and write them down. I still owe myself that.

The brown-out came from a frame the firmware was allowed to send. Once every frame passes through one gate that knows the supply, what the host asks for stops being a risk to the chip.
