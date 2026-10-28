# QIDI Plus 5 + QIDI Box – machine notes

Everything learned about how this printer behaves, for anyone picking up the project. Most of it is not
documented by QIDI; it was found through Moonraker's API, QIDI's own config files and Fluidd bundle, the
printer's logs, and careful testing on an idle printer. Where something was inferred rather than confirmed,
it says so. Untested items are collected at the end.

Setup these notes come from: QIDI Plus 5, one QIDI Box (4 slots), QIDI's Klipper/Moonraker firmware and
QIDI's Fluidd build v1.30.5, as of October 2026.

**Contents:** [Overview](#overview) · [Access](#access-and-files) · [Restarting](#restarting-and-recovery) ·
[Gotchas](#klipper-and-macro-gotchas) · [Console noise](#console-messages-that-are-normal) ·
[Box data](#qidi-box-how-slot-data-is-stored) · [Box objects](#qidi-box-live-objects-and-sensors) ·
[Unload/eject](#qidi-box-unload-eject-load) · [Dryer](#qidi-box-filament-dryer) ·
[Printing with the box](#printing-with-the-box) · [Slicers](#slicers) · [Heaters](#heaters-sensors-and-power) ·
[Fans and outputs](#fans-lights-and-outputs) · [Motion](#motion-probe-and-calibration) · [Camera](#camera) ·
[QIDI's Fluidd](#qidis-fluidd-what-doesnt-work) · [Firmware updates](#firmware-updates) ·
[Testing safely](#testing-safely) · [Open questions](#open-questions-and-untested)

---

## Overview

| Part | Details |
|---|---|
| Kinematics | CoreXY. `max_velocity` 600 mm/s, `max_accel` 20000 mm/s², `square_corner_velocity` 8, Z max 20 mm/s |
| Travel | X −7…326, Y −5…340, Z −5…310 (X endstop at 325, Y at −3) |
| Z | Two Z motors (`stepper_z`, `stepper_z1`) with `z_tilt` |
| Boards | Main MCU (`mcu`), toolhead board (`THR`, on `/dev/ttyS4`), QIDI Box board (`mcu_box1`, USB) |
| Host | Debian 11, ~512 MB RAM. Klipper and Moonraker report their versions as `?` (QIDI hides them) |
| QIDI modules | Compiled Python modules in QIDI's Klipper: `box_extras`, `multi_color_controller` (`TaskQueueManager`, `FlowTask`, `BoxAdapterV1`), `box485`, `box2base`, `print_stats_manager`, `smart_output_pin`, `ai_func_manager`, `d_bus_service_manager`. Source isn't readable; behavior was observed |
| Web | Moonraker on port 7125 (also proxied by nginx on 80), QIDI's Fluidd on 80, camera on `/webcam/` |

## Access and files

- **No SSH needed.** Everything here was done through Moonraker's HTTP/websocket API.
- Linux user is `qidi` (older QIDI models use `mks`). Config: `/home/qidi/printer_data/config`,
  logs: `/home/qidi/printer_data/logs`. Klipper itself lives in `/home/qidi/klipper` – **not** reachable through
  Moonraker (file roots are `config`, `gcodes`, `logs` only).
- Moonraker `[authorization]` trusts `10.0.0.0/8`, `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`,
  `192.168.0.0/16`: LAN clients need no login or API key.
- `cors_domains` allows `*://localhost:*` (any port) but **not** pages opened from a file (origin `null`) or other
  sites. That's why the dashboard is served from a tiny localhost server.
- Moonraker can't host a custom page itself (it serves config files as downloads).
- Useful endpoints: `/printer/objects/query?…`, `/printer/gcode/script?script=…`, `/server/files/upload`
  (`root=config`), `/server/files/config/<file>`, `/server/files/logs/klippy.log`, `/server/gcode_store?count=N`
  (recent console lines – the best way to read a command's reply), `/printer/info`, `/printer/restart`,
  `/printer/firmware_restart`.
- `klippy.log` rotates daily (`klippy.log.<date>`). It's mostly "Can not find 485 device" lines (see below).

## Restarting and recovery

- **`RESTART`** (host restart) is the normal way to reload config. Wait for `/printer/info` to report `ready`;
  commands sent earlier fail with "Printer is not ready".
- **`FIRMWARE_RESTART`** once failed with "Failed automated reset of MCU 'mcu'" (a plain `RESTART` recovered that
  time). But when a board is shut down (`Can not update MCU 'mcu' config as it is shutdown`), `RESTART` is **not**
  enough and `FIRMWARE_RESTART` is required – it worked in ~20 s when this happened. Power-cycling is the fallback.
- Klipper shuts down on any internal error in QIDI's modules (see [unload/eject](#qidi-box-unload-eject-load)).
- Safe config change: download the file → edit locally → upload with `/server/files/upload` → `RESTART` → check
  `/printer/info`; if it's `error`, re-upload the backup and `RESTART`.
- On Windows, `curl.exe -F "file=@…"` silently uploads nothing when given a Git Bash style path (`/c/...`).
  Use a normal Windows path, and verify the upload by downloading the file again.

## Klipper and macro gotchas

- **`#` starts a comment in Klipper config files, even inside macro code.** A macro containing `replace('#','')`
  was cut at the `#`, gave a template error and halted the printer. Never put `#` or `;` in macro code.
- **`#` is also stripped from G-code commands**: `COLOR=#FF0000` arrives empty. Pass hex colors without `#`.
- Any `!!` error in the console pops up on the touchscreen (info box `QDC_100_005_000_001`). Harmless.
- QIDI's Klipper gives **no reply at all** to unknown commands (stock Klipper says "Unknown command").
- Many QIDI commands report problems as **console messages while the command itself returns OK**
  (e.g. `// Error: Missing parameters.`). Always read `/server/gcode_store` or check state afterwards.

## Console messages that are normal

| Message | Meaning |
|---|---|
| `Can not find 485 device` (every 2 s, log only) | `[box485]` polls an RS-485 bus for chained boxes. This box is on USB (`mcu_box1`), so nothing answers. Harmless |
| `SMART_STATUS 状态更新: MODE=… SCREEN=…` | QIDI's screen/print state sync |
| `[smart_output_pin caselight] 照明同步 … -> LIGHT=ON/OFF` | Automatic case light logic (see [lights](#fans-lights-and-outputs)) |
| `[neopixel RGB] UI_EVENT: Mode=Smart, Screen=Sleep…` | Automatic LED strip logic |
| `1C did not recognize the filament` | After a restart: the RFID reader found no QIDI tag on that slot's spool (normal for non-QIDI or untagged spools) |
| `Run Current: 0.90A Hold Current: 0.90A` / `1.07A` | Motor current switching during box/filament moves |
| `Flow completed successfully.` | A box flow (unload, eject, …) finished |
| `Sub status 'chamber_heating' not valid for main status 'print_start'` | Harmless status-name mismatch in QIDI's start sequence |

---

## QIDI Box: how slot data is stored

Slot data lives in Klipper's `save_variables` (`saved_variables.cfg`). **Slots are 0-based here** (`slot0` = the
box's slot 1); the box label, slicers and this repo's macros use 1-based numbers. Index `16` is the external spool.

| Variable | Meaning | Example |
|---|---|---|
| `filament_slot<N>` | QIDI filament ID (string) | `'QFA00'` = PLA Basic |
| `color_slot<N>` | color as a one-item list of hex | `['FAFAFA']` |
| `slot<N>` | slot state: `0` empty, `1` spool present, `3` filament re-inserted after an eject | `1` |
| `vendor_slot<N>` | legacy, appears unused | `1` |
| `value_t<T>` | tool → slot mapping used when printing | `'slot2'` |
| `enable_box` | `1` = print from the box, `0` = external spool | `1` |
| `box_count` | number of boxes | `1` |
| `last_load_slot`, `last_load_filament_id` | last slot loaded into the toolhead and its ID | `'slot16'` |
| `auto_read_rfid`, `auto_init_detect`, `auto_reload_detect` | box automation switches (RFID read on insert, feed on insert, auto refill on runout) | `1` |
| `box_drying_roll_enable` | rotate spools while drying | `1` |
| `runout_<N>`, `slot_sync`, `retry_step`, `load_retry_num` | internal state | |

- **Format history.** Current firmware stores IDs + hex. Older firmware stored list indexes (`filament_slot0 = 5`
  meaning entry `fila5` of `officiall_filas_list.cfg`). An **unset** slot still holds the integer `1` from the old
  format; `box_extras` then reports the default, PLA Basic white.
- **Stored type/color stay after a spool is removed.** Whether a spool is really there comes from the spool sensor.
- Writing these with Klipper's standard `SAVE_VARIABLE` updates the box **live** – `box_extras` shows the new name,
  vendor, temperatures and color immediately; no `UPDATE_FILAMENT_INFORMATION` call needed. This repo's
  `SET_SLOT_FILAMENT` macro relies on that.
- The firmware's material database ("MaterialDatabase loaded: 50 filaments, 24 colors, 2 vendors" in `klippy.log`)
  is loaded from `officiall_filas_list.cfg` and turns IDs into names and temperatures. Don't edit that file.
- **Filament IDs** match QIDI Studio's profiles (`resources/profiles/Q Series/filament/*.json`, field
  `filament_id`). Pattern: QFA = PLA, QFB = ABS/ASA, QFC = PC, QFG = PETG, QFL = other brands (Bambu, Hatchbox,
  PolyLite, Overture…), QFN = nylon, QFP = PPS, QFS = support, QFT = PET, QFU = TPU; `xx90`+ = Generic.
  56 IDs are listed in `printer/box_slots.cfg`.

## QIDI Box: live objects and sensors

- **`box_extras`** – the resolved view. Always lists 4 boxes; only `is_online: 1` ones are real.
  - `boxes[b].filament_info[i]`: `filament_id`, `vendor_str`, `filament_str`, `filament_type`, `color_rgb_str`
    (`["#FAFAFA"]`), `min_temp`/`max_temp` (nozzle), `box_min_temp`/`box_max_temp` (drying limit, e.g. ABS/ASA 45,
    PLA **0**), `info_from_rfid`, `read_rfid_state`.
  - `boxes[b].box_inserted_<i>`: **spool sensor**, 1 = spool in the slot. The saved `slot<N>` flag mirrors it.
  - `boxes[b].filament_inserted_<i>`: always 0 in every observation (meaning unknown).
  - `boxes[b].aht20_temp`, `aht20_humidity`: box air temperature and humidity.
  - `boxes[b].dry_state`, `box_target_temp`, `end_time`: dryer (see below).
  - `boxes[b].slots[]`: old index-format fields (`vendor`, `type`, `color_rgb` all `1`) – ignore.
  - Top level: `loaded_slot`, `last_load_slot`, `is_tool_change`, `auto_refill`, `buffer` (hall/photo sensors).
- **`loaded_slot`**: `slot0`–`slot15` for box slots, `slot16` for the external spool – **and also `slot16` when
  nothing is loaded** (confirmed by unloading everything). To tell "external" from "nothing", check the toolhead
  sensor:
- **`filament_switch_sensor filament_switch_sensor`** (pin `!THR:PA1`, on the toolhead board): `filament_detected`
  = filament in the toolhead. During prints `enabled` reads false (the start G-code runs `DISABLE_ALL_SENSOR`) but
  `filament_detected` keeps updating. Its runout G-code checks `enable_box`.
- **`box_stepper slot<i>`**: `runout_button` (0 = filament present at that slot's feeder, 1 = none), `rfid_state`.
  Exists only for real box slots (0–3 per box) – there is no `box_stepper slot16`.
- **`multi_color_controller`**: the same slot data flattened, plus task/operation state.
- RFID: `RFID_READ SLOT=slot<i>` is what QIDI's Fluidd sends to read a tag (not tested here).

## QIDI Box: unload, eject, load

```
UNLOAD_FILAMENT_CONTROL SLOT=<i>   ; pull filament out of the toolhead, park it in the tube (ready to reload)
EJECT_FILAMENT_CONTROL SLOT=<i>    ; pull filament fully out of the box feeder
LOAD_FILAMENT_CONTROL SLOT=<i>     ; feed filament from the slot to the toolhead
```

- `SLOT` is the **0-based** box slot index – the code looks up `box_stepper slot<SLOT>`. Without it:
  `// Error: Missing SLOT parameter.`; with text (`slot3`): `unable to parse slot3`.
- ⚠️ **The value is not validated.** `EJECT_FILAMENT_CONTROL SLOT=99` raised `Unknown config object
  'box_stepper slot99'` inside `multi_color_controller` and **shut Klipper down** (`RESTART` wasn't enough;
  `FIRMWARE_RESTART` recovered it). Only ever send real box slot indexes. Never send 16 (external).
- `UNLOAD_FILAMENT_CONTROL SLOT=99` did *not* crash: it logged "extruder has been manually disabled" and
  "Flow completed successfully" without moving anything.
- **Eject, tested** (slot 4 = `SLOT=3`, nothing in the toolhead): the printer **homed and moved the toolhead**,
  retracted the filament fully out of the box, and replied `// Flow completed successfully.` after ~36 s. The slot
  then read empty (`box_inserted_3` 0, `runout_button` 1). After pushing the filament back in: `box_inserted_3` 1,
  `runout_button` 0, saved `slot3` = **3** (it was 1 before) – inferred to mean "re-inserted, not yet fed to the
  ready position".
- QIDI's Fluidd enables its buttons like this: eject when `runout_button` is 0; unload only for the loaded slot;
  load when the spool is present and that slot isn't already loaded. The dashboard uses the same rules and also
  requires nothing else to be loaded before Load.
- `LOAD_FILAMENT_CONTROL` without arguments: `// Error: Missing SLOT parameter.` (same signature as the others).
- **Load, tested** (slot 4 = `SLOT=3`, PLA, nothing in the toolhead, X/Y already homed): about 100 s in total.
  1. Nozzle target set to **280 °C – even for PLA** (PLA's range is 190–240 °C); reached in ~60 s from 40 °C.
     One test only, but it looks like a fixed QIDI load temperature.
  2. `loaded_slot` switched from `slot16` to `slot3` (~65 s); the toolhead sensor (`filament_detected`) went true
     ~15 s later.
  3. Nozzle held at 280 °C ~20 s more (inferred: purge), then target 0 and `// Flow completed successfully.`
  Klipper stayed ready. Afterwards the dashboard correctly showed slot 4 "In toolhead" with Unload available.
- QIDI's wiki: unload all filament from the feeder before drying.

## QIDI Box: filament dryer

```
BOX_START_DRYING BOX=<n> TEMP=<°C> TIME=<hours>    ; box number is 1-based
BOX_STOP_DRYING BOX=<n>
```

- Found by testing. Replies: `// BOX_DRY started for BOX 1`, `// DISABLE_BOX_DRY for BOX 1`,
  `// No active heating for BOX 1` (stop when idle), `// Error: Missing parameters.` (as a console message).
  `BOX=0` is also accepted; `heater_box1` naming suggests 1-based is correct.
- `TIME` is in **hours**: `TIME=2` gave `end_time` 119 and it didn't change over a minute – `end_time` is
  **minutes left**.
- While drying: `boxes[b].dry_state` 1, `box_target_temp` = TEMP, and `heater_generic heater_box1` gets the target.
  After stop: target 0, power 0.
- QIDI's wiki: close the lid; trays rotate every 5 minutes (`box_drying_roll_enable`); box fans start above 35 °C;
  open the rear vent for a while after an hour or two to let moisture out, then close it. Spec max 65 °C.
- PLA: `box_max_temp` 0 – QIDI disables *manual* box heating with PLA loaded (auto drying still rotates spools).
- Related, not used here: `SET_BOX_TEMP_CONTROL`, `BOX_TEMP_SET`, `DISABLE_BOX_HEATER` (box temperature during a
  print); `EX_START_DRYING` / `EX_STOP_DRYING` dry spools **inside the printer** using bed + chamber, with presets in
  `drying.conf` (type, bed °C, chamber °C, minutes – e.g. PLA 70/55/720, ABS 90/60/720); `PREPARE_FILAMENT_DRY`
  (homes, raises Z to 250, moves Y to 320 – positions the bed for that).

---

## Printing with the box

- **Tool → slot mapping.** Before a print, the slot for each tool is saved as
  `SAVE_VARIABLE VARIABLE=value_t<T> VALUE="'slot<i>'"` (0-based `i`). The start G-code then runs
  `BOX_PRINT_START EXTRUDER=<first tool> HOTENDTEMP=<°C>`, which loads the slot mapped to that tool; tool changes
  use the mapping too.
- **If nothing sets the mapping, the printer reuses the last `value_t…` values** – e.g. a print sent with
  OrcaSlicer's "Upload and Print" can load the wrong spool. Set the mapping first (dashboard print dialog, QIDI's
  Fluidd dialog, the touchscreen, or `SAVE_VARIABLE` lines at the top of the slicer start G-code).
- QIDI's Fluidd fallback for files without a tool list: `T<i>` → slot `i`.
- `enable_box` 0 = everything prints from the external spool.
- QIDI start G-code uses custom commands: `SET_PRINT_STATS_INFO`, `SET_PRINT_MAIN_STATUS` / `SET_PRINT_SUB_STATUS`
  (drive the touchscreen), `DISABLE_ALL_SENSOR` / `ENABLE_ALL_SENSOR`, `M1002`, `M1004`, `M1006`, `CLEAR_PAUSE`,
  `G29.0`, `MOVE_TO_TRASH`, `EXTRUSION_AND_FLUSH HOTEND=…`, `M109.1` (wait while cooling), `probe samples=1`,
  `Z_TILT_ADJUST`, `G29`.
- Print files are usually `.gcode.3mf` (G-code inside a 3MF with plate thumbnails); `print_stats.plateindex` and
  `virtual_sdcard.plate_index` give the plate. Thumbnails: `.thumbs/<name>/plate_<n>.png` in the `gcodes` root.

## Slicers

- **QIDI Studio** files' metadata includes `used_extruders`; **OrcaSlicer** files don't, so derive the tools from
  `filament_type` / `preset_colours` (one entry per filament).
- **Chamber temperature variable:** QIDI Studio uses `[chamber_temperatures]`; OrcaSlicer needs
  `[overall_chamber_temperature]`. A `.3mf` project saved by QIDI Studio carries its own printer settings, so opening
  it in Orca gives `Variable does not exist … [chamber_temperatures]` even if your Orca profile is fixed – pick your
  own printer profile in Orca and discard the project's printer changes.
- Upload prints to the **`gcodes`** storage, never `config`.
- Orca's sliced metadata lists every filament configured in the project even if unused (0 g); check
  `; filament used [g] =` in the G-code header and the `T<n>` commands to see what's actually used.

## Heaters, sensors and power

| Object | What it is | Limits |
|---|---|---|
| `extruder` | nozzle, **MAX6675 thermocouple**, 0.4 mm | `max_temp` 375 °C, ~150 W |
| `heater_bed` | bed | `max_temp` 125 °C, ~500 W |
| `heater_generic chamber` | chamber heater | `max_temp` 68 °C, ~550 W |
| `temperature_sensor Chamber_Thermal_Protection_Sensor` | on the chamber heater itself (not the air) | shuts down above 170 °C; reads ~140 °C while the heater runs at 100 % – normal |
| `heater_generic heater_box1` | QIDI Box dryer, controlled by the box's AHT20 air sensor | target up to 90 °C (config), spec 65 °C, ~245 W |
| `temperature_sensor heater_temp_a_box1` / `_b_box1` | probes on the box's two heater + fan units (inferred: on the elements) | shut down above 130 °C |

- Wattages above are the owner's measured/rated figures. All heaters at once ≈ 1445 W.
- To stay under ~1000 W at startup (UPS / shared circuit), heat sequentially: bed (wait) → chamber (wait) → nozzle.
  The repo's Orca profile does this.
- `heaters.available_sensors` lists all of the above; Moonraker's `server.temperature_store` has ~20 min history.

## Fans, lights and outputs

| Object | What it is |
|---|---|
| `fan_generic cooling_fan` | **part cooling fan** (there's no `[fan]` object) – `M106 P0` / `M107` |
| `fan_generic auxiliary_cooling_fan` | auxiliary (side) part cooling – `M106 P2` |
| `fan_generic chamber_circulation_fan` | chamber exhaust/circulation – `M106 P3` |
| `output_pin polar_cooler` | optional cooler accessory (on/off) – `M106 P4`; hidden when `enable_polar_cooler` is 0 |
| `heater_fan hotend_fan` | hotend fan, automatic |
| `controller_fan chamber_fan`, `controller_fan board_fan` | automatic |
| `box_heater_fan heater_fan_a_box1` / `_b_box1`, `controller_fan board_fan_box1` | QIDI Box fans, automatic (heater fans start above 35 °C) |
| `output_pin caselight` + `smart_output_pin caselight` | case light. With smart mode on, the printer switches it by itself (e.g. off when the screen sleeps). `SET_PIN PIN=caselight VALUE=0/1` works but can be overridden |
| `neopixel RGB` | 25-LED strip (GRB) with QIDI's "smart" modes (`NEOPIXEL_MODE`, `NEOPIXEL_ENABLE`, breathing effects) |
| `output_pin beeper` | buzzer (`M300`, `BEEP_ON/OFF`) |

- ⚠️ **`M106 P3 S<anything above 0>` also sets the chamber heater target to 0** (QIDI's `M106` macro in
  `klipper-macros-qd/fans.cfg`). Running the chamber fan turns chamber heating off; QIDI's start G-code only
  enables the fan when the chamber target is 0.
- `M106 S…` without `P` controls the part fan. `SET_FAN_SPEED FAN=<name> SPEED=0..1` works for all `fan_generic`.

## Motion, probe and calibration

- Probe: `[probe_air]`, sensor type `c_sensor` on the toolhead board, `z_offset` −0.075, 2 samples averaged.
- Bed mesh 7×7 from (15, 15) to (305, 305); KAMP adaptive meshing/purge macros are included.
- Accelerometer: `lis2dw` on the toolhead board (`axes_map: y, z, -x`). Input shaper results are saved in
  `printer.cfg`'s SAVE_CONFIG block.
- `idle_timeout` is **43200 s (12 h)** – heaters turn off after 12 h idle.
- The bed mesh and input shaper are written to the auto-saved block at the end of `printer.cfg` – machine-specific;
  never copy them to another printer.

## Camera

- crowsnest + ustreamer, 640×480 @ 15 fps (5 fps idle), behind nginx: stream `http://<printer-ip>/webcam/?action=stream`,
  snapshot `…/webcam/?action=snapshot`. Moonraker lists it under `server.webcams.list`.
- Each open stream costs printer CPU; the dashboard only streams while its camera panel is open and visible.

## QIDI's Fluidd: what doesn't work

QIDI's Fluidd build (v1.30.5) was written for the old index-based slot format:

- **Control Box panel shows `?` for every slot.** It runs `parseInt` on `filament_slot<N>` / `color_slot<N>` and looks
  up `fila<number>` / `colordict[<number>]`; IDs like `QFA00` become `NaN`. Can't be fixed by config.
- **Vendor / Filament / Color dropdowns write old-format numbers**, which the firmware treats as "not set" – don't use.
- **Print dialog with the box can't map slots** (it filters slots by type, which it can't read).
- **Uninstall / Load / Unload buttons send `E_BOX` / `E_LOAD` / `E_UNLOAD slot=<i>`** – those commands don't exist on
  current firmware.
- Spool presence greying still works (it uses `box_stepper … runout_button`).
- The dashboard in this repo replaces all of the above.

## Firmware updates

- QIDI updates **replace `printer.cfg`** (the old one is kept as `printer-<date>.cfg`). Re-add
  `[include box_slots.cfg]` after `[include box.cfg]` and `RESTART`. Extra files like `box_slots.cfg` normally survive.
- If QIDI changes the slot data format again, re-check `save_variables` and `box_extras` as described above;
  `LIST_SLOT_FILAMENTS` and the dashboard will show anything odd.
- QIDI's dated `printer-<date>.cfg` copies accumulate in the config folder.

## Testing safely

Rules that came out of working on this machine:

1. Test only with the printer **idle** (`print_stats.state` = `standby`), and say so in your notes.
2. Read replies from `/server/gcode_store` – QIDI commands often "succeed" while printing an error to the console.
3. Probe unknown commands **without arguments first**; they usually answer with the missing parameter name.
   For commands that move filament or motors, **don't probe with out-of-range values** – QIDI's code may not
   validate them (see the eject crash above).
4. For heaters, use low temperatures and short times, and confirm they're off afterwards (target 0, power 0).
5. Know the recovery: `RESTART`, and `FIRMWARE_RESTART` if a board is shut down.
6. Back up any config file before uploading a change, and verify the upload.

## Open questions and untested

- `UNLOAD_FILAMENT_CONTROL` on a really loaded spool (should park it in the tube) – not yet run on hardware.
- Load temperature: is 280 °C fixed, or taken from the box or filament settings? (One PLA test so far.)
  Does Load move the toolhead to the purge/trash position (X/Y were already homed in the test)?
- `RFID_READ`, `READ_RFID`, `INIT_RFID_READ`, `UPDATE_FILAMENT_INFORMATION` – parameters
  and effects not tested.
- Full-length box drying session (only short start/stop tests so far).
- Saved `slot<N>` = 3 meaning ("re-inserted after eject") is inferred from one test.
- `filament_inserted_<i>` always reads 0 – purpose unknown.
- Behavior with more than one box (RS-485 chaining via `box485`) – only one USB-connected box here.
- Whether PC-side slot changes show up in OrcaSlicer's "Sync filament".
- The 1-based vs 0-based `BOX=` in the dryer commands (both accepted with one box).
