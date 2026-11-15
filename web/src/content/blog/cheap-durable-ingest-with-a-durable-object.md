---
title: "Cheap durable ingest of small frames with a Durable Object"
description: "How batching 20 ms audio frames into one SQLite row per second, then one R2 object per ten seconds, kept an ack meaning durable at about a penny an hour."
date: 2026-11-15T03:00:00+05:30
tags: [Cloudflare, Durable Objects, streaming, cost]
draft: false
---

I work on a voice transcription service where devices send audio as 20 ms frames over a WebSocket, and a Cloudflare Durable Object receives them. One rule shaped the design: when the server tells the device "stored", the audio must survive a crash. This post is about getting that rule at about a penny per hour of audio instead of about 38 cents, and about the parts that make it safe. The code below is my own sketch of the technique, not the real source.

## The naive design and its bill

A frame here is 320 samples of 16 kHz mono, signed 16-bit: 640 bytes, 20 ms. That is 50 frames a second, 180,000 an hour.

The first version I built, a spike, did the obvious thing. Every frame arrived, was written to storage, and was acknowledged. Later it was moved out to object storage and the row was deleted. Durable, simple, easy to reason about. It also cost about $0.38 per hour of one audio stream, and I measured that rather than guessing. Multiply by a few devices running all day and the storage line becomes the largest on the bill, for a product whose whole job is to carry 32 KB a second.

The cost is not bytes. SQLite storage in a Durable Object is billed mostly by rows written, and R2 by operations. 640 bytes per row is a tiny row, so you pay the per-row price for almost no payload. The fix is to stop treating a frame as the unit of storage.

## What the output gate guarantees

Batching normally costs you the guarantee. If you hold frames in memory and ack each one, a crash loses acked data. If you ack only after a write, you need to write often.

Durable Objects give you a third option. Storage writes in a Durable Object are applied to the in-memory cache immediately and flushed to disk asynchronously, but the runtime holds back outgoing messages (the output gate) until the write they depend on is confirmed. So this code:

```ts
this.sql.exec("INSERT INTO audio (seq, count, pcm) VALUES (?, ?, ?)", first, n, pcm);
socket.send(JSON.stringify({ type: "stored", through: last }));
```

does not need an `await` between the insert and the send. The `send` call returns at once, but the message does not leave the machine until the insert is durable. If the write fails, the object is reset and the message is never sent. The device therefore never hears "stored" for something that was not stored.

What I rely on, and nothing more: a message sent after a write in the same event is not delivered before that write is confirmed. I do not rely on the gate for ordering between different messages or for anything about R2, whose writes are a separate call and do not carry this guarantee.

## Batching into SQLite rows

With the gate doing the waiting, the rule for batching is simple. Keep incoming frames in memory. Write one row when 50 frames have gathered (one second of audio), or one second after the first unwritten frame, whichever comes first. Then ack.

```ts
const FRAME_BYTES = 640;
const FRAMES_PER_ROW = 50;
const ROW_WAIT_MS = 1000;

class Ingest {
  held: { first: number; frames: Uint8Array[] } | null = null;
  timer: ReturnType<typeof setTimeout> | undefined;

  take(first: number, frames: Uint8Array[]) {
    const expected = this.nextSeq();
    if (first + frames.length <= expected) return;        // already have it
    const skip = Math.max(0, expected - first);           // overlap on resend
    this.held ??= { first: first + skip, frames: [] };
    this.held.frames.push(...frames.slice(skip));
    if (this.held.frames.length >= FRAMES_PER_ROW) this.writeRow();
    else this.timer ??= setTimeout(() => this.writeRow(), ROW_WAIT_MS);
  }

  writeRow() {
    clearTimeout(this.timer); this.timer = undefined;
    const h = this.held; if (!h?.frames.length) return;
    this.held = null;
    const pcm = new Uint8Array(h.frames.length * FRAME_BYTES);
    h.frames.forEach((f, i) => pcm.set(f, i * FRAME_BYTES));
    this.sql.exec("INSERT INTO audio (seq, count, pcm) VALUES (?, ?, ?)",
                  h.first, h.frames.length, pcm);
    // the output gate holds this until the row is durable
    this.source.send(JSON.stringify({ type: "stored", through: h.first + h.frames.length - 1 }));
  }
}
```

