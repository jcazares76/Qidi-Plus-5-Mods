import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { boxSlotList, filamentName, loadedIdx, toolheadHasFilament } from '../core/box';
import { hexOf, slotLabel } from '../core/format';
import { MoonrakerService } from '../core/moonraker.service';
import { Card } from '../shared/card';
import { DryerControl } from './dryer-control';
import { SlotCard, SlotView } from './slot-card';

/** QIDI Box: temperature, humidity, what's in the toolhead, and the slot editor. */
@Component({
  selector: 'app-box-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card, SlotCard, DryerControl],
  template: `
    <app-card cardId="box" title="Control Box" [info]="headInfo()">
      <svg class="ic" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="13" rx="2" /><circle cx="7" cy="12.5" r="2.5" /><circle cx="17" cy="12.5" r="2.5" /><path d="M12 6v13" /></svg>
      @if (box(); as b) {
        <div class="boxinfo">
          <span>In toolhead:
            @if (loaded(); as l) {
              <b>{{ l.where }}</b>
              @if (l.hex) { <span class="swatch" [style.background]="'#' + l.hex" style="margin:0 4px 0 6px"></span> } @else { &nbsp; }
              {{ l.name }}
            } @else {
              <b>nothing</b>@if (noFilament()) { (no filament at the toolhead) }
            }
          </span>
          <span>Box 1: <b>{{ b.aht20_temp != null ? b.aht20_temp.toFixed(1) : '–' }} °C</b></span>
          <span>Humidity <b>{{ b.aht20_humidity ?? '–' }}%</b></span>
          <span>{{ b.dry_state ? 'Drying · target ' + b.box_target_temp + ' °C' : 'Not drying' }}</span>
          <span>Box @if (enabled()) { <b>enabled</b> } @else { <b>disabled</b> (prints use the external spool) }</span>
        </div>
      }
      <div class="grid">
        @for (s of slots(); track s.key) {
          <app-slot-card [view]="s" />
        }
      </div>
      @if (box()) { <app-dryer-control [boxNo]="1" /> }
      <p class="muted" style="font-size:12px;margin:12px 0 0">Slot changes are saved with the <code>SET_SLOT_FILAMENT</code> macro (same data the touchscreen uses). Editing is paused while printing.</p>
    </app-card>
  `,
})
export class BoxPanel {
  private readonly mr = inject(MoonrakerService);

  protected readonly box = computed<any>(() => this.mr.status()['box_extras']?.boxes?.[0] ?? null);
  protected readonly enabled = computed(() => this.mr.saveVars().enable_box === 1);
  private readonly li = computed(() => loadedIdx(this.mr.status()));
  protected readonly noFilament = computed(() => toolheadHasFilament(this.mr.status()) === false);

  protected readonly loaded = computed(() => {
    const li = this.li(), sv = this.mr.saveVars();
    if (li == null) return null;
    const raw = sv['filament_slot' + li], id = typeof raw === 'string' ? raw : '';
    return { where: li === 16 ? 'External spool' : slotLabel(li), hex: hexOf(sv['color_slot' + li]), name: id ? filamentName(id) : 'type not set' };
  });

  protected readonly headInfo = computed(() => {
    const b = this.box();
    if (!b) return '';
    const li = this.li();
    const l = li == null ? (this.noFilament() ? ' · Nothing loaded' : '') : li === 16 ? ' · External loaded' : ` · ${slotLabel(li)} loaded`;
    return `${b.aht20_humidity ?? '–'}% RH${b.dry_state ? ' · Drying' : ''}${l}`;
  });

  protected readonly slots = computed<SlotView[]>(() => {
    const st = this.mr.status(), sv = this.mr.saveVars(), li = this.li();
    const out: SlotView[] = boxSlotList(st).map((x) => ({
      key: String(x.slot), id: x.id, hex: x.hex, label: x.name, temps: x.temps, rfid: x.rfid, present: x.present, loaded: li === x.idx,
    }));
    if (st['save_variables']) {
      out.push({
        key: 'EXT', id: typeof sv.filament_slot16 === 'string' ? sv.filament_slot16 : '', hex: hexOf(sv.color_slot16),
        label: '', temps: '', rfid: false, present: null, loaded: li === 16,
      });
    }
    return out;
  });
}
