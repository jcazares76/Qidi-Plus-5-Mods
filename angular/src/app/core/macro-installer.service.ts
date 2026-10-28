import { Injectable, inject, signal } from '@angular/core';
import { MoonrakerService } from './moonraker.service';

/** missing = not loaded; outdated = the app's copy is newer; newer = the printer's copy is newer than the app's. */
export type MacroState = 'unknown' | 'missing' | 'installed' | 'outdated' | 'newer';

/** `variable_version: N` in [gcode_macro _BOX_SLOT_DATA]; files from before versioning count as 1. */
export function macroVersion(text: string | null): number {
  const m = /^variable_version:\s*(\d+)/m.exec(text ?? '');
  return m ? Number(m[1]) : 1;
}

export interface InstallPlan {
  printerCfg: string;
  newPrinterCfg: string | null; // null = include line already there
  includeLine: string;
  afterLine: { n: number; text: string } | null; // where the include goes (1-based line in printer.cfg)
  backupName: string;
  hadMacroFile: string | null; // previous box_slots.cfg on the printer, if any
}

const INCLUDE = '[include box_slots.cfg]         # computer-side box slot editing (SET_SLOT_FILAMENT)';
const IDLE_STATES = ['standby', 'complete', 'cancelled', 'error'];

/**
 * One-click install / update of printer/box_slots.cfg (bundled with the app):
 * back up printer.cfg → upload box_slots.cfg → add the include line → RESTART → check the macros loaded.
 * If Klipper doesn't come back ready, the original files are put back and Klipper restarted again.
 */
@Injectable({ providedIn: 'root' })
export class MacroInstallerService {
  private readonly mr = inject(MoonrakerService);

  readonly state = signal<MacroState>('unknown');
  /** Macro file versions: the app's bundled copy and the printer's (0 = none on the printer). */
  readonly versions = signal({ app: 0, printer: 0 });
  readonly busy = signal(false);
  readonly progress = signal('');

  constructor() {
    this.mr.ready.subscribe(() => this.check());
  }

  /** Bundled box_slots.cfg (copied from printer/ at build time). */
  private async bundled(): Promise<string> {
    const r = await fetch('box_slots.cfg', { cache: 'no-store' });
    if (!r.ok) throw new Error("The app's copy of box_slots.cfg is missing.");
    return r.text();
  }

  private async download(file: string): Promise<string | null> {
    const r = await fetch(this.mr.api('/server/files/config/' + encodeURIComponent(file)), { cache: 'no-store' });
    return r.ok ? r.text() : null;
  }

  private async upload(name: string, text: string): Promise<void> {
    const fd = new FormData();
    fd.append('root', 'config');
    fd.append('file', new Blob([text], { type: 'text/plain' }), name);
    const r = await fetch(this.mr.api('/server/files/upload'), { method: 'POST', body: fd });
    if (!r.ok) throw new Error(`Uploading ${name} failed (HTTP ${r.status}).`);
    // Verify: read it back.
    const back = await this.download(name);
    if (norm(back) !== norm(text)) throw new Error(`Uploaded ${name} doesn't match – not changed.`);
  }

  async check(): Promise<void> {
    try {
      const loaded = !!this.mr.status()['gcode_macro _BOX_SLOT_DATA'];
      const [mine, theirs] = await Promise.all([this.bundled(), this.download('box_slots.cfg')]);
      const app = macroVersion(mine), printer = theirs == null ? 0 : macroVersion(theirs);
      this.versions.set({ app, printer });
      if (!loaded) { this.state.set(printer > app ? 'newer' : 'missing'); return; }
      // Compare versions, never contents: a dashboard must not "update" a printer to an older file.
      this.state.set(app > printer ? 'outdated' : app < printer ? 'newer' : 'installed');
    } catch {
      this.state.set('unknown');
    }
  }

  /** Work out what would change, without changing anything. */
  async plan(): Promise<InstallPlan> {
    const printerCfg = await this.download('printer.cfg');
    if (printerCfg == null) throw new Error("Couldn't read printer.cfg from the printer.");
    const eol = printerCfg.includes('\r\n') ? '\r\n' : '\n';
    const lines = printerCfg.split(/\r?\n/);
    const has = lines.some((l) => /^\s*\[include\s+box_slots\.cfg\]/.test(l));
    let afterLine: InstallPlan['afterLine'] = null;
    let newPrinterCfg: string | null = null;
    if (!has) {
      // After [include box.cfg]; otherwise just before Klipper's auto-saved SAVE_CONFIG block; otherwise at the end.
      let i = lines.findIndex((l) => /^\s*\[include\s+box\.cfg\]/.test(l));
      if (i < 0) {
        const save = lines.findIndex((l) => l.startsWith('#*# <') && l.includes('SAVE_CONFIG'));
        i = save > 0 ? save - 1 : lines.length - 1;
      }
      afterLine = { n: i + 1, text: lines[i] };
      newPrinterCfg = [...lines.slice(0, i + 1), INCLUDE, ...lines.slice(i + 1)].join(eol);
    }
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
    return {
      printerCfg, newPrinterCfg, includeLine: INCLUDE, afterLine,
      backupName: `printer-${stamp}-before-slot-editing.cfg.bak`,
      hadMacroFile: await this.download('box_slots.cfg'),
    };
  }

