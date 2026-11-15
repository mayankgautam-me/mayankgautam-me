---
title: "Presence detection for silent devices, and the day it used up a database's read quota"
description: "How I made a cloud backend notice a dead Wi-Fi device in about 35 seconds with a Durable Object, and how one rollout-order mistake turned an unread-count query into 5 million D1 reads."
date: 2026-11-15T05:00:00+05:30
tags: [IoT, Cloudflare, Durable Objects, firmware, backend]
draft: false
---

A Wi-Fi connected home device keeps a WebSocket open to a cloud backend. The phone app asks the backend whether the device is present, and shows it as online or offline. That sounds like a flag. It is harder than it looks, because the common way for such a device to disappear is to send nothing at all.

This post is about how I made the backend notice that quickly, and about the mistake in the rollout that cost me an entire day's database read allowance from a single query. The technique is general. The numbers are from my own project.

## The problem: silence has no event

If the device closes its socket, the server gets a close event and can mark it offline at once. That case was never a problem. The cases that matter are the ones with no close frame: the router loses power, Wi-Fi drops, the device is unplugged, the firmware hangs. The TCP connection just stops carrying data. The server sees nothing, and nothing will arrive to tell it.

So the server can only go on the absence of something. It has to decide that a heartbeat is overdue, and for that something has to wake up and look, because an idle connection produces no code to run. Two numbers decide how long that takes: how often the device speaks, and how long the server waits before believing the silence.

I had a third number too, and it is the one people forget: how often the server checks.

## Heartbeat and timeout arithmetic

My first version was typical. The device sent a heartbeat every 60 s. The server considered it gone after 75 s without one, and checked every 15 s.

Take the worst case. The last heartbeat arrives at t = 0 and the device dies right after. The timeout expires at t = 75 s. The check that notices runs at the next 15 s tick after that, so up to t = 90 s. That is where "about 90 seconds" comes from:

```
detection time  =  timeout  +  up to one check interval
old:  75 s + 15 s = 90 s worst case   (60 s heartbeat)
```

Ninety seconds is a long time for an app to show a device as present, and the app has no reason to start looking for it over Bluetooth until it believes the cloud path is dead.

The new settings were a 15 s heartbeat, a timeout of two heartbeats (30 s), and a check every 10 s:

```
new:  30 s + 10 s = 40 s worst case, about 35 s typical
```

Why two heartbeats and not one? A timeout equal to the interval means any late frame reads as a disconnection. Two was the practical floor: enough to forgive a stalled frame, little enough to keep detection near half a minute.

The check interval matters as much as the timeout. At 15 s it adds up to 15 s to the worst case, so cutting the timeout from 75 s to 30 s alone would give 45 s, not 40. Going to 10 s took off the last few seconds. It is not free: the check is an alarm, and alarms are billed per firing. That is what the 10 s buys.

## Durable Objects, hibernation and alarms

The server side is one Durable Object per device. It holds the device's WebSocket, the app sockets watching it, the last heartbeat time and the last status. Three Cloudflare features make this cheap.

**WebSocket Hibernation API.** Instead of calling `addEventListener` on the socket, you hand it to the runtime with `ctx.acceptWebSocket(server, ["device"])` and implement `webSocketMessage`, `webSocketClose` and `webSocketError` as class methods. The runtime can evict the object from memory while the socket stays open and wake it when a message arrives. The consequence is that in-memory fields vanish between messages, so anything that matters has to be re-read from storage. I keep the last heartbeat time and the last status in Durable Object storage and restore them at the top of each handler.

**Tags and `getWebSockets`.** The device socket is tagged `"device"` and each app socket `"app"`. After a wake-up, `ctx.getWebSockets("device")` returns the live sockets with that tag, so the object does not have to keep its own list.

**The alarm loop.** An object that is hibernating runs no code, so it cannot notice silence by itself. The alarm is what wakes it. Each time it fires, the handler checks whether a device socket exists and whether the last heartbeat is older than the timeout, and then schedules the next alarm. A sketch of the shape, written from scratch rather than copied:

```ts
const HEARTBEAT_TIMEOUT_MS = 30_000; // two 15 s heartbeats
const ALARM_INTERVAL_MS = 10_000;    // how often silence is checked

export class DeviceState extends DurableObject {
  async webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer) {
    // Plain storage write: cheap, and survives hibernation.
    await this.ctx.storage.put("lastHeartbeat", Date.now());
    // Make sure the check loop is running while a device is connected.
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
    }
    // ...handle the frame...
  }

  async alarm() {
    const sockets = this.ctx.getWebSockets("device");
    if (sockets.length === 0) return;          // nothing to watch, loop ends

    const last = (await this.ctx.storage.get<number>("lastHeartbeat")) ?? 0;
    if (last > 0 && Date.now() - last > HEARTBEAT_TIMEOUT_MS) {
      await this.ctx.storage.put("lastHeartbeat", 0);
      for (const ws of sockets) ws.close(1000, "heartbeat timeout");
      this.announceOffline();                  // apps + owner push
      return;                                  // loop ends until reconnect
    }
    await this.ctx.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
  }
}
```

