import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { BUSY_STATES, NAMES } from '../core/constants';
import { BoxSlot, boxSlotList } from '../core/box';
import { FilesService } from '../core/files.service';
import { bigType, colorDist, fmtDur, stripGcodeExt } from '../core/format';
import { MoonrakerService } from '../core/moonraker.service';

interface Job { filename: string; meta: any; tools: number[]; types: string[]; colors: string[] }

/**
 * Start a print, mapping each filament (tool) in the file to a loaded box slot — what QIDI's Fluidd does,
 * but working with the filament-ID slot format. Sends SAVE_VARIABLE value_t<T>='slot<idx>' then starts.
 */
@Component({
  selector: 'app-print-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg (close)="job.set(null)">
      @if (job(); as j) {
        <header>{{ title() }}</header>
        <div class="dbody">
          <div class="job">
            <div class="thumb" [style.background-image]="thumb()"></div>
            <div class="muted">
              @for (line of metaLines(); track line) { <div>{{ line }}</div> }
            </div>
          </div>
          <label class="row">
            <span class="switch"><input type="checkbox" [checked]="useBox()" (change)="setUseBox($any($event.target).checked)" /><span></span></span>
            Use the Control Box
          </label>
          @if (!useBox()) {
            <div class="muted">Prints from the external spool ({{ externalName() }}).</div>
            @if (j.tools.length > 1) {
              <div class="warnline">This file uses {{ j.tools.length }} filaments. Without the box it will print with one.</div>
            }
          } @else if (!j.tools.length) {
            <div class="muted">This file has no filament info. It will print with T0 → slot 1A, T1 → 1B, … (same as QIDI's Fluidd).</div>
          } @else if (!loaded().length) {
            <div class="warnline">No spools detected in the box. Load filament or turn off "Use the Control Box".</div>
          } @else {
            <div class="map">
              @for (t of j.tools; track t) {
                <div class="tool"><span class="swatch" [style.background]="j.colors[t] || '#888888'"></span>T{{ t }} · {{ j.types[t] }}</div>
                <select [value]="mapping()[t] ?? ''" (change)="pick(t, $any($event.target).value)">
                  @if (mapping()[t] == null) { <option value="" selected disabled>Choose a slot</option> }
                  @for (x of loaded(); track x.idx) {
                    <option [value]="x.idx" [selected]="mapping()[t] === x.idx">{{ optionText(x, j.types[t]) }}</option>
                  }
                </select>
              }
            </div>
            <div class="warnline">{{ warnings() }}</div>
          }
        </div>
        <footer>
          <button class="btn" (click)="close()">Cancel</button>
          <button class="btn primary" [disabled]="!canStart() || starting()" (click)="start()">Print</button>
        </footer>
      }
    </dialog>
  `,
})
export class PrintDialog {
  private readonly mr = inject(MoonrakerService);
  private readonly files = inject(FilesService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly job = signal<Job | null>(null);
  protected readonly useBox = signal(false);
  /** tool → slot index (null = not chosen). */
  protected readonly mapping = signal<Record<number, number | null>>({});
  protected readonly starting = signal(false);

  protected readonly loaded = computed(() => boxSlotList(this.mr.status()).filter((x) => x.present));
  protected readonly title = computed(() => stripGcodeExt(this.job()?.filename ?? ''));
  protected readonly thumb = computed(() => {
    const u = this.files.thumbUrl(this.job()?.meta);
    return u ? `url("${u}")` : '';
  });
  protected readonly metaLines = computed(() => {
    const m = this.job()?.meta ?? {};
    return [
      m.estimated_time ? 'Time: ' + fmtDur(m.estimated_time) : '',
      m.filament_weight_total ? 'Filament: ' + m.filament_weight_total.toFixed(1) + ' g' : '',
      m.filament_type ? 'Types: ' + m.filament_type.split(';').join(' + ') : '',
      m.slicer ? 'Sliced with ' + m.slicer : '',
    ].filter(Boolean);
  });
  protected readonly externalName = computed(() => {
    const id = this.mr.saveVars().filament_slot16;
    return typeof id === 'string' ? NAMES[id] || id : 'not set';
  });
  protected readonly warnings = computed(() => {
    const j = this.job();
    if (!j) return '';
    const all = boxSlotList(this.mr.status()), notes: string[] = [];
    let missing = false;
    for (const t of j.tools) {
      const idx = this.mapping()[t];
      if (idx == null) { missing = true; continue; }
      const x = all[idx];
      if (x && bigType(x.type) !== bigType(j.types[t])) notes.push(`T${t} is ${j.types[t]} but slot ${x.label} has ${x.type || 'no type set'}.`);
    }
    if (missing) notes.unshift('Choose a slot for every filament.');
    return notes.join(' ');
  });
  protected readonly canStart = computed(() => {
    const j = this.job();
    if (!j || !this.useBox() || !j.tools.length) return !!j;
    return this.loaded().length > 0 && j.tools.every((t) => this.mapping()[t] != null);
  });

  async open(filename: string): Promise<void> {
    const meta = (await this.files.getMeta(filename)) ?? {};
    const types = String(meta.filament_type || '').split(';').filter(Boolean), colors: string[] = meta.preset_colours ?? [];
    // QIDI Studio files list the tools they use. Orca files don't, so fall back to one tool per filament in the file.
    let tools: number[] = meta.used_extruders?.length ? meta.used_extruders : [];
    if (!tools.length) tools = Array.from({ length: Math.max(types.length, colors.length) }, (_, i) => i);
    const job: Job = { filename, meta, tools, types, colors };
    this.useBox.set(this.mr.saveVars().enable_box === 1);
    this.mapping.set(this.defaultMapping(job));
    this.starting.set(false);
    this.job.set(job);
    this.dlg().nativeElement.showModal();
  }

  protected close(): void {
    this.dlg().nativeElement.close();
  }

  /** Default: same filament type, closest color, not already taken. */
  private defaultMapping(j: Job): Record<number, number | null> {
    const used = new Set<number>(), map: Record<number, number | null> = {};
    for (const t of j.tools) {
      const color = j.colors[t] || '#888888';
      const cands = this.loaded().filter((x) => bigType(x.type) === bigType(j.types[t]))
        .sort((a, b) => colorDist(a.hex, color) - colorDist(b.hex, color));
      const pick = cands.find((x) => !used.has(x.idx)) ?? cands[0];
      if (pick) used.add(pick.idx);
      map[t] = pick ? pick.idx : null;
    }
    return map;
  }

  protected optionText(x: BoxSlot, type: string): string {
    return `${x.label} · ${x.name || NAMES[x.id] || 'not set'} · #${x.hex}${bigType(x.type) !== bigType(type) ? ' (different type)' : ''}`;
  }

  protected pick(tool: number, value: string): void {
    this.mapping.update((m) => ({ ...m, [tool]: value === '' ? null : Number(value) }));
  }

  protected setUseBox(on: boolean): void {
    this.useBox.set(on);
    this.mr.gcode(`SAVE_VARIABLE VARIABLE=enable_box VALUE=${on ? 1 : 0}`).catch((e) => alert(e.message));
  }

  protected async start(): Promise<void> {
    const j = this.job();
    if (!j) return;
    this.starting.set(true);
    try {
      const st = await this.mr.call('printer.objects.query', { objects: { print_stats: ['state'] } });
      if (BUSY_STATES.includes(st.status.print_stats.state)) throw new Error('The printer is already printing.');
      if (this.useBox()) {
        const lines = j.tools.length
          ? j.tools.map((t) => `SAVE_VARIABLE VARIABLE=value_t${t} VALUE="'slot${this.mapping()[t]}'"`)
          : j.colors.map((_, i) => `SAVE_VARIABLE VARIABLE=value_t${i} VALUE="'slot${i}'"`);
        if (lines.length) await this.mr.gcode(lines.join('\n'));
      }
      await this.mr.call('printer.print.start', { filename: j.filename });
      this.close();
    } catch (e: any) {
      alert('Print not started: ' + e.message);
      this.starting.set(false);
    }
  }
}
