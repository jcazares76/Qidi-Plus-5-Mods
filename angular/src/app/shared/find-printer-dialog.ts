import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { SettingsService } from '../core/settings.service';

interface Found { ip: string; name: string; state: string }

/** Networks to try when the launcher can't tell us (e.g. during `ng serve`). */
const FALLBACK_NETWORKS = ['192.168.1', '192.168.0', '10.0.0', '10.0.1', '192.168.2'];
const TIMEOUT_MS = 1500;
const PARALLEL = 48;

/**
 * "Find my printer": scans this PC's local network(s) for Moonraker (port 7125) and lists what it finds.
 * The launcher (serve.ps1) reports the PC's networks at /local-networks; nothing leaves the local network.
 */
@Component({
  selector: 'app-find-printer-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg (close)="stop()">
      <header>Find my printer</header>
      <div class="dbody">
        @if (scanning()) {
          <div>Searching {{ network() }}.x … {{ checked() }} / {{ total() }}</div>
          <div class="bar"><div [style.width.%]="total() ? checked() / total() * 100 : 0"></div></div>
        } @else if (!found().length) {
          <div class="muted">{{ done() ? 'No printers found. Make sure the printer is on and on the same network as this PC, or type its IP address in the Printer box (shown on the printer’s touchscreen under network settings).' : '' }}</div>
        }
        @for (p of found(); track p.ip) {
          <div class="row found">
            <div style="flex:1;min-width:0">
              <div><b>{{ p.name || 'Klipper printer' }}</b></div>
              <div class="muted" style="font-size:12px">{{ p.ip }} · Klipper {{ p.state }}</div>
            </div>
            <button class="btn primary" (click)="use(p)">Connect</button>
          </div>
        }
      </div>
      <footer>
        @if (!scanning()) { <button class="btn" (click)="start()">Search again</button> }
        <button class="btn" (click)="close()">Close</button>
      </footer>
    </dialog>
  `,
  styles: `.found { padding: 8px 0; border-bottom: 1px solid var(--line); } .found:last-child { border-bottom: 0; }`,
})
export class FindPrinterDialog {
  private readonly settings = inject(SettingsService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly scanning = signal(false);
  protected readonly done = signal(false);
  protected readonly network = signal('');
  protected readonly checked = signal(0);
  protected readonly total = signal(0);
  protected readonly found = signal<Found[]>([]);
  private runId = 0;

  open(): void {
    this.dlg().nativeElement.showModal();
    this.start();
  }

  protected close(): void {
    this.dlg().nativeElement.close();
  }

  protected stop(): void {
    this.runId++;
    this.scanning.set(false);
  }

  protected use(p: Found): void {
    this.settings.setHost(p.ip);
    this.close();
  }

  protected async start(): Promise<void> {
    const run = ++this.runId;
    this.found.set([]);
    this.done.set(false);
    this.scanning.set(true);
    const nets = await this.networks();
    for (const net of nets) {
      if (run !== this.runId) return;
      await this.scanNetwork(net, run);
      if (this.found().length) break; // found something on the PC's main network: no need to go on
    }
    if (run === this.runId) {
      this.scanning.set(false);
      this.done.set(true);
    }
  }

  private async networks(): Promise<string[]> {
    let nets: string[] = [];
    try {
      const r = await fetch('local-networks', { cache: 'no-store' });
      if (r.ok) nets = await r.json();
    } catch { /* not served by the launcher */ }
    if (!nets.length) nets = FALLBACK_NETWORKS;
    // Try the network of the address already entered first.
    const cur = this.settings.host().match(/^(\d+\.\d+\.\d+)\.\d+$/)?.[1];
    if (cur) nets = [cur, ...nets.filter((n) => n !== cur)];
    return nets;
  }

  private async scanNetwork(net: string, run: number): Promise<void> {
    this.network.set(net);
    this.checked.set(0);
    this.total.set(254);
    const hosts = Array.from({ length: 254 }, (_, i) => `${net}.${i + 1}`);
    let next = 0;
    const worker = async () => {
      while (next < hosts.length && run === this.runId) {
        const ip = hosts[next++];
        const hit = await this.probe(ip);
        if (run !== this.runId) return;
        if (hit) this.found.update((f) => [...f, hit].sort((a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true })));
        this.checked.update((c) => c + 1);
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
  }

  /** Moonraker answers /printer/info with Klipper's state and the host name. */
  private async probe(ip: string): Promise<Found | null> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(`http://${ip}:7125/printer/info`, { signal: ctrl.signal, cache: 'no-store' });
      if (!r.ok) return null;
      const j = await r.json();
      return j?.result ? { ip, name: j.result.hostname ?? '', state: j.result.state ?? '?' } : null;
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  }
}
