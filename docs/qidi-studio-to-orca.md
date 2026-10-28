# Migrating from QIDI Studio to OrcaSlicer (QIDI Plus 5 + QIDI Box)

How this printer was moved from QIDI Studio to OrcaSlicer, what had to change, and the traps found along the
way. The approach: **create a new printer in Orca based on Orca's own X-Plus 5 profile, then copy the custom
G-code over from QIDI Studio** and fix the few things Orca names differently.

Versions used: QIDI Studio 2.07.02, OrcaSlicer **2.5.0-dev nightly build** (October 2026).

## 1. Use an Orca build that knows the X-Plus 5

**The current stable OrcaSlicer (v2.4.2, July 2026) has no QIDI X-Plus 5 printer profile.** Orca added it on
7 August 2026, after that release. It's in:

| Build | X-Plus 5 profile |
|---|---|
| v2.4.2 (latest stable) | no |
| v2.5.0-alpha (16 Oct 2026) | yes |
| v2.5.0-beta (27 Oct 2026) | yes |
| nightly builds | yes (used here) |

So until 2.5.0 is released as stable, install the beta or a nightly from
[OrcaSlicer's releases page](https://github.com/OrcaSlicer/OrcaSlicer/releases). Nightlies change daily and can
have bugs; keep a copy of your presets (see [backups](#backups)).

Orca's built-in X-Plus 5 profile is a port of QIDI Studio's: same start, filament-change and end G-code,
including the QIDI Box commands (`BOX_PRINT_START`, `TOOL_CHANGE_START`, `CUT_FILAMENT`, `UNLOAD_T…`). The only
differences are the chamber variable name (below) and an `{if current_extruder != next_extruder}` guard around the
filament-change G-code.

## 2. Create the printer in Orca

1. In Orca's setup wizard (or **Printer → Add/Remove printers**) select **Qidi → Qidi X-Plus 5**, 0.4 nozzle.
2. Select that printer, change what you need (step 3), then **save it as a user preset** with your own name
   (e.g. "Qidi X-Plus 5 0.4 nozzle - UPS Safe"). It inherits everything else from Orca's profile.

Preset names differ between the apps: QIDI Studio's system printer is **"X-Plus 5 0.4 nozzle"**, Orca's is
**"Qidi X-Plus 5 0.4 nozzle"**. That matters for filament presets ([step 5](#5-filament-presets)).

## 3. Copy the G-code from QIDI Studio

QIDI Studio presets live in `%APPDATA%\QIDIStudio\`:
- your printers: `user\default\machine\*.json`
- QIDI's stock profile: `system\X 5 Series\machine\Qidi X-Plus 5 0.4 nozzle.json` (+ `fdm_machine_x_common.json`)

Each field is also visible in QIDI Studio under **Printer settings → Machine G-code**. Copy into the same field of
the Orca printer:

| Field | What was done |
|---|---|
| Machine start G-code | Copied from the QIDI Studio user printer (custom "UPS safe" version), then fixed (below) |
| Change filament G-code | Copied from QIDI Studio – identical to QIDI's stock version |
| Machine end G-code | Left as Orca's – it's identical to QIDI Studio's |

### Fix the chamber temperature variable (required)

QIDI Studio's G-code uses `[chamber_temperatures]`. **Orca doesn't have that variable** – slicing fails with:

```
machine_start_gcode Parsing error at line 19: Variable does not exist
M141 S[chamber_temperatures]
```

Replace every use (4 lines in the X-Plus 5 start G-code):

| QIDI Studio | Orca (used here) | Orca built-in profile uses |
|---|---|---|
| `M141 S[chamber_temperatures]` | `M141 S[overall_chamber_temperature]` | `M141 S[chamber_temperature]` |
| `M191 S[chamber_temperatures]` | `M191 S[overall_chamber_temperature]` | `M191 S[chamber_temperature]` |
| `{if chamber_temperatures[0] == 0}` | `{if overall_chamber_temperature == 0}` | `{if chamber_temperature[0] == 0}` |

`overall_chamber_temperature` is the highest chamber temperature of all filaments in the print;
`chamber_temperature` is per filament (`[chamber_temperature]` = the first one). For multi-material prints the
overall value is the safer choice.

Every other placeholder in QIDI's G-code works in Orca unchanged (`[bed_temperature_initial_layer_single]`,
`[initial_no_support_extruder]`, `{nozzle_temperature_range_high[...]}`, `[total_layer_count]`,
`{flush_length_1}`, `{retraction_distances_when_cut[...]}`, `[during_print_exhaust_fan_speed]`, …).

### Optional: the "UPS safe" sequential heating

The start G-code in [`orcaslicer/`](../orcaslicer) heats **bed (wait) → chamber (wait) → nozzle** instead of
QIDI's bed + chamber at the same time, keeping startup draw under ~1000 W (nozzle 150 W, bed 500 W, chamber
550 W). See [orcaslicer.md](orcaslicer.md).

### Optional: fixed box slot mapping

The Orca printer here also starts with:

```gcode
SAVE_VARIABLE VARIABLE=value_t0 VALUE="'slot0'"
SAVE_VARIABLE VARIABLE=value_t1 VALUE="'slot1'"
SAVE_VARIABLE VARIABLE=value_t2 VALUE="'slot2'"
SAVE_VARIABLE VARIABLE=value_t3 VALUE="'slot3'"
```

so Orca filaments 1–4 always come from box slots 1–4 (left to right). Why it helps: QIDI Studio and the
touchscreen ask which slot feeds each filament before printing; **Orca's "Upload and Print" doesn't**, and the
printer would otherwise reuse whatever mapping the last print used. The catch: you must keep Orca's filament list
in the same order as the box, and it overrides the slot choice made in the dashboard's print dialog.

## 4. Connect Orca to the printer

1. **Printer settings → Connection** (or the Wi-Fi/connection icon): host type **Moonraker**, address = the
   printer's IP (no port needed; Moonraker is on 7125 and also behind nginx on 80). No API key – the printer
   trusts the local network.
2. When sending, choose storage **gcodes** (the print folder). **Never `config`** – that's the printer's settings
   folder.
3. Orca's device tab can show Fluidd, but QIDI's Fluidd box panel doesn't work with current firmware – see
   [machine-notes.md](machine-notes.md#qidis-fluidd-what-doesnt-work). Use the dashboard in this repo.

## 5. Filament presets

- Orca has QIDI's filaments built in (`QIDI PLA Basic @Qidi X-Plus 5 0.4 nozzle`, `QIDI ABS Rapido @…`, …).
- **Custom filament presets made in QIDI Studio are tied to QIDI Studio's printer name** (`compatible_printers:
  X-Plus 5 0.4 nozzle`). Imported into Orca as-is, they **don't show up** for Orca's printer
  (`Qidi X-Plus 5 0.4 nozzle`). Recreate them in Orca, or re-import and set the compatible printer to the Orca one.
  (Here the PA12-CF preset exists in both forms; only the `@Qidi X-Plus 5 0.4 nozzle` one is used.)
- Custom filament presets get a random `filament_id` (e.g. `P039…`). The QIDI Box only knows QIDI IDs (`QFxxx`),
  so on the box/dashboard set the slot to the closest QIDI or Generic type; slot matching uses the filament *type*.
- Custom QIDI Studio filaments to recreate: check `%APPDATA%\QIDIStudio\user\default\filament\`.

## 6. Projects (.3mf) saved in QIDI Studio

A `.3mf` project stores its **own copy of the printer settings**. Opening a QIDI Studio project in Orca brings
QIDI Studio's start G-code back – including `[chamber_temperatures]` – so you get the "Variable does not exist"
error even though your Orca printer is fixed.

Fix per project: pick **your Orca printer** in the Printer dropdown, choose **Discard** for the project's changed
printer settings, slice, then **Save Project** (it's now an Orca project). Don't bulk-edit QIDI Studio projects –
they'd then fail in QIDI Studio.

## 7. Differences you'll notice after switching

- **No tool list in Orca files.** QIDI Studio writes `used_extruders` into the file metadata; Orca doesn't. Tools
  that read it (QIDI's Fluidd, the dashboard) fall back to `filament_type` / `preset_colours` – one entry per
  filament in the project, even unused ones.
- **Orca lists every filament in the project**, used or not (0 g). Check `; filament used [g] =` in the G-code
  header or the `T<n>` commands to see what a print really uses.
- **Upload and Print doesn't set the box slot mapping** (see step 3).
- Print files keep the `.gcode.3mf` format with plate thumbnails, so the printer, touchscreen and dashboard show
  them the same way.
- **No box temperature during prints.** QIDI Studio's filament profiles have a "box temperature" and QIDI Studio
  writes `DISABLE_BOX_HEATER` + `BOX_TEMP_SET VT0=<°C> …` into every print. Orca has no such setting and writes
  nothing, so the box never heats during an Orca print. **Fix:** add the line `AUTO_BOX_TEMP` to the Orca printer's
  start G-code after the nozzle has reached temperature (needs this repo's `box_slots.cfg`). It picks the box
  temperature automatically from the spools in the box – nothing to enter per print. See
  [box-slot-macros.md](box-slot-macros.md#auto_box_temp--box-temperature-during-a-print).
- Unconfirmed: whether Orca's "Sync filament" reads the box's slot data correctly.

## 8. Check your first slice

Before printing, open the sliced G-code (or the preview's G-code viewer) and check:

- [ ] `M141 S<number>` and `M191 S<number>` have the chamber temperature you expect (0 = no chamber heating).
- [ ] `BOX_PRINT_START EXTRUDER=<n> HOTENDTEMP=<°C>` is there (box prints).
- [ ] With the slot mapping lines: `SAVE_VARIABLE VARIABLE=value_t0 VALUE="'slot0'"` … at the top.
- [ ] Only the `T<n>` tools you expect appear, and `; filament used [g] =` shows grams only for those.
- [ ] Bed / nozzle temperatures match the filament.

## Backups

- Orca: `%APPDATA%\OrcaSlicer\user\default\` (`machine`, `filament`, `process`). Orca also keeps
  `user_backup-v<version>` folders when it upgrades.
- QIDI Studio: `%APPDATA%\QIDIStudio\user\default\`.
- The Orca printer used here is in [`orcaslicer/`](../orcaslicer) (printer address removed).
