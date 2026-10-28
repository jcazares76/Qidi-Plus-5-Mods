# QIDI Plus 5 Mods

Configuration changes, a local web dashboard, and notes for the **QIDI Plus 5** with the **QIDI Box**
(multi-material unit), running QIDI's Klipper + Moonraker firmware.

Why this exists: on current QIDI firmware the box stores each slot's filament as a QIDI filament ID
(e.g. `QFA00`) and a hex color. QIDI's bundled Fluidd still expects the old numbered format, so its
Control Box panel shows `?` for every slot, can't map filaments to slots when printing, and its
dropdowns write values the firmware treats as "not set". This repo works around that without
touching QIDI's own files.

## What's here

| Folder | What it is |
|---|---|
| [`printer/box_slots.cfg`](printer/box_slots.cfg) | Klipper macros to set/list box slot filament and color (`SET_SLOT_FILAMENT`, `LIST_SLOT_FILAMENTS`, `LIST_FILAMENT_TYPES`) |
| [`printer/printer.cfg`](printer/printer.cfg) | QIDI's `printer.cfg` with the one added line (`[include box_slots.cfg]` after `[include box.cfg]`), for reference. The printer's auto-saved calibration section is left out |
| [`printer/original/printer.cfg`](printer/original/printer.cfg) | QIDI's stock `printer.cfg` without any mods, for comparison and undo (same calibration section left out) |
| [`dashboard/`](dashboard) | A Fluidd-style dashboard that runs from your PC: status, thermals, control box, camera, console, fans/outputs, jobs |
| [`orcaslicer/`](orcaslicer) | An OrcaSlicer printer profile with a "UPS safe" start G-code (heats one thing at a time to keep startup draw under ~1000 W) |
| [`docs/`](docs) | Install steps and everything learned about how the box and firmware work |

## Quick start

1. **Install the macros** – see [docs/install.md](docs/install.md). One new file plus one `[include]` line in `printer.cfg`.
2. **Run the dashboard** – double-click `dashboard/Open Dashboard.bat`, then enter your printer's IP address
   in the top bar. See [docs/dashboard.md](docs/dashboard.md).
3. **OrcaSlicer (optional)** – import the profile in `orcaslicer/`. See [docs/orcaslicer.md](docs/orcaslicer.md).

## Docs

- [Install / undo](docs/install.md)
- [Box slot macros](docs/box-slot-macros.md)
- [Dashboard](docs/dashboard.md)
- [OrcaSlicer profile and gotchas](docs/orcaslicer.md)
- [How QIDI stores box data (and other findings)](docs/qidi-internals.md)

## Tested with

- QIDI Plus 5 with one QIDI Box, QIDI's Fluidd v1.30.5, Moonraker on port 7125 (Linux user `qidi`)
- OrcaSlicer 2.5.0-dev, QIDI Studio 2.07
- Windows 11 for the dashboard launcher (the page itself works in any modern browser)

Use at your own risk. Keep a backup of your printer's config folder before changing anything.
