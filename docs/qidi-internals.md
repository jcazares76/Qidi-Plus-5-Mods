# How QIDI stores box data (and other findings)

Everything here was found through Moonraker's HTTP/websocket API on a QIDI Plus 5 with one QIDI Box.
QIDI's box code is compiled (`box_extras.so` etc.), so behavior was worked out by observation.

## Printer basics

- Moonraker on port 7125 (also proxied by nginx on port 80). Fluidd on port 80.
- Linux user `qidi` (not `mks` like older QIDI models):
  config `/home/qidi/printer_data/config`, logs `/home/qidi/printer_data/logs`.
- Moonraker `[authorization]` trusts `192.168.0.0/16` and `10.0.0.0/8`, so LAN clients need no login.
  `cors_domains` already allows `*://localhost:*`.

## Slot data (`save_variables` / `saved_variables.cfg`)

Slots are **0-based** here, 1-based on the box label, in slicers and in the macros.

| Variable | Meaning | Example |
|---|---|---|
| `filament_slot<N>` | QIDI filament ID | `'QFA00'` (PLA Basic) |
| `color_slot<N>` | one-item list of hex | `['FAFAFA']` |
| `vendor_slot<N>` | legacy, appears unused | `1` |
| `slot<N>` | spool present flag (mirrors the sensor) | `0` / `1` |
| `value_t<T>` | tool → slot mapping used when printing | `'slot2'` |
| `enable_box` | 1 = print from the box, 0 = external spool | `1` |
| `filament_slot16` / `color_slot16` | the external spool holder | |

- An unset slot holds the integer `1` (left over from the old index-based format). `box_extras` then reports
  the default, PLA Basic white.
- The stored type/color **stays after a spool is removed**. Whether a spool is really there comes from the
  spool sensor (below).
- Standard `SAVE_VARIABLE` updates the box live; no `UPDATE_FILAMENT_INFORMATION` call is needed.
- The printer has its own material database ("MaterialDatabase loaded: 50 filaments, 24 colors, 2 vendors"),
  loaded from `officiall_filas_list.cfg`, that turns IDs into names and temperatures.

## Useful Moonraker objects

- `box_extras` – resolved view: `boxes[b].filament_info[i]` (`filament_id`, `vendor_str`, `filament_str`,
  `filament_type`, `color_rgb_str`, `min_temp`, `max_temp`, `info_from_rfid`), `boxes[b].box_inserted_<i>`
  (spool sensor, 1 = spool in), `aht20_temp`, `aht20_humidity`, `dry_state`, and top-level `loaded_slot`.
  Always 4 boxes listed; only `is_online: 1` ones are real.
- `loaded_slot` – `slot0`…`slot15` for box slots, `slot16` for the external spool, **and also `slot16` when
  nothing is loaded**. Combine with the toolhead sensor below.
- `filament_switch_sensor filament_switch_sensor` – toolhead filament sensor (pin on the toolhead board).
  `filament_detected` keeps updating during prints even though the start G-code sets `enabled` to false.
- `multi_color_controller` – the same slot data flattened, plus task state.
- `print_stats.state` – `standby` / `printing` / `paused` / …

## Why QIDI's Fluidd box panel shows `?`

QIDI's Fluidd (v1.30.5) runs `parseInt` on `filament_slot<N>` / `color_slot<N>` and looks up `fila<number>` and
`colordict[<number>]` in `officiall_filas_list.cfg`. IDs like `QFA00` become `NaN`, so nothing resolves.
Adding entries to that file can't fix it (every ID collapses to the same `NaN` key), and the firmware loads the
same file, so it's best left alone.

Consequences:
- The panel shows `?` for every slot (the spool sensor greying still works).
- Its print dialog can't offer slots (it filters by filament type), so box printing from Fluidd breaks.
- **Don't use its Vendor / Filament / Color dropdowns** – they write old-format numbers, which the firmware
  treats as "not set".

How QIDI's Fluidd starts a box print (what the dashboard replicates): for each tool `T` in the file it sends
`SAVE_VARIABLE VARIABLE=value_t<T> VALUE="'slot<index>'"`, then starts the print. `BOX_PRINT_START` later loads
the slot mapped to the first tool.

## Heaters and sensors

