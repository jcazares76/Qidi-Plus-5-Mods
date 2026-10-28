import { Injectable, computed, inject, signal } from '@angular/core';
import { BUSY_STATES } from './constants';
import { boxSlotList } from './box';
import { MoonrakerService } from './moonraker.service';

export type FilamentOp = 'unload' | 'eject';

/**
 * Box filament moves (QIDI multi_color_controller):
 *   UNLOAD_FILAMENT_CONTROL SLOT=<i>  pull filament out of the toolhead and park it in the tube, ready to reload
 *   EJECT_FILAMENT_CONTROL SLOT=<i>   pull filament fully out of the box feeder
 * SLOT is the 0-based box slot index (box_stepper slot<i>). QIDI's code doesn't validate it: a slot without a
 * box_stepper (e.g. 99, or 16 = external) raises an internal error and shuts Klipper down. Only real box slots
 * are ever sent from here.
 */
@Injectable({ providedIn: 'root' })
export class FilamentOpsService {
  private readonly mr = inject(MoonrakerService);

  /** The move currently running (only one at a time). */
  readonly running = signal<{ op: FilamentOp; idx: number } | null>(null);

  readonly blockedReason = computed((): string | null => {
    if (this.mr.klippyState() !== 'ready') return 'Printer not ready.';
    if (BUSY_STATES.includes(this.mr.printState())) return 'Not available while printing.';
    if (this.running()) return 'Another filament move is running.';
    return null;
  });

  async run(op: FilamentOp, idx: number): Promise<void> {
    if (this.blockedReason()) throw new Error(this.blockedReason()!);
    // Never send a slot that has no box stepper (see above).
    const valid = boxSlotList(this.mr.status()).some((s) => s.idx === idx) && this.mr.status()[`box_stepper slot${idx}`];
    if (!valid || !Number.isInteger(idx) || idx < 0 || idx > 15) throw new Error('Not a box slot.');
    const cmd = op === 'unload' ? 'UNLOAD_FILAMENT_CONTROL' : 'EJECT_FILAMENT_CONTROL';
    this.running.set({ op, idx });
    try {
      await this.mr.gcode(`${cmd} SLOT=${idx}`);
    } finally {
      this.running.set(null);
    }
  }
}
