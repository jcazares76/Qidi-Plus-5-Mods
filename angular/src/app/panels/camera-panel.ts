import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { MoonrakerService } from '../core/moonraker.service';
import { SettingsService } from '../core/settings.service';
import { Card } from '../shared/card';

/**
 * Printer camera. Closed on every page load; the MJPEG stream only runs while the panel is open AND the
 * browser tab is visible, so the printer isn't streaming to nobody.
 */
@Component({
  selector: 'app-camera-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card],
  template: `
    <app-card cardId="camera" title="Camera" [info]="label()" [remember]="false" [startClosed]="true" (openChange)="open.set($event)">
      <svg class="ic" viewBox="0 0 24 24"><path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" /></svg>
      <div class="cam">
        @if (src(); as s) {
          <img alt="Printer camera" [src]="s" (error)="failed.set(true)" />
        } @else {
          <span class="muted">{{ failed() ? 'Camera not available' : 'Stream stopped' }}</span>
        }
      </div>
      <div class="muted" style="font-size:11px;margin-top:6px">Streams only while this panel is open and the page is visible. Collapse it to stop.</div>
    </app-card>
  `,
})
export class CameraPanel {
  private readonly mr = inject(MoonrakerService);
  private readonly settings = inject(SettingsService);

  protected readonly open = signal(false);
  private readonly visible = signal(!document.hidden);
  protected readonly failed = signal(false);
  /** Image source; set to "data:," for a moment before removal so the browser drops the stream. */
  protected readonly src = signal<string | null>(null);

  private readonly wanted = computed(() => this.open() && this.visible() && this.mr.connected() && !!this.settings.host());
  protected readonly label = computed(() => (this.failed() && this.wanted() ? 'Error' : this.src() && this.wanted() ? 'Live' : 'Off'));

  constructor() {
    const onVis = () => this.visible.set(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('visibilitychange', onVis));

    effect(() => {
      if (this.wanted()) {
        this.failed.set(false);
        this.src.set(`http://${this.settings.host()}/webcam/?action=stream&t=${Date.now()}`);
      } else if (this.src()) {
        this.src.set('data:,');
        setTimeout(() => { if (!this.wanted()) this.src.set(null); });
      }
    });
  }
}
