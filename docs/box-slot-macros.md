# Box slot macros (`printer/box_slots.cfg`)

Slots are numbered **1–16** as printed on the box (box 1 = slots 1–4). `SLOT=EXT` (or `17`) is the external
spool holder.

## `SET_SLOT_FILAMENT`

```
SET_SLOT_FILAMENT SLOT=3 FILAMENT=PLA_BASIC COLOR=FFFFFF
SET_SLOT_FILAMENT SLOT=1 FILAMENT=QFB54 COLOR=BLACK
SET_SLOT_FILAMENT SLOT=EXT FILAMENT=GENERIC_PETG
SET_SLOT_FILAMENT SLOT=2 COLOR=2850FF          # change only the color
```

- `FILAMENT` – a name (`PLA_BASIC`, `PETG_BASIC`, `GENERIC_PLA`, `ABS_RAPIDO`, `BAMBU_PLA`, …) or a QIDI ID (`QFA00`).
  `LIST_FILAMENT_TYPES` prints all 56.
- `COLOR` – 6 hex digits **without `#`** (Klipper drops everything after `#` in a command), or a name:
  WHITE, BLACK, GREY/GRAY, SILVER, RED, ORANGE, YELLOW, GREEN, LIME, BLUE, NAVY, PURPLE, PINK, BROWN, BEIGE,
  GOLD, TEAL, CYAN.
- Either one can be left out to change only the other.
- Rejected with a clear error (also shown on the touchscreen): unknown filament, bad color, slot 0 / text,
  slots on a box that isn't connected (e.g. `SLOT=5` with one box). Nothing is written on an error.
- Writes `filament_slot<N-1>` and `color_slot<N-1>` with Klipper's `SAVE_VARIABLE` – the same data the touchscreen
  uses. The box picks it up immediately; no refresh command is needed.

## `LIST_SLOT_FILAMENTS`

Shows each slot of each connected box plus the external spool. Slots where the box's spool sensor sees no
spool are shown as `empty (last set: …)`, because the stored type/color stays after a spool is removed.

## `LIST_FILAMENT_TYPES`

Lists the accepted `FILAMENT` names with their IDs, and the color names.

## `AUTO_BOX_TEMP` – box temperature during a print

OrcaSlicer has no box temperature setting, so the box never heats during an Orca print. Add one line to the
slicer's **start G-code, after the nozzle has reached temperature** (the included Orca profile has it right after
`ENABLE_ALL_SENSOR`):

```
AUTO_BOX_TEMP
```

Nothing to enter per print – it works it out from the spools in the box:

- Looks at every spool **physically in the box** (the heat reaches all of them, used or not).
- Uses QIDI's own drying limit for each filament (`box_max_temp` from the printer's material database,
  e.g. ABS/ASA 45 °C, PA12-CF 65 °C).
- Sets the box to the **lowest** of those limits. If any spool has no limit – QIDI uses 0, e.g. for PLA – the
  heater stays **off** (QIDI's own rule: no box heating with PLA inside).
- Replies on the console, e.g. `AUTO_BOX_TEMP box 1: slot 1 ABS Rapido max 45 C, slot 3 PLA Basic no box heating -> heater off`.
- A watcher turns the box heater **off within a minute once no print is running** – after a finished, cancelled
  or failed print. (QIDI's `DISABLE_BOX_HEATER` in the end G-code does *not* switch off a heater set this way.)

Options: `SLOTS=1,2` only consider those slots, `MAX=40` cap the temperature, `OFF=1` turn the box heater off now.

Why it's after the nozzle heats: the box heater is ~245 W; starting it then keeps the startup power peak low
(see the UPS-safe start G-code in [orcaslicer.md](orcaslicer.md)).

## Filament IDs

Taken from QIDI Studio's profiles (`resources/profiles/Q Series/filament/*.json`, field `filament_id`).
Pattern: QFA = PLA, QFB = ABS/ASA, QFC = PC, QFG = PETG, QFL = other brands, QFN = nylon, QFP = PPS,
QFS = support, QFT = PET, QFU = TPU; `xx90`+ = Generic.

## Writing Klipper macros for this printer

- **`#` starts a comment in Klipper config files, even inside macro code.** A `replace('#', '')` in a macro
  cuts the line and halts the printer with a template error. Never put `#` or `;` in macro code.
- Any `!!` error in the console pops up on the touchscreen. Harmless.
