# QIDI Plus 5 Dashboard – Angular source

Angular 22 version of the dashboard (standalone components, signals, zoneless change detection).
The built app is committed in [`../dashboard/app/`](../dashboard/app) (served by `../dashboard/serve.ps1`), so you only need this folder to change it.

## Build

Requires Node.js 22.22+ or 24.15+.

```bash
npm install
npm run build         # outputs to ../dashboard/app (served at http://localhost:8765/)
```

Use `npm run build` / `npm start`, not `npx ng …` directly: the `prebuild` / `prestart` scripts copy
`../printer/box_slots.cfg` into `public/` so the one-click macro setup installs that exact file
(`public/box_slots.cfg` is git-ignored).

For live reload while editing: `npm start`, then open `http://localhost:4200/?printer=<printer-ip>`
(Moonraker allows pages from any `localhost` port). "Find my printer" falls back to common home networks there,
since only `serve.ps1` can report the PC's own network.

Packaging the download zip: see [../docs/releasing.md](../docs/releasing.md).

## Layout

| Path | What |
|---|---|
| `src/app/core/moonraker.service.ts` | Websocket JSON-RPC connection; printer objects as a `status` signal (batched 4×/s) |
| `src/app/core/settings.service.ts` | Printer address and collapsed cards (localStorage) |
| `src/app/core/thermal-history.service.ts` | 10-minute temperature history and 10 s power averages |
| `src/app/core/files.service.ts` | G-code files, print history, file metadata cache, thumbnails |
| `src/app/core/box.ts` | Box slot helpers (slot list, loaded slot + toolhead sensor, macro filament IDs) |
| `src/app/core/constants.ts` | Filament names, color presets, heater wattages, sensor order |
| `src/app/core/macro-installer.service.ts` | One-click install/update of `box_slots.cfg` with backup, restart, verify and rollback |
| `src/app/core/filament-ops.service.ts` | Load / unload / eject (only ever sends real box slot indexes) |
| `src/app/shared/card.ts` | Collapsible panel |
| `src/app/shared/find-printer-dialog.ts` | "Find my printer" network scan |
| `src/app/panels/*` | One component per panel, plus the slot card, dryer, macro setup and print dialog |
| `src/styles.css` | Global styles (Fluidd-like dark theme) |
