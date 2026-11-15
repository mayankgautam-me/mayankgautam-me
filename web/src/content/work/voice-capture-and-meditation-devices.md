---
title: "Voice-capture and meditation devices"
summary: "A voice-capture system that turns audio into an attributed transcript on hardware I control, and a two-node vibrating meditation device on an nRF54L15."
group: product
context: Independent
period: 2019 to now
order: 6
art: voice
tags: [Zephyr, nRF54L15, BLE, Cloudflare Workers, Speech recognition, KiCad]
---

Two products in this area show the range of work: a voice-capture system that turns audio into a transcript with named speakers, and a small meditation device built around vibration and light. Both are firmware, boards, cloud and apps, and I built them end to end as an independent Product Engineer.

## A voice-capture system

Audio goes in and an attributed transcript comes out, on machines the owner controls. A person records in the app or imports a file, or records from a small board that sends audio over Bluetooth. The transcript appears as people speak. Speakers are separated and then named from voices that were enrolled. At the end, a language model writes a summary, notes and a tidied transcript.

The board is an Arduino Nicla Voice: an nRF52832 with Bluetooth LE, plus a Syntiant NDP120 that acts as the microphone. It has no Wi-Fi, so the firmware (Zephyr, nRF Connect SDK) streams 20 ms IMA ADPCM frames at 64 kbps, because the link does not carry 16 kHz PCM16 reliably. The app holds the board over Bluetooth and acts as the bridge to the cloud.

- The core is a Cloudflare Worker with Durable Objects, D1 and R2. It stores only ciphertext: audio and events are sealed on the device (HPKE key wrapping, AES-256-GCM, Ed25519 signatures).
- Recognition, diarization, identity and analysis are separate Python providers that dial out to the core and listen on nothing, so they can sit behind NAT on a Mac, a GPU box or a Raspberry Pi.
- Live recognition uses an NVIDIA Nemotron streaming model. Whisper large-v3-turbo and AI4Bharat IndicConformer re-read doubtful lines, and a language identifier checks the language.
- Diarization labels speakers live, and pyannote refines the labels in passes. Identity uses ECAPA or TitaNet embeddings, and the voiceprints never leave the provider's machine.
- The local analysis model is Qwen3 4B through Ollama. Hosted models are used only when chosen.
- Board audio is cleaned on the device that records it with SpeexDSP: a 60 Hz high-pass filter, noise suppression and automatic gain control.

The board's button and light cover pairing, claiming and recording. Pairing uses LE Secure Connections and needs a press on the board. Each board signs a nonce with its own Ed25519 key, so a session can show that the board itself was there. The firmware also deep-sleeps after a few minutes unattended on a battery. The apps (macOS, Linux, iOS, iPadOS and Android) are one Svelte app wrapped with Tauri.

## A meditation device

A pocket-sized bilateral pulse device: two nodes take turns to vibrate and light up, one side and then the other. Each node is a 4-layer, 24.5 by 33 mm board with an Insight SiP nRF54L15 module and a DRV8837 motor driver. It also has five SK6812 LEDs, one button, a BQ25180 charger, a MAX17048 fuel gauge, and a buck-boost and LDO for the rails.

The firmware is Zephyr on nRF Connect SDK with signed MCUboot images and Bluetooth update. At power-up a node scans for a peer. One connects to the other as central, and a phone can connect to either to change settings, start or stop and read the battery.

- Motor strength, pulse frequency, pace, LED colour and brightness, and duration are set over a small GATT service. The settings are stored in flash.
- The motor and LED rail is switched off when idle. A node can go to System OFF, charger shutdown or ship mode, and an idle timeout powers it down.
- A separate charging-case board takes USB-C or a Qi receiver, charges its own battery with a BQ24075 and boosts to 5 V for the nodes. It has no microcontroller.
- Both boards were designed in KiCad to JLCPCB rules, with ERC, DRC and fabrication outputs produced by the build.

## What I did

I did the whole of both products: firmware, board design, the Cloudflare core and the apps. I wrote the wire protocol for the voice board and held its four implementations to the same test vectors. I designed the sealing scheme and the provider model so that models can run on owned hardware. I also set up the builds, releases and secrets handling so each part ships on its own tag.
