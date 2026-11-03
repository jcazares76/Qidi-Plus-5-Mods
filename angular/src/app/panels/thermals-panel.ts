import {
  ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild,
} from '@angular/core';
import { CHART_COLORS, CHART_LEN, HEATER_MAX_TARGET, HEATER_WATTS, PLA_SOFT_LIMIT, TEMP_TOL } from '../core/constants';
import { boxSlotList } from '../core/box';
import { fmtClock, fmtDur, pretty } from '../core/format';
import { MoonrakerService } from '../core/moonraker.service';
import { ThermalHistoryService } from '../core/thermal-history.service';
import { Card } from '../shared/card';

interface TipRow { color: string; label: string; temp: string; target: string }
interface Tip { left: number; when: string; rows: TipRow[] }

const hasTarget = (n: string) => !n.startsWith('temperature_sensor');
/** Klipper heater name for SET_HEATER_TEMPERATURE: "heater_generic chamber" → "chamber". */
const heaterName = (n: string) => n.replace(/^heater_generic /, '');

export function sensorLabel(n: string): string {
  if (n === 'extruder') return 'Extruder';
  if (n === 'heater_bed') return 'Bed';
  if (n === 'heater_generic chamber') return 'Chamber';
  if (n === 'heater_generic heater_box1') return 'Box 1 heater';
  if (n === 'temperature_sensor Chamber_Thermal_Protection_Sensor') return 'Chamber safety sensor';
  const m = n.match(/heater_temp_([ab])_box(\d+)/);
  if (m) return `Box ${m[2]} heater ${m[1].toUpperCase()}`;
  return pretty(n);
}

/** Heaters and sensors: settable targets, colored actual vs target, 10 s average power bars, total draw, 10-minute chart. */
@Component({
  selector: 'app-thermals-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card],
  template: `
    <app-card cardId="thermals" title="Thermals" (openChange)="open.set($event)">
      <svg class="ic" viewBox="0 0 24 24"><path d="M14 14.8V4a2 2 0 1 0-4 0v10.8a4 4 0 1 0 4 0z" /></svg>
      <table>
        <thead>
          <tr class="totrow">
            <th></th>
            <th class="num"><div class="totw" [title]="total().tip"><small>Total</small>{{ total().text }}</div></th>
            <th colspan="2"></th>
          </tr>
          <tr><th>Name</th><th class="num">Power</th><th class="num">Actual</th><th class="num">Target</th></tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.name) {
            <tr>
              <td><span class="swatch" [style.background]="r.color"></span>{{ r.label }}</td>
              <td class="num pw" [class.pbar]="r.bar" [style.background]="r.bar ? r.barBg : null" [title]="r.powerTip">{{ r.power }}</td>
              <td class="num act" [class]="'num act ' + r.cls">{{ r.actual }}</td>
              <td class="num">
                @if (r.max) {
                  <span class="tset">
                    <input type="number" min="0" [max]="r.max" step="1" [value]="r.targetNum || ''" placeholder="off"
                      [disabled]="!ready()" [title]="'Type a target (0–' + r.max + ' °C) and press Enter. 0 or empty = off.'"
                      (keydown.enter)="setTarget(r.name, $any($event.target))"
                      (keydown.escape)="revert($any($event.target), r.targetNum)"
                      (blur)="revert($any($event.target), r.targetNum)" />
                    <button class="off" [disabled]="!ready() || !r.targetNum" title="Turn off" (click)="send(r.name, 0)">✕</button>
                  </span>
                } @else {
                  {{ r.target }}
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
      @if (msg()) { <div class="msg" style="margin-top:6px">{{ msg() }}</div> }
      <div class="chartwrap">
        <canvas #chart class="chart" (pointermove)="hoverX.set($event.offsetX)" (pointerleave)="hoverX.set(null)"></canvas>
        @if (tip(); as t) {
          <div class="ctip" style="display:block" [style.left.px]="t.left">
            <div class="tt">{{ t.when }}</div>
            @for (row of t.rows; track row.label) {
              <div class="tr"><span class="swatch" [style.background]="row.color" style="margin:0"></span>{{ row.label }}
                <b>{{ row.temp }}@if (row.target) { <i> → {{ row.target }}</i> }</b></div>
            }
          </div>
        }
      </div>
      <div class="muted" style="font-size:11px;margin-top:4px">Last 10 minutes. Dashed lines are targets.</div>
    </app-card>
  `,
  styles: `
    td.act, td.pw { white-space: nowrap; }
    .tset { display: inline-flex; gap: 4px; align-items: center; justify-content: flex-end; }
    .tset input { width: 64px; text-align: right; padding: 2px 4px; }
    .tset .off { background: none; border: 1px solid var(--line); color: var(--muted, #999); border-radius: 4px;
      padding: 1px 6px; cursor: pointer; line-height: 1.3; }
    .tset .off:disabled { opacity: .3; cursor: default; }
  `,
  host: { '(window:resize)': 'draw()' },
})
export class ThermalsPanel {
  private readonly mr = inject(MoonrakerService);
  private readonly hist = inject(ThermalHistoryService);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('chart');

