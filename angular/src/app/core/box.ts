import { NAMES, TOOL_SENSOR } from './constants';
import { hexOf } from './format';

export interface BoxSlot {
  idx: number; // 0-based slot index (16 = external)
  slot: number; // 1-based slot number
  label: string; // "1A"
  id: string; // QIDI filament ID or ""
  hex: string;
  type: string;
  name: string;
  temps: string;
  rfid: boolean;
  present: boolean;
}

/** Slots of all connected boxes (used by the box panel and the print dialog). */
export function boxSlotList(st: any): BoxSlot[] {
  const out: BoxSlot[] = [];
  const bx: any[] = st['box_extras']?.boxes ?? [];
  const sv: any = st['save_variables']?.variables ?? {};
  const count = Math.max(1, parseInt(sv.box_count || 1, 10));
  for (let b = 0; b < Math.min(count, bx.length); b++) {
    for (let i = 0; i < 4; i++) {
      const idx = b * 4 + i;
      const info = (bx[b].filament_info ?? [])[i] ?? {};
      const raw = sv['filament_slot' + idx];
      const id = typeof raw === 'string' ? raw : '';
      const match = !!id && info.filament_id === id;
      out.push({
        idx, slot: idx + 1, label: `${b + 1}${String.fromCharCode(65 + i)}`, id, hex: hexOf(sv['color_slot' + idx]),
        type: match ? info.filament_type : '',
        name: match ? `${info.vendor_str || ''} ${info.filament_str || ''}`.trim() : '',
        temps: id && info.min_temp ? `${info.min_temp}–${info.max_temp} °C` : '',
        rfid: !!info.info_from_rfid,
        // Spool sensor; fall back to the saved slot flag if the sensor field is missing.
        present: 'box_inserted_' + i in bx[b] ? !!bx[b]['box_inserted_' + i] : sv['slot' + idx] !== 0,
      });
    }
  }
  return out;
}

/** true / false from the toolhead filament sensor, null when unknown. */
export function toolheadHasFilament(st: any): boolean | null {
  const fs = st[TOOL_SENSOR];
  return fs && typeof fs.filament_detected === 'boolean' ? fs.filament_detected : null;
}

/** Slot index feeding the toolhead ("slot0".."slot15", "slot16" = external), or null when nothing is loaded. */
export function loadedIdx(st: any): number | null {
  if (toolheadHasFilament(st) === false) return null;
  const m = /^slot(\d+)$/.exec(st['box_extras']?.loaded_slot || '');
  return m ? Number(m[1]) : null;
}

/** Filament IDs accepted by the printer's SET_SLOT_FILAMENT macro (empty if the macros aren't loaded). */
export function macroFilamentIds(st: any): string[] {
  const d = st['gcode_macro _BOX_SLOT_DATA'];
  return d?.filaments ? (Object.values(d.filaments) as string[]) : [];
}

export const filamentName = (id: string): string => (id ? NAMES[id] || id : 'not set');
