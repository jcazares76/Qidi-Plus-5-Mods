import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { BUSY_STATES } from '../core/constants';
import { boxSlotList, loadedIdx } from '../core/box';
import { MoonrakerService } from '../core/moonraker.service';

/** QIDI Box spec maximum drying temperature. */
const MAX_TEMP = 65;
const MIN_TEMP = 30;
/** QIDI reports box_max_temp 0 for PLA (manual box heating disabled); treat it as this soft limit. */
const PLA_SOFT_LIMIT = 45;

/**
 * Box filament dryer: BOX_START_DRYING BOX=<n> TEMP=<°C> TIME=<hours> / BOX_STOP_DRYING BOX=<n>.
 * box_extras.boxes[b]: dry_state (1 = drying), box_target_temp, end_time (minutes left).
 */
@Component({
  selector: 'app-dryer-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dryer">
      <div class="subhead">Filament dryer</div>
      @if (drying()) {
        <div class="row">
          <span class="badge load" style="margin:0">Drying</span>
          <span>Target <b>{{ box()?.box_target_temp }} °C</b> · now {{ airTemp() }} · <b>{{ left() }}</b> left</span>
          <span class="spacer"></span>
          <button class="btn danger" [disabled]="busyCmd()" (click)="stop()">Stop drying</button>
        </div>
      } @else {
        <div class="row">
          <label class="dfield">Temperature
            <span><input type="number" [min]="minTemp" [max]="maxTemp" step="1" [value]="temp()"
                         (input)="temp.set(+$any($event.target).value)" /> °C</span>
          </label>
          <label class="dfield">Time
            <span><input type="number" min="1" max="24" step="1" [value]="hours()"
                         (input)="hours.set(+$any($event.target).value)" /> h</span>
          </label>
          <span class="spacer"></span>
          <button class="btn primary" [disabled]="!!blocked() || busyCmd()" [title]="blocked() || ''" (click)="start()">Start drying</button>
        </div>
        @if (blocked(); as b) { <div class="muted" style="font-size:12px;margin-top:6px">{{ b }}</div> }
        @for (w of warnings(); track w) { <div class="warnline" style="margin-top:6px">{{ w }}</div> }
        <div class="muted" style="font-size:11px;margin-top:6px">
          Close the box lid while drying. The trays rotate every 5 minutes; the box fans start above 35 °C.
        </div>
      }
      @if (msg()) { <div class="msg" [class]="'msg ' + msgCls()">{{ msg() }}</div> }
    </div>
  `,
  styles: `
    .dryer { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); }
    .dfield { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
    .dfield span { color: var(--text); }
    .dfield input { width: 72px; }
  `,
})
export class DryerControl {
  private readonly mr = inject(MoonrakerService);
  /** 1-based box number. */
  readonly boxNo = input(1);

  protected readonly minTemp = MIN_TEMP;
  protected readonly maxTemp = MAX_TEMP;
  protected readonly temp = signal(45);
  protected readonly hours = signal(6);
  protected readonly busyCmd = signal(false);
  protected readonly msg = signal('');
  protected readonly msgCls = signal('');

  protected readonly box = computed<any>(() => this.mr.status()['box_extras']?.boxes?.[this.boxNo() - 1] ?? null);
  protected readonly drying = computed(() => !!this.box()?.dry_state);
  /** end_time is whole minutes left. */
  protected readonly left = computed(() => {
    const m = Math.max(0, Math.round(this.box()?.end_time ?? 0));
    return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
  });
  protected readonly airTemp = computed(() => {
    const t = this.box()?.aht20_temp;
    return t != null ? t.toFixed(1) + ' °C' : '–';
  });

  /** Loaded spools in this box with their drying limit (°C). */
  private readonly limits = computed(() => {
    const bx = this.box(), b = this.boxNo() - 1;
    return boxSlotList(this.mr.status())
      .filter((x) => Math.floor(x.idx / 4) === b && x.present)
      .map((x) => {
        const max = bx?.filament_info?.[x.idx % 4]?.box_max_temp ?? 0;
        return { label: x.label, name: x.name || x.type || 'filament', limit: max > 0 ? max : PLA_SOFT_LIMIT, isPla: !(max > 0) };
      });
  });

  protected readonly blocked = computed((): string | null => {
    if (this.mr.klippyState() !== 'ready') return 'Printer not ready.';
    if (BUSY_STATES.includes(this.mr.printState())) return 'Not available while printing.';
    if (loadedIdx(this.mr.status()) != null) return 'Unload the filament from the toolhead first (QIDI requires this before drying).';
    const t = this.temp(), h = this.hours();
    if (!(t >= MIN_TEMP && t <= MAX_TEMP)) return `Temperature must be ${MIN_TEMP}–${MAX_TEMP} °C.`;
    if (!(h >= 1 && h <= 24 && Number.isInteger(h))) return 'Time must be 1–24 whole hours.';
    return null;
  });

  protected readonly warnings = computed(() =>
    this.limits().filter((l) => this.temp() > l.limit).map((l) =>
      `Slot ${l.label} (${l.name}) ${l.isPla ? 'is PLA and can soften' : `has a QIDI drying limit of ${l.limit} °C`} – ${this.temp()} °C may deform it.`));

  private defaulted = false;

  constructor() {
    // Default the temperature to the lowest limit among loaded spools, once.
    effect(() => {
      const lim = this.limits();
      if (this.defaulted || !lim.length) return;
      this.defaulted = true;
      untracked(() => this.temp.set(Math.min(...lim.map((l) => l.limit))));
    });
  }

  protected async start(): Promise<void> {
    if (this.blocked()) return;
    await this.send(`BOX_START_DRYING BOX=${this.boxNo()} TEMP=${this.temp()} TIME=${this.hours()}`, 'Drying started.');
    // The box reports problems as console messages (the command itself still "succeeds"), so confirm it's drying.
    setTimeout(() => {
      if (!this.drying() && this.msgCls() === 'ok') {
        this.msg.set("The box didn't start drying – see the Console for the printer's message.");
        this.msgCls.set('err');
      }
    }, 2500);
  }

  protected async stop(): Promise<void> {
    await this.send(`BOX_STOP_DRYING BOX=${this.boxNo()}`, 'Drying stopped.');
  }

  private async send(cmd: string, ok: string): Promise<void> {
    this.busyCmd.set(true);
    this.msg.set('');
    try {
      await this.mr.gcode(cmd);
      this.msg.set(ok);
      this.msgCls.set('ok');
      setTimeout(() => { if (this.msg() === ok) this.msg.set(''); }, 4000);
    } catch (e: any) {
      this.msg.set(String(e?.message || e).replace(/^.*CommandError:\s*/, ''));
      this.msgCls.set('err');
    } finally {
      this.busyCmd.set(false);
    }
  }
}