  protected readonly open = signal(true);
  protected readonly hoverX = signal<number | null>(null);
  protected readonly tip = signal<Tip | null>(null);

  protected readonly rows = computed(() => {
    this.hist.tick(); // refresh averages every second
    const st = this.mr.status();
    return this.hist.sensors().map((n, i) => {
      const o = st[n] ?? {};
      let cls = '';
      if (o.target > 0 && o.temperature != null) {
        const d = o.temperature - o.target;
        cls = Math.abs(d) <= TEMP_TOL ? 't-ok' : d < 0 ? 't-cool' : 't-hot';
      }
      const avg = this.hist.avgPower(n);
      const pct = avg == null ? null : Math.round(avg * 100);
      const samples = this.hist.powerHist[n]?.length || 1;
      return {
        name: n,
        label: sensorLabel(n),
        color: CHART_COLORS[i % CHART_COLORS.length],
        actual: o.temperature != null ? o.temperature.toFixed(1) + ' °C' : '–',
        target: hasTarget(n) ? (o.target ? o.target.toFixed(0) + ' °C' : 'off') : '',
        targetNum: Math.round(o.target ?? 0),
        max: HEATER_MAX_TARGET[n] ?? 0,
        cls,
        power: pct == null ? '' : pct + '%',
        powerTip: pct == null ? '' : `Average of the last ${samples} s (now ${Math.round((o.power ?? 0) * 100)}%)`,
        bar: pct != null && o.target > 0,
        barBg: `linear-gradient(to right, #d32f2f ${pct}%, #000 ${pct}%)`,
      };
    });
  });

  protected readonly total = computed(() => {
    this.hist.tick();
    let sum = 0;
    const parts: string[] = [];
    for (const [n, w] of Object.entries(HEATER_WATTS)) {
      const avg = this.hist.avgPower(n);
      if (avg == null) continue;
      sum += avg * w;
      parts.push(`${sensorLabel(n)}: ${Math.round(avg * w)} W of ${w} W`);
    }
    const max = Object.values(HEATER_WATTS).reduce((a, b) => a + b, 0);
    return {
      text: parts.length ? `${Math.round(sum)} W` : '– W',
      tip: `Heater draw, 10 s average (power × rated watts):\n${parts.join('\n')}\nMax if all on: ${max} W\nNot included: motors, fans, electronics, lights.`,
    };
  });

  protected readonly ready = computed(() => this.mr.klippyState() === 'ready');
  protected readonly msg = signal('');

  /** Enter in a target box: check the value, warn about box spools that could soften, then send. */
  protected setTarget(n: string, el: HTMLInputElement): void {
    const raw = el.value.trim(), v = raw === '' ? 0 : Number(raw), max = HEATER_MAX_TARGET[n];
    if (!Number.isFinite(v) || v < 0 || v > max) {
      this.msg.set(`${sensorLabel(n)}: enter 0–${max} °C.`);
      return;
    }
    if (n.startsWith('heater_generic heater_box') && v > 0) {
      const b = Number(n.match(/(\d+)$/)![1]) - 1;
      const bx = this.mr.status()['box_extras']?.boxes?.[b];
      const risky = boxSlotList(this.mr.status())
        .filter((x) => Math.floor(x.idx / 4) === b && x.present)
        .map((x) => {
          const lim = bx?.filament_info?.[x.idx % 4]?.box_max_temp ?? 0;
          return { x, lim: lim > 0 ? lim : PLA_SOFT_LIMIT, pla: !(lim > 0) };
        })
        .filter((s) => v > s.lim)
        .map((s) => `Slot ${s.x.label} (${s.x.name || s.x.type || 'filament'}) ${s.pla ? 'is PLA and can soften' : `has a drying limit of ${s.lim} °C`}`);
      if (risky.length && !confirm(`${risky.join('\n')}\n\nSet the box to ${v} °C anyway?`)) {
        el.value = String(Math.round(this.mr.status()[n]?.target ?? 0) || '');
        return;
      }
    }
    this.send(n, Math.round(v));
    el.blur();
  }

  protected revert(el: HTMLInputElement, current: number): void {
    el.value = current ? String(current) : '';
  }

  protected async send(n: string, v: number): Promise<void> {
    let script = `SET_HEATER_TEMPERATURE HEATER=${heaterName(n)} TARGET=${v}`;
    // Box heater during a print: let AUTO_BOX_TEMP's watcher switch it off when the print ends
    // (QIDI's end G-code doesn't turn off a heater set this way).
    const st = this.mr.status();
    if (n.startsWith('heater_generic heater_box') && v > 0 && st['gcode_macro AUTO_BOX_TEMP']
      && ['printing', 'paused'].includes(this.mr.printState())) {
      script += '\nSET_GCODE_VARIABLE MACRO=AUTO_BOX_TEMP VARIABLE=active VALUE=1\nUPDATE_DELAYED_GCODE ID=_AUTO_BOX_TEMP_WATCH DURATION=60';
    }
    this.msg.set('');
    try {
      await this.mr.gcode(script, 15_000);
    } catch (e: any) {
      this.msg.set(`${sensorLabel(n)}: ${e?.message || e}`);
    }
  }

