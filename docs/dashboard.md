# Dashboard (`dashboard/`)

A Fluidd-style dashboard for the QIDI Plus 5 that runs from your PC. There are two versions with the same
features and look, served side by side:

| URL | Version | Source |
|---|---|---|
| `http://localhost:8765/` | Original single-file page (plain HTML/JS) | [`dashboard/index.html`](../dashboard/index.html) |
| `http://localhost:8765/ng/` | Angular 22 version (built output committed) | [`angular/`](../angular) → built into [`dashboard/ng/`](../dashboard/ng) |

Both share the printer address and panel settings (same browser storage). Node.js is only needed to
*change* the Angular version, not to run it – see [`angular/README.md`](../angular/README.md).

## Run it

Double-click **`Open Dashboard.bat`**. It starts a tiny web server on `http://localhost:8765` (this PC only)
and opens the page. Close the window to stop it. To open the Angular version directly, run
`serve.ps1 -Open ng/`.

The first time, type your printer's IP address into the **Printer** box in the top bar. It's remembered in
that browser. You can also open `http://localhost:8765/?printer=<printer-ip>`.

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
- **Camera** – closed on every page load. The MJPEG stream only runs while the panel is open **and** the
  browser tab is visible, to keep load off the printer.
- **Console** – recent history, live replies, ↑/↓ command history. Automatic light/screen/LED status chatter is
  hidden by default. QIDI's Klipper gives no reply to unknown commands.
- **Fans & Outputs** – sliders for `fan_generic` fans (`SET_FAN_SPEED`), automatic fans shown read-only,
  output pins as switches (`SET_PIN`; beeper hidden; polar cooler hidden when not enabled). The case light is
  also driven by QIDI's "smart" light logic, so the printer may switch it by itself.
- **Jobs** – files (newest first, thumbnails, time/weight/types) and history with Reprint.

## Printing with the box

QIDI's Fluidd asks which box slot feeds each filament before printing, but its slot list is empty on current
firmware (see [qidi-internals.md](qidi-internals.md)). The dashboard's print dialog does this instead:

1. For each tool in the file (`used_extruders` from QIDI Studio files; for OrcaSlicer files, one per entry in
   `filament_type`), pick a loaded box slot. The default is the same filament type and the closest color.
2. It sends `SAVE_VARIABLE VARIABLE=value_t<T> VALUE="'slot<index>'"` for each tool, then starts the print.
3. "Use the Control Box" toggles `enable_box`. With the box off, prints use the external spool.

If your slicer's start G-code also sets `value_t…` (the included Orca profile does – see
[orcaslicer.md](orcaslicer.md)), the start G-code runs last and wins.

OrcaSlicer's **Upload and Print** does not set any mapping; the printer reuses the last `value_t…` values.
Upload only, then start from the dashboard – or use a start G-code that sets the mapping.

## Implementation notes

- Plain HTML/JS, no build step, no external libraries. Talks to Moonraker over its websocket
  (`ws://<printer-ip>:7125/websocket`, JSON-RPC) with push updates – no polling.
- Camera: `http://<printer-ip>/webcam/?action=stream` (crowsnest/ustreamer behind nginx).
- "In toolhead": `box_extras.loaded_slot` reads `slot0`–`slot15` for box slots and `slot16` for external –
  but it also reads `slot16` when **nothing** is loaded. The page therefore also checks the toolhead filament
  sensor (`filament_switch_sensor filament_switch_sensor`, on the toolhead board): no filament = nothing loaded.
