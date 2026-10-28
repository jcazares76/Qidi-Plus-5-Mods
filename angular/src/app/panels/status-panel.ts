import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { BUSY_STATES, STATE_TITLE } from '../core/constants';
import { FilesService } from '../core/files.service';
import { fmtDur } from '../core/format';
import { MoonrakerService } from '../core/moonraker.service';
import { Card } from '../shared/card';

/** Printer state, current job and Pause / Resume / Cancel. The card title is the state ("Ready", "Printing", …). */
@Component({
  selector: 'app-status-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card],
  template: `
    <app-card cardId="ready" [title]="title()" [info]="info()">
      <svg class="ic" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 8h18M8 13h8M10 17h4" /></svg>
      <div class="job">
        <div class="thumb" [style.background-image]="thumb()"></div>
        <div style="flex:1;min-width:0">
          <div class="fname">{{ file() || 'No print loaded' }}</div>
          <div class="muted">{{ sub() }}</div>
          <div class="bar"><div [style.width.%]="file() ? progress() * 100 : 0"></div></div>
        </div>
      </div>
      <div class="stats">
        @for (s of stats(); track s.k) {
          <div class="stat"><div class="k">{{ s.k }}</div><div class="v">{{ s.v }}</div></div>
        }
      </div>
      <div class="row ready-actions">
        @if (state() === 'printing') { <button class="btn" (click)="act('printer.print.pause')">Pause</button> }
        @if (state() === 'paused') { <button class="btn" (click)="act('printer.print.resume')">Resume</button> }
        @if (active()) { <button class="btn danger" (click)="cancel()">Cancel</button> }
        <span class="spacer"></span>
        @if (mr.connected() && mr.klippyState() !== 'ready') {
          <button class="btn" title="Klipper RESTART (not FIRMWARE_RESTART)" (click)="restart()">Restart Klipper</button>
        }
      </div>
    </app-card>
  `,
})
export class StatusPanel {
  protected readonly mr = inject(MoonrakerService);
  private readonly files = inject(FilesService);

  protected readonly state = this.mr.printState;
  protected readonly title = computed(() => STATE_TITLE[this.state()] || this.state());
  protected readonly info = computed(() =>
    this.mr.connected() && this.mr.klippyState() !== 'ready' ? this.mr.klippyMessage().split('\n')[0] : '');
  protected readonly active = computed(() => BUSY_STATES.includes(this.state()));
  protected readonly file = computed<string>(() => this.mr.status()['print_stats']?.filename || '');
  protected readonly progress = computed<number>(() => this.mr.status()['virtual_sdcard']?.progress || 0);
  private readonly meta = signal<any>(null);
  protected readonly thumb = computed(() => {
    const u = this.files.thumbUrl(this.meta());
    return u ? `url("${u}")` : '';
  });
  protected readonly sub = computed(() =>
    this.file() && !this.active() ? `Last print · ${STATE_TITLE[this.state()] || this.state()}` : '');

  protected readonly stats = computed(() => {
    const st = this.mr.status(), ps = st['print_stats'] ?? {}, file = this.file(), p = this.progress();
    const dur = ps.print_duration || 0, m = this.meta();
    let left: number | null = null;
    if (this.active()) {
      if (p > 0.05 && dur > 0) left = dur / p - dur;
      else if (m?.estimated_time) left = m.estimated_time - dur;
    }
    const info = ps.info ?? {}, gm = st['gcode_move'] ?? {}, th = st['toolhead'] ?? {};
    return [
      { k: 'Progress', v: file ? (p * 100).toFixed(1) + '%' : '–' },
      { k: 'Elapsed', v: file ? fmtDur(ps.total_duration || dur) : '–' },
      { k: 'Remaining', v: this.active() ? fmtDur(left) : '–' },
      { k: 'Layer', v: info.total_layer ? `${info.current_layer || 0} / ${info.total_layer}` : '–' },
      { k: 'Speed', v: gm.speed_factor != null ? Math.round(gm.speed_factor * 100) + '%' : '–' },
      { k: 'Flow', v: gm.extrude_factor != null ? Math.round(gm.extrude_factor * 100) + '%' : '–' },
      { k: 'Filament used', v: file && ps.filament_used ? (ps.filament_used / 1000).toFixed(2) + ' m' : '–' },
      {
        k: 'Position',
        v: th.position ? th.position.slice(0, 3).map((x: number) => x.toFixed(1)).join(', ') + (th.homed_axes ? '' : ' (not homed)') : '–',
      },
    ];
  });

  constructor() {
    // Load the current file's details (thumbnail, slicer estimate) when the file changes.
    effect(() => {
      const f = this.file();
      this.meta.set(null);
      if (f) this.files.getMeta(f).then((m) => { if (this.file() === f) this.meta.set(m); });
    });
  }

  protected act(method: string): void {
    this.mr.call(method).catch((e) => alert(e.message));
  }

  protected cancel(): void {
    if (confirm('Cancel the current print?')) this.act('printer.print.cancel');
  }

  protected restart(): void {
    if (confirm('Restart Klipper (RESTART)?')) this.act('printer.restart');
  }
}
