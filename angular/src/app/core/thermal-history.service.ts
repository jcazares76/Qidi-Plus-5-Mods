import { Injectable, inject, signal } from '@angular/core';
import { CHART_LEN, POWER_AVG_S, SENSOR_ORDER } from './constants';
import { MoonrakerService } from './moonraker.service';

export interface Series {
  temps: (number | null)[];
  targets: number[];
}

/** Keeps 10 minutes of 1-second temperature samples and 10 s of power samples per sensor. */
@Injectable({ providedIn: 'root' })
export class ThermalHistoryService {
  private readonly mr = inject(MoonrakerService);

  /** Sensor object names in display order. */
  readonly sensors = signal<string[]>([]);
  /** Bumps once a second after a new sample (for redraws and averages). */
  readonly tick = signal(0);

  readonly series: Record<string, Series> = {};
  readonly powerHist: Record<string, number[]> = {};
  lastSampleAt = Date.now();

  constructor() {
    this.mr.ready.subscribe(() => this.load());
    setInterval(() => this.sample(), 1000);
  }

  /** 10-second average power (0..1), or the current power if no samples yet. */
  avgPower(name: string): number | null {
    const o = this.mr.status()[name];
    if (!o || o.power == null) return null;
    const h = this.powerHist[name] ?? [];
    return h.length ? h.reduce((a, b) => a + b, 0) / h.length : o.power;
  }

  private async load(): Promise<void> {
    const st = this.mr.status();
    const order = (n: string) => {
      const i = SENSOR_ORDER.indexOf(n);
      return i >= 0 ? i : n.startsWith('temperature_sensor') ? 99 : 50;
    };
    const names = ((st['heaters']?.available_sensors as string[]) ?? []).filter((n) => st[n]).sort((a, b) => order(a) - order(b));
    let store: any = {};
    try {
      store = await this.mr.call('server.temperature_store', { include_monitors: false });
    } catch { /* no history */ }
    for (const k of Object.keys(this.series)) delete this.series[k];
    for (const n of names) {
      const h = store[n] ?? {};
      this.series[n] = { temps: (h.temperatures ?? []).slice(-CHART_LEN), targets: (h.targets ?? []).slice(-CHART_LEN) };
    }
    this.lastSampleAt = Date.now();
    this.sensors.set(names);
    this.tick.update((t) => t + 1);
  }

  private sample(): void {
    if (this.mr.klippyState() !== 'ready') return;
    const st = this.mr.status();
    for (const n of this.sensors()) {
      const s = this.series[n];
      if (!s) continue;
      const o = st[n] ?? {};
      s.temps.push(o.temperature ?? null);
      s.targets.push(o.target ?? 0);
      if (s.temps.length > CHART_LEN) s.temps.shift();
      if (s.targets.length > CHART_LEN) s.targets.shift();
      if (o.power != null) {
        const h = (this.powerHist[n] ??= []);
        h.push(o.power);
        if (h.length > POWER_AVG_S) h.shift();
      }
    }
    this.lastSampleAt = Date.now();
    this.tick.update((t) => t + 1);
  }
}
