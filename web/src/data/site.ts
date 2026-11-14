// Facts about the site and its owner. README.md at the repository root is the source of truth.
export const SITE = {
  url: 'https://mayankgautam.me',
  name: 'Mayank Gautam',
  role: 'Embedded engineer',
  place: 'Delhi, India',
  email: 'contact@mayankgautam.me',
  github: 'https://github.com/mayankgautam-me',
  linkedin: 'https://www.linkedin.com/in/mayankgautam-me/',
};

export const NAV = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/resume', label: 'Resume' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
];

export const INTRO =
  'Embedded engineer in Delhi with more than seven years across the full embedded stack. I take hardware products from the schematic to the shelf: the board, the firmware, the cloud behind it and the app in your hand.';

export type Role = {
  title: string;
  org: string;
  from: string;
  to: string;
  current?: boolean;
  summary: string;
  details?: string[];
  tags?: string[];
};

// Experience, newest first, as in README.md. Details for the research-lab roles come from the
// older resume, rewritten plainly.
export const EXPERIENCE: Role[] = [
  {
    title: 'Embedded engineer',
    org: 'Deep-tech startup',
    from: '2024',
    to: 'now',
    current: true,
    summary:
      'Connected devices from board to cloud, including air-quality monitoring, a 5G RedCap, Wi-Fi and BLE gateway, oneM2M device platforms and Zephyr firmware on Silicon Labs Wi-Fi SoCs.',
    tags: ['Zephyr', 'SiWx917', '5G RedCap', 'BLE', 'oneM2M'],
  },
  {
    title: 'Product engineering lead',
    org: 'Independent',
    from: '2019',
    to: 'now',
    current: true,
    summary:
      'More than a dozen hardware products from concept to production, among them wearables, Bluetooth tags and cellular trackers, a BLDC motor controller, USB control decks, voice-capture and meditation devices and a musical instrument, with the boards, firmware, cloud back ends, SaaS and apps around them.',
    tags: ['Wearables', 'Trackers', 'Motor control', 'USB HID', 'SaaS'],
  },
  {
    title: 'Senior project scientist',
    org: 'University research lab',
    from: '2022',
    to: '2024',
    summary:
      'A proprietary IEEE 802.15.4 RF network stack with custom PHY and MAC layers, its GCC build system and CI/CD packaging.',
    details: [
      'Developed the RF network stack on the IEEE 802.15.4 standard, including custom PHY and MAC layers.',
      'Built the GCC build system used to compile the stack and debug it on hardware.',
      'Wrote the shell scripts around the stack, and one script that sets it up on different operating systems.',
      'Packaged and distributed the stack through CI/CD pipelines, and managed the project timeline.',
    ],
    tags: ['IEEE 802.15.4', 'PHY/MAC', 'GCC', 'CI/CD'],
  },
  {
    title: 'Project scientist',
    org: 'University research lab',
    from: '2019',
    to: '2022',
    summary:
      'Li-Fi networks on embedded Linux (Xilinx MPSoC, kernel modules, Yocto), Altium boards and OrCAD simulation.',
    details: [
      'Ran Linux on ARM-based Xilinx MPSoCs and wrote kernel modules for the project.',
      'Worked on the networking stack at the kernel layer for the Li-Fi network.',
      'Built a custom embedded Linux distribution with the Yocto Project.',
      'Designed boards in Altium Designer and simulated circuits in Cadence OrCAD.',
      'Set up DevOps processes for the team, and wrote Python GUIs, Linux shell tools and C# console applications.',
    ],
    tags: ['Embedded Linux', 'Yocto', 'Kernel modules', 'Altium', 'OrCAD'],
  },
  {
    title: 'Electronics engineer intern',
    org: '',
    from: '2018',
    to: '2018',
    summary: 'Wireless communication, audio processing, analog design, PCB design and assembly.',
  },
  {
    title: 'Personal builds',
    org: 'Own projects',
    from: '2017',
    to: '2019',
    summary:
      '3D printers and their controller boards, self-balancing robots and a one-wheel vehicle, MIDI and HID controllers, IoT devices and computer-vision systems.',
  },
];

export const EDUCATION = {
  degree: 'B.Tech',
  field: 'Electrical, Electronics and Communications Engineering',
  from: '2015',
  to: '2019',
};

// "What I build" from README.md, one entry per line there.
export const SKILLS: { area: string; items: string }[] = [
  { area: 'Products', items: 'Wearables, Bluetooth and cellular trackers, IoT gateways, environmental sensors, motor controllers, control decks, instruments and robots' },
  { area: 'Boards', items: 'KiCad and Altium, from schematic to assembled panels' },
  { area: 'Firmware', items: 'Zephyr on nRF52, nRF54, nRF91 and SiWx917, STM32 with FreeRTOS, ESP32, Arduino, PlatformIO, USB HID, motor control (FOC)' },
  { area: 'Wireless', items: '5G RedCap, BLE, LTE-M/NB-IoT, IEEE 802.15.4, Thread, Zigbee, LoRaWAN, Wi-Fi' },
  { area: 'Networking', items: 'TCP/IP, Linux kernel networking, MQTT, oneM2M, custom PHY and MAC layers' },
  { area: 'Embedded Linux', items: 'Yocto, kernel modules, networking stacks' },
  { area: 'Bring-up and debug', items: 'JTAG/SWD (OpenOCD, probe-rs), GDB, logic analysers and scopes, HIL testing' },
  { area: 'Cloud', items: 'Cloudflare Workers, D1, R2, Pages, multi-tenant SaaS' },
  { area: 'Security', items: 'Device identity and provisioning, encrypted secrets (SOPS, age), hardware wallets' },
  { area: 'AI/ML', items: 'Speech recognition and speaker diarization pipelines, LLM apps on the Claude API, on-device inference, computer vision' },
  { area: 'DevOps', items: 'Docker, CI/CD on GitHub Actions and GitLab CI, self-hosted runners, reproducible toolchains, encrypted secrets' },
  { area: 'Apps', items: 'SwiftUI, Wear OS, Tauri desktop (Rust and Svelte), React, Next.js and Payload CMS web' },
  { area: 'Languages', items: 'C, C++, Rust, Python, Go, TypeScript, Swift, Kotlin, shell' },
];

export const OPEN_SOURCE = [
  { name: 'workbench', href: 'https://github.com/mayankgautam-me/workbench', text: 'My Mac setup, Brewfile, dotfiles, macOS settings and Claude Code mods.' },
  { name: 'ci-templates', href: 'https://github.com/mayankgautam-me/ci-templates', text: 'Reusable GitHub Actions workflows, one per part kind.' },
];