  async install(plan: InstallPlan): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    let changed = false, succeeded = false;
    try {
      const st = await this.mr.call('printer.objects.query', { objects: { print_stats: ['state'], multi_color_controller: ['task'] } });
      if (!IDLE_STATES.includes(st.status.print_stats.state)) throw new Error('The printer is busy (printing or paused).');
      const task = st.status.multi_color_controller?.task;
      if (task && (task.flow_id != null || task.current_queue?.length)) throw new Error('The box is busy (loading, unloading or changing filament).');
      const appVersion = macroVersion(await this.bundled());
      if (plan.hadMacroFile != null && macroVersion(plan.hadMacroFile) > appVersion) {
        throw new Error(`The printer already has newer macros (version ${macroVersion(plan.hadMacroFile)}) than this dashboard (version ${appVersion}).`);
      }

      this.step(`Backing up printer.cfg as ${plan.backupName}…`);
      await this.upload(plan.backupName, plan.printerCfg);

      this.step('Uploading box_slots.cfg…');
      changed = true;
      await this.upload('box_slots.cfg', await this.bundled());

      if (plan.newPrinterCfg) {
        this.step('Adding the include line to printer.cfg…');
        await this.upload('printer.cfg', plan.newPrinterCfg);
      }

      this.step('Restarting Klipper…');
      const ok = await this.restartAndWait();
      if (!ok.ready) throw new Error(`Klipper didn't come back ready: ${ok.message}`);

      this.step('Checking the macros loaded…');
      const q = await fetch(this.mr.api('/printer/objects/query?gcode_macro%20_BOX_SLOT_DATA')).then((r) => r.json());
      if (!q?.result?.status?.['gcode_macro _BOX_SLOT_DATA']?.filaments) throw new Error('Klipper restarted but the macros are not loaded.');

      this.step('Done – slot editing is set up.');
      this.state.set('installed');
      succeeded = true;
    } catch (e: any) {
      const why = String(e?.message || e);
      if (changed) {
        this.step(`Problem: ${why} Putting the original files back…`);
        try {
          await this.upload('printer.cfg', plan.printerCfg);
          if (plan.hadMacroFile != null) await this.upload('box_slots.cfg', plan.hadMacroFile);
          const back = await this.restartAndWait();
          this.step(back.ready
            ? `Not installed: ${why} The original files were restored and Klipper is ready again.`
            : `Not installed: ${why} The original files were restored, but Klipper isn't ready (${back.message}). Try FIRMWARE_RESTART or power-cycle the printer. Backup: ${plan.backupName}`);
        } catch (e2: any) {
          this.step(`Not installed: ${why} Restoring also failed (${e2?.message || e2}). Your original printer.cfg is saved as ${plan.backupName}.`);
        }
      } else {
        this.step(`Not installed: ${why} Nothing was changed.`);
      }
      throw e;
    } finally {
      this.busy.set(false);
      // On success, the dashboard re-reads the printer when Klipper reports ready and re-checks then;
      // checking now would use the old object list and briefly show "not set up".
      if (!succeeded) this.check();
    }
  }

  private step(text: string): void {
    this.progress.set(text);
  }

  /** RESTART, then poll /printer/info until Klipper is ready (or fails) – up to 2 minutes. */
  private async restartAndWait(): Promise<{ ready: boolean; message: string }> {
    await fetch(this.mr.api('/printer/restart'), { method: 'POST' }).catch(() => {});
    await sleep(3000);
    let last = '';
    for (let i = 0; i < 60; i++) {
      try {
        const info = (await fetch(this.mr.api('/printer/info'), { cache: 'no-store' }).then((r) => r.json())).result;
        last = (info?.state_message || '').split('\n')[0];
        if (info?.state === 'ready') return { ready: true, message: '' };
        if (info?.state === 'error' || info?.state === 'shutdown') return { ready: false, message: last || info.state };
      } catch { /* Moonraker busy for a moment */ }
      await sleep(2000);
    }
    return { ready: false, message: last || 'timed out' };
  }
}

const norm = (s: string | null) => (s ?? '').replace(/\r\n/g, '\n').trim();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
