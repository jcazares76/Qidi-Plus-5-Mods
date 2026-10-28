import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { STATE_TITLE } from './core/constants';
import { MoonrakerService } from './core/moonraker.service';
import { SettingsService } from './core/settings.service';
import { BoxPanel } from './panels/box-panel';
import { CameraPanel } from './panels/camera-panel';
import { ConsolePanel } from './panels/console-panel';
import { FansPanel } from './panels/fans-panel';
import { JobsPanel } from './panels/jobs-panel';
import { StatusPanel } from './panels/status-panel';
import { ThermalsPanel } from './panels/thermals-panel';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatusPanel, BoxPanel, ConsolePanel, ThermalsPanel, CameraPanel, FansPanel, JobsPanel],
  template: `
    <div class="appbar">
      <div class="brand">QIDI Plus 5<small>Dashboard</small></div>
      <span class="chip"><span class="dot" [class]="'dot ' + conn().kind"></span><span>{{ conn().text }}</span></span>
      <span class="spacer"></span>
      <label class="host">Printer
        <input type="text" spellcheck="false" placeholder="printer IP address" [value]="settings.host()"
               (change)="settings.setHost($any($event.target).value)" />
      </label>
    </div>
    <div class="banner" [class.show]="!!banner().text" [class.err]="banner().err">{{ banner().text }}</div>

    <div class="dash">
      <div class="col">
        <app-status-panel />
        <app-box-panel />
        <app-console-panel />
      </div>
      <div class="col">
        <app-thermals-panel />
        <app-camera-panel />
        <app-fans-panel />
        <app-jobs-panel />
      </div>
    </div>
  `,
})
export class App {
  protected readonly settings = inject(SettingsService);
  private readonly mr = inject(MoonrakerService);

  protected readonly conn = computed(() => {
    if (!this.settings.host()) return { kind: 'warn', text: 'No printer set' };
    if (!this.mr.connected()) return { kind: 'err', text: "Can't reach printer" };
    if (this.mr.klippyState() !== 'ready') return { kind: 'warn', text: 'Klipper: ' + this.mr.klippyState() };
    const st = this.mr.printState();
    return { kind: st === 'printing' || st === 'paused' ? 'warn' : 'ok', text: 'Connected · ' + (STATE_TITLE[st] || st) };
  });

  protected readonly banner = computed(() => {
    const host = this.settings.host();
    if (!host) {
      return { text: "Enter your printer's IP address in the Printer box (top right). It's shown on the printer's touchscreen under network settings.", err: false };
    }
    if (!this.mr.connected()) {
      return { text: `Can't reach the printer at ${host}. Retrying… (open this page with the launcher, from localhost)`, err: true };
    }
    const k = this.mr.klippyState();
    if (k !== 'ready') return { text: `Klipper is ${k}. ${this.mr.klippyMessage()}`, err: k !== 'startup' };
    const st = this.mr.status();
    if (st['webhooks'] && !st['gcode_macro _BOX_SLOT_DATA']) { // only once objects are subscribed
      return { text: "The SET_SLOT_FILAMENT macros (box_slots.cfg) aren't loaded on the printer. Slot editing is disabled.", err: true };
    }
    return { text: '', err: false };
  });
}
