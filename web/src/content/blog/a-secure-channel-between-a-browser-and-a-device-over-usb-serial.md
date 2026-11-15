---
title: "A secure channel between a browser and a device over USB serial"
description: "How I built an encrypted, authenticated link between a web dashboard and a Cortex-M device over a USB CDC port with ECDH, HKDF and AES-GCM, and the bug classes I fixed along the way."
date: 2026-11-15T08:00:00+05:30
tags: [embedded, security, WebCrypto, nRF91, protocols]
draft: false
---

I work on a device with an nRF91 modem SoC and a web dashboard that talks to it over USB. The dashboard uses Web Serial, the device shows up as a CDC serial port, and the two exchange commands: read status, store a token, change settings, push a firmware image. The device holds secrets and accepts commands that change what it does, so I did not want that link to be plain bytes on a cable.

This post covers the channel I built: framing, the handshake, key derivation, per-message encryption, replay protection, and how a dashboard can reconnect without locking the device. It also lists the bugs I fixed, because they fall into classes you will likely meet too.

## Why not just trust the cable

A USB cable feels private. Three facts make that a weak argument:

- Every program on the host can see the port. Any process that can open a serial device can write to it.
- The device cannot tell who is on the other end. It cannot distinguish my dashboard reconnecting from someone plugging it into another computer.
- The dashboard cannot tell which device it has. A look-alike board answers just as well.

So the device must prove its identity, and every command must be confidential, authentic and fresh. I did not want a full TLS stack on a small device and in a browser. I wanted something I could describe in two pages, built from the same pieces as TLS 1.3: ephemeral Diffie-Hellman, a signature from a long-term key, HKDF, and an AEAD cipher. WebCrypto has all of them, and so does the PSA crypto API on the device.

The device is the server and holds an identity key pair created on first boot; the private half never leaves the secure side. The browser is the client and starts the conversation.

## Framing

A serial port is a byte stream with no message boundaries, so the first job is to cut it into frames.

```
SOF (1) | Type (1) | Length (2, LE) | Payload (0..4096) | CRC-16 (2, LE)
```

The start byte is `0xAA`. There are three types: handshake (plaintext), data (encrypted) and alert (plaintext, for fatal errors). The CRC is CRC-16/CCITT over type, length and payload. Payloads are CBOR maps with text keys, which both sides can decode and which stay readable in a log.

The CRC catches noise and truncation; it is not a security measure, the encryption is. A frame with a bad CRC is dropped silently. Two parser rules mattered more than the layout:

1. Bytes outside a frame are discarded until the next `0xAA`, and after a false start byte the bytes behind it are rescanned. A `0xAA` can appear inside a payload, so a false start can swallow the real frame that follows it.
2. The parser resets after 5 seconds. On the device that is a 5 second gap between two bytes; in the browser it is 5 seconds from the start byte to the last byte. Without it, a frame cut short by an unplug leaves the parser waiting for bytes that never come.

## The handshake

Six messages. The first four are plaintext frames, the last two are already encrypted.

```
Browser                                       Device
   |-- ClientHello (client_random) ----------->|
   |<-- ServerHello (server_random,            |
   |        ephemeral pubkey, identity pubkey) |
   |<-- ServerVerify (signature) --------------|
   |   verify signature with identity pubkey   |
   |-- ClientKeyExchange (ephemeral pubkey) -->|
   |   both sides derive keys                  |
   |-- ClientFinished  (encrypted, ctr 0) ---->|
   |<-- ServerFinished (encrypted, ctr 0) -----|
   |========== session established ===========|
```

The hello messages carry 32 random bytes each. The ClientHello also lists the curves and ciphers the browser supports, one of each today (P-256 and AES-128-GCM); the fields exist so a later version can add a choice. The ServerHello adds a fresh ephemeral P-256 key, which the device destroys right after the key exchange, and the identity public key.

The ServerVerify is the proof of identity:

```
transcript = SHA-256(client_random || server_random || server ephemeral pubkey)
signature  = ECDSA-P256-SHA256(identity_key, transcript)
```

The signature covers both randoms, so it cannot be recorded and replayed into a later connection, and it covers the ephemeral key, so a man in the middle cannot swap in their own key.

