# Dashboard (`dashboard/`)

A Fluidd-style dashboard for the QIDI Plus 5 that runs from your PC. It's an Angular 22 app: source in
[`angular/`](../angular), built output committed in [`dashboard/app/`](../dashboard/app). Node.js is only needed
to *change* it, not to run it – see [`angular/README.md`](../angular/README.md).

## Run it

Double-click **`Open Dashboard.bat`** (from the repo, or from the release zip – see [releasing.md](releasing.md)).
It starts a tiny web server on `http://localhost:8765` (this PC only) and opens the page. Close the window to stop
it. (The old address `/ng/` redirects to the main page.)

**Connect to the printer:** click **Find my printer**. The launcher tells the page which local network(s) the PC
is on (`/local-networks`, real adapters before virtual ones like VirtualBox/Hyper-V), and the page checks each
address on that network for Moonraker (`http://<ip>:7125/printer/info`, 48 at a time, 1.5 s timeout) – about
10 seconds for a home network. Pick a printer and click **Connect**. You can also type the IP address into the
**Printer** box, or open `http://localhost:8765/?printer=<printer-ip>`. The address is remembered in that browser.

**First time on a printer:** if the box macros aren't installed, the Control Box panel shows
**Set up slot editing** (see [one-click macro setup](#one-click-macro-setup)).

**Why a local server:** Moonraker's existing CORS setting already allows pages from `localhost`, but blocks
pages opened straight from a file. Serving from localhost means no printer setting has to change.

## Panels

All panels collapse; the open/closed state is remembered (except Camera).

- **Status** – the title is the printer state (Ready, Printing, Paused, …). File + thumbnail, progress, elapsed,
  remaining, layer, speed, flow, filament used, position. Pause / Resume / Cancel (asks first).
  "Restart Klipper" (`RESTART`) only appears when Klipper isn't ready.
- **Thermals** (view only) – every heater and sensor with power, actual and target.
  - Actual is colored against the target: blue = below, green = within ±2 °C, red = above. No color without a target.
  - Power is a **10-second average**, drawn as a red bar on black while a target is set.
  - **Total** above the Power column = Σ (10 s average power × rated watts). Ratings are in `HEATER_WATTS`
    in `index.html` (nozzle 150 W, bed 500 W, chamber 550 W, box heater 245 W). Heaters only – motors, fans,
    electronics and lights are not included.
  - 10-minute chart (seeded from Moonraker's temperature store) with 20° / 1-minute gridlines and a hover
    tooltip showing every sensor at that moment.
  - Order: heaters first, safety sensors (no target) at the bottom.
- **Control Box** – box temperature, humidity, drying state, whether the box is enabled, and what's
  **in the toolhead**. Slot cards show "Spool in" / "Empty" from the spool sensor and "In toolhead" for the
  loaded slot. Edit filament and color per slot (and the external spool); saving uses `SET_SLOT_FILAMENT`
  and is blocked while printing.
  - **Load / Unload / Eject**, always shown on each box slot card and greyed out with a reason
    (hover) when they don't apply, with a confirmation first:
    **Load** feeds the slot's filament to the toolhead (only when the slot has a spool and nothing else is loaded).
    **Unload** – only for the slot in the toolhead – pulls the filament out of the extruder and parks it in the
    tube, ready to load again. **Eject** – spool present, not in the toolhead – pulls the filament fully out of the
    box feeder. They home and move the toolhead (keep the bed clear). Blocked while printing; one move at a time;
    never offered for the external spool (see [machine-notes.md](machine-notes.md#qidi-box-unload-eject-load)).
  - **Filament dryer**: start drying with a temperature (30–65 °C) and time (1–24 h), see
    the target, box air temperature and time left, and stop it. The temperature defaults to the lowest QIDI
    drying limit among the loaded spools, and it warns when the setting is above a spool's limit (PLA is treated
    as 45 °C). Start is disabled while printing and while filament is in the toolhead – QIDI requires unloading
    first. Uses `BOX_START_DRYING` / `BOX_STOP_DRYING` (see [machine-notes.md](machine-notes.md#qidi-box-filament-dryer)).
- **Camera** – closed on every page load. The MJPEG stream only runs while the panel is open **and** the
  browser tab is visible, to keep load off the printer.
- **Console** – recent history, live replies, ↑/↓ command history. Automatic light/screen/LED status chatter is
  hidden by default. QIDI's Klipper gives no reply to unknown commands.
- **Fans & Outputs** – sliders for `fan_generic` fans (`SET_FAN_SPEED`), automatic fans shown read-only,
  output pins as switches (`SET_PIN`; beeper hidden; polar cooler hidden when not enabled). The case light is
  also driven by QIDI's "smart" light logic, so the printer may switch it by itself.
- **Jobs** – files (newest first, thumbnails, time/weight/types) and history with Reprint.

## One-click macro setup

The app carries its own copy of [`printer/box_slots.cfg`](../printer/box_slots.cfg) (copied in at build time).
The Control Box panel compares the **version number** of that copy (`variable_version` in `_BOX_SLOT_DATA`;
files without one count as 1) with the printer's:

- **Macros not loaded** → "Slot editing isn't set up" with **Set up slot editing**.
- **App's copy is newer** → "A newer version of the slot macros is available (version X; the printer has Y)" with
  **Update macros**.
- **Printer's copy is newer** → "The printer has newer slot macros … than this dashboard" and **no button** – it
  never downgrades. Get the latest dashboard instead.
- **Same version** → nothing shown.

⚠️ Dashboard **v1.0.0** compared file *contents* instead, so it offers to "update" a printer that has newer macros –
which installs the **older** file (this removed `AUTO_BOX_TEMP` once). Don't use v1.0.0's **Update macros**; use
v1.1.0 or later.

Clicking first shows exactly what will happen (backup name, the line to add and where, restart), then:

1. Checks the printer is idle.
2. Saves `printer.cfg` as `printer-<date>_<time>-before-slot-editing.cfg.bak` in the config folder.
3. Uploads `box_slots.cfg` and reads it back to verify.
4. If `printer.cfg` doesn't load it yet, adds `[include box_slots.cfg]` right after `[include box.cfg]`
   (or before the auto-saved SAVE_CONFIG block if that line isn't there) – nothing else is touched – and verifies.
5. `RESTART`s Klipper and waits up to 2 minutes for it to be ready.
6. Checks the macros actually loaded.

If any step after the upload fails, it puts the original `printer.cfg` (and the previous `box_slots.cfg`, if
there was one) back and restarts Klipper again, then says what happened. Tested on hardware: macros removed →
**Set up slot editing** → include line added back at the same place, Klipper ready, macros loaded.

## Printing with the box

QIDI's Fluidd asks which box slot feeds each filament before printing, but its slot list is empty on current
firmware (see [machine-notes.md](machine-notes.md#qidis-fluidd-what-doesnt-work)). The dashboard's print dialog does this instead:

1. For each tool in the file (`used_extruders` from QIDI Studio files; for OrcaSlicer files, one per entry in
   `filament_type`), pick a loaded box slot. The default is the same filament type and the closest color.
2. It sends `SAVE_VARIABLE VARIABLE=value_t<T> VALUE="'slot<index>'"` for each tool, then starts the print.
3. "Use the Control Box" toggles `enable_box`. With the box off, prints use the external spool.

If your slicer's start G-code also sets `value_t…` (the included Orca profile does – see
[orcaslicer.md](orcaslicer.md)), the start G-code runs last and wins.

OrcaSlicer's **Upload and Print** does not set any mapping; the printer reuses the last `value_t…` values.
Upload only, then start from the dashboard – or use a start G-code that sets the mapping.

## Implementation notes

- Angular 22 (standalone components, signals, zoneless), no other libraries. Talks to Moonraker over its
  websocket (`ws://<printer-ip>:7125/websocket`, JSON-RPC) with push updates – no polling. G-code calls wait up
  to 10 minutes for Moonraker's reply (box load/unload take ~2 minutes).
- `dashboard/serve.ps1` serves `dashboard/app/` on localhost only, falls back to `index.html` for app routes, and
  refuses paths outside that folder.
- Camera: `http://<printer-ip>/webcam/?action=stream` (crowsnest/ustreamer behind nginx).
- "In toolhead": `box_extras.loaded_slot` reads `slot0`–`slot15` for box slots and `slot16` for external –
  but it also reads `slot16` when **nothing** is loaded. The page therefore also checks the toolhead filament
  sensor (`filament_switch_sensor filament_switch_sensor`, on the toolhead board): no filament = nothing loaded.
