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

## Filament IDs

Taken from QIDI Studio's profiles (`resources/profiles/Q Series/filament/*.json`, field `filament_id`).
Pattern: QFA = PLA, QFB = ABS/ASA, QFC = PC, QFG = PETG, QFL = other brands, QFN = nylon, QFP = PPS,
QFS = support, QFT = PET, QFU = TPU; `xx90`+ = Generic.

## Writing Klipper macros for this printer

- **`#` starts a comment in Klipper config files, even inside macro code.** A `replace('#', '')` in a macro
  cuts the line and halts the printer with a template error. Never put `#` or `;` in macro code.
- Any `!!` error in the console pops up on the touchscreen. Harmless.