That only proves the device holds the private half of the key it presented. To know it is the right device, the dashboard has to compare that key with one it already trusts, for example one fetched from a backend at registration. I do the comparison right after the handshake, inside the encrypted session, by asking the device for its info and checking the identity fields against the ServerHello. A mismatch ends the session.

## Key derivation

Both sides compute a 32-byte shared secret with ECDH and run it through HKDF-SHA-256:

```
okm = HKDF-SHA-256(
        salt = client_random || server_random,
        ikm  = shared,
        info = "<app> session keys v1",
        L    = 52)

session_key = okm[0..15]     // AES-128 key
client_iv   = okm[16..27]    // base IV, browser to device
server_iv   = okm[28..39]    // base IV, device to browser
                             // okm[40..51] unused
```

The salt is both randoms, so keys differ per handshake. The `info` string is a fixed ASCII label with a version in it, and each purpose gets its own label; the resume secret below comes from the same shared secret with a different one. 52 bytes is 16 + 12 + 12 with 12 spare, kept so a later version can add a value without changing the length both sides expect. There is one key but two base IVs, which matters next.

## Per-message encryption and nonces

Each DATA frame looks like this:

```
counter (4, big-endian) | ciphertext (N) | GCM tag (16)
nonce = base_iv, with the counter XORed into bytes 8..11
```

It is AES-128-GCM with a 12-byte nonce and no additional data. Each direction has its own counter, starting at 0 and increasing by one per message; the Finished messages are counter 0.

Reusing a nonce under one GCM key is catastrophic: it leaks the XOR of two plaintexts and allows forgeries. The two directions cannot collide because their base IVs differ, and each counter only moves forward. The counter travels in the clear, which is fine: it is public input to GCM and the receiver needs it to build the nonce.

```ts
function nonce(baseIv: Uint8Array, counter: number): Uint8Array {
  const n = baseIv.slice();
  const v = new DataView(n.buffer);
  v.setUint32(8, (v.getUint32(8) ^ counter) >>> 0);  // unsigned, big-endian
  return n;
}
const iv = nonce(txIv, txCounter++);
const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
// payload = u32be(counter) || ct   (ct already ends in the 16-byte tag)
```

JavaScript bitwise operators work on signed 32-bit integers, which is why the `>>> 0` is there. If the 32-bit counter ever ran out, the answer is a new handshake, never a wrap.

## Replay protection

Each receiver keeps the next counter it expects:

- If `counter < expected`, reject the frame.
- Otherwise authenticate it, and only once the tag verifies set `expected = counter + 1`.

Gaps are allowed. If a frame is lost the next one has a higher counter and is accepted, which suits a serial line, and costs no security because a counter that has been used is below `expected` afterwards.

The order of those steps is the important part. If `expected` moves as soon as the counter is parsed, before the tag is checked, one forged frame with a huge counter fails authentication but still pushes `expected` far ahead, and every real message after it looks like a replay. A frame that cannot be decrypted would be able to cut the session off. I fixed exactly that: the counter is parsed as unsigned, compared without changing anything, and `expected` moves only after GCM succeeds. Parsing it unsigned also removes the case where a counter with the top bit set reads as negative and compares as old.

## Resuming a session

This came from a usability problem, not a cryptographic one.

The device locks itself when a session ends, because it cannot tell its owner reconnecting from someone who plugged it into another computer. But a browser tab reloads, a USB port re-enumerates, a session sometimes dies on the browser side. The owner reconnects and finds the device locked, which is the rule working against the wrong person.

The fix is a resume proof. When a session is established, both sides also derive a resume secret with a different `info` label, and keep it in RAM only; the browser holds it in memory, never in storage, per device identity key.

```
resume_secret = HKDF-SHA-256(salt = client_random || server_random,
                             ikm = shared, info = "<app> resume v1", L = 32)

resume = HMAC-SHA-256(key  = previous resume_secret,
                      data = "<app> resume proof v1" || client_random || server_random)
```

The randoms in the proof are those of the new handshake, so a recorded proof is useless for any other connection. The browser sends `resume` as an optional field in ClientFinished.

The device holds the lock decision until the new handshake ends. If the proof is valid and arrives within 60 seconds of the old session's last authenticated frame, the old session's end is not counted and the device stays unlocked. If the proof is missing, wrong or late, or the handshake fails, the end counts and the device locks as before. A bad proof is not an error, it only means no resume. The comparison is constant time, and the old secret is wiped when the new handshake ends either way.

