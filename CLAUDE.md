# Rules for this repo

This repository is **public**. Never commit personal information. That includes:

- Names, usernames, emails, home directory, synced-drive or other local paths (e.g. `C:\Users\<name>\...`)
- IP addresses, hostnames, network names, or anything identifying the owner's network
- Device serial numbers and unique IDs (MCU serials, `/dev/serial/by-id/...` names, camera IDs, RFID/UUIDs)
- Printer nicknames, print file names or project names from the owner's own prints
- Saved printer state (`saved_variables.cfg` values), logs, or screenshots that show any of the above

Use placeholders instead (`<printer-ip>`, `<mcu-serial>`, `printer.local`) and keep the code configurable
(the dashboard asks for the printer address instead of hard-coding one).

Before every commit, search the staged files for IPs, serials, paths and names, and fix anything found.

# Machine knowledge

[`docs/machine-notes.md`](docs/machine-notes.md) is the log of everything specific to the QIDI Plus 5 + QIDI Box
(commands, data formats, quirks, crashes, safe testing rules). Read it before touching the printer, and add to it
whenever you learn something new about the machine – including what was tested, how, and what's still unconfirmed.
