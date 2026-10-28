# Releasing a new version of the dashboard

Non-technical users download `QIDI-Plus-5-Dashboard-v<version>.zip` from the GitHub Releases page. It contains
the built app (`app/`), `serve.ps1`, `Open Dashboard.bat` and `README-FIRST.txt` – no Node.js or git needed.

## Steps

1. Bump the version in **both** places (the packaging script refuses to run if they differ):
   - `angular/package.json` → `"version"`
   - `angular/src/app/core/constants.ts` → `APP_VERSION` (shown in the dashboard's top bar)
2. Build and check locally:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/package.ps1
   ```
   This runs `npm run build` (which also copies `printer/box_slots.cfg` into the app) and writes
   `dist/QIDI-Plus-5-Dashboard-v<version>.zip`. Unzip it somewhere new and try `Open Dashboard.bat`.
3. Commit (including the rebuilt `dashboard/app/`), then tag and push:
   ```bash
   git tag v<version>
   git push origin v<version>
   ```
4. The **Release dashboard** GitHub Action builds the zip on Windows, checks the tag matches the version, and
   publishes a GitHub Release with the zip attached. You can also run it by hand from the Actions tab
   (it then only keeps the zip as a workflow artifact, no release).

## Notes

- `printer/box_slots.cfg` is the single source of the macros. The build copies it into the app so the
  dashboard's **Set up slot editing** / **Update macros** button installs exactly that version. Changing the
  macros means a new release; users then see "A newer version of the slot macros is available".
- The zip is Windows-only (the launcher is PowerShell). Downloaded `.bat` files can trigger a Windows
  SmartScreen or "Security Warning" prompt; `README-FIRST.txt` explains how to continue.
- Keep personal information out of releases too (see [CLAUDE.md](../CLAUDE.md)).
