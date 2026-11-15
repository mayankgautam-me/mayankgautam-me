---
title: "nRF9151 power saving with PSM, eDRX and RAI, and a GNSS bug that looked like a bad antenna"
description: "How I configured an nRF9151 battery tracker for LTE-M and NB-IoT power saving, what the network actually grants, and why GNSS failed like an antenna mismatch until one AT line fixed it."
date: 2026-11-15T07:00:00+05:30
tags: [nRF9151, LTE-M, NB-IoT, GNSS, Zephyr]
draft: false
---

I have been building a battery-powered tracker around the nRF9151 for a while. It reports telemetry and a position fix on a schedule, and it has to run for a long time on a small cell. Most of the battery life comes from a handful of modem settings, and most of my debugging time went into the places where the radio did something other than what I configured.

This post goes through the settings I use, how to read the encoded values, what the network does with them, and one GNSS bug that cost me days because it looked exactly like a hardware problem. It is based on the firmware of a private project, so I keep the examples generic: no carrier names, no APNs. The stack is Zephyr on nRF Connect SDK, with the application non-secure under TF-M.

## The duty cycle

Every power decision follows from one question: how long is the modem awake per cycle, and how many cycles are there?

Mine works like this. The device sends telemetry every 30 minutes, and every 120 seconds in an emergency mode that stays on until the owner ends it. A cycle is:

1. Attach LTE, read signal and cell information.
2. Upload what is queued: alerts, telemetry, a cell-based position.
3. Try a GNSS fix, with LTE left registered.
4. Upload the fix. If LTE was not up in step 1, everything goes here.

There is no downlink traffic. The device never needs to be reached, so it never needs to listen between cycles. That is the property that makes aggressive settings safe. If your device must receive commands within seconds, most of what follows is not for you, or you will pick different numbers.

The tools are three layers. PSM puts the modem to sleep for hours. eDRX lowers how often it listens while it is awake. RAI shortens the time the radio stays connected after the last packet. Each saves power in a different part of the cycle.

## PSM timers and how to read the encoded values

PSM (Power Saving Mode) has two timers. T3412 is the periodic tracking area update (TAU) interval: how often the modem must tell the network it still exists. T3324 is the active timer: how long the modem stays reachable after a transfer before it goes to sleep.

You request both as bit strings. In nRF Connect SDK they are Kconfig options:

```
CONFIG_LTE_LC_PSM_MODULE=y
CONFIG_LTE_PSM_REQ=y
CONFIG_LTE_PSM_REQ_RPTAU="00100101"
CONFIG_LTE_PSM_REQ_RAT="00000101"
```

`RPTAU` is T3412 and `RAT` is T3324. Both are an 8-bit "GPRS timer": the top three bits pick a unit and the bottom five bits are a count. The unit tables differ between the two timers.

For T3324 the unit bits `000` mean 2 s. So `00000101` is 5 times 2 s, which is 10 s. That matches what I want: the modem stays reachable for 10 s after the upload, then sleeps.

For the extended T3412 the unit bits are:

| bits 8-6 | unit |
|---|---|
| 000 | 10 min |
| 001 | 1 h |
| 010 | 10 h |
| 011 | 2 s |
| 100 | 30 s |
| 101 | 1 min |
| 110 | 320 h |

My target is 5 hours: unit `001` (1 h) times `00101` (5), so `00100101`. My config used to say `00101000` with a comment claiming 5 hours, but that string is unit `001` times 8, which is 8 hours. I found it while writing this post, by decoding the string by hand instead of trusting my own comment, and fixed the config. The general lesson is the useful part: write the decode next to every timer string, and check it against what the modem reports back, because a comment can be wrong and the network does not care what the comment says.

Why a long T3412 at all, if a cycle happens every 30 minutes? The device re-attaches explicitly on each cycle, so the TAU timer only keeps the network from deregistering it. If you would rather rely on PSM alone, T3412 has to match your reporting interval.

Two more options are worth turning on: modem sleep notifications (`CONFIG_LTE_LC_MODEM_SLEEP_NOTIFICATIONS=y`), which I use to drive a status LED and a log, and a TAU pre-warning (`CONFIG_LTE_LC_TAU_PRE_WARNING_MODULE=y`), which fires shortly before the periodic TAU.

## eDRX

PSM covers the long sleeps. eDRX (extended discontinuous reception) covers the time the modem is awake but idle. Instead of checking for paging every second or so, it checks once per eDRX cycle. I set it for both radio technologies:

```
CONFIG_LTE_LC_EDRX_MODULE=y
CONFIG_LTE_EDRX_REQ=y
CONFIG_LTE_EDRX_REQ_VALUE_LTE_M="0101"
CONFIG_LTE_EDRX_REQ_VALUE_NBIOT="0101"
```

`0101` is a 20.48 s cycle for both. There are two options because the encoding depends on the technology, and I set both so one binary works wherever the modem attaches. With no downlink, eDRX only helps in the short window after a transfer. It also has a cost, covered below.

## RAI

