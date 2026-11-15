---
title: "oneM2M device platforms"
summary: "Device-to-cloud plumbing on oneM2M: an open-source CSE, custom device types, a two-plane resource model, subscriptions instead of polling, and an application framework that writes configuration back."
group: product
context: Deep-tech startup
period: 2024 to now
order: 10
art: mesh
tags: [oneM2M, ACME CSE, Python, Node.js, Docker, Device management]
---

## What it is

oneM2M is the standard for how IoT devices and applications share data through a common services entity (CSE). The platform work here is what sits between embedded devices and the people or systems that use them: how a device registers, what resources it owns, how readings reach consumers, and how settings travel back to the device.

The working example is an air-quality node, described on its own page. I used it to build and test the whole platform side.

## The CSE

The CSE is the open-source ACME oneM2M implementation, run as a Docker image and configured as an infrastructure node (IN-CSE) on oneM2M release 5. Devices register as application entities whose originator names match a pattern, and flexContainers are limited to a retained history and a size cap.

Custom device types are written as SDT flexContainer specialisations in an `.fcp` file: a device type holding the sampling interval and location, with a child module type carrying the eleven measurement attributes.

## Resource model

Each device uses two planes.

- **Data plane:** the device's own application entity, with an access control policy, the device flexContainer, the sensor flexContainer, a subscription that forwards every reading, and a semantic descriptor using SSN/SOSA.
- **Management plane:** an operator-owned node with the usual management objects (device info, firmware, software, memory, battery, reboot, event log, network and others), plus one capability object per sensor. A capability's flag is the on/off switch for that sensor.

A reading is an update to the sensor flexContainer, which fires one notification. The device provisions what is missing each time it wakes, because deep sleep wipes its RAM.

## Consuming it

- **Dashboard bridge:** a Node.js service with no dependencies that receives notifications, streams them to a browser over server-sent events, and exposes a small REST layer for devices, history and settings. The browser never talks to the CSE and never polls. A node counts as active while it reports within two and a half times its own interval.
- **Application framework:** a Python service that routes notifications to per-device plugins, keeps a rolling history, writes results to SQLite or MySQL, and writes configuration back to the CSE. It is configured entirely through environment variables, so one image runs anywhere.
- **Settings sync:** the dashboard shows desired against reported values, so a change is only confirmed once the device has applied it.

## Tooling

A simulator impersonates one node or a fleet against a local CSE, and the command-line tool builds and runs each component. Notifications also have a documented HTTP contract so a third-party platform can subscribe.

## What I did

I worked on both ends: the oneM2M client in the device firmware, the resource model, the simulator, and the bridge and framework.
