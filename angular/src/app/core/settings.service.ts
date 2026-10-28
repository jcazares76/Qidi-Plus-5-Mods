import { Injectable, signal } from '@angular/core';

/** Per-browser settings kept in localStorage (same keys as the original page, so they're shared). */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  /** Printer address. Empty until the user enters it (or opens the page with ?printer=<address>). */
  readonly host = signal(this.initialHost());

  private closed: Record<string, boolean> = this.read('closedCards', {});

  setHost(value: string): void {
    const h = value.trim();
    this.write('qidiHost', h);
    this.host.set(h);
  }

  isClosed(card: string): boolean {
    return !!this.closed[card];
  }

  setClosed(card: string, closed: boolean): void {
    this.closed = { ...this.closed, [card]: closed };
    this.write('closedCards', this.closed);
  }

  private initialHost(): string {
    const fromUrl = new URLSearchParams(location.search).get('printer');
    if (fromUrl) {
      this.write('qidiHost', fromUrl.trim());
      return fromUrl.trim();
    }
    return this.read<string>('qidiHost', '');
  }

  private read<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      if (v == null) return fallback;
      return typeof fallback === 'string' ? (v as T) : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  }

  private write(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch {
      /* storage blocked: settings just won't persist */
    }
  }
}
