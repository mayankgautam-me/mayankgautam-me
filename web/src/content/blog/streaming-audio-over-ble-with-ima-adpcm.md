---
title: "Streaming 16 kHz audio over BLE with IMA ADPCM"
description: "The bandwidth math, block framing and measurements behind sending speech from a small BLE board at 64 kbps, with every block decodable on its own."
date: 2026-11-15T11:00:00+05:30
tags: [BLE, firmware, audio, embedded]
draft: false
---

I work on a small BLE audio board with a PDM microphone. It captures speech and sends it to a phone or computer, which cleans it up and hands it to a speech recogniser. The recogniser wants 16 kHz, mono, signed 16-bit samples, and the radio link did not carry that reliably. This post covers how I got the stream down to a quarter of the size with IMA ADPCM, why I framed it the way I did, and what I measured. I label each number as computed or measured, because they are different kinds of claim.

## The problem

Speech models expect 16 kHz audio and discard anything above it, so capturing more only wastes bandwidth. Mono is enough because nothing here separates speakers by microphone geometry. That leaves 16 000 samples a second at 16 bits each.

Raw PCM16 did not stream reliably over the BLE link I had. I wanted a codec cheap enough for the board's CPU, simple enough that four independent implementations (firmware, a Python tool, a phone app and a Rust decoder) could agree bit for bit, and tolerant of a radio that drops packets.

## The bandwidth math

All of this is computed.

```
PCM16:  16 000 samples/s x 16 bits = 256 000 bit/s = 256 kbps
ADPCM:  16 000 samples/s x  4 bits =  64 000 bit/s =  64 kbps
```

IMA ADPCM spends 4 bits a sample instead of 16, an exact 4:1. It is not a perceptual codec: no psychoacoustic model, no lookahead, just a few table lookups and adds per sample. The cost is a higher noise floor than 16-bit PCM. For speech going into a recogniser I found that acceptable.

The 64 kbps counts only the codes. Each block has a 4-byte header, and my wire frame adds a start byte, a type, a 2-byte length, a 4-byte frame index and a CRC-8:

```
block:       4 header + 160 code bytes  = 164 B per 20 ms (320 samples)
wire frame:  1 + 1 + 2 + 4 + 164 + 1   = 173 B per 20 ms
rate:        173 B x 50/s = 8 650 B/s  = ~69 kbps
```

About 69 kbps on the wire against 256 kbps for raw samples.

## How IMA ADPCM works, briefly

ADPCM sends differences. The encoder keeps a predictor, subtracts it from the next real sample, and quantises the difference to 4 bits: one sign bit and three magnitude bits, measured against a step size. The step size adapts. Large codes grow it so the codec can follow a loud, fast signal; small codes shrink it so it can resolve quiet detail.

The adaptation is a state machine over a table of 89 step sizes (7 up to 32767) and an index into it. After each code the index moves by an amount that depends on the magnitude bits:

```
shift[8] = { -1, -1, -1, -1, 2, 4, 6, 8 }
index    = clamp(index + shift[code & 7], 0, 88)
```

Reconstruction, which the decoder does and the encoder repeats on its own output:

```
step = STEPS[index]
diff = step >> 3
if (code & 1) diff += step >> 2
if (code & 2) diff += step >> 1
if (code & 4) diff += step
predictor = clamp(predictor +/- diff, -32768, 32767)   // minus if code & 8
```

Because the encoder runs the same update, both ends hold the same predictor and index at every sample. The step size is never transmitted; each side derives it from codes it has already seen. That is the elegance of the scheme and also its weakness. If the decoder's state drifts from the encoder's, every sample after that point is wrong, and not in a way that announces itself.

## Block framing and loss

Sent as one endless run of nibbles, a single lost packet would leave the decoder's predictor and index wrong until the stream ended. So I made every block stand alone, using the layout WAV files use for IMA:

```
bytes 0-1   int16 LE  predictor: the block's first sample, exactly
byte  2     uint8     step index to start from
byte  3     uint8     0
bytes 4..   4-bit codes, low nibble first
```

The first sample is stored in full, and the step index is stored with it, so the decoder needs nothing from the previous block. A block of n bytes holds

```
samples = 1 + (n - 4) x 2
```

one sample in the header plus two codes per remaining byte. My encoder writes sample 0 as the predictor and codes samples 1 to 319, which is 319 nibbles. That fills 159 bytes and half of a 160th, so the last byte carries a padding nibble. This is why a 164-byte block formally counts as 321 samples while the frame is 320. The decoder is told how many samples it wants and ignores the padding. Off-by-one agreements like this are the sort of thing that stays quiet until two implementations disagree.

