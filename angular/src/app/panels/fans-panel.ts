import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { pretty } from '../core/format';
import { MoonrakerService } from '../core/moonraker.service';
import { Card } from '../shared/card';

function fanLabel(n: string): string {
  if (n === 'fan') return 'Part fan';
  let m = n.match(/heater_fan_([ab])_box(\d+)$/);
  if (m) return `Box ${m[2]} heater fan ${m[1].toUpperCase()}`;
  m = n.match(/board_fan_box(\d+)$/);
  if (m) return `Box ${m[1]} board fan`;
  return pretty(n);
}

/** Fan sliders (fan_generic / fan), automatic fans read-only, and output pins as switches. */
@Component({
  selector: 'app-fans-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card],
  template: `
    <app-card cardId="fans" title="Fans & Outputs">
      <svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="2" /><path d="M12 10c0-4 1-7 4-7s3 4-2 7M14 12c4 0 7 1 7 4s-4 3-7-2M12 14c0 4-1 7-4 7s-3-4 2-7M10 12c-4 0-7-1-7-4s4-3 7 2" /></svg>
      @if (lists(); as l) {
        @if (l.ctrl.length) {
          <div class="subhead">Fans</div>
          @for (f of l.ctrl; track f.name) {
            <div class="fan">
              <div>{{ f.label }}<div class="muted" style="font-size:11px">{{ f.rpm }}</div></div>
              <input type="range" min="0" max="100" step="1" [value]="f.pct" [disabled]="!ready()"
                     (input)="drag.set({ name: f.name, pct: +$any($event.target).value })"
                     (change)="setFan(f.name, +$any($event.target).value)" />
              <div class="val">{{ f.pct }}%</div>
            </div>
          }
        }
        @if (l.auto.length) {
          <div class="subhead">Automatic fans (view only)</div>
          @for (f of l.auto; track f.name) {
            <div class="fan">
              <div>{{ f.label }}<div class="muted" style="font-size:11px">{{ f.rpm }}</div></div>
              <div class="ro"><div [style.width.%]="f.pct"></div></div>
              <div class="val">{{ f.pct }}%</div>
            </div>
          }
        }
        @if (l.outs.length) {
          <div class="subhead">Outputs</div>
          @for (o of l.outs; track o.name) {
            <div class="fan pinrow">
              <div>{{ o.label }}<div class="muted" style="font-size:11px">{{ o.note }}</div></div>
              <div class="val">
                <label class="switch" [title]="o.label + ' on/off'">
                  <input type="checkbox" [attr.aria-label]="o.label" [checked]="o.on" [disabled]="!ready()"
                         (change)="setPin(o.name, $any($event.target))" /><span></span>
                </label>
              </div>
            </div>
          }
        }
        @if (!l.ctrl.length && !l.auto.length && !l.outs.length) { <span class="muted">No fans found.</span> }
      }
    </app-card>
  `,
})
export class FansPanel {
  private readonly mr = inject(MoonrakerService);
  protected readonly ready = computed(() => this.mr.klippyState() === 'ready');
  /** Slider being dragged: shown instead of the printer's value until released. */
  protected readonly drag = signal<{ name: string; pct: number } | null>(null);

  protected readonly lists = computed(() => {
    const st = this.mr.status(), names = Object.keys(st), sv = this.mr.saveVars(), drag = this.drag();
    const type = (n: string) => n.split(' ')[0];
    const fan = (n: string) => {
      const o = st[n] ?? {};
      return { name: n, label: fanLabel(n), rpm: o.rpm ? Math.round(o.rpm) + ' RPM' : '', pct: drag?.name === n ? drag.pct : Math.round((o.speed || 0) * 100) };
    };
    return {
      ctrl: names.filter((n) => ['fan', 'fan_generic'].includes(type(n))).map(fan),
      auto: names.filter((n) => ['controller_fan', 'heater_fan', 'temperature_fan', 'box_heater_fan'].includes(type(n))).map(fan),
      outs: names
        .filter((n) => n.startsWith('output_pin ') && !/beeper/.test(n) && !(n === 'output_pin polar_cooler' && sv.enable_polar_cooler === 0))
        .map((n) => ({
          name: n, label: pretty(n), on: !!st[n]?.value,
          note: st['smart_' + n]?.enable ? 'Auto mode on (the printer may switch it by itself)' : '',
        })),
    };
  });

  protected setFan(name: string, pct: number): void {
    const v = pct / 100;
    const cmd = name === 'fan' ? `M106 S${Math.round(v * 255)}` : `SET_FAN_SPEED FAN=${name.split(' ')[1]} SPEED=${v.toFixed(2)}`;
    this.mr.gcode(cmd).catch((e) => alert(e.message)).finally(() => setTimeout(() => this.drag.set(null), 600));
  }

  protected setPin(name: string, cb: HTMLInputElement): void {
    this.mr.gcode(`SET_PIN PIN=${name.split(' ')[1]} VALUE=${cb.checked ? 1 : 0}`).catch((e) => {
      alert(e.message);
      cb.checked = !cb.checked;
    });
  }
}
