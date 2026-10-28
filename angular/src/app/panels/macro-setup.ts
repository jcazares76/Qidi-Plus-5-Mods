import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BUSY_STATES } from '../core/constants';
import { MacroInstallerService } from '../core/macro-installer.service';
import { MoonrakerService } from '../core/moonraker.service';

/** "Set up slot editing" / "Update" for the box_slots.cfg macros, shown in the Control Box panel when needed. */
@Component({
  selector: 'app-macro-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (show()) {
      <div class="setup" [class.warn]="inst.state() === 'missing'">
        @if (inst.state() === 'missing' && !inst.busy()) {
          <div><b>Slot editing isn't set up on this printer yet.</b></div>
          <div class="muted" style="font-size:12px;margin:4px 0 8px">
            One click installs the small macro file this dashboard uses to change a slot's filament and color.
            Your printer settings are backed up first, and put back automatically if anything goes wrong.
          </div>
        } @else if (inst.state() === 'outdated' && !inst.busy()) {
          <div><b>A newer version of the slot macros is available.</b></div>
        }
        @if (inst.progress()) { <div class="msg" style="margin:4px 0">{{ inst.progress() }}</div> }
        <div class="row">
          <button class="btn primary" [disabled]="!!blocked() || inst.busy()" [title]="blocked() || ''" (click)="run()">
            {{ inst.busy() ? 'Working…' : inst.state() === 'outdated' ? 'Update macros' : 'Set up slot editing' }}
          </button>
          @if (blocked(); as b) { <span class="muted" style="font-size:12px">{{ b }}</span> }
        </div>
      </div>
    }
  `,
  styles: `
    .setup { border: 1px solid var(--line); border-left: 4px solid var(--accent); border-radius: 6px; padding: 10px 12px; margin-bottom: 12px; }
    .setup.warn { border-left-color: var(--warn); }
  `,
})
export class MacroSetup {
  protected readonly inst = inject(MacroInstallerService);
  private readonly mr = inject(MoonrakerService);

  private readonly lastMsgVisible = signal(false);
  protected readonly show = computed(() =>
    this.inst.busy() || this.inst.state() === 'missing' || this.inst.state() === 'outdated' || this.lastMsgVisible());
  protected readonly blocked = computed((): string | null => {
    if (this.mr.klippyState() !== 'ready' && !this.inst.busy()) return 'Printer not ready.';
    if (BUSY_STATES.includes(this.mr.printState())) return 'Not while printing.';
    return null;
  });

  protected async run(): Promise<void> {
    let plan;
    try {
      plan = await this.inst.plan();
    } catch (e: any) {
      alert(String(e?.message || e));
      return;
    }
    const steps = [
      `1. Save a backup of printer.cfg as "${plan.backupName}"`,
      plan.hadMacroFile == null ? '2. Upload box_slots.cfg (new file)' : '2. Replace box_slots.cfg with the newer version',
      plan.newPrinterCfg
        ? `3. Add one line to printer.cfg after line ${plan.afterLine!.n} (${plan.afterLine!.text.trim()}):\n      ${plan.includeLine}`
        : '3. printer.cfg already loads box_slots.cfg – no change',
      '4. Restart Klipper (about 15–30 seconds)',
    ];
    const ok = confirm(`This will:\n\n${steps.join('\n')}\n\nIf Klipper doesn't come back ready, the original files are put back automatically.\n\nContinue?`);
    if (!ok) return;
    this.lastMsgVisible.set(true);
    try {
      await this.inst.install(plan);
      setTimeout(() => this.lastMsgVisible.set(false), 8000);
    } catch {
      /* the progress line explains what happened */
    }
  }
}
