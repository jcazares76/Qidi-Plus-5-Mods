/** "['FAFAFA']" style saved value → "FAFAFA" (or "" when unset). */
export const hexOf = (arr: unknown): string =>
  Array.isArray(arr) && arr[0] ? String(arr[0]).replace('#', '').toUpperCase() : '';

export const validHex = (h: string): boolean => /^[0-9A-F]{6}$/.test(h);

/** "fan_generic cooling_fan" → "Cooling fan". */
export function pretty(name: string): string {
  const n = (name.split(' ').pop() ?? name).replace(/_/g, ' ');
  return n.charAt(0).toUpperCase() + n.slice(1);
}

export function fmtDur(s: number | null | undefined): string {
  if (s == null || !isFinite(s) || s < 0) return '–';
  s = Math.round(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : m ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

export const fmtSize = (b: number): string => (b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1e3) + ' KB');

export const fmtDate = (t: number): string =>
  new Date(t * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const fmtClock = (ms: number): string =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** "PLA-CF" / "PLA Basic" → "PLA" for loose type matching. */
export const bigType = (t: unknown): string => String(t || '').split(/[ \-/+]+/)[0].toUpperCase();

export function colorDist(a: string, b: string): number {
  const p = (h: string) => [0, 2, 4].map((i) => parseInt(String(h).replace('#', '').slice(i, i + 2), 16) || 0);
  const x = p(a), y = p(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

export const stripGcodeExt = (f: string): string => f.replace(/\.gcode(\.3mf)?$/i, '');

/** Label for a slot index: 0 → "1A", 5 → "2B", 16 → "External". */
export const slotLabel = (idx: number): string =>
  idx === 16 ? 'External' : `${Math.floor(idx / 4) + 1}${String.fromCharCode(65 + (idx % 4))}`;
