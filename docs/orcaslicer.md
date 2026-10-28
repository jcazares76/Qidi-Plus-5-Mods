# OrcaSlicer (`orcaslicer/`)

## The "UPS Safe" printer profile

[`Qidi X-Plus 5 0.4 nozzle - UPS Safe.json`](../orcaslicer/Qidi%20X-Plus%205%200.4%20nozzle%20-%20UPS%20Safe.json)
is a user printer profile based on Orca's built-in "Qidi X-Plus 5 0.4 nozzle". Its start G-code
([readable copy](../orcaslicer/start-gcode-ups-safe.gcode)) heats **one thing at a time** so the printer's
startup draw stays under ~1000 W (useful on a UPS or a shared circuit):

1. Bed – heat and **wait** for full temperature.
2. Chamber – heat and wait (`M141`/`M191`; instant if the target is 0).
3. Only then the nozzle (via `BOX_PRINT_START` / `EXTRUSION_AND_FLUSH`).

Rated heaters for reference: nozzle 150 W, bed 500 W, chamber 550 W, box heater 245 W.

It also **hard-codes the slot mapping** at the very top:

```gcode
SAVE_VARIABLE VARIABLE=value_t0 VALUE="'slot0'"
SAVE_VARIABLE VARIABLE=value_t1 VALUE="'slot1'"
SAVE_VARIABLE VARIABLE=value_t2 VALUE="'slot2'"
SAVE_VARIABLE VARIABLE=value_t3 VALUE="'slot3'"
```

So Orca filament 1–4 always feed from box slots 1–4 (left to right), no matter how the print was started.
Order your Orca filament list to match the box. This overrides the slot picker in the dashboard's print dialog.

### Import

Copy the `.json` into `%APPDATA%\OrcaSlicer\user\default\machine\` (or use **File → Import → Import Configs**),
restart Orca, then set the printer's address under **Printer settings → Connection** (the address is left
empty in this repo).

## Error: `Variable does not exist … [chamber_temperatures]`

```
machine_start_gcode Parsing error at line 19: Variable does not exist
M141 S[chamber_temperatures]
```

QIDI Studio's start G-code uses `[chamber_temperatures]`; OrcaSlicer calls it `[overall_chamber_temperature]`.

- The profile in this repo already uses the Orca name.
- The error still appears when you open a **project saved by QIDI Studio** in Orca: a `.3mf` project carries its
  own copy of the printer settings, which overrides your profile. Fix: in Orca pick your own printer profile in
  the **Printer** dropdown, choose **Discard** for the project's changed settings, slice, and **Save Project**.
- Don't bulk-edit QIDI Studio projects to the Orca name – they would then fail in QIDI Studio.

## Uploading from Orca

In **Send G-code to printer host**, choose storage **gcodes** (the print folder). **config** is the printer's
settings folder – never upload prints there.

Before using **Upload and Print** with the box, check which slot each filament will come from: Orca doesn't
set the mapping, so the printer uses the last `value_t…` values unless your start G-code sets them
(the UPS Safe profile does).