Two details I would keep in any version of this. The alarm closes the sockets it gives up on, so a device that was only slow reconnects cleanly instead of holding a half-dead connection. And the offline notice is deduplicated: a stored flag records that the owner has already been told, and it is cleared when the device comes back, so one outage produces one push rather than one per check.

A heartbeat is a small frame that costs one storage write and no D1 row. Telemetry is batched, one D1 insert per five status frames, so database writes do not follow the heartbeat rate. That is why going from one heartbeat a minute to four was affordable.

## The rollout-order mistake and the flapping

Both halves had to change together: the firmware sends every 15 s, the backend times out at 30 s. I made the change in the backend first, and that was the mistake.

A device still running the old firmware beats once every 60 s. Against a 30 s timeout it is, by arithmetic, absent for half of every interval. The alarm saw 30 s of silence, declared the device gone, closed the socket and told the apps. The device then sent its next heartbeat at the 60 s mark, reconnected, and the server declared it back online. Then the cycle began again.

Each cycle sends the owner two push notifications, one "offline" and one "online". Across the fleet that came to about 800 of each, every day. Nothing was broken in the devices. They were doing exactly what the old firmware told them to do. The server had changed the rule they were judged by.

The general lesson is plain: a timeout is a contract between two programs, and the shorter side can only be tightened after the slower side has changed. Ship the device side first, wait until the fleet has it, then tighten the server. If you cannot wait, the server needs a per-device value, for example the interval the device announces when it connects.

## Why one push cost thousands of reads

This part is the reason for the post's title. Every push notification had a side effect I had stopped thinking about: it sets the app icon badge, so the server computes the owner's unread count.

The query was a plain count:

```sql
SELECT COUNT(*) AS count
FROM notifications
WHERE user_id = ? AND read = 0;
```

It looks innocent, and on a user with three unread items it is. But D1 bills by rows read, and a filtered `COUNT(*)` reads every row that matches. The flapping had piled up notifications, and the affected accounts had thousands unread. Each count read about 6,900 rows.

The arithmetic is simple. The pushes were about 800 offline and 800 online a day, and each one ran a count that read about 6,900 rows. What I saw was about 5 million rows read in a day, the free tier's entire daily read allowance, from that one query. I am reporting the measured figure, not a product I can reproduce exactly.

Two things made it worse. The notification volume was itself caused by the flapping, so the cost of the query scaled with the bug. And the unread count had no upper bound, so a query that is cheap with three unread items costs thousands of reads with thousands.

## The cap and other fixes

I made two changes.

First, the timeout went back to 75 s until the whole fleet runs the 15 s firmware. The flapping stopped immediately. The code comment now says to drop it to 30 s only once no device still runs the one-minute firmware, which is the rule that should have been written the first time.

Second, I capped the count. The app shows "99+" for anything over 99 anyway, so counting past 100 buys nothing:

```sql
SELECT COUNT(*) AS count
FROM (
  SELECT 1 FROM notifications
  WHERE user_id = ? AND read = 0
  LIMIT 100
);
```

The subquery stops reading after 100 matching rows, so the cost of the badge is at most about 100 rows however large the backlog grows. I added a test that inserts 150 unread rows and expects 100 back.

What I kept from the first change: the 15 s heartbeat on the device and the 10 s alarm on the server, which is where the roughly 35 s detection comes from once the fleet has caught up. 


## A checklist for presence systems

- Write the detection time as a formula before choosing numbers: timeout plus one check interval, worst case. Include the check interval.
- Set the timeout to at least two heartbeat intervals, so one late frame is forgiven.
- Treat the timeout as a contract. Change the device side first, confirm the fleet has it, then change the server. Keep the old value in a comment with the condition for lowering it.
- Remember that hibernating objects run no code. You need an alarm to notice silence, and every firing is billed, so price the check interval.
- Persist the last-seen time in storage. In-memory state does not survive hibernation.
- Close the socket when you declare a device gone, and deduplicate the offline notice so one outage is one message.
- Look at every side effect of a state change, not only the obvious one. A "status changed" event that sends a push may also run a query. Find out what it costs.
- Cap any count that feeds a badge. `COUNT(*)` costs rows read, not rows returned.
- Watch your database's read metric after a rollout, not just the error rate. Here the sign was a quota, not a crash.
- Assume rows accumulate. A query that is cheap today gets dearer as the table grows, and a bug elsewhere can make it dear overnight.
