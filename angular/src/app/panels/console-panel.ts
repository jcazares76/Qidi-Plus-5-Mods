import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { AUTO_MSG } from '../core/constants';
import { fmtClock } from '../core/format';
import { GcodeLine, MoonrakerService } from '../core/moonraker.service';
import { Card } from '../shared/card';

interface LogLine { n: number; time: string; cls: string; text: string; auto: boolean }

const LOG_MAX = 500;

/** G-code console: recent history, live replies, ↑/↓ history, automatic chatter hidden by default. */
@Component({
  selector: 'app-console-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card],
  template: `
    <app-card cardId="console" title="Console" (openChange)="$event && scrollDown()">
      <svg class="ic" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M6 9l3 3-3 3M12 15h5" /></svg>
      <div class="log" #log>
        @for (l of lines(); track l.n) {
          @if (!(l.auto && hideAuto())) {
            <div [class]="l.cls"><span class="t">{{ l.time }}</span>{{ l.text }}</div>
          }
        }
      </div>
      <div class="cin">
        <input #cmd type="text" placeholder="Send G-code (Enter). ↑/↓ for history" spellcheck="false" autocomplete="off"
               (keydown)="onKey($event, cmd)" />
        <button class="btn primary" (click)="send(cmd)">Send</button>
      </div>
      <label class="row muted" style="font-size:12px;margin-top:8px">
        <input type="checkbox" [checked]="hideAuto()" (change)="hideAuto.set($any($event.target).checked); scrollDown()" />
        Hide automatic status messages (lights, screen, LEDs)
      </label>
    </app-card>
  `,
})
export class ConsolePanel {
  private readonly mr = inject(MoonrakerService);
  private readonly logEl = viewChild.required<ElementRef<HTMLDivElement>>('log');

  protected readonly lines = signal<LogLine[]>([]);
  protected readonly hideAuto = signal(true);
  private counter = 0;
  private readonly history: string[] = [];
  private histPos = -1;

  constructor() {
    this.mr.opened.subscribe(() => this.load());
    this.mr.gcodeLines.subscribe((l) => this.add([l], false));
  }

  private async load(): Promise<void> {
    try {
      const r = await this.mr.call('server.gcode_store', { count: 150 });
      this.lines.set([]);
      this.add(r.gcode_store as GcodeLine[], true);
    } catch { /* not ready */ }
  }

  private add(entries: GcodeLine[], forceScroll: boolean): void {
    const el = this.logEl().nativeElement;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;
    const add = entries.map((e) => {
      const text = String(e.message).split('\n').map((l) => l.replace(/^\/\/ ?/, '')).join('\n');
      return {
        n: ++this.counter,
        time: fmtClock((e.time || Date.now() / 1000) * 1000),
        cls: e.type === 'command' ? 'cmd' : /^!!/.test(e.message) ? 'err' : 'info',
        text: e.type === 'command' ? '> ' + text : text,
        auto: AUTO_MSG.test(e.message),
      };
    });
    this.lines.update((ls) => [...ls, ...add].slice(-LOG_MAX));
    if (forceScroll || atBottom) this.scrollDown();
  }

  protected scrollDown(): void {
    setTimeout(() => { const el = this.logEl().nativeElement; el.scrollTop = el.scrollHeight; });
  }

  protected async send(input: HTMLInputElement): Promise<void> {
    const c = input.value.trim();
    if (!c) return;
    this.history.unshift(c);
    if (this.history.length > 50) this.history.pop();
    this.histPos = -1;
    input.value = '';
    this.add([{ message: c, type: 'command', time: Date.now() / 1000 }], true);
    try {
      await this.mr.gcode(c);
    } catch (e: any) {
      // Klipper errors also arrive as "!!" console lines; only show other failures here.
      if (!/CommandError|Error evaluating/.test(e.message)) this.add([{ message: '!! ' + e.message, type: 'response', time: Date.now() / 1000 }], true);
    }
  }

  protected onKey(e: KeyboardEvent, input: HTMLInputElement): void {
    if (e.key === 'Enter') this.send(input);
    else if (e.key === 'ArrowUp' && this.history.length) {
      this.histPos = Math.min(this.histPos + 1, this.history.length - 1);
      input.value = this.history[this.histPos];
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      this.histPos = Math.max(this.histPos - 1, -1);
      input.value = this.histPos < 0 ? '' : this.history[this.histPos];
      e.preventDefault();
    }
  }
}
