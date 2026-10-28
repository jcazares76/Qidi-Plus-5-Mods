import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { BUSY_STATES } from '../core/constants';
import { FilesService } from '../core/files.service';
import { fmtDate, fmtDur, fmtSize, stripGcodeExt } from '../core/format';
import { MoonrakerService } from '../core/moonraker.service';
import { Card } from '../shared/card';
import { PrintDialog } from './print-dialog';

/** Print files (newest first, with thumbnails and details) and print history with Reprint. */
@Component({
  selector: 'app-jobs-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card, PrintDialog],
  template: `
    <app-card cardId="jobs" title="Jobs" [info]="files.files().length ? files.files().length + ' files' : ''">
      <svg class="ic" viewBox="0 0 24 24"><path d="M4 4h10l6 6v10H4z" /><path d="M14 4v6h6" /></svg>
      <div class="tabs">
        <button [class.on]="tab() === 'files'" (click)="tab.set('files')">Files</button>
        <button [class.on]="tab() === 'history'" (click)="tab.set('history')">History</button>
      </div>
      @if (tab() === 'files') {
        <div id="tabFiles">
          <table class="files"><tbody>
            @for (f of fileRows(); track f.path) {
              <tr>
                <td style="width:52px"><div class="fthumb" [style.background-image]="f.thumb"></div></td>
                <td><div class="fn">{{ f.name }}</div><div class="muted" style="font-size:12px">{{ f.details }}</div></td>
                <td class="num" style="width:90px"><button class="btn" [disabled]="!canPrint()" (click)="dialog().open(f.path)">Print</button></td>
              </tr>
            } @empty {
              <tr><td class="muted">No files.</td></tr>
            }
          </tbody></table>
        </div>
      } @else {
        <div id="tabHistory">
          <table class="files"><tbody>
            @for (j of files.history(); track j.job_id) {
              <tr>
                <td>
                  <div class="fn">{{ strip(j.filename) }}</div>
                  <div class="muted" style="font-size:12px">{{ histDetails(j) }}</div>
                </td>
                <td><span class="st" [class]="'st ' + j.status">{{ j.status.replace('_', ' ') }}</span></td>
                <td class="num" style="width:90px">
                  @if (j.exists) { <button class="btn" [disabled]="!canPrint()" (click)="dialog().open(j.filename)">Reprint</button> }
                </td>
              </tr>
            } @empty {
              <tr><td class="muted">No print history.</td></tr>
            }
          </tbody></table>
        </div>
      }
    </app-card>
    <app-print-dialog />
  `,
})
export class JobsPanel {
  protected readonly files = inject(FilesService);
  private readonly mr = inject(MoonrakerService);
  protected readonly dialog = viewChild.required(PrintDialog);

  protected readonly tab = signal<'files' | 'history'>('files');
  protected readonly canPrint = computed(() =>
    this.mr.connected() && this.mr.klippyState() === 'ready' && !BUSY_STATES.includes(this.mr.printState()));

  protected readonly fileRows = computed(() => {
    const metas = this.files.metas();
    return this.files.files().map((f) => {
      const m = metas[f.path];
      const bits = [fmtDate(f.modified), fmtSize(f.size)];
      if (m?.estimated_time) bits.push(fmtDur(m.estimated_time));
      if (m?.filament_weight_total) bits.push(m.filament_weight_total.toFixed(1) + ' g');
      if (m?.filament_type) bits.push(m.filament_type.split(';').join(' + '));
      const u = m ? this.files.thumbUrl(m) : '';
      return { path: f.path, name: stripGcodeExt(f.path), details: bits.join(' · '), thumb: u ? `url("${u}")` : '' };
    });
  });

  constructor() {
    // Fetch details for every listed file (cached; re-read when a file changes).
    effect(() => { for (const f of this.files.files()) this.files.getMeta(f.path); });
  }

  protected strip = stripGcodeExt;

  protected histDetails(j: any): string {
    return `${fmtDate(j.start_time)} · ${fmtDur(j.print_duration)}${j.filament_used ? ' · ' + (j.filament_used / 1000).toFixed(1) + ' m' : ''}`;
  }
}