Resume never gets past a lock: a locked device refuses the hello, and locking wipes the secret. A freshly loaded page has no secret, and a clean disconnect leaves nothing to resume.

## WebCrypto and PSA signature formats

This cost me an afternoon. The device signs with `psa_sign_hash` and the browser verifies with WebCrypto, and two things must line up:

1. **Format.** WebCrypto's ECDSA signature is raw `r || s`, 64 bytes for P-256, not DER. PSA's output for P-256 is also raw `r || s`, so the bytes go on the wire as they are.
2. **Who hashes.** `psa_sign_hash` signs a digest you give it. WebCrypto's `verify` with `hash: "SHA-256"` hashes the message first. If the device signs the transcript hash directly, the browser verifies against a hash of a hash and every signature fails.

So the device hashes twice: it builds the transcript, hashes it with SHA-256 (what the browser will do inside `verify`), then hands that digest to `psa_sign_hash`.

```c
sha256(transcript_inputs, 129, digest);   // what WebCrypto computes in verify()
psa_sign_hash(key_id, PSA_ALG_ECDSA(PSA_ALG_SHA_256), digest, 32, sig, 64, &len);
```

```ts
await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, identityKey, sig, transcript);
```

The same applies to any challenge-signing command. A disagreement about who hashes gives a signature that never verifies and no error that says why.

## Bugs I fixed, and their class

None were in the cryptography. They were in how the pieces fit together.

- **Errors in encrypted frames never caught.** An exception while handling a DATA frame was lost in an event handler and the session carried on half-broken, with commands waiting forever. Frames are now handled one at a time in a promise chain, and an error tears the session down and rejects pending work. Class: errors that vanish on an asynchronous path.
- **A handshake that never settled.** If the port closed mid-handshake, nothing resolved or rejected the waiting promise and the UI stayed on "connecting". Cleanup now rejects the handshake and every queued command, and each stage has a timeout. Class: waiting with no timeout and no cancel path.
- **Retries that invalidated a good answer.** A slow-booting device may answer two hellos. With a new random per retry, a late ServerVerify no longer matched the transcript. Now one `client_random` serves all retries, handshake frames are handled in arrival order, and after a ServerVerify the browser waits a second for a newer ServerHello. Class: retries that change what the answer is checked against.
- **Frame resync that dropped data.** Described under framing. Class: a stream parser that treats an error as the end of its buffer.
- **The replay counter advanced before authentication.** Described above. Class: state that changes before the check that justifies the change. If you remember one rule, make it this one: parse, check, authenticate, and only then update state.

## Testing with a vector

Two implementations of the same crypto, one in C and one in TypeScript, will differ somewhere unless pinned to the same numbers. The protocol document carries a published test vector whose inputs are byte sequences counting up from a start value, so anyone can reproduce it: `shared` is `00 01 ... 1f`, the previous handshake's randoms are `20 ... 3f` and `40 ... 5f`, the new ones are `60 ... 7f` and `80 ... 9f`. Both implementations must produce the same resume secret and the same resume proof, byte for byte. Firmware and browser tests both check against the values in the document, so a change on either side that breaks it fails a test at once.

The same trick works for the session keys, and catches a salt in the wrong order, an `info` string with a trailing NUL, or a counter written little-endian. I also test the failure paths on purpose: a flipped tag bit, a counter below `expected`, a counter with the top bit set, a hello nobody answers, a port that closes mid-handshake.

## Limits of the scheme

It is small on purpose, so it is worth being clear about what it does not do.

- **It protects the link, not the endpoints.** If the host or the browser is compromised, the attacker sees plaintext after decryption.
- **The identity key is only as good as its pinning.** The dashboard must compare the key against something it trusts for the signature to mean "this is my device".
- **One session at a time.** A new handshake replaces the old one.
- **Single curve, single cipher.** The negotiation fields and the version in each `info` label exist so a later version can change that without mixing keys.
- **State lives in RAM.** Counters and resume secrets are deliberately not stored, so a reboot or page reload starts from nothing.

I would choose this shape again: ephemeral ECDH with a signed transcript, HKDF with labelled outputs, GCM with a counter-derived nonce, and state that moves only after authentication. Most of the time went into the edges, such as how a parser recovers and what a retry does to a transcript. Those are the parts I would write down first and test hardest.
