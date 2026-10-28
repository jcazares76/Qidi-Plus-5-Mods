# Stock QIDI config (reference)

The printer's config folder as shipped by QIDI firmware, taken before any change in this repo. Kept for
reference and to undo changes.

Removed or changed for publishing:
- USB serial numbers of the main board, box board and camera replaced with `<main-mcu-serial>`,
  `<box-mcu-serial>` and `<camera-id>`.
- `saved_variables.cfg` (machine state) and QIDI's dated `printer-<date>.cfg` backups left out.
- The bed mesh at the end of `printer.cfg` is machine-specific calibration – don't copy it to another printer.

The only change this repo makes to `printer.cfg` is one line after `[include box.cfg]`:

```ini
[include box_slots.cfg]         # computer-side box slot editing (SET_SLOT_FILAMENT)
```

The other files are QIDI's and the bundled third-party macro packages' (KAMP, klipper-macros, timelapse),
with their own copyright notices.