Release Assistance Indication lets the device tell the network that it has nothing more to send, so the network can release the RRC connection straight away instead of waiting for its inactivity timer. In my notes that timer is 10 to 20 seconds on NB-IoT. On every cycle that is 10 to 20 seconds of the radio in the connected state, which is expensive compared with sleep.

Enable it in Kconfig, then set it on the socket:

```
CONFIG_LTE_LC_RAI_MODULE=y
CONFIG_LTE_RAI_REQ=y
```

```c
int rai_option = RAI_NO_DATA;
zsock_setsockopt(fd, SOL_SOCKET, SO_RAI, &rai_option, sizeof(rai_option));
```

The detail that matters is where in the exchange you set it. My first version set `RAI_ONE_RESP` before sending the request body, meaning "I expect one more response". Over TLS on TCP, that "one response" can be the TCP acknowledgement of my own request. The network released the connection after the ACK, before the HTTP reply came back. The reply then waited for the next paging occasion, which is governed by eDRX. On NB-IoT the network had granted a long cycle, 81.92 s, so my 30 s receive timeout expired, and the application sent the whole request again.

The fix was to set `RAI_NO_DATA` only after the full response has been read. That says "this socket is finished" at the point where it is true. RAI is a hint, so a failing `setsockopt` is logged and ignored, not treated as an error.

I also enable the proprietary PSM fallback:

```
CONFIG_LTE_PROPRIETARY_PSM_REQ=y
```

If a network rejects standard PSM, the modem uses a proprietary sleep behaviour instead of staying awake. The option is documented for the nRF91x1 modem firmware 2.x line. I use it as a safety net, and I would not rely on it as the main path.

## What the network actually grants

Everything above is a request. The network answers with what it will actually give you, and the answer can be different, or a refusal.

Two things in the log told me this. The first is the 81.92 s eDRX cycle on NB-IoT, against my 20.48 s request. The second is the PSM event from the link control library, which reports the granted values, or that the network rejected the request. I log both:

```c
case LTE_LC_EVT_PSM_UPDATE:
	if (evt->psm_cfg.active_time >= 0 && evt->psm_cfg.tau >= 0) {
		LOG("[PSM] Granted - TAU=%ds Active=%ds\n",
		    evt->psm_cfg.tau, evt->psm_cfg.active_time);
	} else {
		LOG("[PSM] Rejected by network\n");
	}
	break;
```

Two practical consequences:

- Design the application timeouts around the granted eDRX cycle, not the one you asked for. My bug above came from the gap between the two.
- Do not depend on a request for correctness. If PSM is rejected, the device still has to work, only with a worse battery life.

One side effect: while the modem sleeps in PSM, the signal quality query has no RSRP and answers 255. My telemetry lacked signal strength on most uploads until I fell back to the connection evaluation value, which is available while registered.

## GNSS alongside LTE

The nRF9151 shares RF between LTE and GNSS. GNSS gets the radio while LTE sleeps in PSM, in eDRX, or idle. Because of this, the modem can stay registered during a fix, and the device does not have to detach and re-attach, which is slow and costs power.

The system mode I use is LTE-M, NB-IoT and GNSS together:

```
CONFIG_LTE_NETWORK_MODE_LTE_M_NBIOT_GPS=y
```

That is `AT%XSYSTEMMODE=1,1,1,0` underneath, and the modem picks LTE-M or NB-IoT per network. The same build can then go to a region that only has one of them.

To start GNSS without touching LTE, use functional mode 31:

```c
lte_lc_func_mode_set(LTE_LC_FUNC_MODE_ACTIVATE_GNSS);   /* CFUN=31 */
```

Then I use the modem GNSS API for a single fix:

```c
nrf_modem_gnss_fix_interval_set(0);      /* single fix */
nrf_modem_gnss_fix_retry_set(timeout_s);
nrf_modem_gnss_start();
```

The receiver can be blocked by LTE. The event handler reports `BLOCKED` and `UNBLOCKED`, and I skip my "no satellite seen, give up early" shortcut when an attempt was blocked, since a blocked receiver sees nothing for reasons that are not the sky. I also wait briefly for RRC to go idle before starting, and inject the current time and a last-known position before the start call.

## Band locks and PDNs

Scanning all bands is slow, and slow means the radio is on for a long time. A band lock cuts the scan to the bands your SIM's network can use. I choose it from a table keyed on the mobile country and network codes, read from the IMSI after the SIM is active. The structure is a small per-network record:

```c
struct carrier_profile {
	int mcc, mnc;           /* -1 = wildcard */
	const char *pdp_type;   /* "IP" / "IPV6" / "IPV4V6" */
	const char *apn;
	const char *band_lock;  /* NULL = let the modem scan */
};
```

The table is searched in order. The first match wins, there are country-level entries for networks I do not know yet, and the last entry is a wildcard with no band lock. The lookup never returns NULL.

The one rule you cannot skip is the modem state. `AT%XBANDLOCK` only works while the modem is not on the air:

```
AT+CFUN=41
AT+CGDCONT=0,"IPV4V6","<apn>"
AT%XBANDLOCK=2,"<88 characters>"
```

