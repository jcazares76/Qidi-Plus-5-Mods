# Install and undo

Everything is done through Moonraker's web API or Fluidd's file manager. SSH is not needed.

## 1. Back up

In Fluidd: **Configuration** → select all files in the config folder → **Download**. Keep that zip.
This repo only contains the files that change; everything else stays as QIDI ships it.

## 2. Add the macros

1. Upload [`printer/box_slots.cfg`](../printer/box_slots.cfg) to the printer's config folder
   (Fluidd → Configuration → Upload).
2. Open `printer.cfg` and add this line directly after `[include box.cfg]`:

   ```ini
   [include box_slots.cfg]         # computer-side box slot editing (SET_SLOT_FILAMENT)
   ```

   That is the only change to `printer.cfg` ([modified copy](../printer/printer.cfg),
   [original](../printer/original/printer.cfg) – don't overwrite your
   own `printer.cfg` with it; your printer's calibration section is at the end of yours). Nothing else in
   QIDI's files is modified, and `moonraker.conf` is not changed.
3. Save, then send `RESTART` from the console. **Try `RESTART` first** – `FIRMWARE_RESTART` once failed on this
   printer with "Failed automated reset of MCU 'mcu'". If Klipper reports that a board (MCU) is shut down,
   `RESTART` isn't enough; then use `FIRMWARE_RESTART` (or power-cycle the printer).
4. Wait until Klipper reports ready, then run `LIST_SLOT_FILAMENTS` to check.

If Klipper shows an error after the restart, re-upload your backup `printer.cfg` and `RESTART` again.

## Upload from a script (optional)

```bash
curl -F "root=config" -F "file=@printer/box_slots.cfg;filename=box_slots.cfg" http://<printer-ip>:7125/server/files/upload
curl -X POST "http://<printer-ip>:7125/printer/gcode/script?script=RESTART"
curl http://<printer-ip>:7125/printer/info      # wait for "state": "ready"
```

Note for Windows: use a normal Windows path for the `@file` part. Git Bash style paths (`/c/...`) can make
curl.exe upload nothing without an error.

## After a QIDI firmware update

QIDI updates replace `printer.cfg` (the old one is kept as `printer-<date>.cfg`). Re-add the include line
after `[include box.cfg]` and `RESTART`. `box_slots.cfg` normally survives; check it's still in the config folder.
If QIDI changes the slot data format again, `LIST_SLOT_FILAMENTS` and the dashboard will show it – see
[machine-notes.md](machine-notes.md#qidi-box-how-slot-data-is-stored) for what to re-check.

## Undo

Remove the include line from `printer.cfg`, delete `box_slots.cfg`, `RESTART`. The dashboard's slot editor
stops working without the macros; everything else in the dashboard keeps working.
