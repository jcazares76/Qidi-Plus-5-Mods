import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { SettingsService } from '../core/settings.service';

/**
 * Collapsible panel. The open/closed state is remembered per card, unless `remember` is false
 * (the camera always starts closed). Project an <svg class="ic"> for the icon and the body as content.
 */
@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" [class.closed]="closed()">
      <header (click)="toggle()">
        <ng-content select="svg" />
        <h2>{{ title() }}</h2>
        @if (info()) {
          <span class="hinfo">{{ info() }}</span>
        }
        <button class="tog" type="button" [attr.title]="closed() ? 'Expand' : 'Collapse'"
                [attr.aria-expanded]="!closed()" (click)="$event.stopPropagation(); toggle()">
          <svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6" /></svg>
        </button>
      </header>
      <div class="body"><ng-content /></div>
    </section>
  `,
})
export class Card implements OnInit {
  private readonly settings = inject(SettingsService);

  readonly cardId = input.required<string>();
  readonly title = input.required<string>();
  readonly info = input<string>('');
  readonly startClosed = input(false);
  readonly remember = input(true);
  readonly openChange = output<boolean>();

  readonly closed = signal(false);

  ngOnInit(): void {
    this.closed.set(this.remember() ? this.settings.isClosed(this.cardId()) : this.startClosed());
    this.openChange.emit(!this.closed());
  }

  toggle(): void {
    this.closed.update((c) => !c);
    if (this.remember()) this.settings.setClosed(this.cardId(), this.closed());
    this.openChange.emit(!this.closed());
  }
}