| Object | What it is |
|---|---|
| `extruder` | nozzle (150 W) |
| `heater_bed` | bed (500 W) |
| `heater_generic chamber` | chamber heater (550 W), `max_temp` 68 °C |
| `temperature_sensor Chamber_Thermal_Protection_Sensor` | sensor on the chamber heater itself, `max_temp` 170 °C. Runs ~140 °C while the heater is at full power – normal |
| `heater_generic heater_box1` | QIDI Box dryer (245 W), controlled by the box's AHT20 air sensor, target up to 90 °C |
| `temperature_sensor heater_temp_a_box1` / `_b_box1` | probes on the box's two heater + fan units, `max_temp` 130 °C |

## Box filament dryer

Not documented by QIDI; worked out by testing (the box code is compiled):

```
BOX_START_DRYING BOX=1 TEMP=45 TIME=6     ; box number (1-based), °C, hours
BOX_STOP_DRYING BOX=1
```

- Without all parameters the box replies `// Error: Missing parameters.` (as a console message – the command
  itself still returns OK). On success: `// BOX_DRY started for BOX 1` / `// DISABLE_BOX_DRY for BOX 1`.
  Stopping when idle replies `// No active heating for BOX 1`.
- While drying, `box_extras.boxes[b]` shows `dry_state: 1`, `box_target_temp`, and `end_time` = **minutes left**;
  `heater_generic heater_box1` gets the target.
- QIDI's wiki: unload all filament from the feeder first, close the lid, trays rotate every 5 minutes, box fans
  start above 35 °C. Spec maximum 65 °C.
- Per-filament limit: `box_extras.boxes[b].filament_info[i].box_max_temp` (e.g. ABS/ASA 45). PLA reports `0` –
  QIDI disables *manual* box heating for PLA.
- Related commands (not used here): `EX_START_DRYING` / `EX_STOP_DRYING` dry spools in the printer chamber
  with the bed and chamber heaters (presets in `drying.conf`); `SET_BOX_TEMP_CONTROL`, `BOX_TEMP_SET`,
  `DISABLE_BOX_HEATER` set box temperature during a print.

## Unload and eject

```
UNLOAD_FILAMENT_CONTROL SLOT=0   ; pull filament out of the toolhead, park it in the tube (ready to reload)
EJECT_FILAMENT_CONTROL SLOT=0    ; pull filament fully out of the box feeder
LOAD_FILAMENT_CONTROL SLOT=0     ; feed filament to the toolhead (not used by the dashboard)
```

- `SLOT` is the **0-based** box slot index: the code looks up `box_stepper slot<SLOT>` (box 1 = 0–3).
  Without it: `// Error: Missing SLOT parameter.`
- **Danger:** the value isn't validated. `EJECT_FILAMENT_CONTROL SLOT=99` raised
  `Unknown config object 'box_stepper slot99'` inside QIDI's `multi_color_controller` and **shut Klipper down**.
  `RESTART` wasn't enough ("Can not update MCU 'mcu' config as it is shutdown"); `FIRMWARE_RESTART` recovered it.
  The external spool (index 16) has no `box_stepper`, so never send these for it.
- QIDI's Fluidd buttons (Uninstall / Load / Unload) send `E_BOX` / `E_LOAD` / `E_UNLOAD slot=<i>`, which don't
  exist on current firmware.
- Fluidd's enable rules: eject when the slot's `box_stepper slot<i>.runout_button` is 0 (spool present);
  unload only for the slot that's loaded.

## Other QIDI G-code commands seen

`UPDATE_FILAMENT_INFORMATION`, `READ_RFID`, `INIT_RFID_READ`, `LOAD_FILAMENT_CONTROL`, `UNLOAD_FILAMENT_CONTROL`,
`BOX_PRINT_START`, `ENABLE_SMART_PIN`, `NEOPIXEL_MODE`. Parameters weren't needed here.

## Gotchas

- `#` starts a comment in Klipper configs even inside macro code, and is dropped from G-code commands
  (`COLOR=#FF0000` arrives empty).
- Use `RESTART` first; `FIRMWARE_RESTART` failed once on this printer but is needed when a board (MCU) is shut down.
- After a restart, wait for Klipper to be ready; earlier commands fail with "Printer is not ready".
- Safe way to change config: download → edit → upload with `/server/files/upload` → `RESTART` →
  check `/printer/info`; if it's `error`, re-upload the backup and `RESTART`.
