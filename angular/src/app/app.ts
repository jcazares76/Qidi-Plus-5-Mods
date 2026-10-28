import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { APP_VERSION, STATE_TITLE } from './core/constants';
import { MacroInstallerService } from './core/macro-installer.service';
import { MoonrakerService } from './core/moonraker.service';
import { SettingsService } from './core/settings.service';
import { BoxPanel } from './panels/box-panel';
import { CameraPanel } from './panels/camera-panel';
import { ConsolePanel } from './panels/console-panel';
import { FansPanel } from './panels/fans-panel';
import { JobsPanel } from './panels/jobs-panel';
import { StatusPanel } from './panels/status-panel';
import { ThermalsPanel } from './panels/thermals-panel';
import { FindPrinterDialog } from './shared/find-printer-dialog';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatusPanel, BoxPanel, ConsolePanel, ThermalsPanel, CameraPanel, FansPanel, JobsPanel, FindPrinterDialog],
  template: `
    <div class="appbar">
      <div class="brand">QIDI Plus 5<small>Dashboard v{{ version }}</small></div>
      <span class="chip"><span class="dot" [class]="'dot ' + conn().kind"></span><span>{{ conn().text }}</span></span>
      <span class="spacer"></span>
      <label class="host">Printer
        <input type="text" spellcheck="false" placeholder="printer IP address" [value]="settings.host()"
               (change)="settings.setHost($any($event.target).value)" />
      </label>
      <button class="btn" [class.primary]="!settings.host()" (click)="finder.open()">Find my printer</button>
    </div>
    <app-find-printer-dialog #finder />
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
  protected readonly version = APP_VERSION;
  protected readonly settings = inject(SettingsService);
  private readonly mr = inject(MoonrakerService);
  private readonly installer = inject(MacroInstallerService);

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
      return { text: "Click “Find my printer” (top right) to search your network, or type the printer's IP address in the Printer box – it's shown on the printer's touchscreen under network settings.", err: false };
    }
    if (!this.mr.connected()) {
      return { text: `Can't reach the printer at ${host}. Retrying… (open this page with the launcher, from localhost)`, err: true };
    }
    const k = this.mr.klippyState();
    if (k === 'disconnected' || k === 'startup') return { text: 'Klipper is restarting… this usually takes 10–30 seconds.', err: false };
    if (k !== 'ready') return { text: `Klipper is ${k}. ${this.mr.klippyMessage()}`.trim(), err: true };
    const st = this.mr.status();
    if (st['webhooks'] && !st['gcode_macro _BOX_SLOT_DATA'] && !this.installer.busy()) { // only once objects are subscribed
      return { text: "Slot editing isn't set up on this printer yet. Use “Set up slot editing” in the Control Box panel.", err: true };
    }
    return { text: '', err: false };
  });
}