Two details matter. The row is keyed by the sequence number of its first frame, and carries a count, so a row says exactly which span it holds. And the ack names the last sequence number covered, so the device knows which frames it may stop keeping.

In the real object the same write also appends a small receipt event for the span, and any other consumer that is fed live (here, the transcription service) gets the frames at once, before the write, not after. That is safe only because of the next two sections: a frame heard live and then lost in a crash is re-sent by the device and de-duplicated by sequence number downstream.

The cost of this choice is up to one second of acknowledgement latency. A device has to keep about a second of frames, plus whatever grace period it wants for reconnecting, until the ack comes. For audio that is small. It would not suit a design where the sender cannot buffer.

## Flushing to R2

A row per second is far cheaper than a row per frame, but rows in the object's SQLite are not where hours of audio should live. Every ten seconds (500 frames, ten rows) the object copies them to R2 as one object, then removes them:

```ts
async flush() {
  const rows = this.sql.exec(
    "SELECT seq, count, pcm FROM audio ORDER BY seq").toArray().slice(0, 10);
  if (rows.length < 10) return;
  const first = rows[0].seq, last = rows.at(-1)!;
  const to = last.seq + last.count - 1;
  const key = `audio/${String(first).padStart(10, "0")}`;

  await this.env.BUCKET.put(key, concat(rows.map(r => r.pcm)));
  this.sql.exec("INSERT OR REPLACE INTO chunks (from_seq, to_seq, key) VALUES (?, ?, ?)",
                first, to, key);
  this.sql.exec("DELETE FROM audio WHERE seq BETWEEN ? AND ?", first, last.seq);
}
```

The order is the point. The rows are deleted only after the R2 `put` has finished and the index row naming the object has been written. A crash between the `put` and the delete leaves the rows and an object, and the index insert is `INSERT OR REPLACE`, so running the flush again writes the same key and the same index row. There is no instant at which a frame is in neither place.

Because the `put` is awaited, other messages are processed while it runs, so new rows can arrive. The delete is by sequence range for exactly that reason: it removes the rows that were read, and rows written meanwhile wait for the next object. A flag stops two flushes from overlapping. When the session stops, the partial last object is flushed too.

## Sequence numbers and replay

None of this works unless every frame has a number that the device assigns and never changes. The wire format is small: each binary message starts with a 4-byte little-endian sequence number of its first frame, followed by whole frames. A body that is not a multiple of the frame size is a protocol error. Four bytes per message buys three things:

- The receiver can tell a retransmission from new audio, because it knows what it has seen.
- It can detect that something is missing: a message that starts beyond the next expected number leaves a gap, and the gap is recorded as an event rather than hidden.
- The device can resume where it left off.

The device's side of this is deliberately dull. It numbers frames from zero for a session, never renumbers after a reconnect, and on reconnect opens the socket asking from the first sequence number it still needs. Sending too much is safe, because anything already held is dropped. Sending too little is not. Skipping already-held frames is the `skip` line in the sketch above.

Replay inside the object is a read in three places, oldest first: index rows pointing to R2 objects, then rows still in SQLite, then the frames in memory that have not been written. A consumer that falls behind, or arrives late, asks for a starting sequence number and gets stored audio from there and then goes live.

What a crash loses, and what covers it:

| Lost | Covered by |
| --- | --- |
| Frames received since the last ack (under a second) | The device resends from the first number it has not seen acked. |
| Frames forwarded live but not yet written | The same resend; the consumer drops sequence numbers it has already heard. |
| A receipt for a row being gathered | Nothing needed: it is written in the same step as the row, before the ack. |

The invariant is that anything acked is in a row or in R2, and anything not acked is still held by the device.

## Rejoin after a crash

A frame that a consumer has seen is not necessarily a frame that was stored, so the consumers need their own way back in. The ones I run are workers: processes that read audio and write results back to the object. A worker that drops mid-session reconnects with two numbers: `from`, the next frame it needs, and `after`, the last event number it handled. The object replays stored audio from `from` and events after `after`, then switches to live.