  constructor() {
    effect(() => {
      this.hist.tick();
      this.hoverX();
      if (this.open() && !document.hidden) queueMicrotask(() => this.draw());
    });
  }

  protected draw(): void {
    const c = this.canvas().nativeElement, dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    if (!w) return;
    c.width = w * dpr;
    c.height = h * dpr;
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, w, h);
    const sensors = this.hist.sensors(), series = this.hist.series;
    let max = 40;
    for (const n of sensors) for (const v of [...series[n].temps, ...series[n].targets]) if (v != null && v > max) max = v;
    max = Math.ceil(max / 20) * 20;
    const L = 34, B = 16, pw = w - L - 4, ph = h - B - 6;
    g.font = '11px system-ui';
    g.fillStyle = '#777';
    g.strokeStyle = '#2c2c2c';
    g.lineWidth = 1;
    // Temperature lines every 20°; labels thinned out when lines get close together.
    const gap = (20 / max) * ph, every = Math.max(1, Math.ceil(14 / gap));
    for (let v = 0, k = 0; v <= max; v += 20, k++) {
      const y = Math.round(6 + ph - (v / max) * ph) + 0.5;
      g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke();
      if (k % every === 0) g.fillText(v + '°', 2, y + 4);
    }
    // Time lines every minute; labels every 2 minutes.
    for (let m = 10; m >= 0; m--) {
      const x = Math.round(L + ((10 - m) / 10) * pw) + 0.5;
      g.strokeStyle = '#262626';
      g.beginPath(); g.moveTo(x, 6); g.lineTo(x, 6 + ph); g.stroke();
      if (m % 2 === 0) {
        const t = m ? `-${m}m` : 'now', tw = g.measureText(t).width;
        g.fillText(t, Math.min(Math.max(x - tw / 2, L), L + pw - tw), h - 3);
      }
    }
    sensors.forEach((n, i) => {
      const s = series[n], col = CHART_COLORS[i % CHART_COLORS.length];
      const line = (arr: (number | null)[], dash: number[]) => {
        g.setLineDash(dash);
        g.strokeStyle = col;
        g.lineWidth = dash.length ? 1 : 1.6;
        g.beginPath();
        let started = false;
        arr.forEach((v, j) => {
          if (v == null) { started = false; return; }
          const x = L + ((j + CHART_LEN - arr.length) / (CHART_LEN - 1)) * pw, y = 6 + ph - (v / max) * ph;
          if (started) g.lineTo(x, y); else { g.moveTo(x, y); started = true; }
        });
        g.stroke();
      };
      line(s.temps, []);
      if (hasTarget(n) && s.targets.some((v) => v > 0)) line(s.targets, [4, 4]);
    });
    g.setLineDash([]);

    // Hover: crosshair, dots and tooltip for the sample under the mouse.
    const hoverX = this.hoverX();
    if (hoverX == null) { this.tip.set(null); return; }
    const hx = Math.min(Math.max(hoverX, L), L + pw); // snap to the plot edges
    const jg = Math.round(((hx - L) / pw) * (CHART_LEN - 1)); // position on the 10-minute grid
    const x = L + (jg / (CHART_LEN - 1)) * pw;
    g.strokeStyle = '#ffffff55';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, 6); g.lineTo(x, 6 + ph); g.stroke();
    const rows: TipRow[] = [];
    sensors.forEach((n, i) => {
      const s = series[n], col = CHART_COLORS[i % CHART_COLORS.length];
      const j = jg - (CHART_LEN - s.temps.length), v = j >= 0 ? s.temps[j] : null;
      if (v == null) return;
      g.fillStyle = col;
      g.beginPath(); g.arc(x, 6 + ph - (v / max) * ph, 3, 0, Math.PI * 2); g.fill();
      const tj = jg - (CHART_LEN - s.targets.length), t = tj >= 0 ? s.targets[tj] : 0;
      rows.push({ color: col, label: sensorLabel(n), temp: v.toFixed(1) + ' °C', target: hasTarget(n) && t > 0 ? t.toFixed(0) : '' });
    });
    if (!rows.length) { this.tip.set(null); return; }
    const back = CHART_LEN - 1 - jg; // seconds before the latest sample
    const when = fmtClock(this.hist.lastSampleAt - back * 1000) + (back ? ` · ${fmtDur(back)} ago` : ' · now');
    // Tooltip about 210px wide: flip to the left of the cursor near the right edge.
    const left = x + 12 + 210 > w ? Math.max(0, x - 12 - 210) : x + 12;
    this.tip.set({ left, when, rows });
  }
}
