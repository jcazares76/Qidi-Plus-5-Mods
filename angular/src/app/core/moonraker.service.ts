import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Subject } from 'rxjs';
import { BUSY_STATES, FAN_PREFIXES } from './constants';
import { SettingsService } from './settings.service';

export interface GcodeLine {
  message: string;
  type: 'command' | 'response';
  time: number; // seconds
}

interface Pending {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
}

/** Object types the dashboard subscribes to (besides the fixed list below). */
const SUB_TYPES = new Set([...FAN_PREFIXES, 'output_pin', 'smart_output_pin', 'filament_switch_sensor', 'box_stepper',
  'extruder', 'heater_bed', 'heater_generic', 'temperature_sensor']);
const SUB_FIXED = ['webhooks', 'print_stats', 'virtual_sdcard', 'display_status', 'idle_timeout', 'pause_resume',
  'toolhead', 'gcode_move', 'heaters', 'box_extras', 'save_variables', 'gcode_macro _BOX_SLOT_DATA'];

/**
 * Moonraker connection over its websocket (JSON-RPC). Printer objects arrive as push updates
 * and are exposed as one `status` signal (batched to at most 4 updates a second).
 */
@Injectable({ providedIn: 'root' })
export class MoonrakerService {
  private readonly settings = inject(SettingsService);

  readonly connected = signal(false);
  readonly klippyState = signal('disconnected');
  readonly klippyMessage = signal('');
  /** Live printer objects, e.g. status()['print_stats'].state. */
  readonly status = signal<any>({});

  /** Websocket opened and server info read (fires even when Klipper isn't ready). */
  readonly opened = new Subject<void>();
  /** Klipper ready and objects subscribed. */
  readonly ready = new Subject<void>();
  readonly gcodeLines = new Subject<GcodeLine>();
  readonly fileListChanged = new Subject<string | undefined>();
  readonly historyChanged = new Subject<void>();

  readonly printState = computed(() => {
    if (!this.connected()) return 'disconnected';
    if (this.klippyState() !== 'ready') return this.klippyState();
    return this.status()['print_stats']?.state || 'standby';
  });
  readonly isBusy = computed(() => BUSY_STATES.includes(this.printState()) || this.klippyState() !== 'ready');
  readonly saveVars = computed<any>(() => this.status()['save_variables']?.variables ?? {});

  private ws?: WebSocket;
  private rpcId = 0;
  private readonly pending = new Map<number, Pending>();
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private queued: any = {};
  private flushTimer?: ReturnType<typeof setTimeout>;
  private initRunning = false;

  constructor() {
    // (Re)connect whenever the printer address changes.
    effect(() => {
      const host = this.settings.host();
      untracked(() => this.connect(host));
    });
  }

  api(path: string): string {
    return `http://${this.settings.host()}:7125${path}`;
  }

  call<T = any>(method: string, params: object = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return reject(new Error('Not connected to the printer'));
      const id = ++this.rpcId;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ jsonrpc: '2.0', method, params, id }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('Timed out'));
        }
      }, 30000);
    });
  }

  gcode(script: string): Promise<string> {
    return this.call('printer.gcode.script', { script });
  }

  private connect(host: string): void {
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      try { this.ws.close(); } catch { /* already closed */ }
      this.ws = undefined;
    }
    this.connected.set(false);
    this.klippyState.set('disconnected');
    this.status.set({});
    if (!host) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(`ws://${host}:7125/websocket`);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.connected.set(true);
      this.init().catch((e) => console.warn(e));
    };
    ws.onmessage = (ev) => this.handle(JSON.parse(ev.data));
    ws.onclose = () => {
      this.connected.set(false);
      this.klippyState.set('disconnected');
      this.pending.forEach((p) => p.reject(new Error('Connection closed')));
      this.pending.clear();
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(this.settings.host()), 3000);
  }

  private handle(m: any): void {
    if (m.id && this.pending.has(m.id)) {
      const p = this.pending.get(m.id)!;
      this.pending.delete(m.id);
      if (m.error) p.reject(new Error(m.error.message || 'Error'));
      else p.resolve(m.result);
      return;
    }
    switch (m.method) {
      case 'notify_status_update':
        this.queue(m.params[0]);
        break;
      case 'notify_gcode_response':
        this.gcodeLines.next({ message: m.params[0], type: 'response', time: Date.now() / 1000 });
        break;
      case 'notify_klippy_ready':
        this.init().catch(() => {});
        break;
      case 'notify_klippy_shutdown':
        this.klippyState.set('shutdown');
        this.refreshInfo();
        break;
      case 'notify_klippy_disconnected':
        this.klippyState.set('disconnected');
        setTimeout(() => this.init().catch(() => {}), 2000);
        break;
      case 'notify_filelist_changed':
        this.fileListChanged.next(m.params?.[0]?.item?.path);
        break;
      case 'notify_history_changed':
        this.historyChanged.next();
        break;
    }
  }

  private async refreshInfo(): Promise<void> {
    try {
      const i = await this.call('printer.info');
      this.klippyState.set(i.state);
      this.klippyMessage.set(i.state_message || '');
    } catch { /* ignore */ }
  }

  private async init(): Promise<void> {
    if (this.initRunning) return;
    this.initRunning = true;
    try {
      await this.call('server.connection.identify', {
        client_name: 'QIDI Plus 5 dashboard', version: '3.0', type: 'web', url: location.href,
      }).catch(() => {});
      const info = await this.call('printer.info');
      this.klippyState.set(info.state);
      this.klippyMessage.set(info.state_message || '');
      this.opened.next();
      if (info.state !== 'ready') {
        if (info.state === 'startup') setTimeout(() => this.init().catch(() => {}), 2000);
        return;
      }
      const objs: string[] = (await this.call('printer.objects.list')).objects;
      const sub: Record<string, string[] | null> = {};
      for (const o of objs) if (SUB_FIXED.includes(o) || SUB_TYPES.has(o.split(' ')[0])) sub[o] = null;
      sub['toolhead'] = ['homed_axes', 'position'];
      const r = await this.call('printer.objects.subscribe', { objects: sub });
      this.queued = {};
      this.status.set(r.status);
      this.ready.next();
    } finally {
      this.initRunning = false;
    }
  }

  /** Merge pushed updates (one level deep) and publish them at most every 250 ms. */
  private queue(update: any): void {
    for (const k in update) {
      const v = update[k];
      this.queued[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...(this.queued[k] ?? {}), ...v } : v;
    }
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      const q = this.queued;
      this.queued = {};
      this.status.update((s) => {
        const n = { ...s };
        for (const k in q) {
          const v = q[k];
          n[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...(s[k] ?? {}), ...v } : v;
        }
        return n;
      });
    }, 250);
  }
}