A block is also the unit of loss. If one never arrives, the next decodes correctly from its own header, and the damage is those 20 ms and nothing after.

Each block travels with a frame index that counts 20 ms frames from the start of the stream. The receiver numbers audio by that index, not by arrival order, so a lost block shows up as a gap in the numbering rather than audio that closes up around the hole. A transcript that silently lost a sentence is worse than one with a visible break. The CRC-8 (polynomial 0x07) covers type, length and payload, so a stream that starts halfway through a frame loses that frame and resumes at the next start byte.

Standing alone costs the header: 4 B x 50/s = 200 B/s, or 1.6 kbps (computed), on top of the 64 kbps of codes. A longer block would cost less per second and lose more per drop. I chose 20 ms because it divides evenly into the chunk sizes streaming recognisers use and is short enough that one lost block is inaudible.

## MTU and notification rate

A BLE notification carries the negotiated ATT MTU minus 3 bytes of overhead. The default MTU of 23 leaves 20 bytes. In this design the host tells the board how many bytes one notification carries, and a Mac negotiated about 180.

My 173-byte frame fits in one 180-byte notification. That was deliberate: I picked the block size to fit the notification, not the reverse. The rates, computed:

```
~180 B notifications:  1 frame per 20 ms          = ~50 notifications/s
20 B notifications:    173 B / 20 B = 9 per frame
                       8 650 B/s / 20 B           = ~430 notifications/s
```

The bytes per second are identical; the packet count differs by almost nine times. Every notification costs controller work, an interrupt and a copy in the host stack, so fifty a second is easy and four hundred and thirty a second is the sort of load that makes throughput depend on the phone. If the other end will not negotiate a larger MTU, I would shrink the block before I would blame the codec.

I also found a ceiling on the write side by hitting it. A write of 209 bytes was accepted and one of 219 dropped the link, so file and firmware pieces sent to the board over BLE go in 180-byte parts. That is a property of this stack, not of BLE. It is still a good reason to probe the edges instead of trusting the number a host reports.

## Measuring it

**BLE stream, measured.** With a 180-byte notification size the stream ran at 1.00x real time on a desk: a second of audio arrived in a second. I have not measured this at a distance or through a wall, and I do not claim it holds there.

**Bench UART, measured.** The board also has a UART behind a bridge chip, used for flashing and the log. Audio sessions do not run over it, but I used it to exercise the encoder, and it showed how easily a link can look fine while falling behind. The board reads audio in 24 ms chunks:

| Baud rate | Time to send a 24 ms chunk | Result |
|---|---|---|
| 115200 | 34 ms | sessions at 0.6x real time |
| 230400 | not recorded | not dependable |
| 460800 | not recorded | not dependable |
| 921600 | 8.5 ms | 1.0x real time |

At 115200 the link is slower than the audio it carries, so the sender loses ground on every chunk. At 921600 it has plenty of slack. The two rates in between were unreliable and I did not investigate why.

**Lost commands, measured.** At 921600, a command sent to a board that was already streaming was sometimes lost: 2 of 5 PINGs were answered. So the host repeats PING, RESUME and STOP until the board visibly acts. That only works if every command is safe to repeat. A request for a reply is; a command that toggled state would not be.

## What I would do differently

I would measure the link's ceiling before choosing the format. I settled on 64 kbps because 256 kbps was not reliable, but I did not record how much headroom the link had at each notification size. A table of sustained throughput against MTU and connection interval, taken on the real host, would show whether 64 kbps was the right target or just the first one that worked.

I would test at distance sooner. The 1.00x figure is from a desk. The design tolerates loss by construction, but I have no number for how much loss, and how bursty, a recogniser can absorb before the transcript gets worse. That is the measurement that would show whether the codec choice is right.

I would write the shared test vectors before the second implementation. A disagreement between encoder and decoder does not fail loudly; it decodes into audio that is only slightly worse, which a recogniser copes with and nobody notices. What keeps the four implementations honest is one vectors file they are all tested against, plus a test that compiles the firmware's header on the host and compares it with the reference encoder. I would add those first next time.

Four bits a sample gives a 4:1 cut for almost no CPU, a self-contained block makes loss cheap, and the negotiated MTU decides whether the rest is easy or fragile.