A worker that restarted from nothing has no such memory, so it cannot say where it was. For a transcription worker the answer is in its own output. It first asks for the event log without audio, finds its last finished transcript line, and sets `from` to the frame after that line ends. The span it missed while gone is recorded as a degraded interval with a reason, so a reader sees a break and not a seamless transcript that quietly lost words. Resuming from the last sealed line means no line is written twice.

Both ends need a deadline, or a worker that never comes back holds its place forever. A worker absent for 60 seconds is marked lost, and the scheduler may give its place to another instance, which joins as a fresh one. The old one may still return while the session is open. A close without an explicit "done" message counts as a drop, not a finish. I had the opposite earlier, where closing the socket meant finished, and a deploy that restarted a worker would then have been indistinguishable from a worker that completed.

## The cost arithmetic

The $0.01 and $0.38 figures are my measurements and design numbers. The unit prices below are Cloudflare's public list prices as I remember them, not figures from my own source, so check them against the current pricing page before you reuse the sums. I also ignore the free allowances, which only make small deployments cheaper.

Assumed prices: Durable Object SQLite rows written, $1.00 per million; R2 Class A operations (writes, `put`), $4.50 per million.

Naive, per hour of one stream:

1. Frames: 50 per second × 3,600 seconds = 180,000.
2. Each frame is inserted once and deleted once after it moves to R2: 2 rows written per frame, 360,000 rows.
3. 360,000 × $1.00 / 1,000,000 = $0.36.
4. Events and bookkeeping on top, and the spike's own R2 operations, bring it to the roughly $0.38 I measured. I did not break that last $0.02 down, so treat it as measured, not derived.

Batched, per hour:

1. Rows: one per second, so 3,600 inserts.
2. Each is deleted after the flush: 3,600 deletes.
3. One receipt event per row: 3,600 more.
4. Total 10,800 rows written, 10,800 × $1.00 / 1,000,000 = $0.0108. That is the "about $0.01".
5. R2: one object per ten seconds, 360 `put`s an hour, 360 × $4.50 / 1,000,000 = $0.0016. It rounds into the same penny.

The ratio is about 35 to 1. Nearly all of it comes from one change: the unit of a write went from 20 ms to one second, which is 50 times fewer inserts. The rest is bookkeeping that grew back (deletes, receipts). The cut is smaller than 50 because each batched row also has a delete and a receipt, which the naive version did not count the same way.

## What this does not cover

- **Power loss on the device.** The guarantee starts at the ack. Frames the device had not yet sent are the device's problem.
- **Latency below a second for the ack.** If your sender cannot buffer a second, this is the wrong trade. Live consumers still get frames immediately; only the "stored" message waits.
- **Reading the whole stream live from storage.** Replay works, but a consumer that is always behind is better served by the live path.
- **Eviction surprises.** An object with an open socket and flowing data is not evicted for idleness, so in practice you meet this only on a crash, a deploy, or a local stop. I have not tested what hibernation does to a half-filled in-memory batch beyond relying on the resend.
- **Multi-writer sessions.** My rows hold one source's frames; a second source starts a row of its own. If you have several writers into one object, decide that up front.
- **Per-row limits.** A row of 50 frames is 32 KB, far from SQLite value limits. A much larger batch would need checking.
- **Anything about pricing changing.** The arithmetic is a template; replace the unit prices.

## A checklist

1. Number every frame at the source, from zero, contiguous, never renumbered after reconnect.
2. Put the number of the first frame in the header of every message.
3. Hold frames in memory; write one row per N frames or T milliseconds, whichever first.
4. Ack with the last sequence number covered, and send the ack in the same event as the write, with no await between them.
5. Drop frames you already hold; record a gap event for a jump forward.
6. Flush rows to R2 in bigger objects; delete rows only after the `put` and the index row. Make the flush idempotent.
7. Delete by sequence range, not "everything", because writes arrive during the `put`.
8. Keep what the device must resend small and defined: everything not yet acked.
9. Give consumers `from` and `after`. Give stateless ones a way to find their own place in their own output.
10. Set a rejoin deadline, and treat a close without an explicit done as a drop.
11. Write the cost sum with unit prices, and re-run it when the prices or the batch sizes change.