The modem needs to be in `CFUN=0` or `CFUN=4`, or `41` if you need the SIM readable but the radio off. I read the SIM in `CFUN=41`, apply the profile there, and only then attach. If you apply it after the modem is already on, the command fails.

The mask is 88 ASCII characters. The leftmost character is band 88 and the rightmost is band 1. To lock to bands 2, 4, 5 and 12, everything is zero except the last 12 characters, which read from band 12 down to band 1:

```
"0000...0000" + "100000011010"
              B12        B5 B4 B2
```

I use lock mode 2. My code comment calls it the softer mode: the modem prefers the listed bands but can fall back when it finds no network. That is the safer choice for a device that may travel to a region you did not list. And a failed band lock is not fatal; the code logs it and carries on, since a scan of all bands is slow, but works.

The PDN part has a trap. I request `IPV4V6` for every profile, and still found a network where the bearer came up IPv6-only (NB-IoT, with DNS64 and NAT64 so IPv4 hosts stay reachable) and another where it was IPv4-only. An IPv6 socket on an IPv4-only bearer fails to connect. The sockets layer does not choose for you, so enable both stacks:

```
CONFIG_NET_IPV4=y
CONFIG_NET_IPV6=y
CONFIG_NET_IPV6_NBR_CACHE=n
CONFIG_NET_IPV6_MLD=n
CONFIG_NRF_MODEM_LIB_NET_IF=y
```

With the modem net-interface option on, name resolution returns the right address family for the PDN you have. My upload code also keeps a latched preferred family. It tries IPv6 first, and if the transport fails before the TLS connection is up, it tries the other family once and remembers whichever worked. A failure after the connection is up is not blamed on the family.

## TLS offload

The modem can do TLS itself. The socket call is the normal one, with the protocol set to the modem's TLS type:

```c
fd = zsock_socket(family, SOCK_STREAM, IPPROTO_TLS_1_2);
```

The root CA goes into the modem's credential storage at boot (`CONFIG_MODEM_KEY_MGMT=y`), and the modem does the handshake.

The thing not to do is enable Zephyr's own TLS socket option. It pulls in the host mbedTLS stack, which conflicts with the offloaded one. I left a comment in the config where it would be tempting. Credential writes need the modem off the air (`CFUN=4`).

## The MAGPIO bug and how to spot it

Now the bug. Every GNSS attempt failed. No satellites tracked, no fix, in places with a clear sky. Every symptom said hardware: a bad antenna, a detuned matching network, a damaged LNA. I started down that path, with the usual measurements, before I looked at the control signals.

The board has a GNSS low-noise amplifier with an enable pin. That pin is wired to MAGPIO0 on the SiP. The Nordic antenna helper sends two things at start: an `AT%XCOEX0` line, which drives a coexistence output, and an `AT%XMAGPIO` line, which drives the MAGPIO pins. The helper sends the COEX0 line too, and on my board COEX0 is not connected. So the modem was doing exactly what it was told, on a pin that goes nowhere, and the LNA never turned on. GNSS without the LNA looks just like an antenna that is badly matched: weak signal, no lock.

The fix is a single option that supplies the right string:

```
CONFIG_MODEM_ANTENNA_AT_MAGPIO="AT%XMAGPIO=1,0,0,1,1,1574,1577"
```

Reading it as my config comment does: `1,0,0` says MAGPIO0 is used and MAGPIO1 and MAGPIO2 are not; then one frequency range, with the pin state 1 across 1574 to 1577 MHz, which is the GPS L1 band. The pin goes high when the receiver is listening in that band, and the LNA is on only then.

How to tell this class of fault from an antenna fault, in order:

1. Look at the schematic first. Find which pin enables the LNA, then ask which of the modem's control outputs reaches it. If a signal your software assumes is not connected, you have the answer without a probe.
2. Probe the LNA enable pin during a fix attempt. If it never moves, the antenna is not the problem.
3. Read back the active configuration. If you can query the `XMAGPIO` and `XCOEX0` settings, compare them with the board's wiring.
I would have saved a lot of time if I had done step one before step two. A fault that looks like RF is often a control line.

## A checklist

- Write down the duty cycle first, and whether anything is ever sent to the device.
- Request PSM and eDRX, write the decoded meaning beside each bit string, and check it against the granted values.
- Log the grants, show them on a status screen, and survive a rejection.
- Set application timeouts from the granted eDRX cycle.
- Set RAI after the response is read, not before the request body.
- Use the LTE-M, NB-IoT and GNSS system mode if you ship to more than one region.
- Start GNSS with `CFUN=31`, handle blocked events, and inject time and position.
- Choose the band lock from the SIM and apply it with the modem off the air.
- Enable IPv4 and IPv6, turn on the modem net interface, and probe the other family once.
- Let the modem do TLS; leave Zephyr's TLS sockets off.
- Read the schematic for the LNA enable before blaming the antenna.

The modem does what you configured, not what you meant, and it tells you what it was actually given if you ask. Log those answers and compare them with the board.
