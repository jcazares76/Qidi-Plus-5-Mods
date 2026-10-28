import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { BUSY_STATES, NAMES, PRESETS } from '../core/constants';
import { loadedIdx, macroFilamentIds } from '../core/box';
import { validHex } from '../core/format';
import { FilamentOp, FilamentOpsService } from '../core/filament-ops.service';
import { MoonrakerService } from '../core/moonraker.service';

export interface SlotView {
  key: string; // "1".."16" or "EXT" (the SLOT= value for SET_SLOT_FILAMENT)
  id: string;
  hex: string;
  label: string; // vendor + name from box_extras, if known
  temps: string;
  rfid: boolean;
  present: boolean | null; // spool sensor; null = no sensor (external)
  loaded: boolean; // feeding the toolhead
}

/** One box slot (or the external spool): shows what's in it and edits filament/color via SET_SLOT_FILAMENT. */
@Component({
  selector: 'app-slot-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let v = view();
    <div class="slot" [class.dirty]="dirty()" [class.empty]="v.present === false" [class.loaded]="v.loaded">
      <div class="top">
        <div class="spool" [style.background]="spoolBg()"></div>
        <div>
          <div class="slotno">{{ v.key === 'EXT' ? 'External spool' : 'Slot ' + v.key }}
            @if (badge().text) { <span class="badge" [class]="'badge ' + badge().cls">{{ badge().text }}</span> }
          </div>
          <div class="name">{{ v.present === false ? 'Empty' : filName() }}</div>
          <div class="meta">{{ meta() }}</div>
        </div>
      </div>
      <label class="f">Filament
        <select [value]="fil()" (change)="fil.set($any($event.target).value)">
          @if (!v.id) { <option value="" disabled>— not set —</option> }
          @for (grp of groups(); track grp.brand) {
            <optgroup [label]="grp.brand">
              @for (o of grp.items; track o.id) {
                <option [value]="o.id" [selected]="o.id === fil()">{{ o.name }}</option>
              }
            </optgroup>
          }
        </select>
      </label>
      <div style="display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--muted)">Color
        <div class="colorrow">
          <input type="color" [value]="'#' + (validHexNow() ? hex() : '888888')"
                 (input)="hex.set($any($event.target).value.slice(1).toUpperCase())" />
          <input type="text" maxlength="7" spellcheck="false" [value]="hex()"
                 (input)="hex.set($any($event.target).value.replace('#', '').toUpperCase())" />
        </div>
        <div class="presets">
          @for (p of presets; track p) {
            <button type="button" [title]="'#' + p" [style.background]="'#' + p" (click)="hex.set(p)"></button>
          }
        </div>
      </div>
      <div class="actions">
        <button class="btn primary" [disabled]="!canSave()" (click)="save()">Save</button>
        <button class="btn" [disabled]="!dirty()" (click)="reset()">Reset</button>
      </div>
      @if (moves(); as mvs) {
        <div class="actions">
          @for (mv of mvs; track mv.op) {
            <button class="btn" style="flex:1;padding:7px 6px" [disabled]="!!mv.disabled" [title]="mv.disabled || mv.tip" (click)="runMove(mv.op)">
              {{ ops.running()?.idx === slotIdx() && ops.running()?.op === mv.op ? mv.busyLabel : mv.label }}
            </button>
          }
        </div>
        @if (hint()) { <div class="muted" style="font-size:11px">{{ hint() }}</div> }
      }
      <div class="msg" [class]="'msg ' + msg().cls">{{ msg().text }}</div>
    </div>
  `,
})
export class SlotCard {
  private readonly mr = inject(MoonrakerService);
  readonly view = input.required<SlotView>();
  protected readonly presets = PRESETS;

  // Edited values. They follow the printer until the user changes something.
  protected readonly fil = signal('');
  protected readonly hex = signal('');
  protected readonly msg = signal({ text: '', cls: '' });

  protected readonly dirty = computed(() => this.fil() !== this.view().id || this.hex() !== this.view().hex);
  protected readonly validHexNow = computed(() => validHex(this.hex()));
  protected readonly filName = computed(() => {
    const v = this.view();
    return v.id ? v.label || NAMES[v.id] || v.id : 'Not set';
  });
  protected readonly spoolBg = computed(() => this.validHexNow()
    ? '#' + this.hex()
    : 'repeating-linear-gradient(45deg,#8883,#8883 6px,transparent 6px,transparent 12px)');
  protected readonly badge = computed(() => {
    const v = this.view();
    if (v.loaded) return { text: 'In toolhead', cls: 'load' };
    if (v.present === true) return { text: 'Spool in', cls: 'in' };
    if (v.present === false) return { text: 'Empty', cls: '' };
    return { text: '', cls: '' };
  });
  protected readonly meta = computed(() => {
    const v = this.view();
    if (v.present === false) return v.id ? `No spool detected · last set: ${this.filName()}` : 'No spool detected';
    return [v.id, v.temps, v.rfid ? 'from RFID tag' : ''].filter(Boolean).join(' · ');
  });
  protected readonly groups = computed(() => {
    const ids = [...new Set([...macroFilamentIds(this.mr.status()), this.view().id].filter(Boolean))];
    const by: Record<string, { id: string; name: string }[]> = {};
    for (const id of ids) {
      const name = NAMES[id] || id;
      const brand = name.startsWith('QIDI ') ? 'QIDI' : name.startsWith('Generic ') ? 'Generic' : 'Other brands';
      (by[brand] ??= []).push({ id, name: name.replace(/^(QIDI|Generic) /, '') });
    }
    return ['QIDI', 'Generic', 'Other brands'].filter((b) => by[b])
      .map((brand) => ({ brand, items: by[brand].sort((a, b) => a.name.localeCompare(b.name)) }));
  });
  protected readonly canSave = computed(() =>
    !this.mr.isBusy() && macroFilamentIds(this.mr.status()).length > 0 && this.dirty() && !!this.fil() && this.validHexNow());

  protected readonly ops = inject(FilamentOpsService);
  /** 0-based box slot index, or null for the external spool (no box motor: never send a move for it). */
  protected readonly slotIdx = computed(() => (this.view().key === 'EXT' ? null : Number(this.view().key) - 1));
  /** Slot currently in the toolhead (any slot), or null when nothing is loaded. */
  private readonly loadedNow = computed(() => loadedIdx(this.mr.status()));

  /**
   * Load / Unload / Eject for box slots, always shown, disabled with a reason when they don't apply
   * (same rules as QIDI's own panel). None for the external spool – it has no box motor.
   */
  protected readonly moves = computed(() => {
    const v = this.view(), idx = this.slotIdx(), cur = this.loadedNow(), blocked = this.ops.blockedReason();
    if (idx == null) return null;
    const otherLoaded = cur != null && cur !== idx;
    const curName = cur === 16 ? 'the external spool' : cur != null ? `slot ${cur + 1}` : '';
    const reason = (own: string | null) => blocked || own;
    return [
      {
        op: 'load' as FilamentOp, label: 'Load', busyLabel: 'Loading…',
        tip: 'Feed the filament from this slot to the toolhead',
        disabled: reason(v.loaded ? 'Already in the toolhead.'
          : !v.present ? 'No filament in this slot.'
          : otherLoaded ? `Unload ${curName} first.` : null),
      },
      {
        op: 'unload' as FilamentOp, label: 'Unload', busyLabel: 'Unloading…',
        tip: 'Pull the filament out of the toolhead and park it in the tube, ready to load again',
        disabled: reason(v.loaded ? null : 'Not in the toolhead.'),
      },
      {
        op: 'eject' as FilamentOp, label: 'Eject', busyLabel: 'Ejecting…',
        tip: 'Pull the filament fully out of the box feeder so the spool can be removed',
        disabled: reason(v.loaded ? 'In the toolhead – unload it first.' : !v.present ? 'No filament in this slot.' : null),
      },
    ];
  });

  /** One-line explanation under the buttons (hover a greyed button for its reason). */
  protected readonly hint = computed(() => {
    const ms = this.moves();
    if (!ms || this.ops.running()) return '';
    const b = this.ops.blockedReason();
    if (b) return b;
    return ms.every((m) => m.disabled) ? (ms[0].disabled ?? '') : '';
  });

  private lastSynced = '';

  protected async runMove(op: FilamentOp): Promise<void> {
    const idx = this.slotIdx();
    if (idx == null) return;
    const v = this.view(), what = `slot ${v.key} (${this.filName()})`;
    const texts: Record<FilamentOp, string> = {
      load: `Load ${what}?\n\nThe printer heats the nozzle to about 280 °C (even for PLA), feeds the filament from the box to the toolhead and purges. Takes about 2 minutes.`,
      unload: `Unload ${what}?\n\nThe filament is pulled out of the toolhead and parked in the tube, ready to load again.`,
      eject: `Eject ${what}?\n\nThe filament is pulled all the way out of the box feeder so you can remove the spool.`,
    };
    const doing: Record<FilamentOp, [string, string]> = {
      load: ['Loading…', 'Loaded.'], unload: ['Unloading…', 'Unloaded.'], eject: ['Ejecting…', 'Ejected.'],
    };
    if (!confirm(texts[op] + '\n\nThe printer homes and moves the toolhead first, so keep the bed area clear.')) return;
    this.msg.set({ text: doing[op][0], cls: '' });
    try {
      await this.ops.run(op, idx);
      this.msg.set({ text: doing[op][1], cls: 'ok' });
      setTimeout(() => { if (this.msg().cls === 'ok') this.msg.set({ text: '', cls: '' }); }, 5000);
    } catch (e: any) {
      this.msg.set({ text: String(e?.message || e).replace(/^.*CommandError:\s*/, ''), cls: 'err' });
    }
  }

  constructor() {
    // Take new printer values unless there are unsaved edits.
    effect(() => {
      const v = this.view();
      const key = v.id + '|' + v.hex;
      untracked(() => {
        const wasClean = this.fil() + '|' + this.hex() === this.lastSynced || this.lastSynced === '';
        if (wasClean) {
          this.fil.set(v.id);
          this.hex.set(v.hex);
        }
        this.lastSynced = key;
      });
    });
  }

  protected reset(): void {
    this.fil.set(this.view().id);
    this.hex.set(this.view().hex);
    this.msg.set({ text: '', cls: '' });
  }

  protected async save(): Promise<void> {
    if (this.mr.isBusy()) return;
    this.msg.set({ text: 'Saving…', cls: '' });
    try {
      // Re-check right before writing, in case a print just started.
      const st = await this.mr.call('printer.objects.query', { objects: { print_stats: ['state'] } });
      if (BUSY_STATES.includes(st.status.print_stats.state)) throw new Error('A print is running; not saved.');
      await this.mr.gcode(`SET_SLOT_FILAMENT SLOT=${this.view().key} FILAMENT=${this.fil()} COLOR=${this.hex()}`);
      this.lastSynced = this.fil() + '|' + this.hex();
      this.msg.set({ text: 'Saved.', cls: 'ok' });
      setTimeout(() => { if (this.msg().text === 'Saved.') this.msg.set({ text: '', cls: '' }); }, 4000);
    } catch (e: any) {
      this.msg.set({ text: String(e?.message || e).replace(/^.*CommandError:\s*/, ''), cls: 'err' });
    }
  }
}
