# QIDI Plus 5 Dashboard – Angular source

Angular 22 version of the dashboard (standalone components, signals, zoneless change detection).
The built app is committed in [`../dashboard/ng/`](../dashboard/ng), so you only need this folder to change it.

## Build

Requires Node.js 22.22+ or 24.15+.

```bash
npm install
npx ng build          # outputs to ../dashboard/ng (served at http://localhost:8765/ng/)
```

For live reload while editing: `npx ng serve`, then open `http://localhost:4200/ng/?printer=<printer-ip>`
(Moonraker allows pages from any `localhost` port).

## Layout

| Path | What |
|---|---|
| `src/app/core/moonraker.service.ts` | Websocket JSON-RPC connection; printer objects as a `status` signal (batched 4×/s) |
| `src/app/core/settings.service.ts` | Printer address and collapsed cards (localStorage, shared with the original page) |
| `src/app/core/thermal-history.service.ts` | 10-minute temperature history and 10 s power averages |
| `src/app/core/files.service.ts` | G-code files, print history, file metadata cache, thumbnails |
| `src/app/core/box.ts` | Box slot helpers (slot list, loaded slot + toolhead sensor, macro filament IDs) |
| `src/app/core/constants.ts` | Filament names, color presets, heater wattages, sensor order |
| `src/app/shared/card.ts` | Collapsible panel |
| `src/app/panels/*` | One component per panel, plus the slot card and print dialog |
| `src/styles.css` | Global styles (same look as the original page) |
